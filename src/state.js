/**
 * NNLL Minor AAA State Management & Game Operations
 */

import { solveDefensiveGrid } from './solver.js';
import { validateGameRules, calculatePlayerStats } from './rules.js';
import { saveGame } from './storage.js';
import { NNLL_RULES, LITTLE_LEAGUE_PITCH_RULES, getMaxPitchesForAge, calculatePitchRestDetails } from './constants.js';
import { SAMPLE_TEAMS } from './sample-data.js';

export function normalizePlayer(p) {
  if (!p) return p;
  const rawJersey = p.jersey !== undefined ? p.jersey : (p.jerseyNumber !== undefined ? p.jerseyNumber : p['Jersey']);
  const jersey = parseInt(rawJersey, 10) || 0;
  
  let firstName = p.firstName ?? p['Player First Name'] ?? p['first_name'];
  let lastName = p.lastName ?? p['Player Last name'] ?? p['Player Last Name'] ?? p['last_name'];
  
  if (!firstName && !lastName && p.name) {
    const parts = p.name.trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }
  firstName = (firstName || '').trim();
  lastName = (lastName || '').trim();
  const name = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : (p.name || '');

  const canPitch = Boolean(
    p.canPitch !== undefined ? p.canPitch :
    (p['Can Pitch flag'] !== undefined ? p['Can Pitch flag'] :
    (p.eligiblePositions?.canPitch !== undefined ? p.eligiblePositions.canPitch : true))
  );

  const canCatch = Boolean(
    p.canCatch !== undefined ? p.canCatch :
    (p['can catch flag'] !== undefined ? p['can catch flag'] :
    (p.eligiblePositions?.canCatch !== undefined ? p.eligiblePositions.canCatch : true))
  );

  const rawAge = p.age !== undefined ? p.age : (p['Player Age'] !== undefined ? p['Player Age'] : p.playerAge);
  const parsedAge = parseInt(rawAge, 10);
  const age = (!isNaN(parsedAge) && parsedAge > 0) ? parsedAge : 10;

  return {
    id: p.id || `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    jersey,
    jerseyNumber: jersey,
    firstName,
    lastName,
    name,
    age,
    'Player Age': age,
    canPitch,
    canCatch,
    'Player First Name': firstName,
    'Player Last name': lastName,
    'Can Pitch flag': canPitch,
    'can catch flag': canCatch,
    eligiblePositions: {
      canPitch,
      canCatch,
    },
    ...(p.isOut !== undefined ? { isOut: p.isOut } : {}),
    ...(p.outReason !== undefined ? { outReason: p.outReason } : {}),
  };
}

export function getFallbackOpponentPlayers(opponentName) {
  if (opponentName) {
    const oppLower = opponentName.toLowerCase().trim();
    const matched = SAMPLE_TEAMS.find((t) => {
      const tLower = t.teamName.toLowerCase();
      return tLower.includes(oppLower) || oppLower.includes(tLower.split(' ')[0]);
    });
    if (matched && matched.players && matched.players.length > 0) {
      return matched.players.map((p) => normalizePlayer(p));
    }
  }
  return Array.from({ length: 9 }, (_, i) => normalizePlayer({
    id: `opp_p_${i + 1}`,
    jersey: i + 1,
    jerseyNumber: i + 1,
    firstName: 'Opponent',
    lastName: `Batter ${i + 1}`,
    name: `Opponent Batter ${i + 1}`,
    canPitch: true,
    canCatch: true,
  }));
}

export function getBattingContextFromState(state) {
  if (!state) return { isHome: true, isTop: true, isMyTeamBatting: false, isOpponentBatting: true, battingTeamName: 'Opponents', fieldingTeamName: 'Black Bats' };
  const isHome = state.isHomeTeam !== false;
  const isTop = state.currentHalf === 'TOP';
  const isMyTeamBatting = isHome ? !isTop : isTop;
  const battingTeamName = isMyTeamBatting ? (state.teamName || 'Black Bats') : (state.opponentName || 'Opponents');
  const fieldingTeamName = isMyTeamBatting ? (state.opponentName || 'Opponents') : (state.teamName || 'Black Bats');

  return {
    isHome,
    isTop,
    isMyTeamBatting,
    isOpponentBatting: !isMyTeamBatting,
    battingTeamName,
    fieldingTeamName,
  };
}

export class GameStateManager {
  constructor(initialState = null) {
    this.state = initialState || this.getDefaultState();
    this.history = [];
    this.historyIndex = -1;
    this.listeners = [];
  }

  getDefaultState() {
    return {
      gameId: 'game_' + Date.now(),
      teamId: 'nnll-rivercats-11',
      teamName: 'NNLL River Cats',
      opponentName: 'River Bandits',
      isHomeTeam: true,
      scheduledInnings: NNLL_RULES.REGULATION_INNINGS,
      currentInning: 1,
      currentHalf: 'TOP', // 'TOP' or 'BOTTOM'
      currentOuts: 0,
      currentBalls: 0,
      currentStrikes: 0,
      runs: {
        home: 0,
        opponent: 0,
        innings: {
          1: { top: 0, bottom: 0 },
          2: { top: 0, bottom: 0 },
          3: { top: 0, bottom: 0 },
          4: { top: 0, bottom: 0 },
          5: { top: 0, bottom: 0 },
          6: { top: 0, bottom: 0 },
        },
      },
      activePitcherId: null,
      battingOrder: [], // Ordered array of playerIds
      currentBatterIndex: 0,
      opponentPlayers: [], // Opponent roster
      opponentBattingOrder: [], // Opponent batting order
      opponentBatterIndex: 0,
      outHistory: [], // Array of playerIds who made outs in chronological order
      runnersOnBase: { '1B': null, '2B': null, '3B': null },
      pitcherRemovalInning: {}, // playerId -> inning number when removed
      pitchHistory: [], // Array of { timestamp, pitcherId, delta, previousCount, newCount }
      playerPitches: {}, // playerId -> count
      atBatStartPitchCounts: {}, // pitcherId -> pitch count at start of current plate appearance
      gameDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD for Little League calendar rest calculation
      pitchersRemoved: [],
      players: [],
      innings: [],
      lastSolveTime: Date.now(),
    };
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    const validation = this.validate();
    const payload = {
      state: this.state,
      validation,
      canUndo: this.historyIndex > 0,
      canRedo: this.historyIndex < this.history.length - 1,
    };
    this.listeners.forEach((listener) => listener(payload));
    saveGame(this.state).catch((e) => console.error('Save failed', e));
    if (this.state.teamId) {
      import('./team-storage.js').then(({ teamStorage }) => {
        teamStorage.recordGameToTeam(this.state.teamId, this.state).catch(() => {});
      }).catch(() => {});
    }
  }

  saveSnapshot() {
    // Truncate redo tree if needed
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(JSON.parse(JSON.stringify(this.state)));
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex -= 1;
      this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.notify();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex += 1;
      this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.notify();
    }
  }

  validate() {
    return validateGameRules(this.state);
  }

  /**
   * Initializes a new game with players and automatically solves the initial 6-inning defensive grid
   */
  initNewGame({ teamId, teamName, opponentName, isHomeTeam, players, battingOrder, opponentPlayers, opponentBattingOrder }) {
    this.state = this.getDefaultState();
    this.state.teamId = teamId || 'nnll-rivercats-11';
    this.state.teamName = teamName || 'NNLL River Cats';
    this.state.opponentName = opponentName || 'Opponents';
    this.state.isHomeTeam = isHomeTeam !== undefined ? isHomeTeam : true;
    this.state.players = (players || []).map((p) => normalizePlayer(p));

    // Continuous Batting Order (CBO)
    this.state.battingOrder = battingOrder
      ? [...battingOrder]
      : this.state.players.map((p) => p.id);

    // Opponent Continuous Batting Order
    if (opponentPlayers && opponentPlayers.length > 0) {
      this.state.opponentPlayers = JSON.parse(JSON.stringify(opponentPlayers));
      this.state.opponentBattingOrder = opponentBattingOrder
        ? [...opponentBattingOrder]
        : this.state.opponentPlayers.map((p) => p.id);
    } else {
      const fallback = getFallbackOpponentPlayers(this.state.opponentName);
      this.state.opponentPlayers = fallback;
      this.state.opponentBattingOrder = fallback.map((p) => p.id);
    }
    this.state.opponentBatterIndex = 0;

    // Initial Pitch counts
    this.state.playerPitches = {};
    this.state.players.forEach((p) => {
      this.state.playerPitches[p.id] = 0;
    });

    // Generate initial 6-inning grid
    this.recalculateDefensiveGrid(1);

    // Set initial active pitcher
    if (this.state.innings[0] && this.state.innings[0].assignments.P) {
      this.state.activePitcherId = this.state.innings[0].assignments.P;
    }

    // Reset counts and innings
    this.state.currentInning = 1;
    this.state.currentHalf = 'TOP';
    this.state.currentOuts = 0;
    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;

    this.saveSnapshot();
    this.notify();
  }

  /**
   * Re-solves defensive grid from a specific inning onwards, keeping previous innings immutable
   */
  recalculateDefensiveGrid(fromInning = 1) {
    const lockedInnings = this.state.innings.slice(0, fromInning - 1);
    const solvedGrid = solveDefensiveGrid({
      players: this.state.players,
      lockedInnings,
      startInning: fromInning,
      totalInnings: this.state.scheduledInnings,
      playerPitches: this.state.playerPitches,
      pitchersRemoved: this.state.pitchersRemoved,
    });

    this.state.innings = solvedGrid;
    this.state.lastSolveTime = Date.now();
  }

  /**
   * Free defensive substitution: swap two players in an inning
   */
  swapPositions(inningNum, playerAId, playerBId) {
    const inningIdx = inningNum - 1;
    const inning = this.state.innings[inningIdx];
    if (!inning) return;

    this.saveSnapshot();

    let posA = null;
    let posB = null;

    Object.entries(inning.assignments).forEach(([pos, pId]) => {
      if (pId === playerAId) posA = pos;
      if (pId === playerBId) posB = pos;
    });

    const benchPlayers = [...(inning.benchPlayerIds || [])];
    const isABench = benchPlayers.includes(playerAId);
    const isBBench = benchPlayers.includes(playerBId);

    // Handle Mound removal check
    if (posA === 'P' && posB !== 'P') {
      if (!this.state.pitchersRemoved.includes(playerAId)) {
        this.state.pitchersRemoved.push(playerAId);
        this.state.pitcherRemovalInning[playerAId] = inningNum;
      }
    } else if (posB === 'P' && posA !== 'P') {
      if (!this.state.pitchersRemoved.includes(playerBId)) {
        this.state.pitchersRemoved.push(playerBId);
        this.state.pitcherRemovalInning[playerBId] = inningNum;
      }
    }

    // Apply Swap
    if (posA && posB) {
      // Swap between 2 field positions
      inning.assignments[posA] = playerBId;
      inning.assignments[posB] = playerAId;
    } else if (posA && isBBench) {
      // Swap field with bench
      inning.assignments[posA] = playerBId;
      const bIdx = benchPlayers.indexOf(playerBId);
      benchPlayers[bIdx] = playerAId;
      inning.benchPlayerIds = benchPlayers;
    } else if (posB && isABench) {
      // Swap field with bench
      inning.assignments[posB] = playerAId;
      const aIdx = benchPlayers.indexOf(playerAId);
      benchPlayers[aIdx] = playerBId;
      inning.benchPlayerIds = benchPlayers;
    }

    // Update active pitcher if current inning
    if (inningNum === this.state.currentInning) {
      this.state.activePitcherId = inning.assignments.P || null;
    }

    this.notify();
  }

  /**
   * Set specific position for a player in an inning
   */
  assignPlayerToPosition(inningNum, position, playerId) {
    const inningIdx = inningNum - 1;
    const inning = this.state.innings[inningIdx];
    if (!inning) return;

    this.saveSnapshot();

    // Handling assignment to BENCH / Dugout
    if (position === 'BENCH') {
      let previousPosOfPlayer = null;
      Object.entries(inning.assignments).forEach(([pos, pId]) => {
        if (pId === playerId) previousPosOfPlayer = pos;
      });
      if (previousPosOfPlayer) {
        delete inning.assignments[previousPosOfPlayer];
        if (previousPosOfPlayer === 'P') {
          if (!this.state.pitchersRemoved.includes(playerId)) {
            this.state.pitchersRemoved.push(playerId);
            this.state.pitcherRemovalInning[playerId] = inningNum;
          }
          if (inningNum === this.state.currentInning) {
            this.state.activePitcherId = null;
          }
        }
      }
      if (!inning.benchPlayerIds) inning.benchPlayerIds = [];
      if (!inning.benchPlayerIds.includes(playerId)) {
        inning.benchPlayerIds.push(playerId);
      }
      this.notify();
      return;
    }

    const oldPosPlayer = inning.assignments[position];

    // Check if replacing pitcher
    if (position === 'P' && oldPosPlayer && oldPosPlayer !== playerId) {
      if (!this.state.pitchersRemoved.includes(oldPosPlayer)) {
        this.state.pitchersRemoved.push(oldPosPlayer);
        this.state.pitcherRemovalInning[oldPosPlayer] = inningNum;
      }
    }

    // If player was already in field, replace their old position with previous occupant or bench
    let previousPosOfPlayer = null;
    Object.entries(inning.assignments).forEach(([pos, pId]) => {
      if (pId === playerId && pos !== position) {
        previousPosOfPlayer = pos;
      }
    });

    if (previousPosOfPlayer) {
      if (oldPosPlayer) {
        inning.assignments[previousPosOfPlayer] = oldPosPlayer;
      } else {
        delete inning.assignments[previousPosOfPlayer];
      }
    } else {
      // Player was on bench
      inning.benchPlayerIds = (inning.benchPlayerIds || []).filter((id) => id !== playerId);
      if (oldPosPlayer && !inning.benchPlayerIds.includes(oldPosPlayer)) {
        inning.benchPlayerIds.push(oldPosPlayer);
      }
    }

    inning.assignments[position] = playerId;

    if (inningNum === this.state.currentInning && position === 'P') {
      this.state.activePitcherId = playerId;
    }

    this.notify();
  }

  /**
   * Pitch Counter Operations with Balls and Strikes
   */
  recordPitches(delta) {
    const pitcherId = this.state.activePitcherId;
    if (!pitcherId) return;

    this.saveSnapshot();

    const prevCount = this.state.playerPitches[pitcherId] || 0;
    const newCount = Math.max(0, prevCount + delta);
    this.state.playerPitches[pitcherId] = newCount;

    if (!this.state.atBatStartPitchCounts) this.state.atBatStartPitchCounts = {};
    if (this.state.atBatStartPitchCounts[pitcherId] === undefined) {
      this.state.atBatStartPitchCounts[pitcherId] = prevCount;
    }
    if (newCount < this.state.atBatStartPitchCounts[pitcherId]) {
      this.state.atBatStartPitchCounts[pitcherId] = newCount;
    }

    this.state.pitchHistory.push({
      timestamp: Date.now(),
      pitcherId,
      delta,
      type: 'generic',
      previousCount: prevCount,
      newCount,
      previousBalls: this.state.currentBalls || 0,
      previousStrikes: this.state.currentStrikes || 0,
    });

    // Check if pitcher just hit 41 pitches and is currently scheduled to catch in downstream innings
    if (newCount >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD && prevCount < NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD) {
      const unplayedStart = this.state.currentInning + 1;
      let hasDownstreamCatch = false;
      for (let i = unplayedStart - 1; i < this.state.innings.length; i++) {
        if (this.state.innings[i].assignments.C === pitcherId) {
          hasDownstreamCatch = true;
          break;
        }
      }

      if (hasDownstreamCatch) {
        try {
          this.recalculateDefensiveGrid(unplayedStart);
        } catch (e) {
          console.warn('Re-solve after 41 pitches warning:', e);
        }
      }
    }

    this.notify();
  }

  recordPitchStrike() {
    const pitcherId = this.state.activePitcherId;
    if (!pitcherId) return { error: 'No active pitcher' };

    this.saveSnapshot();
    const prevCount = this.state.playerPitches[pitcherId] || 0;
    const newCount = prevCount + 1;
    this.state.playerPitches[pitcherId] = newCount;

    const prevBalls = this.state.currentBalls || 0;
    const prevStrikes = this.state.currentStrikes || 0;
    const newStrikes = prevStrikes + 1;

    let isStrikeout = false;
    let newBalls = prevBalls;
    let finalStrikes = newStrikes;

    if (newStrikes >= 3) {
      isStrikeout = true;
      finalStrikes = 0;
      newBalls = 0;
    }

    this.state.currentBalls = newBalls;
    this.state.currentStrikes = finalStrikes;

    this.state.pitchHistory.push({
      timestamp: Date.now(),
      pitcherId,
      delta: 1,
      type: 'strike',
      previousCount: prevCount,
      newCount,
      previousBalls: prevBalls,
      previousStrikes: prevStrikes,
      isStrikeout,
    });

    if (isStrikeout) {
      const { isMyTeamBatting } = this.getBattingContext();
      let batterId = null;
      if (isMyTeamBatting) {
        const bOrder = this.state.battingOrder || [];
        const bIndex = this.state.currentBatterIndex || 0;
        batterId = bOrder.length > 0 ? bOrder[bIndex % bOrder.length] : null;
      } else {
        const oppOrder = this.getOpponentBattingOrder();
        const oppIndex = this.state.opponentBatterIndex || 0;
        batterId = oppOrder.length > 0 ? oppOrder[oppIndex % oppOrder.length] : null;
      }
      this.recordOut({
        playerId: batterId,
        outType: 'strikeout',
        base: 'HP',
        advanceBatter: true,
      });
    }

    this.notify();
    return { isStrikeout, pitchCount: newCount, balls: newBalls, strikes: finalStrikes };
  }

  walkCurrentBatter(reason = 'walk') {
    const { isMyTeamBatting } = this.getBattingContext();
    const order = isMyTeamBatting ? (this.state.battingOrder || []) : this.getOpponentBattingOrder();
    const idx = isMyTeamBatting ? (this.state.currentBatterIndex || 0) : (this.state.opponentBatterIndex || 0);
    const batterId = order.length > 0 ? order[idx % order.length] : null;

    if (!this.state.runnersOnBase) {
      this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
    }

    const teamKey = isMyTeamBatting ? (this.state.isHomeTeam ? 'home' : 'opponent') : (this.state.isHomeTeam ? 'opponent' : 'home');
    const r1 = this.state.runnersOnBase['1B'];
    const r2 = this.state.runnersOnBase['2B'];
    const r3 = this.state.runnersOnBase['3B'];

    let runScored = false;
    // Walk force progression: forced runners advance
    if (r1) {
      if (r2) {
        if (r3) {
          // Bases loaded: runner on 3B is forced home to HP (+1 Run)
          runScored = true;
          this.recordRun(teamKey, 1);
        }
        this.state.runnersOnBase['3B'] = r2;
      }
      this.state.runnersOnBase['2B'] = r1;
    }
    this.state.runnersOnBase['1B'] = batterId;

    // Reset batter count
    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;

    // Continuous batting: advance to next batter
    this.advanceBatter(1);
    this.notify();
    return { batterId, runScored };
  }

  recordPitchBall() {
    const pitcherId = this.state.activePitcherId;
    if (!pitcherId) return { error: 'No active pitcher' };

    this.saveSnapshot();
    const prevCount = this.state.playerPitches[pitcherId] || 0;
    const newCount = prevCount + 1;
    this.state.playerPitches[pitcherId] = newCount;

    const prevBalls = this.state.currentBalls || 0;
    const prevStrikes = this.state.currentStrikes || 0;
    const newBalls = prevBalls + 1;

    let isWalk = false;
    let finalBalls = newBalls;
    let finalStrikes = prevStrikes;

    if (newBalls >= 4) {
      isWalk = true;
      finalBalls = 0;
      finalStrikes = 0;
    }

    this.state.currentBalls = finalBalls;
    this.state.currentStrikes = finalStrikes;

    this.state.pitchHistory.push({
      timestamp: Date.now(),
      pitcherId,
      delta: 1,
      type: 'ball',
      previousCount: prevCount,
      newCount,
      previousBalls: prevBalls,
      previousStrikes: prevStrikes,
      isWalk,
    });

    if (isWalk) {
      this.walkCurrentBatter('walk');
    } else {
      this.notify();
    }

    return { isWalk, pitchCount: newCount, balls: finalBalls, strikes: finalStrikes };
  }

  recordPitchHitBatter() {
    const pitcherId = this.state.activePitcherId;
    if (!pitcherId) return { error: 'No active pitcher' };

    this.saveSnapshot();
    const prevCount = this.state.playerPitches[pitcherId] || 0;
    const newCount = prevCount + 1;
    this.state.playerPitches[pitcherId] = newCount;

    const prevBalls = this.state.currentBalls || 0;
    const prevStrikes = this.state.currentStrikes || 0;

    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;

    this.state.pitchHistory.push({
      timestamp: Date.now(),
      pitcherId,
      delta: 1,
      type: 'hit_batter',
      previousCount: prevCount,
      newCount,
      previousBalls: prevBalls,
      previousStrikes: prevStrikes,
      isWalk: true,
      isHBP: true,
    });

    const result = this.walkCurrentBatter('hbp');
    return { isHBP: true, pitchCount: newCount, ...result };
  }

  recordSafeHit(hitType) {
    this.saveSnapshot();
    const { isMyTeamBatting } = this.getBattingContext();
    const order = isMyTeamBatting ? (this.state.battingOrder || []) : this.getOpponentBattingOrder();
    const idx = isMyTeamBatting ? (this.state.currentBatterIndex || 0) : (this.state.opponentBatterIndex || 0);
    const batterId = order.length > 0 ? order[idx % order.length] : null;

    if (!this.state.runnersOnBase) {
      this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
    }

    const teamKey = isMyTeamBatting ? (this.state.isHomeTeam ? 'home' : 'opponent') : (this.state.isHomeTeam ? 'opponent' : 'home');
    const r1 = this.state.runnersOnBase['1B'];
    const r2 = this.state.runnersOnBase['2B'];
    const r3 = this.state.runnersOnBase['3B'];

    let runsScored = 0;

    if (hitType === 'HR') {
      // Home Run: all runners on base score + batter scores at HP
      const runnersCount = (r1 ? 1 : 0) + (r2 ? 1 : 0) + (r3 ? 1 : 0) + 1;
      runsScored = runnersCount;
      this.recordRun(teamKey, runsScored);
      this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
    } else if (hitType === '3B') {
      // Triple: all runners on base score at HP
      const runnersCount = (r1 ? 1 : 0) + (r2 ? 1 : 0) + (r3 ? 1 : 0);
      if (runnersCount > 0) {
        runsScored = runnersCount;
        this.recordRun(teamKey, runsScored);
      }
      this.state.runnersOnBase = { '1B': null, '2B': null, '3B': batterId };
    } else if (hitType === '2B') {
      // Double: 3B & 2B score at HP, 1B advances to 3B, batter on 2B
      if (r3) runsScored++;
      if (r2) runsScored++;
      if (runsScored > 0) this.recordRun(teamKey, runsScored);
      this.state.runnersOnBase = { '1B': null, '2B': batterId, '3B': r1 || null };
    } else if (hitType === '1B' || hitType === 'FC') {
      // Single / Error / FC: 3B scores at HP, 2B to 3B, 1B to 2B, batter on 1B
      if (r3) {
        runsScored++;
        this.recordRun(teamKey, 1);
      }
      this.state.runnersOnBase = {
        '1B': batterId,
        '2B': r1 || null,
        '3B': r2 || null,
      };
    }

    // Reset batter count
    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;

    // Continuous batting: advance to next batter
    this.advanceBatter(1);
    this.notify();
    return { runsScored };
  }

  recordPitchInPlay() {
    const pitcherId = this.state.activePitcherId;
    if (!pitcherId) return { error: 'No active pitcher' };

    this.saveSnapshot();
    const prevCount = this.state.playerPitches[pitcherId] || 0;
    const newCount = prevCount + 1;
    this.state.playerPitches[pitcherId] = newCount;

    const prevBalls = this.state.currentBalls || 0;
    const prevStrikes = this.state.currentStrikes || 0;

    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;

    this.state.pitchHistory.push({
      timestamp: Date.now(),
      pitcherId,
      delta: 1,
      type: 'in_play',
      previousCount: prevCount,
      newCount,
      previousBalls: prevBalls,
      previousStrikes: prevStrikes,
    });

    this.advanceBatter(1);
    this.notify();
  }

  recordPitchFoul() {
    const pitcherId = this.state.activePitcherId;
    if (!pitcherId) return { error: 'No active pitcher' };

    this.saveSnapshot();
    const prevCount = this.state.playerPitches[pitcherId] || 0;
    const newCount = prevCount + 1;
    this.state.playerPitches[pitcherId] = newCount;

    const prevBalls = this.state.currentBalls || 0;
    const prevStrikes = this.state.currentStrikes || 0;
    const finalStrikes = prevStrikes < 2 ? prevStrikes + 1 : 2;

    this.state.currentStrikes = finalStrikes;

    this.state.pitchHistory.push({
      timestamp: Date.now(),
      pitcherId,
      delta: 1,
      type: 'foul',
      previousCount: prevCount,
      newCount,
      previousBalls: prevBalls,
      previousStrikes: prevStrikes,
    });

    this.notify();
  }

  resetBatterCount() {
    this.saveSnapshot();
    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;
    const pId = this.state.activePitcherId;
    if (pId) {
      if (!this.state.atBatStartPitchCounts) this.state.atBatStartPitchCounts = {};
      this.state.atBatStartPitchCounts[pId] = this.state.playerPitches[pId] || 0;
    }
    this.notify();
  }

  setBatterCount(balls, strikes) {
    this.saveSnapshot();
    this.state.currentBalls = Math.max(0, Math.min(4, balls));
    this.state.currentStrikes = Math.max(0, Math.min(3, strikes));
    this.notify();
  }

  undoLastPitch() {
    if (this.state.pitchHistory.length === 0) return;

    this.saveSnapshot();
    const last = this.state.pitchHistory.pop();
    if (last) {
      this.state.playerPitches[last.pitcherId] = last.previousCount;
      if (last.previousBalls !== undefined) {
        this.state.currentBalls = last.previousBalls;
      }
      if (last.previousStrikes !== undefined) {
        this.state.currentStrikes = last.previousStrikes;
      }
    }
    this.notify();
  }

  changeActivePitcher(newPitcherId) {
    if (this.state.activePitcherId === newPitcherId) return;

    this.saveSnapshot();
    const oldPitcher = this.state.activePitcherId;
    if (oldPitcher && !this.state.pitchersRemoved.includes(oldPitcher)) {
      this.state.pitchersRemoved.push(oldPitcher);
      this.state.pitcherRemovalInning[oldPitcher] = this.state.currentInning;
    }

    this.state.activePitcherId = newPitcherId;
    if (!this.state.atBatStartPitchCounts) this.state.atBatStartPitchCounts = {};
    if (newPitcherId && this.state.atBatStartPitchCounts[newPitcherId] === undefined) {
      this.state.atBatStartPitchCounts[newPitcherId] = this.state.playerPitches[newPitcherId] || 0;
    }
    const curInning = this.state.innings[this.state.currentInning - 1];
    if (curInning) {
      curInning.assignments.P = newPitcherId;
    }
    this.notify();
  }

  /**
   * Retrieves Little League Regulation VI pitch limits & rest details for a pitcher
   * @param {string|null} pitcherId - Player ID (defaults to activePitcherId)
   * @returns {Object|null} Workload and rest day analysis
   */
  getPitcherRestDetails(pitcherId = null) {
    const pId = pitcherId || this.state.activePitcherId;
    if (!pId) return null;
    const player = this.state.players.find((p) => p.id === pId);
    const pitches = this.state.playerPitches[pId] || 0;
    const age = Number(player?.age) || 10;
    const atBatStart = this.state.atBatStartPitchCounts?.[pId] ?? null;
    return calculatePitchRestDetails(pitches, age, atBatStart, this.state.gameDate);
  }

  /**
   * Inning Navigation & Half Inning / Outs
   */
  setCurrentInning(inningNum) {
    if (inningNum < 1 || inningNum > this.state.scheduledInnings) return;
    this.saveSnapshot();

    // Mark previous innings completed
    for (let i = 0; i < inningNum - 1; i++) {
      if (this.state.innings[i]) {
        this.state.innings[i].isCompleted = true;
      }
    }

    this.state.currentInning = inningNum;
    const curInningRec = this.state.innings[inningNum - 1];
    if (curInningRec && curInningRec.assignments.P) {
      this.state.activePitcherId = curInningRec.assignments.P;
    }
    this.notify();
  }

  advanceInning() {
    if (this.state.currentInning < this.state.scheduledInnings) {
      this.setCurrentInning(this.state.currentInning + 1);
    }
  }

  recordOut(options = {}) {
    const opts = typeof options === 'string' ? { playerId: options } : (options || {});
    const {
      playerId = null,
      playerName = null,
      base = '1B', // '1B', '2B', '3B', 'HP', or 'AIR'
      outType = 'ground_out', // 'ground_out', 'fly_out', 'line_out', 'force_out', 'tag_out', 'strikeout'
      fieldPositions = [], // e.g. ['SS', '1B']
      clearRunnerBase = null,
      advanceBatter = true,
      description = null,
    } = opts;

    this.saveSnapshot();
    this.state.currentOuts = (this.state.currentOuts + 1) % 4;

    // Reset batter count on out
    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;

    if (!this.state.runnersOnBase) {
      this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
    }

    // Clear runner from base if specified or if force/tag out at a base
    if (clearRunnerBase && this.state.runnersOnBase[clearRunnerBase]) {
      this.state.runnersOnBase[clearRunnerBase] = null;
    } else if (base && ['1B', '2B', '3B'].includes(base) && (outType === 'force_out' || outType === 'tag_out')) {
      this.state.runnersOnBase[base] = null;
    }

    // Resolve player name if missing
    let resolvedName = playerName;
    if (!resolvedName && playerId) {
      const p = this.state.players.find((pl) => pl.id === playerId) ||
                (this.state.opponentPlayers || []).find((pl) => pl.id === playerId);
      if (p) resolvedName = `${p.name} (#${p.jerseyNumber})`;
    }

    // Format play description if not provided
    let playDesc = description;
    if (!playDesc) {
      const posStr = Array.isArray(fieldPositions) && fieldPositions.length > 0 ? ` (${fieldPositions.join(' ➔ ')})` : '';
      const typeLabel = {
        strikeout: 'Strikeout (K)',
        ground_out: 'Ground Out',
        fly_out: 'Fly Out',
        line_out: 'Line Out',
        force_out: 'Force Out',
        tag_out: 'Tag Out',
      }[outType] || 'Out';

      const baseLabel = (base && base !== 'AIR') ? ` at ${base}` : (outType === 'fly_out' ? ' in air' : '');
      playDesc = `${typeLabel}${baseLabel}${posStr}`;
    }

    this.state.outHistory.push({
      playerId,
      playerName: resolvedName || 'Batter',
      inning: this.state.currentInning,
      half: this.state.currentHalf,
      outNumber: this.state.currentOuts,
      base: base || '1B',
      outType: outType || 'ground_out',
      fieldPositions: Array.isArray(fieldPositions) ? fieldPositions : (fieldPositions ? [fieldPositions] : []),
      description: playDesc,
      timestamp: Date.now(),
    });

    if (advanceBatter) {
      this.advanceBatter(1);
    }

    // If 3 outs, switch half or advance inning
    if (this.state.currentOuts === 3) {
      this.state.currentOuts = 0;
      this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
      if (this.state.currentHalf === 'TOP') {
        this.state.currentHalf = 'BOTTOM';
      } else {
        this.state.currentHalf = 'TOP';
        if (this.state.currentInning < this.state.scheduledInnings) {
          this.state.currentInning += 1;
          const curInningRec = this.state.innings[this.state.currentInning - 1];
          if (curInningRec && curInningRec.assignments.P) {
            this.state.activePitcherId = curInningRec.assignments.P;
          }
        }
      }
    }

    this.notify();
  }

  resetOuts() {
    this.saveSnapshot();
    this.state.currentOuts = 0;
    this.notify();
  }

  ensureRunsState() {
    if (!this.state.runs) {
      this.state.runs = {
        home: 0,
        opponent: 0,
        innings: {},
      };
    }
    if (!this.state.runs.innings) {
      this.state.runs.innings = {};
    }
    const maxInn = this.state.scheduledInnings || 6;
    for (let i = 1; i <= maxInn; i++) {
      if (!this.state.runs.innings[i]) {
        this.state.runs.innings[i] = { top: 0, bottom: 0 };
      }
    }
  }

  recordRun(teamKey, delta = 1) {
    this.ensureRunsState();
    this.saveSnapshot();

    const inn = this.state.currentInning;
    const halfKey = this.state.currentHalf === 'TOP' ? 'top' : 'bottom';

    if (teamKey === 'home') {
      const cur = this.state.runs.home || 0;
      this.state.runs.home = Math.max(0, cur + delta);
      // Determine if home team is batting this half
      const isHomeBatting = (this.state.isHomeTeam && this.state.currentHalf === 'BOTTOM') ||
                            (!this.state.isHomeTeam && this.state.currentHalf === 'TOP');
      if (isHomeBatting && this.state.runs.innings[inn]) {
        const curInnHalf = this.state.runs.innings[inn][halfKey] || 0;
        this.state.runs.innings[inn][halfKey] = Math.max(0, curInnHalf + delta);
      }
    } else if (teamKey === 'opponent') {
      const cur = this.state.runs.opponent || 0;
      this.state.runs.opponent = Math.max(0, cur + delta);
      // Determine if opponent is batting this half
      const isOpponentBatting = (this.state.isHomeTeam && this.state.currentHalf === 'TOP') ||
                                (!this.state.isHomeTeam && this.state.currentHalf === 'BOTTOM');
      if (isOpponentBatting && this.state.runs.innings[inn]) {
        const curInnHalf = this.state.runs.innings[inn][halfKey] || 0;
        this.state.runs.innings[inn][halfKey] = Math.max(0, curInnHalf + delta);
      }
    }

    this.notify();
  }

  switchHalfInning() {
    this.saveSnapshot();
    this.state.currentOuts = 0;
    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;
    this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };

    if (this.state.currentHalf === 'TOP') {
      this.state.currentHalf = 'BOTTOM';
    } else {
      this.state.currentHalf = 'TOP';
      if (this.state.currentInning < this.state.scheduledInnings) {
        this.state.currentInning += 1;
      }
    }

    // Update active pitcher for current inning if defensive team changed
    const curInningRec = this.state.innings[this.state.currentInning - 1];
    if (curInningRec && curInningRec.assignments.P) {
      this.state.activePitcherId = curInningRec.assignments.P;
    }

    this.notify();
  }

  setOuts(count) {
    if (count < 0 || count > 3) return;
    this.saveSnapshot();
    this.state.currentOuts = count;
    if (this.state.currentOuts === 3) {
      this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
    }
    this.notify();
  }

  getBattingContext() {
    return getBattingContextFromState(this.state);
  }

  getOpponentPlayers() {
    if (this.state.opponentPlayers && this.state.opponentPlayers.length > 0) {
      return this.state.opponentPlayers;
    }
    const fallback = getFallbackOpponentPlayers(this.state.opponentName);
    this.state.opponentPlayers = fallback;
    if (!this.state.opponentBattingOrder || this.state.opponentBattingOrder.length === 0) {
      this.state.opponentBattingOrder = fallback.map((p) => p.id);
    }
    return this.state.opponentPlayers;
  }

  getOpponentBattingOrder() {
    if (this.state.opponentBattingOrder && this.state.opponentBattingOrder.length > 0) {
      return this.state.opponentBattingOrder;
    }
    const players = this.getOpponentPlayers();
    this.state.opponentBattingOrder = players.map((p) => p.id);
    return this.state.opponentBattingOrder;
  }

  advanceBatter(delta = 1) {
    this.saveSnapshot();
    const { isMyTeamBatting } = this.getBattingContext();

    if (isMyTeamBatting) {
      const len = this.state.battingOrder?.length || 1;
      this.state.currentBatterIndex = (this.state.currentBatterIndex + delta + len) % len;
    } else {
      const oppOrder = this.getOpponentBattingOrder();
      const len = oppOrder.length || 1;
      const cur = this.state.opponentBatterIndex || 0;
      this.state.opponentBatterIndex = (cur + delta + len) % len;
    }

    // Reset batter count & record pitch count at start of next batter's plate appearance
    this.state.currentBalls = 0;
    this.state.currentStrikes = 0;
    const activePitcher = this.state.activePitcherId;
    if (activePitcher) {
      if (!this.state.atBatStartPitchCounts) this.state.atBatStartPitchCounts = {};
      this.state.atBatStartPitchCounts[activePitcher] = this.state.playerPitches[activePitcher] || 0;
    }

    this.notify();
  }

  /**
   * Continuous Batting Order (CBO) Modifiers
   */
  handleLateArrival(playerId) {
    this.saveSnapshot();
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    player.isLate = true;
    player.isOut = false;
    player.status = 'ACTIVE';

    // Append to end of batting order if not already in it
    if (!this.state.battingOrder.includes(playerId)) {
      this.state.battingOrder.push(playerId);
    }

    // Dynamic re-solve for unplayed innings
    const nextInning = Math.min(this.state.currentInning + 1, this.state.scheduledInnings);
    try {
      this.recalculateDefensiveGrid(nextInning);
    } catch (e) {
      console.warn('Re-solve after late arrival:', e);
    }

    this.notify();
  }

  handlePlayerOut(playerId, reason = 'INJURED') {
    this.saveSnapshot();
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    player.isOut = true;
    player.outReason = reason; // 'INJURED' or 'LEFT_EARLY'
    player.status = reason;

    // In CBO, their spot is skipped without automatic out penalty
    // Remove player from downstream defensive innings and re-solve
    const nextInning = Math.min(this.state.currentInning + 1, this.state.scheduledInnings);

    // If currently in the field in current inning, move them to bench or swap
    const curInning = this.state.innings[this.state.currentInning - 1];
    if (curInning) {
      let curPos = null;
      Object.entries(curInning.assignments).forEach(([pos, pId]) => {
        if (pId === playerId) curPos = pos;
      });
      if (curPos && curInning.benchPlayerIds.length > 0) {
        const substitute = curInning.benchPlayerIds.pop();
        curInning.assignments[curPos] = substitute;
      }
    }

    try {
      this.recalculateDefensiveGrid(nextInning);
    } catch (e) {
      console.warn('Re-solve after player departure:', e);
    }

    this.notify();
  }

  /**
   * Move player up or down in the continuous batting order
   * @param {string} playerId
   * @param {'UP'|'DOWN'} direction
   */
  movePlayerInBattingOrder(playerId, direction) {
    const idx = this.state.battingOrder.indexOf(playerId);
    if (idx === -1) return;

    if (direction === 'UP' && idx > 0) {
      this.saveSnapshot();
      const temp = this.state.battingOrder[idx - 1];
      this.state.battingOrder[idx - 1] = this.state.battingOrder[idx];
      this.state.battingOrder[idx] = temp;
      this.notify();
    } else if (direction === 'DOWN' && idx < this.state.battingOrder.length - 1) {
      this.saveSnapshot();
      const temp = this.state.battingOrder[idx + 1];
      this.state.battingOrder[idx + 1] = this.state.battingOrder[idx];
      this.state.battingOrder[idx] = temp;
      this.notify();
    }
  }

  /**
   * Move player to a specific slot index in the continuous batting order
   * @param {string} playerId
   * @param {number} targetIndex
   */
  movePlayerToSlot(playerId, targetIndex) {
    const fromIdx = this.state.battingOrder.indexOf(playerId);
    if (fromIdx === -1) return;
    const clampedTarget = Math.max(0, Math.min(targetIndex, this.state.battingOrder.length - 1));
    if (fromIdx === clampedTarget) return;

    this.saveSnapshot();
    const newOrder = [...this.state.battingOrder];
    const [movedId] = newOrder.splice(fromIdx, 1);
    newOrder.splice(clampedTarget, 0, movedId);
    this.state.battingOrder = newOrder;
    this.notify();
  }

  /**
   * Set entire batting order
   * @param {Array<string>} newOrder
   */
  setBattingOrder(newOrder) {
    if (!Array.isArray(newOrder)) return;
    this.saveSnapshot();
    this.state.battingOrder = [...newOrder];
    this.notify();
  }

  /**
   * Set or toggle player availability / attendance (Present vs Unavailable / Absent)
   * @param {string} playerId
   * @param {boolean|null} isPresent - explicit boolean or null to toggle
   * @param {string} reason - default 'ABSENT'
   */
  setPlayerAvailability(playerId, isPresent = null, reason = 'ABSENT') {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    const shouldBePresent = isPresent !== null ? isPresent : !!player.isOut;

    if (shouldBePresent) {
      // Mark as PRESENT / ACTIVE
      this.saveSnapshot();
      player.isOut = false;
      player.outReason = null;
      player.status = 'ACTIVE';

      // Ensure player is in batting order
      if (!this.state.battingOrder.includes(playerId)) {
        this.state.battingOrder.push(playerId);
      }

      // Re-solve defensive grid for unplayed innings
      const fromInning = Math.max(1, this.state.currentInning);
      try {
        this.recalculateDefensiveGrid(fromInning);
      } catch (e) {
        console.warn('Re-solve after marking present:', e);
      }
      this.notify();
    } else {
      // Check if marking this player absent drops active roster below 8
      const activeCount = this.state.players.filter(p => !p.isOut && p.id !== playerId).length;
      if (activeCount < 8) {
        alert('Little League rules require at least 8 present players to field a team. Cannot mark player absent.');
        return;
      }
      this.handlePlayerOut(playerId, reason);
    }
  }

  /**
   * Courtesy Runner Calculator
   * Little League Rule: When 2 outs are recorded with the catcher on base,
   * a courtesy runner may be used. The runner MUST be the batter who made the previous (last) out.
   */
  getCourtesyRunnerRecommendation() {
    const curInningRec = this.state.innings[this.state.currentInning - 1];
    const catcherId = curInningRec ? curInningRec.assignments.C : null;
    const catcher = this.state.players.find((p) => p.id === catcherId);

    // Check last out from out history
    let lastOutBatter = null;
    if (this.state.outHistory.length > 0) {
      const lastOut = this.state.outHistory[this.state.outHistory.length - 1];
      lastOutBatter = this.state.players.find((p) => p.id === lastOut.playerId);
    }

    return {
      eligible: this.state.currentOuts === 2,
      catcher,
      catcherId,
      recommendedRunner: lastOutBatter,
      message: this.state.currentOuts === 2
        ? `2 Outs Active: If Catcher (${catcher ? catcher.name : 'C'}) is on base, courtesy runner must be the batter who made the previous out${lastOutBatter ? ` (${lastOutBatter.name}, #${lastOutBatter.jerseyNumber})` : ''}.`
        : `Courtesy runner applies strictly when 2 outs are recorded with the catcher on base.`,
    };
  }

  setBaseRunner(base, playerId) {
    if (!['1B', '2B', '3B'].includes(base)) return;
    this.saveSnapshot();
    if (!this.state.runnersOnBase) this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
    this.state.runnersOnBase[base] = playerId;
    this.notify();
  }

  clearBaseRunner(base) {
    if (!['1B', '2B', '3B'].includes(base)) return;
    this.saveSnapshot();
    if (this.state.runnersOnBase) {
      this.state.runnersOnBase[base] = null;
    }
    this.notify();
  }

  clearAllBaseRunners() {
    this.saveSnapshot();
    this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
    this.notify();
  }

  advanceRunner(fromBase, toBase) {
    if (!['1B', '2B', '3B'].includes(fromBase)) return;
    this.saveSnapshot();
    if (!this.state.runnersOnBase) this.state.runnersOnBase = { '1B': null, '2B': null, '3B': null };
    const pId = this.state.runnersOnBase[fromBase];
    this.state.runnersOnBase[fromBase] = null;
    if (['1B', '2B', '3B'].includes(toBase)) {
      this.state.runnersOnBase[toBase] = pId;
    } else if (toBase === 'HP') {
      const { isMyTeamBatting } = this.getBattingContext();
      const teamKey = isMyTeamBatting ? (this.state.isHomeTeam ? 'home' : 'opponent') : (this.state.isHomeTeam ? 'opponent' : 'home');
      this.recordRun(teamKey, 1);
    }
    this.notify();
  }

  updateOpponentPlayer(playerId, updates) {
    this.saveSnapshot();
    const players = this.getOpponentPlayers();
    const p = players.find((pl) => pl.id === playerId);
    if (p) {
      Object.assign(p, updates);
      this.notify();
    }
  }

  setOpponentBattingOrder(newOrder) {
    this.saveSnapshot();
    this.state.opponentBattingOrder = [...newOrder];
    this.notify();
  }

  resetOpponentLineup(players, battingOrder) {
    this.saveSnapshot();
    if (players && players.length > 0) {
      this.state.opponentPlayers = JSON.parse(JSON.stringify(players));
      this.state.opponentBattingOrder = battingOrder ? [...battingOrder] : this.state.opponentPlayers.map((p) => p.id);
    } else {
      const fallback = getFallbackOpponentPlayers(this.state.opponentName);
      this.state.opponentPlayers = fallback;
      this.state.opponentBattingOrder = fallback.map((p) => p.id);
    }
    this.state.opponentBatterIndex = 0;
    this.notify();
  }
}
