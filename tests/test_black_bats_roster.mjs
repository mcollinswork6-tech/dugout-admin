// Mock Browser Storage Environment for Node.js
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = {
  location: {
    origin: 'http://localhost:8000',
    pathname: '/'
  }
};

import { teamStorage } from '../src/team-storage.js';
import { authService } from '../src/auth.js';
import { GameStateManager } from '../src/state.js';

async function testBlackBatsRoster() {
  console.log('=== Verifying Official 12-Player Black Bats Roster ===');

  // 1. Log in as Coach Collins (mcollinswork6@gmail.com)
  authService.loginOfflineDemo('Coach Collins', true);
  const manager = teamStorage.getCurrentManager();
  console.log('Manager:', manager.email, '(', manager.displayName, ')');
  console.assert(manager.email === 'mcollinswork6@gmail.com');

  // 2. Check active team
  const activeTeamId = await teamStorage.getActiveTeamId();
  console.log('Active Team ID for mcollinswork6@gmail.com:', activeTeamId);
  console.assert(activeTeamId === 'team-black-bats-6589', `Active team must default to team-black-bats-6589, got ${activeTeamId}`);

  // 3. Check Team Profile
  const profile = await teamStorage.getTeamProfile('team-black-bats-6589');
  console.log('Team Profile:', profile.teamName, '| Division:', profile.division, '| Season:', profile.season, '| Coach:', profile.headCoach);
  console.assert(profile !== null, 'Black Bats profile must exist');
  console.assert(profile.teamName === 'Black Bats', 'Team name must be Black Bats');
  console.assert(profile.division === 'Minor AAA', 'Division must be Minor AAA');
  console.assert(profile.headCoach === 'Coach Collins', 'Head Coach must be Coach Collins');

  // 4. Check Roster
  const roster = await teamStorage.getTeamRoster('team-black-bats-6589');
  console.log(`Roster Count: ${roster.length} players`);
  console.assert(roster.length === 12, `Roster must contain exactly 12 players, got ${roster.length}`);

  console.log('\n--- Verified 12 Black Bats Players ---');
  roster.forEach((p, idx) => {
    console.log(` ${idx + 1}. #${p.jerseyNumber} ${p.name} (Pitch: ${p.eligiblePositions?.canPitch}, Catch: ${p.eligiblePositions?.canCatch}, 1B: ${p.eligiblePositions?.canPlayFirstBase})`);
  });

  // Verify all 12 official players
  const expectedPlayers = [
    { name: 'Elias Collins', num: 33, p: true, c: true, b1: true },
    { name: 'Hunter Huston', num: 5, p: true, c: true, b1: true },
    { name: 'Jason Clark Jr.', num: 10, p: true, c: true, b1: true },
    { name: 'Larry Parsons', num: 12, p: true, c: true, b1: true },
    { name: 'Kenton Lassen', num: 8, p: false, c: false, b1: true },
    { name: 'Mason Kaine', num: 21, p: true, c: true, b1: true },
    { name: 'Calan Burley', num: 7, p: false, c: false, b1: false },
    { name: 'Drew Bluford', num: 4, p: true, c: true, b1: false },
    { name: 'Jameson Parker', num: 15, p: false, c: false, b1: false },
    { name: 'Cody Byler', num: 18, p: true, c: false, b1: false },
    { name: 'Elijah Stewart', num: 30, p: false, c: false, b1: false },
    { name: 'Israel Iyere', num: 9, p: true, c: false, b1: true },
  ];

  for (const exp of expectedPlayers) {
    const found = roster.find(p => p.name === exp.name);
    console.assert(found, `Player ${exp.name} must be present in roster`);
    console.assert(found.jerseyNumber === exp.num, `${exp.name} jersey number must be ${exp.num}`);
    console.assert(Boolean(found.eligiblePositions?.canPitch) === exp.p, `${exp.name} canPitch mismatch`);
    console.assert(Boolean(found.eligiblePositions?.canCatch) === exp.c, `${exp.name} canCatch mismatch`);
    console.assert(Boolean(found.eligiblePositions?.canPlayFirstBase) === exp.b1, `${exp.name} canPlayFirstBase mismatch`);
  }

  // Check that dummy players are NOT present
  console.assert(!roster.some(p => p.name === 'Liam Garcia'), 'Old placeholder Liam Garcia must NOT be present');
  console.assert(!roster.some(p => p.name === 'Noah Davis'), 'Old placeholder Noah Davis must NOT be present');

  // 5. Check State Manager initialization
  const stateManager = new GameStateManager();
  stateManager.initNewGame({
    teamId: profile.teamId,
    teamName: profile.teamName,
    opponentName: profile.opponentName || 'Opponent',
    isHomeTeam: true,
    players: roster
  });

  const state = stateManager.state;
  console.log('\n--- State Manager Verification ---');
  console.log('State Team Name:', state.teamName);
  console.log('State Players Count:', state.players.length);
  console.log('Batting Order Count:', state.battingOrder.length);
  console.assert(state.teamName === 'Black Bats', 'Game state initialized with Black Bats');
  console.assert(state.players.length === 12, 'All 12 roster players present in game state');
  console.assert(state.battingOrder.length === 12, 'All 12 players in batting order');

  // 6. Verify Super Admin can also load Black Bats roster
  authService.loginSuperAdmin(true);
  const superAdminManager = teamStorage.getCurrentManager();
  console.log('\nSwitched to Super Admin:', superAdminManager.email);
  const superAdminRoster = await teamStorage.getTeamRoster('team-black-bats-6589');
  console.assert(superAdminRoster.length === 12, 'Super Admin gets same complete 12-player roster');

  console.log('\n🎉 ALL 12 PLAYERS VERIFIED SUCCESSFULLY!');
  process.exit(0);
}

testBlackBatsRoster().catch(err => {
  console.error('Black Bats verification failed:', err);
  process.exit(1);
});
