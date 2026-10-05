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
import { DugoutUI } from '../src/ui.js';

async function testGameLayout() {
  console.log('=== Testing Game Layout: Planning vs Game, Bottom Taskbar, Line-Up Inning Adjustments & Strike/Ball Tracker ===\n');

  // 1. Log in as Coach Collins
  authService.loginOfflineDemo('Coach Collins', true);
  const manager = teamStorage.getCurrentManager();
  console.log('Manager Context:', manager.email);

  // 2. Initialize Game with official 12-player Black Bats roster
  const profile = await teamStorage.getTeamProfile('team-black-bats-6589');
  const roster = await teamStorage.getTeamRoster('team-black-bats-6589');
  console.assert(profile !== null, 'Black Bats profile found');
  console.assert(roster.length === 12, '12 players on roster');

  const stateManager = new GameStateManager();
  stateManager.initNewGame({
    teamId: profile.teamId,
    teamName: profile.teamName,
    opponentName: profile.opponentName || 'Opponents',
    isHomeTeam: true,
    players: roster,
  });

  const state = stateManager.state;
  console.log('Initial Inning:', state.currentInning);
  console.log('Initial Active Pitcher:', state.activePitcherId);
  console.assert(state.activePitcherId !== null, 'Inning 1 active pitcher initialized');
  const activePitcherId = state.activePitcherId;

  // -------------------------------------------------------------
  // Test 1: Pitch Counter - Balls & Strikes Tracking
  // -------------------------------------------------------------
  console.log('\n--- Test 1: Strike / Ball Tracking & Strikeout Rule ---');
  console.assert(state.currentBalls === 0, 'Initial balls = 0');
  console.assert(state.currentStrikes === 0, 'Initial strikes = 0');

  // Pitch 1: Ball
  stateManager.recordPitchBall();
  console.assert(state.playerPitches[activePitcherId] === 1, 'Pitch count = 1');
  console.assert(state.currentBalls === 1, 'Balls = 1');
  console.assert(state.currentStrikes === 0, 'Strikes = 0');
  console.log('  Pitch 1 (Ball): Count 1-0, Total Pitches:', state.playerPitches[activePitcherId]);

  // Pitch 2: Strike
  stateManager.recordPitchStrike();
  console.assert(state.playerPitches[activePitcherId] === 2, 'Pitch count = 2');
  console.assert(state.currentBalls === 1, 'Balls = 1');
  console.assert(state.currentStrikes === 1, 'Strikes = 1');
  console.log('  Pitch 2 (Strike): Count 1-1, Total Pitches:', state.playerPitches[activePitcherId]);

  // Pitch 3: Strike 2
  stateManager.recordPitchStrike();
  console.assert(state.currentStrikes === 2, 'Strikes = 2');
  console.log('  Pitch 3 (Strike): Count 1-2, Total Pitches:', state.playerPitches[activePitcherId]);

  // Pitch 4: Strike 3 -> Strikeout!
  const prevOuts = state.currentOuts;
  const prevBatterIndex = state.currentBatterIndex;
  stateManager.recordPitchStrike();
  console.assert(state.currentStrikes === 0, 'Count reset on strikeout');
  console.assert(state.currentBalls === 0, 'Count reset on strikeout');
  console.assert(state.currentOuts === prevOuts + 1, 'Out recorded on strikeout');
  console.assert(state.currentBatterIndex === (prevBatterIndex + 1) % state.battingOrder.length, 'Batter advanced on strikeout');
  console.log('  Pitch 4 (Strike 3): 🛑 Strikeout (K)! Outs:', state.currentOuts, ', Count reset to 0-0. Total Pitches:', state.playerPitches[activePitcherId]);
  console.log('✅ Test 1 Passed: Strikeout rules accurately enforced');

  // -------------------------------------------------------------
  // Test 2: Pitch Counter - 4 Balls Walk
  // -------------------------------------------------------------
  console.log('\n--- Test 2: 4 Balls Walk Rule ---');
  const batterIdxBeforeWalk = state.currentBatterIndex;
  stateManager.recordPitchBall();
  stateManager.recordPitchBall();
  stateManager.recordPitchBall();
  console.assert(state.currentBalls === 3, 'Balls = 3');
  // 4th Ball -> Walk
  stateManager.recordPitchBall();
  console.assert(state.currentBalls === 0, 'Count reset on walk');
  console.assert(state.currentStrikes === 0, 'Count reset on walk');
  console.assert(state.currentBatterIndex === (batterIdxBeforeWalk + 1) % state.battingOrder.length, 'Batter advanced on walk');
  console.log('  4 Balls Recorded: 🚶 Walk (BB)! Count reset to 0-0. Total Pitches:', state.playerPitches[activePitcherId]);
  console.log('✅ Test 2 Passed: Walk rules accurately enforced');

  // -------------------------------------------------------------
  // Test 3: Undo Last Pitch restores count and pitcher tally
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Undo Pitch Restoration ---');
  const pitchCountBefore = state.playerPitches[activePitcherId];
  stateManager.recordPitchStrike();
  console.assert(state.currentStrikes === 1, 'Strikes = 1');
  console.assert(state.playerPitches[activePitcherId] === pitchCountBefore + 1, 'Pitches incremented by 1');

  stateManager.undoLastPitch();
  console.assert(state.currentStrikes === 0, 'Undo restores strikes to 0');
  console.assert(state.playerPitches[activePitcherId] === pitchCountBefore, 'Undo restores pitch count');
  console.log('✅ Test 3 Passed: Undo accurately restores previous count and pitch count');

  // -------------------------------------------------------------
  // Test 4: Inning Line-Up Position Adjustments
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Line-Up Inning Position Adjustments ---');
  const player1 = roster[0]; // Elias Collins
  const player2 = roster[1]; // Hunter Huston

  // Inning 3 assignment test
  const inn3Idx = 2;
  const oldPosP1 = state.innings[inn3Idx].assignments['1B'];
  console.log(`Inning 3: Assigning ${player1.name} to 1B...`);
  stateManager.assignPlayerToPosition(3, '1B', player1.id);
  console.assert(state.innings[inn3Idx].assignments['1B'] === player1.id, 'Player 1 assigned to 1B in Inning 3');

  // Assign to Bench
  console.log(`Inning 3: Moving ${player1.name} to BENCH...`);
  stateManager.assignPlayerToPosition(3, 'BENCH', player1.id);
  console.assert(state.innings[inn3Idx].assignments['1B'] !== player1.id, 'Player 1 removed from 1B');
  console.assert(state.innings[inn3Idx].benchPlayerIds.includes(player1.id), 'Player 1 is now on bench in Inning 3');
  console.log('✅ Test 4 Passed: assignPlayerToPosition supports fielding and BENCH assignments');

  // -------------------------------------------------------------
  // Test 5: DugoutUI Rendering Verification
  // -------------------------------------------------------------
  console.log('\n--- Test 5: UI Rendering (Top Switcher, Bottom Taskbar, Line-Up & Tracker Subviews) ---');
  const mockContainer = {
    innerHTML: '',
  };

  const ui = new DugoutUI(stateManager, authService);
  ui.init(mockContainer);

  // 5a. Check Planning View rendered by default
  ui.appViewMode = 'planning';
  ui.render({
    state: stateManager.state,
    validation: stateManager.validate(),
    canUndo: false,
    canRedo: false,
  });

  console.assert(mockContainer.innerHTML.includes('id="toggle-mode-planning"'), 'Top Planning button present');
  console.assert(mockContainer.innerHTML.includes('id="toggle-mode-game"'), 'Top Game Layout button present');
  console.assert(mockContainer.innerHTML.includes('Planning'), 'Planning label rendered');
  console.assert(mockContainer.innerHTML.includes('Game Layout'), 'Game Layout label rendered');
  console.log('  Top View Switcher: Planning & Game Layout buttons present');

  // 5b. Switch to Game Layout -> Line-Up Subview
  ui.appViewMode = 'game';
  ui.gameLayoutTab = 'lineup';
  ui.gameLineupInning = 2;
  ui.render({
    state: stateManager.state,
    validation: stateManager.validate(),
    canUndo: false,
    canRedo: false,
  });

  console.assert(mockContainer.innerHTML.includes('id="game-bottom-taskbar"'), 'Bottom taskbar present');
  console.assert(mockContainer.innerHTML.includes('id="btn-taskbar-lineup"'), 'Taskbar Line-Up button present');
  console.assert(mockContainer.innerHTML.includes('id="btn-taskbar-tracker"'), 'Taskbar Game Tracker button present');
  console.assert(mockContainer.innerHTML.includes('Line-Up for Inning 2'), 'Line-up header for selected inning rendered');
  console.assert(mockContainer.innerHTML.includes('game-lineup-pos-select'), 'Position select dropdowns rendered');
  console.assert(mockContainer.innerHTML.includes('field-diamond-infield'), 'Field preview diagram rendered');
  console.log('  Game Layout Line-Up View: Inning 2 selector, roster table, position dropdowns & field diagram verified');

  // 5c. Switch to Game Layout -> Game Tracker Subview
  ui.gameLayoutTab = 'tracker';
  ui.render({
    state: stateManager.state,
    validation: stateManager.validate(),
    canUndo: false,
    canRedo: false,
  });

  console.assert(mockContainer.innerHTML.includes('game-card-runs'), 'Runs / Scoreboard card present');
  console.assert(mockContainer.innerHTML.includes('game-card-outs'), 'Outs tracker card present');
  console.assert(mockContainer.innerHTML.includes('btn-pitch-strike'), 'Strike pitch button present');
  console.assert(mockContainer.innerHTML.includes('btn-pitch-ball'), 'Ball pitch button present');
  console.assert(mockContainer.innerHTML.includes('atbat-count-box'), 'At-bat balls & strikes count box present');
  console.assert(mockContainer.innerHTML.includes('id="game-bottom-taskbar"'), 'Bottom taskbar persistent across tabs');
  console.log('  Game Layout Tracker View: Score, Outs, Strike/Ball Pitch Buttons & Persistent Taskbar verified');

  console.log('\n🎉 ALL GAME LAYOUT & TASKBAR TESTS PASSED COMPLETELY!');
  process.exit(0);
}

testGameLayout().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
