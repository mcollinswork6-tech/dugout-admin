/**
 * Firebase Firestore & Team Organization Module
 *
 * Stores Teams, Rosters, Cumulative Stats, and Games purely via Firebase Firestore:
 * - Collection 'teams':
 *     Document '{teamId}':
 *       - profile: { teamId, teamName, division, season, headCoach, opponentName }
 *       - roster:  [ { id, name, jerseyNumber, eligiblePositions }, ... ]
 *       - stats:   { totalGamesPlayed, playerStats: { ... }, recentGames: [ ... ] }
 *       - games:   { [gameId]: gameState }
 * - Document 'app_settings/teams_registry':
 *     - activeTeamId: string
 *     - teams: [ team summaries ]
 *
 * Offline-first: Transparently syncs with LocalStorage for 100% offline dugout reliability.
 */

import { authService } from './auth.js';
import { SAMPLE_TEAMS } from './sample-data.js';
import { calculatePlayerStats } from './rules.js';
import { normalizePlayer } from './state.js';
import { LEAGUE_CONFIG, getDesignatedManagerConfig, isSuperAdmin, SUPER_ADMIN_EMAILS } from './constants.js';

export { normalizePlayer };

const LOCAL_STORAGE_PREFIX = 'nnll_firestore_';
const TEAMS_COLLECTION = 'teams';
const REGISTRY_DOC_PATH = 'app_settings/teams_registry';
const INVITATIONS_DOC_PATH = 'app_settings/invitations';

class TeamStorageService {
  constructor() {
    this.firestore = null;
    this.sdk = null;
    this.listeners = new Set();
    this.syncStatus = 'idle'; // 'idle' | 'syncing' | 'synced' | 'local' | 'error'
    this.lastSyncTime = null;
    this.lastError = null;
    this.isCloudAvailable = true;
  }

  /**
   * Lazily loads Firebase Firestore modular SDK
   */
  async loadFirestoreSDK() {
    if (this.sdk) return this.sdk;
    try {
      const firestoreMod = await import('firebase/firestore');
      this.sdk = {
        getFirestore: firestoreMod.getFirestore,
        doc: firestoreMod.doc,
        getDoc: firestoreMod.getDoc,
        setDoc: firestoreMod.setDoc,
        updateDoc: firestoreMod.updateDoc,
        deleteDoc: firestoreMod.deleteDoc,
        collection: firestoreMod.collection,
        getDocs: firestoreMod.getDocs,
      };
      return this.sdk;
    } catch (err) {
      console.warn('Firebase Firestore SDK not available:', err);
      return null;
    }
  }

  /**
   * Get Firebase Firestore instance
   */
  async getDb() {
    if (this.firestore) return this.firestore;
    const sdk = await this.loadFirestoreSDK();
    if (!sdk) return null;

    try {
      await authService.init();
      if (authService.app) {
        this.firestore = sdk.getFirestore(authService.app);
        return this.firestore;
      }
    } catch (e) {
      console.warn('Firestore initialization fallback to local:', e);
    }
    return null;
  }

  /**
   * Save a document to Firestore with local cache backup
   */
  async setDocData(path, data) {
    // 1. Always write to local storage cache immediately (instant UI & offline reliability)
    try {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${path}`, JSON.stringify(data));
    } catch (e) {}

    // 2. Write to Firebase Firestore if cloud is reachable
    if (this.isCloudAvailable) {
      try {
        const db = await this.getDb();
        const sdk = this.sdk;
        if (db && sdk) {
          this.setSyncStatus('syncing');
          const docRef = sdk.doc(db, path);
          await sdk.setDoc(docRef, data, { merge: true });
          this.setSyncStatus('synced');
          this.lastSyncTime = new Date();
          this.lastError = null;
          return true;
        }
      } catch (err) {
        console.warn(`Firestore save to ${path} falling back to local cache:`, err.message || err);
        this.lastError = err.message || String(err);
        this.setSyncStatus('local');
      }
    }
    return false;
  }

  /**
   * Read a document from Firestore with fallback to local cache
   */
  async getDocData(path, defaultValue = null) {
    // 1. Try reading from Firebase Firestore
    if (this.isCloudAvailable) {
      try {
        const db = await this.getDb();
        const sdk = this.sdk;
        if (db && sdk) {
          const docRef = sdk.doc(db, path);
          const snap = await sdk.getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${path}`, JSON.stringify(data));
            this.setSyncStatus('synced');
            this.lastSyncTime = new Date();
            return data;
          }
        }
      } catch (err) {
        // If Firestore is offline or not yet initialized in console, fall through to local cache
        console.warn(`Firestore read for ${path} falling back to local cache:`, err.message || err);
        this.setSyncStatus('local');
      }
    }

    // 2. Read from local cache
    try {
      const cached = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${path}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    return defaultValue;
  }

  /* ========================================================================
     Manager Identity & League Administration Policy
     ======================================================================== */

  /**
   * Identifies the currently active manager / coach
   */
  getCurrentManager() {
    const user = authService.currentUser || (typeof authService.getSavedOfflineSession === 'function' ? authService.getSavedOfflineSession() : null);
    if (user && user.uid) {
      return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Coach',
        isOffline: !!user.isOfflineDemo
      };
    }
    return {
      uid: 'offline_coach_mcollins',
      email: 'mcollinswork6@gmail.com',
      displayName: 'Coach Collins',
      isOffline: true
    };
  }

  /**
   * Retrieves the team administered by the specified manager (default current user).
   * In Little League configuration, each manager can administer at most one team.
   */
  async getManagedTeam(managerUid = null) {
    const manager = this.getCurrentManager();
    const isSuper = isSuperAdmin(manager?.email);
    const reg = await this.getRegistry();
    const teams = reg.teams || [];

    // Super User Admin (matthew.h.collins6@gmail.com) has access to every team!
    if (isSuper) {
      const activeId = await this.getActiveTeamId();
      const activeTeam = teams.find((t) => t.teamId === activeId) || teams[0] || null;
      if (activeTeam) {
        return {
          ...activeTeam,
          isSuperAdmin: true
        };
      }
      return null;
    }

    const designated = getDesignatedManagerConfig(manager?.email);
    // If manager has an exclusive designated assignment (mcollinswork6@gmail.com -> Black Bats only)
    if (designated && designated.exclusive) {
      const match = teams.find((t) => t.teamId === designated.teamId || t.teamName.toLowerCase() === designated.teamName.toLowerCase());
      if (match) return match;
    }

    const targetUid = managerUid || manager.uid;
    return teams.find((t) => (t.adminUid && t.adminUid === targetUid) || (manager?.email && t.adminEmail === manager.email)) || null;
  }

  /**
   * Checks whether a manager is permitted to create or claim another team.
   */
  async canManagerCreateTeam(managerUid = null) {
    const manager = this.getCurrentManager();

    // Super User Admin (matthew.h.collins6@gmail.com) can create any number of teams!
    if (isSuperAdmin(manager?.email)) {
      return { allowed: true, isSuperAdmin: true };
    }

    const designated = getDesignatedManagerConfig(manager?.email);
    // If manager is configured exclusively for Black Bats
    if (designated && designated.exclusive) {
      const existingTeam = await this.getManagedTeam(manager.uid);
      return {
        allowed: false,
        reason: `League configuration: ${manager.email} is designated as the manager for the "${designated.teamName}" only. You cannot manage or create other teams.`,
        existingTeam
      };
    }

    if (!LEAGUE_CONFIG.ENFORCE_ONE_TEAM_PER_MANAGER) {
      return { allowed: true, existingTeam: null };
    }
    const targetUid = managerUid || manager.uid;
    const existingTeam = await this.getManagedTeam(targetUid);
    if (existingTeam) {
      return {
        allowed: false,
        reason: `League policy enforced: A manager can only manage one team and be the admin for one team. You are already the admin/manager of "${existingTeam.teamName}".`,
        existingTeam
      };
    }
    return { allowed: true, existingTeam: null };
  }

  /**
   * Checks whether the current manager is the administrator of the specified team.
   */
  async isTeamAdmin(teamId, managerUid = null) {
    const manager = this.getCurrentManager();

    // Super User Admin (matthew.h.collins6@gmail.com) has unrestricted admin access to EVERY team!
    if (isSuperAdmin(manager?.email)) {
      return true;
    }

    const designated = getDesignatedManagerConfig(manager?.email);

    // mcollinswork6@gmail.com can ONLY be the admin for Black Bats!
    if (designated && designated.exclusive) {
      return teamId === designated.teamId || teamId === 'team-black-bats-6589' || teamId === 'nnll-black-bats';
    }

    const targetUid = managerUid || manager?.uid;
    const team = await this.getTeam(teamId);
    if (!team) return false;
    if (team.adminUid) {
      return team.adminUid === targetUid || (manager?.email && team.adminEmail === manager.email);
    }
    
    // If manager already has a managed team, any other team (including unassigned presets) is view-only!
    const managedTeam = await this.getManagedTeam(targetUid);
    if (managedTeam && managedTeam.teamId !== teamId) {
      return false;
    }
    return true;
  }

  /**
   * Claims an unadministered or preset team as the manager's official managed team.
   */
  async claimTeamAsAdmin(teamId) {
    const manager = this.getCurrentManager();
    const designated = getDesignatedManagerConfig(manager?.email);

    if (designated && designated.exclusive) {
      if (teamId !== designated.teamId && teamId !== 'team-black-bats-6589' && teamId !== 'nnll-black-bats') {
        throw new Error(`League restriction: ${manager.email} can only manage the "${designated.teamName}". You cannot claim other teams.`);
      }
    }

    const check = await this.canManagerCreateTeam(manager.uid);
    if (!check.allowed && (!designated || teamId !== designated.teamId)) {
      throw new Error(check.reason);
    }

    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found');
    if (team.adminUid && team.adminUid !== manager.uid) {
      throw new Error(`This team is already administered by ${team.adminEmail || team.headCoach || 'another coach'}.`);
    }

    const updates = {
      adminUid: manager.uid,
      adminEmail: manager.email,
      headCoach: manager.displayName || team.headCoach || 'Coach Collins',
      updatedAt: new Date().toISOString()
    };

    await this.updateTeamProfile(teamId, updates);
    return updates;
  }

  /**
   * Relinquishes administrative ownership of a team so manager can switch teams if needed.
   */
  async relinquishTeamAdmin(teamId) {
    const manager = this.getCurrentManager();
    const designated = getDesignatedManagerConfig(manager?.email);

    if (designated && designated.exclusive) {
      throw new Error(`League policy: ${manager.email} is permanently designated as the "${designated.teamName}" manager only.`);
    }

    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found');
    if (team.adminUid && team.adminUid !== manager.uid) {
      throw new Error('Only the team administrator can relinquish ownership of this team.');
    }

    const updates = {
      adminUid: null,
      adminEmail: null,
      updatedAt: new Date().toISOString()
    };

    await this.updateTeamProfile(teamId, updates);
    return updates;
  }

  /* ========================================================================
     Team Registry Operations
     ======================================================================== */

  async getRegistry() {
    let registry = await this.getDocData(REGISTRY_DOC_PATH);
    if (!registry || !registry.teams || registry.teams.length === 0) {
      registry = await this.seedInitialRegistry();
    } else {
      registry = await this.ensureDesignatedTeams(registry);
    }
    return registry;
  }

  async saveRegistry(registry) {
    registry.updatedAt = new Date().toISOString();
    await this.setDocData(REGISTRY_DOC_PATH, registry);
    this.notify();
    return registry;
  }

  /**
   * Ensures designated teams like Black Bats exist and ownership is properly assigned.
   */
  async ensureDesignatedTeams(registry) {
    if (!registry || !registry.teams) return registry;

    const manager = this.getCurrentManager();
    const isMcollins = manager?.email?.toLowerCase() === 'mcollinswork6@gmail.com';
    let modified = false;

    // Filter out any duplicate legacy 'nnll-black-bats'
    if (registry.teams.some((t) => t.teamId === 'nnll-black-bats')) {
      registry.teams = registry.teams.filter((t) => t.teamId !== 'nnll-black-bats');
      modified = true;
    }

    let blackBatsInReg = registry.teams.find((t) => t.teamId === 'team-black-bats-6589' || t.teamName.toLowerCase() === 'black bats');

    if (!blackBatsInReg) {
      const realBlackBats = (await this.getTeam('team-black-bats-6589')) || SAMPLE_TEAMS[0];
      blackBatsInReg = {
        teamId: 'team-black-bats-6589',
        teamName: 'Black Bats',
        division: 'Minor AAA',
        season: 'Spring 2026',
        headCoach: 'Coach Collins',
        opponentName: realBlackBats?.opponentName || 'Opponent',
        playerCount: realBlackBats?.roster ? realBlackBats.roster.length : 12,
        adminUid: isMcollins ? manager.uid : null,
        adminEmail: 'mcollinswork6@gmail.com',
        createdAt: '2026-10-02T23:03:06.589Z',
        updatedAt: new Date().toISOString()
      };
      registry.teams.unshift(blackBatsInReg);
      modified = true;
    } else {
      if (blackBatsInReg.teamId !== 'team-black-bats-6589') {
        blackBatsInReg.teamId = 'team-black-bats-6589';
        modified = true;
      }
      if (blackBatsInReg.playerCount !== 12) {
        blackBatsInReg.playerCount = 12;
        modified = true;
      }
    }

    // If current user is mcollinswork6@gmail.com, bind Black Bats and unbind other teams
    if (isMcollins && blackBatsInReg) {
      if (blackBatsInReg.adminUid !== manager.uid || blackBatsInReg.adminEmail !== manager.email) {
        blackBatsInReg.adminUid = manager.uid;
        blackBatsInReg.adminEmail = manager.email;
        blackBatsInReg.headCoach = 'Coach Collins';
        blackBatsInReg.updatedAt = new Date().toISOString();
        modified = true;

        await this.setDocData(`${TEAMS_COLLECTION}/${blackBatsInReg.teamId}`, {
          adminUid: manager.uid,
          adminEmail: manager.email,
          headCoach: 'Coach Collins',
          updatedAt: blackBatsInReg.updatedAt
        });
      }

      // Ensure mcollinswork6@gmail.com is NOT the admin of any other team
      registry.teams.forEach((t) => {
        if (t.teamId !== blackBatsInReg.teamId && (t.adminUid === manager.uid || t.adminEmail === manager.email)) {
          t.adminUid = null;
          t.adminEmail = null;
          t.updatedAt = new Date().toISOString();
          modified = true;
        }
      });

      // Default active team to Black Bats
      if (registry.activeTeamId !== blackBatsInReg.teamId && (!registry.activeTeamId || registry.activeTeamId.includes('rivercats') || registry.activeTeamId === 'nnll-black-bats')) {
        registry.activeTeamId = blackBatsInReg.teamId;
        modified = true;
      }
    }

    if (modified) {
      await this.saveRegistry(registry);
    }

    return registry;
  }

  async seedInitialRegistry() {
    const manager = this.getCurrentManager();
    const isMcollins = manager.email?.toLowerCase() === 'mcollinswork6@gmail.com';

    const teams = SAMPLE_TEAMS.map((st) => {
      const isBlackBats = st.teamId === 'team-black-bats-6589' || st.teamName.toLowerCase() === 'black bats';
      return {
        teamId: st.teamId,
        teamName: st.teamName,
        division: 'Minor AAA',
        season: 'Spring 2026',
        headCoach: isBlackBats ? 'Coach Collins' : (st.headCoach || 'Coach'),
        opponentName: st.opponentName || 'Opponents',
        playerCount: st.players.length,
        adminUid: isBlackBats && isMcollins ? manager.uid : null,
        adminEmail: isBlackBats ? 'mcollinswork6@gmail.com' : null,
        createdAt: st.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    const initialRegistry = {
      updatedAt: new Date().toISOString(),
      activeTeamId: 'team-black-bats-6589',
      teams: teams
    };

    // Save registry
    await this.setDocData(REGISTRY_DOC_PATH, initialRegistry);

    // Save individual teams
    for (const st of SAMPLE_TEAMS) {
      const isBlackBats = st.teamId === 'team-black-bats-6589' || st.teamId === 'nnll-black-bats' || st.teamName?.toLowerCase().includes('black bats');
      const initialPlayerStats = {};
      st.players.forEach((p) => {
        initialPlayerStats[p.id] = {
          playerId: p.id,
          name: p.name,
          jerseyNumber: p.jerseyNumber,
          gamesPlayed: 0,
          inningsInfield: 0,
          inningsOutfield: 0,
          inningsBench: 0,
          inningsPitched: 0,
          pitchesThrown: 0,
          inningsCaught: 0,
          infieldBy4Compliant: true,
          violations: 0
        };
      });

      const teamDocument = {
        teamId: st.teamId,
        teamName: st.teamName,
        division: 'Minor AAA',
        season: 'Spring 2026',
        headCoach: isBlackBats ? 'Coach Collins' : (st.headCoach || 'Coach'),
        opponentName: st.opponentName || 'Opponents',
        playerCount: st.players.length,
        adminUid: isBlackBats && isMcollins ? manager.uid : null,
        adminEmail: isBlackBats ? 'mcollinswork6@gmail.com' : null,
        roster: st.players,
        stats: {
          totalGamesPlayed: 0,
          playerStats: initialPlayerStats,
          recentGames: []
        },
        games: {},
        updatedAt: new Date().toISOString()
      };

      await this.setDocData(`${TEAMS_COLLECTION}/${st.teamId}`, teamDocument);
    }

    return initialRegistry;
  }

  async getActiveTeamId() {
    const manager = this.getCurrentManager();
    const isMcollins = manager.email?.toLowerCase() === 'mcollinswork6@gmail.com';
    if (isMcollins) {
      return 'team-black-bats-6589';
    }
    const reg = await this.getRegistry();
    return reg.activeTeamId || (reg.teams[0] ? reg.teams[0].teamId : null);
  }

  async setActiveTeam(teamId) {
    const reg = await this.getRegistry();
    reg.activeTeamId = teamId;
    await this.saveRegistry(reg);
    return reg;
  }

  async listTeams() {
    const reg = await this.getRegistry();
    return reg.teams || [];
  }

  /* ========================================================================
     Team Profile & Roster Operations
     ======================================================================== */

  async getTeam(teamId) {
    const resolvedId = (teamId === 'nnll-black-bats') ? 'team-black-bats-6589' : teamId;
    const data = await this.getDocData(`${TEAMS_COLLECTION}/${resolvedId}`);
    if (data) {
      if (Array.isArray(data.roster)) {
        data.roster = data.roster.map(normalizePlayer);
      }
      return data;
    }

    // Check sample teams fallback
    const sample = SAMPLE_TEAMS.find((t) => t.teamId === resolvedId || (resolvedId === 'team-black-bats-6589' && (t.teamId === 'team-black-bats-6589' || t.teamName.toLowerCase() === 'black bats')));
    if (sample) {
      return {
        teamId: sample.teamId,
        teamName: sample.teamName,
        division: sample.division || 'Minor AAA',
        season: sample.season || 'Spring 2026',
        headCoach: sample.headCoach || 'Coach Collins',
        opponentName: sample.opponentName || 'Opponents',
        playerCount: sample.players.length,
        adminUid: null,
        adminEmail: sample.adminEmail || null,
        roster: sample.players.map(normalizePlayer),
        stats: { totalGamesPlayed: 0, playerStats: {}, recentGames: [] },
        games: {}
      };
    }
    return null;
  }

  async getTeamProfile(teamId) {
    const team = await this.getTeam(teamId);
    if (!team) return null;
    return {
      teamId: team.teamId,
      teamName: team.teamName,
      division: team.division || 'Minor AAA',
      season: team.season || 'Spring 2026',
      headCoach: team.headCoach || 'Coach',
      opponentName: team.opponentName || 'Opponent',
      adminUid: team.adminUid || null,
      adminEmail: team.adminEmail || null,
      playerCount: team.roster ? team.roster.length : (team.playerCount || 0)
    };
  }

  async createTeam({ teamName, division = 'Minor AAA', season = 'Spring 2026', headCoach, opponentName = 'Opponent' }) {
    const manager = this.getCurrentManager();

    // Enforce 1-team-per-manager rule
    const check = await this.canManagerCreateTeam(manager.uid);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const teamId = `team-${slug}-${Date.now().toString().slice(-4)}`;

    const newTeamDoc = {
      teamId,
      teamName,
      division,
      season,
      headCoach: headCoach || manager.displayName || 'Coach',
      opponentName,
      adminUid: manager.uid,
      adminEmail: manager.email,
      playerCount: 0,
      roster: [],
      stats: {
        totalGamesPlayed: 0,
        playerStats: {},
        recentGames: []
      },
      games: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save team document
    await this.setDocData(`${TEAMS_COLLECTION}/${teamId}`, newTeamDoc);

    // Add to registry and set as active
    const reg = await this.getRegistry();
    reg.teams.push({
      teamId,
      teamName,
      division,
      season,
      headCoach: newTeamDoc.headCoach,
      opponentName,
      adminUid: manager.uid,
      adminEmail: manager.email,
      playerCount: 0,
      createdAt: newTeamDoc.createdAt,
      updatedAt: newTeamDoc.updatedAt
    });
    reg.activeTeamId = teamId;
    await this.saveRegistry(reg);

    return newTeamDoc;
  }

  async updateTeamProfile(teamId, updates) {
    const team = (await this.getTeam(teamId)) || {};
    const updated = {
      ...team,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.setDocData(`${TEAMS_COLLECTION}/${teamId}`, updated);

    // Update in registry
    const reg = await this.getRegistry();
    const idx = reg.teams.findIndex((t) => t.teamId === teamId);
    if (idx !== -1) {
      reg.teams[idx] = { 
        ...reg.teams[idx], 
        ...updates, 
        adminUid: updated.adminUid !== undefined ? updated.adminUid : reg.teams[idx].adminUid,
        adminEmail: updated.adminEmail !== undefined ? updated.adminEmail : reg.teams[idx].adminEmail,
        updatedAt: updated.updatedAt 
      };
      await this.saveRegistry(reg);
    }

    return updated;
  }

  async deleteTeam(teamId) {
    const isAdmin = await this.isTeamAdmin(teamId);
    if (!isAdmin) {
      throw new Error(`Permission denied: You only have View Only access to other teams. You cannot delete this team.`);
    }

    const reg = await this.getRegistry();
    reg.teams = reg.teams.filter((t) => t.teamId !== teamId);
    if (reg.activeTeamId === teamId) {
      reg.activeTeamId = reg.teams[0] ? reg.teams[0].teamId : null;
    }
    await this.saveRegistry(reg);

    // Delete locally and from firestore
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${TEAMS_COLLECTION}/${teamId}`);
      const db = await this.getDb();
      if (db && this.sdk) {
        await this.sdk.deleteDoc(this.sdk.doc(db, TEAMS_COLLECTION, teamId));
      }
    } catch (e) {}

    return true;
  }

  /* ========================================================================
     Roster & Player Operations
     ======================================================================== */

  async getTeamRoster(teamId) {
    const team = await this.getTeam(teamId);
    return team && Array.isArray(team.roster) ? team.roster.map(normalizePlayer) : [];
  }

  async saveTeamRoster(teamId, players) {
    const isAdmin = await this.isTeamAdmin(teamId);
    if (!isAdmin) {
      throw new Error(`Permission denied: You only have View Only access to other teams. Roster edits cannot be saved.`);
    }

    const team = (await this.getTeam(teamId)) || { teamId, roster: [] };
    const normalized = (players || []).map(normalizePlayer);
    team.roster = normalized;
    team.playerCount = normalized.length;
    team.updatedAt = new Date().toISOString();

    await this.setDocData(`${TEAMS_COLLECTION}/${teamId}`, team);
    await this.updateTeamProfile(teamId, { playerCount: normalized.length });
    return normalized;
  }

  async addPlayerToRoster(teamId, player) {
    const isAdmin = await this.isTeamAdmin(teamId);
    if (!isAdmin) {
      throw new Error(`Permission denied: You only have View Only access to other teams. You cannot add players.`);
    }

    const team = (await this.getTeam(teamId)) || { teamId, roster: [], stats: { playerStats: {} } };
    const players = (team.roster || []).map(normalizePlayer);

    const newPlayer = normalizePlayer(player);

    players.push(newPlayer);
    team.roster = players;
    team.playerCount = players.length;

    // Initialize player stats record
    if (!team.stats) team.stats = { totalGamesPlayed: 0, playerStats: {}, recentGames: [] };
    if (!team.stats.playerStats[newPlayer.id]) {
      team.stats.playerStats[newPlayer.id] = {
        playerId: newPlayer.id,
        name: newPlayer.name,
        jerseyNumber: newPlayer.jerseyNumber,
        jersey: newPlayer.jersey,
        firstName: newPlayer.firstName,
        lastName: newPlayer.lastName,
        age: newPlayer.age,
        gamesPlayed: 0,
        inningsInfield: 0,
        inningsOutfield: 0,
        inningsBench: 0,
        inningsPitched: 0,
        pitchesThrown: 0,
        inningsCaught: 0,
        infieldBy4Compliant: true,
        violations: 0
      };
    }

    await this.setDocData(`${TEAMS_COLLECTION}/${teamId}`, team);
    await this.updateTeamProfile(teamId, { playerCount: players.length });
    return newPlayer;
  }

  async updatePlayerInRoster(teamId, playerId, updates) {
    const isAdmin = await this.isTeamAdmin(teamId);
    if (!isAdmin) {
      throw new Error(`Permission denied: You only have View Only access to other teams. You cannot edit players.`);
    }

    const team = await this.getTeam(teamId);
    if (!team || !team.roster) return null;

    const idx = team.roster.findIndex((p) => p.id === playerId);
    if (idx === -1) return null;

    const existing = normalizePlayer(team.roster[idx]);
    const merged = {
      ...existing,
      ...updates,
      eligiblePositions: {
        ...existing.eligiblePositions,
        ...(updates.eligiblePositions || {})
      }
    };
    if (updates.jersey !== undefined) {
      merged.jersey = updates.jersey;
      merged.jerseyNumber = updates.jersey;
    }
    if (updates.jerseyNumber !== undefined) {
      merged.jersey = updates.jerseyNumber;
      merged.jerseyNumber = updates.jerseyNumber;
    }
    if (updates.firstName !== undefined) merged.firstName = updates.firstName;
    if (updates.lastName !== undefined) merged.lastName = updates.lastName;
    if (updates.age !== undefined) merged.age = updates.age;
    if (updates.canPitch !== undefined) merged.canPitch = updates.canPitch;
    if (updates.canCatch !== undefined) merged.canCatch = updates.canCatch;

    const updatedPlayer = normalizePlayer(merged);

    team.roster[idx] = updatedPlayer;

    // Update stats name/jersey
    if (team.stats?.playerStats?.[playerId]) {
      team.stats.playerStats[playerId].name = updatedPlayer.name;
      team.stats.playerStats[playerId].jerseyNumber = updatedPlayer.jerseyNumber;
      team.stats.playerStats[playerId].jersey = updatedPlayer.jersey;
      team.stats.playerStats[playerId].firstName = updatedPlayer.firstName;
      team.stats.playerStats[playerId].lastName = updatedPlayer.lastName;
      if (updatedPlayer.age !== undefined) team.stats.playerStats[playerId].age = updatedPlayer.age;
    }

    await this.setDocData(`${TEAMS_COLLECTION}/${teamId}`, team);
    return updatedPlayer;
  }

  async removePlayerFromRoster(teamId, playerId) {
    const isAdmin = await this.isTeamAdmin(teamId);
    if (!isAdmin) {
      throw new Error(`Permission denied: You only have View Only access to other teams. You cannot remove players.`);
    }

    const team = await this.getTeam(teamId);
    if (!team || !team.roster) return false;

    team.roster = team.roster.filter((p) => p.id !== playerId);
    team.playerCount = team.roster.length;
    await this.setDocData(`${TEAMS_COLLECTION}/${teamId}`, team);
    await this.updateTeamProfile(teamId, { playerCount: team.roster.length });
    return true;
  }

  /* ========================================================================
     Cumulative Stats Operations
     ======================================================================== */

  async getTeamStats(teamId) {
    const team = await this.getTeam(teamId);
    return team && team.stats ? team.stats : { totalGamesPlayed: 0, playerStats: {}, recentGames: [] };
  }

  async saveTeamStats(teamId, statsData) {
    const team = (await this.getTeam(teamId)) || { teamId };
    team.stats = statsData;
    team.updatedAt = new Date().toISOString();
    await this.setDocData(`${TEAMS_COLLECTION}/${teamId}`, team);
    this.notify();
    return statsData;
  }

  /**
   * Records a finalized or active game into team cumulative season stats
   */
  async recordGameToTeam(teamId, gameState) {
    if (!teamId || !gameState) return;

    const team = (await this.getTeam(teamId)) || {
      teamId,
      roster: gameState.players || [],
      stats: { totalGamesPlayed: 0, playerStats: {}, recentGames: [] },
      games: {}
    };

    // 1. Archive game in team.games[gameId]
    if (!team.games) team.games = {};
    team.games[gameState.gameId] = gameState;

    // 2. Calculate game metrics for each player
    const gamePlayerStats = calculatePlayerStats(
      gameState.players,
      gameState.innings,
      gameState.playerPitches || {},
      gameState.pitchersRemoved || []
    );

    // 3. Merge into cumulative season stats
    if (!team.stats) team.stats = { totalGamesPlayed: 0, playerStats: {}, recentGames: [] };
    team.stats.totalGamesPlayed = (team.stats.totalGamesPlayed || 0) + 1;

    if (!team.stats.recentGames) team.stats.recentGames = [];
    const existingGameIdx = team.stats.recentGames.findIndex((g) => g.gameId === gameState.gameId);
    const gameSummary = {
      gameId: gameState.gameId,
      date: new Date().toISOString(),
      opponent: gameState.opponentName,
      isHome: gameState.isHomeTeam,
      inningsPlayed: gameState.currentInning,
      totalPitches: Object.values(gameState.playerPitches || {}).reduce((a, b) => a + b, 0)
    };

    if (existingGameIdx !== -1) {
      team.stats.recentGames[existingGameIdx] = gameSummary;
    } else {
      team.stats.recentGames.unshift(gameSummary);
      if (team.stats.recentGames.length > 20) team.stats.recentGames.pop();
    }

    // Merge player cumulative totals
    Object.values(gamePlayerStats).forEach((pStats) => {
      const pId = pStats.playerId;
      if (!team.stats.playerStats[pId]) {
        team.stats.playerStats[pId] = {
          playerId: pId,
          name: pStats.name,
          jerseyNumber: pStats.jerseyNumber,
          gamesPlayed: 0,
          inningsInfield: 0,
          inningsOutfield: 0,
          inningsBench: 0,
          inningsPitched: 0,
          pitchesThrown: 0,
          inningsCaught: 0,
          infieldBy4Compliant: true,
          violations: 0
        };
      }

      const rec = team.stats.playerStats[pId];
      rec.gamesPlayed += 1;
      rec.inningsInfield += pStats.inningsPlayedInfield;
      rec.inningsOutfield += pStats.inningsPlayedOutfield;
      rec.inningsBench += pStats.totalBenchInnings;
      rec.inningsPitched += pStats.inningsPitched;
      rec.pitchesThrown += pStats.pitchesThrown;
      rec.inningsCaught += pStats.inningsCaught;
      if (pStats.infieldDeadlineViolation || pStats.benchViolations?.length > 0) {
        rec.violations += 1;
      }
    });

    team.updatedAt = new Date().toISOString();
    await this.setDocData(`${TEAMS_COLLECTION}/${teamId}`, team);
    return team.stats;
  }

  /* ========================================================================
     Sync Status & Observers
     ======================================================================== */

  setSyncStatus(status) {
    this.syncStatus = status;
    this.notify();
  }

  getSyncInfo() {
    return {
      status: this.syncStatus,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
    };
  }

  /**
   * Pushes all local storage teams and registry into Firebase Firestore.
   */
  async syncAllLocalTeamsToFirestore() {
    const db = await this.getDb();
    const sdk = this.sdk;
    if (!db || !sdk) {
      throw new Error('Firebase Firestore SDK is not initialized. Please check network connection.');
    }

    this.setSyncStatus('syncing');
    const reg = await this.getRegistry();
    const results = { syncedTeams: 0, errors: [] };

    // 1. Sync registry document
    try {
      const docRef = sdk.doc(db, REGISTRY_DOC_PATH);
      await sdk.setDoc(docRef, reg, { merge: true });
    } catch (e) {
      this.lastError = e.message || String(e);
      this.setSyncStatus('local');
      throw new Error(`Failed to save teams registry to Firestore: ${e.message}`);
    }

    // 2. Sync all individual team documents
    for (const teamSummary of (reg.teams || [])) {
      try {
        const teamData = await this.getTeam(teamSummary.teamId);
        if (teamData) {
          const docRef = sdk.doc(db, TEAMS_COLLECTION, teamSummary.teamId);
          await sdk.setDoc(docRef, teamData, { merge: true });
          results.syncedTeams++;
        }
      } catch (err) {
        results.errors.push(`Team "${teamSummary.teamName}": ${err.message}`);
      }
    }

    if (results.errors.length > 0) {
      this.lastError = results.errors.join('; ');
      this.setSyncStatus('local');
      throw new Error(`Partial sync error: ${this.lastError}`);
    }

    this.lastError = null;
    this.setSyncStatus('synced');
    this.lastSyncTime = new Date();
    this.notify();
    return results;
  }

  /* ========================================================================
     User & Coach Invitations Operations (Super Admin)
     ======================================================================== */

  async listInvitations() {
    const data = await this.getDocData(INVITATIONS_DOC_PATH);
    if (data && Array.isArray(data.invitations)) {
      return data.invitations;
    }
    // Fallback local cache
    try {
      const local = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}invitations`);
      if (local) return JSON.parse(local);
    } catch (e) {}
    return [];
  }

  async saveInvitations(invitations) {
    const payload = {
      updatedAt: new Date().toISOString(),
      invitations
    };
    await this.setDocData(INVITATIONS_DOC_PATH, payload);
    try {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}invitations`, JSON.stringify(invitations));
    } catch (e) {}
    this.notify();
    return invitations;
  }

  async createInvitation({ email, role = 'manager', teamId = '', teamName = '', note = '' }) {
    const manager = this.getCurrentManager();
    if (!isSuperAdmin(manager?.email)) {
      throw new Error(`Permission denied: Only Super User Admins (${SUPER_ADMIN_EMAILS.join(', ')}) can send invitations.`);
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address for the invite recipient.');
    }

    const invitations = await this.listInvitations();
    const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Resolve team name if ID provided
    let resolvedTeamName = teamName;
    if (teamId && !resolvedTeamName) {
      const team = await this.getTeam(teamId);
      resolvedTeamName = team?.teamName || teamId;
    }

    const newInvite = {
      id,
      token,
      email: cleanEmail,
      role: role || 'manager',
      teamId: teamId || '',
      teamName: resolvedTeamName || 'Any Team / League',
      invitedBy: manager.email,
      invitedByName: manager.displayName || 'Matthew Collins',
      invitedAt: new Date().toISOString(),
      status: 'pending', // 'pending' | 'accepted' | 'revoked'
      note: note.trim()
    };

    // Remove older pending invites for same email and role
    const filtered = invitations.filter((inv) => !(inv.email === cleanEmail && inv.status === 'pending' && inv.teamId === teamId));
    filtered.unshift(newInvite);
    await this.saveInvitations(filtered);

    // Build URL & Mailto draft
    const origin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'http://localhost:8000/';
    const inviteUrl = `${origin}?invite=${newInvite.id}&token=${newInvite.token}&email=${encodeURIComponent(newInvite.email)}&team=${encodeURIComponent(newInvite.teamId)}&role=${encodeURIComponent(newInvite.role)}`;

    const subject = encodeURIComponent(`⚾ Invitation to join North Natomas Little League Dugout Admin`);
    const roleLabels = {
      manager: 'Head Coach & Team Manager',
      assistant: 'Assistant Coach',
      scorekeeper: 'Dugout Scorekeeper',
      super_admin: 'League Commissioner / Admin'
    };
    const roleDisplay = roleLabels[newInvite.role] || newInvite.role;

    const bodyText = `Hello Coach,\n\n` +
      `You have been invited by Commissioner Matthew Collins (${manager.email}) to join North Natomas Little League (NNLL) Minor AAA Dugout Admin.\n\n` +
      `• Assigned Role: ${roleDisplay}\n` +
      `• Team: ${newInvite.teamName}\n` +
      (newInvite.note ? `• Note from Commissioner: "${newInvite.note}"\n\n` : `\n`) +
      `Click the secure invite link below to activate your account and access your team roster & rotation optimizer:\n` +
      `${inviteUrl}\n\n` +
      `Best regards,\n` +
      `North Natomas Little League (NNLL)\nMinor AAA Division`;

    const mailtoUrl = `mailto:${encodeURIComponent(cleanEmail)}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;

    return {
      invitation: newInvite,
      inviteUrl,
      mailtoUrl
    };
  }

  async revokeInvitation(inviteId) {
    const manager = this.getCurrentManager();
    if (!isSuperAdmin(manager?.email)) {
      throw new Error('Permission denied: Only Super User Admins can revoke invitations.');
    }

    const invitations = await this.listInvitations();
    const idx = invitations.findIndex((inv) => inv.id === inviteId);
    if (idx === -1) throw new Error('Invitation not found');

    invitations[idx].status = 'revoked';
    invitations[idx].revokedAt = new Date().toISOString();
    await this.saveInvitations(invitations);
    return invitations[idx];
  }

  async getInvitation(inviteId) {
    const invitations = await this.listInvitations();
    return invitations.find((inv) => inv.id === inviteId) || null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try { fn(this.getSyncInfo()); } catch (e) {}
    });
  }
}

export const teamStorage = new TeamStorageService();
