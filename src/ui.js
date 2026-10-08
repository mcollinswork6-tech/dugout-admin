/**
 * NNLL Minor AAA Dugout UI Rendering & Interaction Module
 */

import {
  FIELD_POSITIONS,
  INFIELD_POSITIONS,
  OUTFIELD_POSITIONS,
  POSITION_NAMES,
  NNLL_RULES,
  LITTLE_LEAGUE_PITCH_RULES,
  getMaxPitchesForAge,
  calculatePitchRestDetails,
  getRestTier,
  isSuperAdmin,
} from './constants.js';
import { TeamManagerUI } from './team-manager-ui.js';
import { teamStorage } from './team-storage.js';
import { SAMPLE_TEAMS } from './sample-data.js';

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

export function getFallbackOpponentRoster(state) {
  if (state?.opponentPlayers && state.opponentPlayers.length > 0) {
    return state.opponentPlayers;
  }
  const oppName = (state?.opponentName || '').toLowerCase().trim();
  const matched = SAMPLE_TEAMS.find((t) => {
    const tLower = t.teamName.toLowerCase();
    return tLower.includes(oppName) || oppName.includes(tLower.split(' ')[0]);
  });
  if (matched && matched.players && matched.players.length > 0) {
    return JSON.parse(JSON.stringify(matched.players));
  }
  return Array.from({ length: 9 }, (_, i) => ({
    id: `opp_p_${i + 1}`,
    jersey: i + 1,
    jerseyNumber: i + 1,
    firstName: 'Opponent',
    lastName: `Batter ${i + 1}`,
    name: `Opponent Batter ${i + 1}`,
    canPitch: true,
    canCatch: true,
    'Player First Name': 'Opponent',
    'Player Last name': `Batter ${i + 1}`,
    'Can Pitch flag': true,
    'can catch flag': true,
    eligiblePositions: { canPitch: true, canCatch: true },
  }));
}

export class DugoutUI {
  constructor(stateManager, authService = null) {
    this.stateManager = stateManager;
    this.authService = authService;
    this.teamManagerUI = new TeamManagerUI(stateManager);
    this.selectedSwapCell = null; // { inningNum, playerId, position }
    this.container = null;
    this.appViewMode = localStorage.getItem('dugout_app_view_mode') || 'planning'; // 'planning' | 'game'
    this.gameLayoutTab = localStorage.getItem('dugout_game_layout_tab') || 'tracker'; // 'lineup' | 'tracker'
    this.gameLineupInning = 1;
    this.mobileTab = 'defense'; // 'defense' | 'pitching' | 'game' | 'menu' | 'all'
  }

  init(containerElement) {
    this.container = containerElement;
    this.stateManager.subscribe((payload) => this.render(payload));
  }

  render({ state, validation, canUndo, canRedo }) {
    if (!this.container) return;

    const manager = teamStorage.getCurrentManager();
    const isSuper = isSuperAdmin(manager?.email);
    const isMcollins = !isSuper && manager?.email?.toLowerCase() === 'mcollinswork6@gmail.com';
    const isOpponentView = isSuper
      ? false
      : (isMcollins
        ? (state.teamId !== 'team-black-bats-6589' && state.teamId !== 'nnll-black-bats' && !state.teamName?.toLowerCase().includes('black bats'))
        : false);

    this.container.innerHTML = `
      <!-- Prominent View Only Top Banner when inspecting Opponent Teams (Hidden for Super Admin) -->
      ${isOpponentView ? `
        <div class="view-only-global-strip">
          <div class="view-only-strip-content">
            <span class="view-only-icon">👁️</span>
            <span class="view-only-tag">VIEW ONLY</span>
            <span class="badge-save-view-only">🔒 Save: View Only</span>
            <span class="view-only-text">
              You have <strong>View Only</strong> access for <strong>${state.teamName}</strong> (Opponent Roster & Record). Edits and saves are restricted to the team's manager.
            </span>
            <button id="btn-back-to-blackbats" class="btn btn-primary btn-xs" style="margin-left: auto; font-weight: 700;">
              👑 Return to Black Bats (My Team)
            </button>
          </div>
        </div>
      ` : ''}

      <!-- App Header -->
      <header class="app-header">
        <div class="header-top-row">
          <div class="brand-identity">
            <img src="icon.jpeg" alt="dugout-admin Logo" class="brand-logo" width="40" height="40" />
            <div class="brand-title-wrap">
              <span class="brand-badge">NNLL MINOR AAA</span>
              <h1 class="brand-title">dugout-admin</h1>
            </div>
          </div>
          ${this.renderCoachProfile()}
        </div>

        <div class="header-nav-row">
          <div class="game-meta-pills">
            <span class="meta-pill" id="header-team-pill" style="cursor: pointer;" title="Click to manage team roster and stats">⚾ ${state.teamName} ▾</span>
            ${isSuper ? `
              <span class="meta-pill" style="color: #c4b5fd; font-weight: 700; border-color: rgba(168, 85, 247, 0.5); background: rgba(168, 85, 247, 0.15);" title="League Commissioner / Super User Admin">
                🛡️ Super User Admin (All Teams)
              </span>
            ` : isOpponentView ? `
              <span class="meta-pill meta-pill-view-only" title="Opponent team - Read Only Access">👁️ VIEW ONLY</span>
            ` : `
              <span class="meta-pill" style="color: #fde047; font-weight: 700; border-color: rgba(234, 179, 8, 0.4);">👑 Managed Team</span>
            `}
            <span style="color: #64748b;">vs</span>
            <span class="meta-pill">${state.opponentName}</span>
            <span style="color: #64748b;">•</span>
            <span class="meta-pill">${state.isHomeTeam ? 'HOME' : 'AWAY'}</span>
          </div>

          <!-- Primary View Mode Switcher: Planning Layout (Dashboard) vs Game Layout -->
          <div class="view-mode-toggle-group" role="tablist" aria-label="Application View Mode">
            <button id="toggle-mode-planning" class="view-mode-btn ${this.appViewMode === 'planning' ? 'active' : ''}" role="tab" aria-selected="${this.appViewMode === 'planning'}" title="Pre-game planning dashboard and 6-inning defensive rotation matrix">
              <span class="mode-icon">📋</span>
              <span class="mode-label">Planning</span>
            </button>
            <button id="toggle-mode-game" class="view-mode-btn ${this.appViewMode === 'game' ? 'active' : ''}" role="tab" aria-selected="${this.appViewMode === 'game'}" title="Live game layout: Line-Up & Game Tracker">
              <span class="mode-icon">⚾</span>
              <span class="mode-label">Game Layout</span>
            </button>
          </div>

          <div class="header-actions">
            ${isOpponentView ? `
              <button class="btn btn-secondary btn-sm disabled-label" disabled style="opacity: 0.9; border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; cursor: not-allowed;" title="You have View Only access to other teams. Edits and saves are disabled.">
                🔒 Save: View Only
              </button>
            ` : ''}
            <button id="btn-undo" class="btn btn-secondary btn-sm" ${!canUndo || isOpponentView ? 'disabled' : ''} title="Undo">↩ Undo</button>
            <button id="btn-redo" class="btn btn-secondary btn-sm" ${!canRedo || isOpponentView ? 'disabled' : ''} title="Redo">↪ Redo</button>
            ${isSuper ? `
              <button id="btn-header-invites" class="btn btn-secondary btn-sm" style="border-color: rgba(168, 85, 247, 0.5); color: #e9d5ff;" title="Invite coaches, managers, and scorekeepers">✉️ User Invites</button>
            ` : ''}
            <button id="btn-lineup-modal" class="btn btn-secondary btn-sm" title="${isOpponentView ? 'View opponent lineup and roster' : 'Reorder batting lineup & set attendance'}">📋 ${isOpponentView ? 'Opponent Lineup' : 'Lineup & Attendance'}</button>
            <button id="btn-teams-manager" class="btn btn-secondary btn-sm" title="Manage teams, rosters, and cumulative season stats">👥 Teams & Stats</button>
            <button id="btn-new-game" class="btn btn-secondary btn-sm">⚙ New Game</button>
            <button id="btn-print-card" class="btn btn-primary btn-sm">🖨 Printable Lineup Card</button>
          </div>
        </div>
      </header>

      ${this.appViewMode === 'planning' ? this.renderPlanningView(state, validation) : this.renderGameView(state, validation)}
    `;

    this.bindEvents(state);
  }

  renderPlanningView(state, validation) {
    return `
      <!-- Alert Banners -->
      <div class="alert-banner-container">
        ${this.renderAlerts(validation)}
      </div>

      <!-- Mobile View Mode Selector (Active on Mobile/Tablet <= 768px in Planning Mode) -->
      ${this.renderMobileNav(state)}

      <div class="main-layout" data-mobile-view="${this.mobileTab || 'defense'}">
        <!-- Dugout Action Trays -->
        <div class="action-trays">
          <!-- Pitch Tracker Card -->
          <div class="tray-card mobile-section-pitching">
            <div class="tray-title">
              <span>🎯 Live Pitch Counter</span>
              <span style="font-size: 0.75rem; color: #94a3b8;">
                Active Pitcher: <strong>${this.getActivePitcherName(state)}</strong>
              </span>
            </div>
            ${this.renderPitchTracker(state)}
          </div>

          <!-- Inning & Outs Control Card -->
          <div class="tray-card mobile-section-game">
            <div class="tray-title">
              <span>⏱ Game Progression & Inning Frame</span>
              <span style="font-size: 0.75rem; color: #94a3b8;">
                Inning <strong>${state.currentInning}</strong> of ${state.scheduledInnings} (${state.currentHalf})
              </span>
            </div>
            ${this.renderGameControls(state)}
          </div>
        </div>

        <!-- Courtesy Runner Notice (if 2 outs) -->
        <div class="mobile-section-game">
          ${this.renderCourtesyRunnerTray(state)}
        </div>

        <!-- Main Dugout Matrix Grid -->
        <div class="matrix-container mobile-section-defense">
          <div class="print-lineup-header">
            <div class="print-brand-wrap">
              <img src="icon.jpeg" alt="dugout-admin Logo" class="print-logo" width="48" height="48" />
              <div>
                <h2>dugout-admin — NNLL Minor AAA Lineup & Defensive Rotation</h2>
                <p><strong>Team:</strong> ${state.teamName} | <strong>Opponent:</strong> ${state.opponentName} | <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
          <table class="matrix-table">
            <thead>
              <tr>
                <th class="col-player" title="Drag rows or use ▲/▼ to change continuous batting order">Batting Order & Player ↕</th>
                ${this.renderInningHeaders(state)}
                <th title="Infield innings played through Inning 4">IF by 4</th>
                <th title="Total Infield innings">Total IF</th>
                <th title="Total Outfield innings">Total OF</th>
                <th title="Total Bench innings">Bench</th>
                <th title="Current pitch count">Pitches</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderPlayerRows(state, validation)}
            </tbody>
          </table>
        </div>

        <!-- Dugout Roster Modifiers Menu -->
        <div class="roster-actions-bar mobile-section-defense">
          <div class="roster-actions-group">
            <span style="font-size: 0.85rem; font-weight: 700; color: #94a3b8;">Live Event Modifiers:</span>
            <button id="btn-late-arrival" class="btn btn-secondary btn-sm">➕ Late Arrival</button>
            <button id="btn-player-out" class="btn btn-warning btn-sm">🚑 Player Injured / Left Early</button>
            <button id="btn-recalculate" class="btn btn-secondary btn-sm" title="Re-solve unplayed innings">🔄 Re-solve Downstream</button>
          </div>
          <div class="roster-actions-group">
            <span style="font-size: 0.8rem; color: #64748b;">
              Tap any two position badges to swap players within an inning.
            </span>
          </div>
        </div>

        <!-- Mobile Dedicated Command Hub -->
        ${this.renderMobileMenuHub(state)}
      </div>
    `;
  }

  renderGameView(state, validation) {
    if (!this.gameLayoutTab) {
      this.gameLayoutTab = localStorage.getItem('dugout_game_layout_tab') || 'tracker';
    }
    if (!this.gameLineupInning) {
      this.gameLineupInning = state.currentInning || 1;
    }

    const isHome = state.isHomeTeam;
    const runsState = state.runs || { home: 0, opponent: 0, innings: {} };
    const awayScore = isHome ? (runsState.opponent || 0) : (runsState.home || 0);
    const homeScore = isHome ? (runsState.home || 0) : (runsState.opponent || 0);
    const curInning = state.currentInning || 1;
    const isTop = state.currentHalf === 'TOP';
    const outs = state.currentOuts || 0;
    const balls = state.currentBalls || 0;
    const strikes = state.currentStrikes || 0;

    return `
      <div class="game-view-container ${this.gameLayoutTab === 'lineup' ? 'tab-lineup-active' : 'tab-tracker-active'}">
        <!-- Top Subview Navigation Strip (Consistent with Mobile Nav & Desktop Tab Bar) -->
        <nav class="game-subnav-strip" aria-label="Game Layout Subviews">
          <button id="btn-subnav-lineup" class="game-subnav-btn ${this.gameLayoutTab === 'lineup' ? 'active' : ''}" title="View and adjust continuous batting order and field defensive assignments">
            <span class="subnav-icon">📋</span>
            <span class="subnav-label">Line-Up & Field</span>
            <span class="subnav-pill">Inning ${this.gameLineupInning}</span>
          </button>
          <button id="btn-subnav-tracker" class="game-subnav-btn ${this.gameLayoutTab === 'tracker' ? 'active' : ''}" title="Live game tracker: Outs, runs scoreboard, and pitch count">
            <span class="subnav-icon">⚾</span>
            <span class="subnav-label">Game Tracker</span>
            <span class="subnav-pill">${isTop ? 'TOP' : 'BOT'} ${curInning} • ${awayScore}-${homeScore}</span>
          </button>
        </nav>

        <!-- Subview: Line-Up vs Game Tracker -->
        ${this.gameLayoutTab === 'lineup'
          ? this.renderGameLineupSubView(state, validation)
          : this.renderGameTrackerSubView(state, validation)}

        <!-- Bottom Task Bar of Buttons (Matches Mobile-Enabled Views) -->
        <nav class="game-bottom-taskbar" id="game-bottom-taskbar" aria-label="Game Navigation Bar">
          <div class="taskbar-btn-group">
            <button id="btn-taskbar-lineup" class="taskbar-btn ${this.gameLayoutTab === 'lineup' ? 'active' : ''}" type="button">
              <span class="taskbar-icon">📋</span>
              <span class="taskbar-label">Line-Up</span>
            </button>
            
            <button id="btn-taskbar-tracker" class="taskbar-btn ${this.gameLayoutTab === 'tracker' ? 'active' : ''}" type="button">
              <span class="taskbar-icon">⚾</span>
              <span class="taskbar-label">Game Tracker</span>
            </button>
          </div>

          <!-- Quick Game Status Pill in Taskbar -->
          <div class="taskbar-status-chip" title="Current Inning, Score, Outs and Count">
            <span class="taskbar-chip-item inning-chip">${isTop ? '▲' : '▼'} ${curInning}</span>
            <span class="taskbar-chip-item score-chip">${awayScore}-${homeScore}</span>
            <span class="taskbar-chip-item outs-chip">${outs} ${outs === 1 ? 'Out' : 'Outs'}</span>
            <span class="taskbar-chip-item count-chip">${balls}-${strikes}</span>
          </div>
        </nav>
      </div>
    `;
  }

  renderGameLineupSubView(state, validation) {
    const selInning = this.gameLineupInning || state.currentInning || 1;
    const scheduledInnings = state.scheduledInnings || 6;
    const inningsList = Array.from({ length: scheduledInnings }, (_, i) => i + 1);

    const inningRec = (state.innings && state.innings[selInning - 1]) || { assignments: {}, benchPlayerIds: [] };
    const assignments = inningRec.assignments || {};
    const benchIds = inningRec.benchPlayerIds || [];

    // Find pitcher & catcher for this inning
    const pitcherPlayer = state.players.find((p) => p.id === assignments.P);
    const catcherPlayer = state.players.find((p) => p.id === assignments.C);

    const battingOrder = state.battingOrder || [];
    const orderedPlayers = battingOrder
      .map((id) => state.players.find((p) => p.id === id))
      .filter(Boolean);

    // Any players in state.players not in battingOrder
    state.players.forEach((p) => {
      if (!orderedPlayers.some((op) => op.id === p.id)) {
        orderedPlayers.push(p);
      }
    });

    const getPlayerPos = (playerId) => {
      for (const [pos, pId] of Object.entries(assignments)) {
        if (pId === playerId) return pos;
      }
      return 'BENCH';
    };

    const formatFieldPlayerName = (playerId) => {
      if (!playerId) return 'Empty';
      const player = state.players.find((p) => p.id === playerId);
      if (!player) return 'Empty';
      const firstName = (player.name || '').trim().split(/\s+/)[0] || 'Player';
      const hasNum = player.jerseyNumber !== undefined && player.jerseyNumber !== null && player.jerseyNumber !== '';
      return hasNum ? `${firstName} #${player.jerseyNumber}` : firstName;
    };

    return `
      <div class="game-lineup-view">
        <!-- Inning Selector Bar -->
        <div class="lineup-inning-selector-card">
          <div class="lineup-selector-header">
            <div class="selector-title-wrap">
              <span class="selector-title">📋 Line-Up for Inning ${selInning}</span>
              <span class="selector-subtitle">Select an inning to view and adjust defensive positions</span>
            </div>
            <div class="selector-actions">
              ${selInning !== state.currentInning ? `
                <button id="btn-jump-live-inning" class="btn btn-secondary btn-sm" title="Jump to active game inning">
                  ⚡ Jump to Live Inning (${state.currentInning})
                </button>
              ` : `
                <span class="badge-live-inning-now">🔴 LIVE GAME INNING</span>
              `}
              <button id="btn-optimize-this-inning" class="btn btn-primary btn-sm" title="Auto-optimize defense for Inning ${selInning} respecting Little League rules">
                🔄 Optimize Inning ${selInning}
              </button>
            </div>
          </div>

          <!-- Inning Pills Strip -->
          <div class="lineup-inning-pills-row">
            <span class="pills-label">INNING:</span>
            ${inningsList.map((inn) => `
              <button class="lineup-inn-pill ${inn === selInning ? 'active' : ''} ${inn === state.currentInning ? 'is-live' : ''}" data-inning="${inn}">
                <span class="pill-number">Inning ${inn}</span>
                ${inn === state.currentInning ? '<span class="pill-live-dot">● LIVE</span>' : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Inning Defense Summary Bar -->
        <div class="lineup-summary-bar">
          <div class="summary-stat-pill">
            <span class="stat-icon">🎯</span>
            <span class="stat-label">Pitcher:</span>
            <strong class="stat-val">${pitcherPlayer ? `${pitcherPlayer.name} (#${pitcherPlayer.jerseyNumber})` : 'Unassigned'}</strong>
          </div>
          <div class="summary-stat-pill">
            <span class="stat-icon">🧤</span>
            <span class="stat-label">Catcher:</span>
            <strong class="stat-val">${catcherPlayer ? `${catcherPlayer.name} (#${catcherPlayer.jerseyNumber})` : 'Unassigned'}</strong>
          </div>
          <div class="summary-stat-pill">
            <span class="stat-icon">🛋️</span>
            <span class="stat-label">Bench (${benchIds.length}):</span>
            <strong class="stat-val">${benchIds.length} Players</strong>
          </div>
        </div>

        <!-- 2 Column Layout: Full Batting Order & Position Adjuster + Mini Field Diagram -->
        <div class="lineup-main-grid">
          <!-- Column 1: Batting Order & Inning Position Selector Table -->
          <div class="lineup-table-card">
            <div class="lineup-table-header">
              <h3>Line-Up & Defensive Assignments (Inning ${selInning})</h3>
              <span class="header-hint">Adjust any player's position below. Changes update in real-time.</span>
            </div>

            <div class="lineup-rows-list">
              ${orderedPlayers.map((p, idx) => {
                const pos = getPlayerPos(p.id);
                const isPitcher = pos === 'P';
                const isCatcher = pos === 'C';
                const isBench = pos === 'BENCH';
                const canPitch = p.canPitch ?? p.eligiblePositions?.canPitch;
                const canCatch = p.canCatch ?? p.eligiblePositions?.canCatch;

                const pitchesThrown = state.playerPitches[p.id] || 0;
                const hit41Pitches = pitchesThrown >= 41;
                const warningMsg = (isCatcher && hit41Pitches) ? '⚠️ Threw 41+ pitches! Cannot play catcher (Rule VI)' : '';

                const isSelectedForSwap = this.selectedSwapCell &&
                  this.selectedSwapCell.inningNum === selInning &&
                  this.selectedSwapCell.playerId === p.id;

                return `
                  <div class="lineup-player-row ${isBench ? 'row-bench' : isPitcher ? 'row-pitcher' : isCatcher ? 'row-catcher' : 'row-field'} ${isSelectedForSwap ? 'row-swap-selected' : ''}">
                    <!-- Batting Slot & Move buttons -->
                    <div class="slot-badge-wrap">
                      <span class="batting-slot-num">#${idx + 1}</span>
                      <div class="slot-move-btns">
                        <button class="btn-slot-move btn-lineup-move-up" data-player-id="${p.id}" ${idx === 0 ? 'disabled' : ''} title="Move up in batting order">▲</button>
                        <button class="btn-slot-move btn-lineup-move-down" data-player-id="${p.id}" ${idx === orderedPlayers.length - 1 ? 'disabled' : ''} title="Move down in batting order">▼</button>
                      </div>
                    </div>

                    <!-- Player Info -->
                    <div class="player-info-cell">
                      <div class="player-name-row">
                        <span class="player-jersey">#${p.jerseyNumber}</span>
                        <strong class="player-name">${p.name}${p.age ? ` <span class="player-age-sub" style="font-size: 0.75rem; color: #94a3b8; font-weight: 500;">(Age ${p.age})</span>` : ''}</strong>
                        ${p.isOut ? '<span class="badge-player-out">ABSENT / OUT</span>' : ''}
                      </div>
                      <div class="player-tags-row">
                        ${canPitch ? '<span class="tag-elig tag-p" title="Eligible to Pitch">P</span>' : ''}
                        ${canCatch ? '<span class="tag-elig tag-c" title="Eligible to Catch">C</span>' : ''}
                        ${pitchesThrown > 0 ? `<span class="tag-pitches">${pitchesThrown} pitches</span>` : ''}
                      </div>
                      ${warningMsg ? `<div class="player-warning-sub">${warningMsg}</div>` : ''}
                    </div>

                    <!-- Inning Position Selector Dropdown -->
                    <div class="pos-select-cell">
                      <label class="pos-select-label">Inning ${selInning} Position:</label>
                      <select class="game-lineup-pos-select pos-badge-select ${pos === 'P' ? 'pos-sel-p' : pos === 'C' ? 'pos-sel-c' : pos === 'BENCH' ? 'pos-sel-bench' : 'pos-sel-field'}"
                        data-player-id="${p.id}" data-inning="${selInning}">
                        <option value="BENCH" ${pos === 'BENCH' ? 'selected' : ''}>🛋️ BENCH (Dugout)</option>
                        <option value="P" ${pos === 'P' ? 'selected' : ''}>🎯 P (Pitcher)</option>
                        <option value="C" ${pos === 'C' ? 'selected' : ''}>🧤 C (Catcher)</option>
                        <option value="1B" ${pos === '1B' ? 'selected' : ''}>🛡️ 1B (First Base)</option>
                        <option value="2B" ${pos === '2B' ? 'selected' : ''}>🛡️ 2B (Second Base)</option>
                        <option value="3B" ${pos === '3B' ? 'selected' : ''}>🛡️ 3B (Third Base)</option>
                        <option value="SS" ${pos === 'SS' ? 'selected' : ''}>🛡️ SS (Shortstop)</option>
                        <option value="LF" ${pos === 'LF' ? 'selected' : ''}>🌲 LF (Left Field)</option>
                        <option value="CF" ${pos === 'CF' ? 'selected' : ''}>🌲 CF (Center Field)</option>
                        <option value="RF" ${pos === 'RF' ? 'selected' : ''}>🌲 RF (Right Field)</option>
                      </select>
                    </div>

                    <!-- Quick Tap-to-Swap button -->
                    <div class="swap-action-cell">
                      <button class="btn btn-secondary btn-xs btn-lineup-swap-tap ${isSelectedForSwap ? 'active-swap' : ''}"
                        data-player-id="${p.id}" data-inning="${selInning}" data-pos="${pos}">
                        ${isSelectedForSwap ? '✓ Selected' : '⇄ Swap'}
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Column 2: Field Visualizer for Inning X -->
          <div class="lineup-field-card">
            <div class="lineup-field-header">
              <h3>Field Positions - Inning ${selInning}</h3>
              <span class="header-hint">Tap any two positions to swap them</span>
            </div>

            <!-- Field Diamond Visualizer -->
            <div class="field-visual-container">
              <!-- Authentic Baseball Diamond SVG Background -->
              <div class="baseball-diamond-bg" aria-hidden="true">
                <svg viewBox="0 0 400 360" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Subtle Outfield Grass Base -->
                  <rect width="400" height="360" fill="#143e26" />

                  <!-- Outfield Mowed Lawn Arc Stripes -->
                  <path d="M 0,0 L 400,0 L 400,240 C 300,290 100,290 0,240 Z" fill="#184a2e" opacity="0.6" />
                  <path d="M 50,0 L 350,0 L 350,220 C 270,265 130,265 50,220 Z" fill="#1e5837" opacity="0.5" />
                  <path d="M 100,0 L 300,0 L 300,200 C 240,240 160,240 100,200 Z" fill="#246841" opacity="0.4" />

                  <!-- Outfield Warning Track Arc -->
                  <path d="M 8,70 Q 200,-25 392,70" fill="none" stroke="#d8b175" stroke-width="6" stroke-opacity="0.35" stroke-dasharray="8,5" />

                  <!-- Foul Lines extending from Home Plate to Outfield Fence -->
                  <line x1="200" y1="312" x2="8" y2="70" stroke="#ffffff" stroke-width="2" stroke-opacity="0.55" />
                  <line x1="200" y1="312" x2="392" y2="70" stroke="#ffffff" stroke-width="2" stroke-opacity="0.55" />

                  <!-- Infield Dirt Cutout Arc / Clay Diamond -->
                  <path d="M 200,80 C 110,80 50,145 50,205 L 175,326 C 190,340 210,340 225,326 L 350,205 C 350,145 290,80 200,80 Z"
                    fill="#d8b175" fill-opacity="0.25" stroke="#d8b175" stroke-width="1.5" stroke-opacity="0.5" />

                  <!-- Infield Turf Grass Diamond -->
                  <polygon points="200,126 295,205 200,284 105,205" fill="#166534" fill-opacity="0.5" stroke="#15803d" stroke-width="1" stroke-opacity="0.4" />

                  <!-- Running Baselines (Chalk Paths connecting Home -> 1B -> 2B -> 3B -> Home) -->
                  <polygon points="200,312 310,205 200,110 90,205" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-opacity="0.65" stroke-linejoin="round" />

                  <!-- Pitcher's Mound Circle & Rubber -->
                  <circle cx="200" cy="205" r="22" fill="#d8b175" fill-opacity="0.4" stroke="#d8b175" stroke-width="1.5" stroke-opacity="0.6" />
                  <rect x="194" y="203" width="12" height="4" rx="1" fill="#ffffff" opacity="0.9" />

                  <!-- Home Plate Dirt Circle -->
                  <circle cx="200" cy="312" r="20" fill="#d8b175" fill-opacity="0.4" stroke="#d8b175" stroke-width="1.5" stroke-opacity="0.6" />
                  <!-- Home Plate Pentagon -->
                  <polygon points="200,320 193,313 193,306 207,306 207,313" fill="#ffffff" opacity="0.95" />

                  <!-- Bases (1st, 2nd, 3rd) White Diamond Bags -->
                  <rect x="303" y="198" width="14" height="14" rx="1.5" transform="rotate(45 310 205)" fill="#ffffff" opacity="0.95" stroke="#94a3b8" stroke-width="0.75" />
                  <rect x="193" y="103" width="14" height="14" rx="1.5" transform="rotate(45 200 110)" fill="#ffffff" opacity="0.95" stroke="#94a3b8" stroke-width="0.75" />
                  <rect x="83" y="198" width="14" height="14" rx="1.5" transform="rotate(45 90 205)" fill="#ffffff" opacity="0.95" stroke="#94a3b8" stroke-width="0.75" />
                </svg>
              </div>

              <div class="field-arc-outfield">
                <div class="field-pos-box box-lf ${assignments.LF ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'LF' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="LF" data-player-id="${assignments.LF || ''}">
                  <span class="pos-tag">LF</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments.LF)}</span>
                </div>
                <div class="field-pos-box box-cf ${assignments.CF ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'CF' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="CF" data-player-id="${assignments.CF || ''}">
                  <span class="pos-tag">CF</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments.CF)}</span>
                </div>
                <div class="field-pos-box box-rf ${assignments.RF ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'RF' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="RF" data-player-id="${assignments.RF || ''}">
                  <span class="pos-tag">RF</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments.RF)}</span>
                </div>
              </div>

              <div class="field-diamond-infield">
                <div class="field-pos-box box-3b ${assignments['3B'] ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === '3B' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="3B" data-player-id="${assignments['3B'] || ''}">
                  <span class="pos-tag">3B</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments['3B'])}</span>
                </div>
                <div class="field-pos-box box-ss ${assignments.SS ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'SS' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="SS" data-player-id="${assignments.SS || ''}">
                  <span class="pos-tag">SS</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments.SS)}</span>
                </div>
                <div class="field-pos-box box-2b ${assignments['2B'] ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === '2B' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="2B" data-player-id="${assignments['2B'] || ''}">
                  <span class="pos-tag">2B</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments['2B'])}</span>
                </div>
                <div class="field-pos-box box-1b ${assignments['1B'] ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === '1B' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="1B" data-player-id="${assignments['1B'] || ''}">
                  <span class="pos-tag">1B</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments['1B'])}</span>
                </div>
                <div class="field-pos-box box-p ${assignments.P ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'P' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="P" data-player-id="${assignments.P || ''}">
                  <span class="pos-tag">P</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments.P)}</span>
                </div>
                <div class="field-pos-box box-c ${assignments.C ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'C' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="C" data-player-id="${assignments.C || ''}">
                  <span class="pos-tag">C</span>
                  <span class="pos-player">${formatFieldPlayerName(assignments.C)}</span>
                </div>
              </div>
            </div>

            <!-- Dugout Bench Section -->
            <div class="field-bench-section">
              <span class="bench-section-title">🛋️ Dugout / Bench (${benchIds.length}):</span>
              <div class="bench-chips-wrap">
                ${benchIds.length === 0 ? '<span class="bench-empty-text">No players on bench this inning</span>' : ''}
                ${benchIds.map((bId) => {
                  const isSelected = this.selectedSwapCell?.playerId === bId && this.selectedSwapCell?.inningNum === selInning;
                  return `
                    <div class="field-pos-box box-bench ${isSelected ? 'selected-swap' : ''}"
                      data-inning="${selInning}" data-position="BENCH" data-player-id="${bId}">
                      <span class="pos-tag">BENCH</span>
                      <span class="pos-player">${formatFieldPlayerName(bId)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderGameTrackerSubView(state, validation) {
    const isHome = state.isHomeTeam;
    const awayTeamName = isHome ? state.opponentName : state.teamName;
    const homeTeamName = isHome ? state.teamName : state.opponentName;

    // Runs state
    const runsState = state.runs || { home: 0, opponent: 0, innings: {} };
    const awayScore = isHome ? (runsState.opponent || 0) : (runsState.home || 0);
    const homeScore = isHome ? (runsState.home || 0) : (runsState.opponent || 0);

    const curInning = state.currentInning || 1;
    const isTop = state.currentHalf === 'TOP';
    const isBottom = !isTop;

    // Batting Context: Determine which team is batting and which is fielding
    const battingContext = (typeof this.stateManager?.getBattingContext === 'function')
      ? this.stateManager.getBattingContext()
      : getBattingContextFromState(state);
    const { isMyTeamBatting, isOpponentBatting, battingTeamName, fieldingTeamName } = battingContext;

    const isBattingAway = isTop;
    const battingTeamTag = isBattingAway ? 'AWAY' : 'HOME';
    const battingScore = isBattingAway ? awayScore : homeScore;

    const fieldingTeamTag = isBattingAway ? 'HOME' : 'AWAY';
    const fieldingScore = isBattingAway ? homeScore : awayScore;

    const battingPlusId = isBattingAway ? 'btn-run-away-plus' : 'btn-run-home-plus';
    const battingMinusId = isBattingAway ? 'btn-run-away-minus' : 'btn-run-home-minus';
    const fieldingPlusId = isBattingAway ? 'btn-run-home-plus' : 'btn-run-away-plus';
    const fieldingMinusId = isBattingAway ? 'btn-run-home-minus' : 'btn-run-away-minus';

    const innRunsObj = (runsState.innings && runsState.innings[curInning]) || { top: 0, bottom: 0 };
    const curHalfRuns = isTop ? (innRunsObj.top || 0) : (innRunsObj.bottom || 0);
    const is5RunCap = curHalfRuns >= 5 && curInning < 6;

    // Active pitcher & Little League Workload details
    const pitcherId = state.activePitcherId;
    const pitcherPlayer = state.players.find((p) => p.id === pitcherId);
    const pitcherJersey = pitcherPlayer?.jerseyNumber ?? pitcherPlayer?.jersey ?? '';
    const pitcherAge = Number(pitcherPlayer?.age) || 10;
    const pitcherName = pitcherPlayer ? `${pitcherPlayer.name}${pitcherJersey ? ` (#${pitcherJersey})` : ''}` : 'None Selected';
    const currentPitches = pitcherId ? state.playerPitches[pitcherId] || 0 : 0;
    const atBatStartPitches = pitcherId ? (state.atBatStartPitchCounts?.[pitcherId] ?? null) : null;

    // Little League Regulation VI Rest & Workload metrics
    const pitchWorkload = calculatePitchRestDetails(currentPitches, pitcherAge, atBatStartPitches, state.gameDate);
    const maxPitches = pitchWorkload.maxPitches;
    const isPitchWarning = currentPitches >= NNLL_RULES.PITCH_WARNING_THRESHOLD && currentPitches < NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD;
    const isPitchDanger = currentPitches >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD;
    const isDailyMaxHit = pitchWorkload.isDailyMaxReached;
    const fillPercent = Math.min(100, Math.round((currentPitches / maxPitches) * 100));
    const restDaysText = `${pitchWorkload.effectiveRestDaysText} (${pitchWorkload.restDays}d)`;

    // Outs
    const outs = state.currentOuts || 0;

    // Count: Balls and Strikes
    const balls = state.currentBalls || 0;
    const strikes = state.currentStrikes || 0;


    // Batting Carousel / Due Up (Active batting team)
    let activeOrder = [];
    let activeIndex = 0;
    let activePlayerList = [];

    if (isMyTeamBatting) {
      activeOrder = state.battingOrder || [];
      activeIndex = state.currentBatterIndex || 0;
      activePlayerList = state.players || [];
    } else {
      activePlayerList = (typeof this.stateManager?.getOpponentPlayers === 'function')
        ? this.stateManager.getOpponentPlayers()
        : getFallbackOpponentRoster(state);
      activeOrder = (typeof this.stateManager?.getOpponentBattingOrder === 'function')
        ? this.stateManager.getOpponentBattingOrder()
        : (state.opponentBattingOrder?.length ? state.opponentBattingOrder : activePlayerList.map((p) => p.id));
      activeIndex = state.opponentBatterIndex || 0;
    }

    const orderLen = activeOrder.length || 1;
    const curSlot = (activeIndex % orderLen) + 1;
    const onDeckSlot = ((activeIndex + 1) % orderLen) + 1;
    const inHoleSlot = ((activeIndex + 2) % orderLen) + 1;

    const atBatPlayer = orderLen > 0 ? activePlayerList.find((p) => p.id === activeOrder[activeIndex % orderLen]) : null;
    const onDeckPlayer = orderLen > 1 ? activePlayerList.find((p) => p.id === activeOrder[(activeIndex + 1) % orderLen]) : null;
    const inHolePlayer = orderLen > 2 ? activePlayerList.find((p) => p.id === activeOrder[(activeIndex + 2) % orderLen]) : null;

    // Courtesy Runner recommendation (Active only when my team is batting)
    const courtesy = isMyTeamBatting && this.stateManager ? this.stateManager.getCourtesyRunnerRecommendation() : { eligible: false };

    // Base Runners state
    const runners = state.runnersOnBase || { '1B': null, '2B': null, '3B': null };
    const getRunnerDisplayName = (baseKey) => {
      const pId = runners[baseKey];
      if (!pId) return null;
      const p = activePlayerList.find((pl) => pl.id === pId) || state.players.find((pl) => pl.id === pId);
      return p ? `${p.name} (#${p.jerseyNumber})` : 'Runner';
    };
    const r1 = getRunnerDisplayName('1B');
    const r2 = getRunnerDisplayName('2B');
    const r3 = getRunnerDisplayName('3B');
    const runnersDesc = [
      r1 ? `1B: ${r1}` : null,
      r2 ? `2B: ${r2}` : null,
      r3 ? `3B: ${r3}` : null,
    ].filter(Boolean).join(' • ') || 'Bases Empty';

    // Current half inning outs feed
    const currentHalfOuts = (state.outHistory || []).filter(
      (o) => o.inning === curInning && o.half === state.currentHalf
    );

    return `
      <div class="game-tracker-subview">
        <!-- Inning & Half Navigation Strip -->
        <div class="game-inning-bar">
          <div class="inning-pills-wrap">
            <span class="inning-bar-label">INNING:</span>
            ${[1, 2, 3, 4, 5, 6].map((inn) => `
              <button class="game-inn-btn ${curInning === inn ? 'active' : inn < curInning ? 'completed' : ''}" data-inning="${inn}">
                ${inn}
              </button>
            `).join('')}
          </div>
          <div class="half-switch-wrap">
            <button id="btn-toggle-half" class="half-pill-btn" title="Toggle Top (Visiting bats) or Bottom (Home bats)">
              ${isTop ? '▲ TOP (Away Bats)' : '▼ BOT (Home Bats)'}
            </button>
            <button id="btn-half-flip" class="btn btn-secondary btn-sm" title="Advance to next half-inning">
              Next Half ❯
            </button>
          </div>
        </div>

        <!-- 3 Core In-Game Pillars: Runs, Outs, Pitch Counter with Strike/Ball -->
        <div class="game-pillars-grid">
          
          <!-- Pillar 1: Runs & Scoreboard -->
          <div class="game-card game-card-runs">
            <div class="game-card-header">
              <span class="game-card-title">⚾ Runs & Scoreboard</span>
              <span class="game-card-badge">${isTop ? 'TOP' : 'BOT'} Inn ${curInning}</span>
            </div>
            
            <!-- Combined Unified Score Card (Changes Dynamically by Batting Team) -->
            <div class="unified-score-card">
              <!-- Top Matchup Summary Strip -->
              <div class="matchup-header-strip">
                <div class="matchup-team-pill ${isTop ? 'active-batting' : ''}">
                  <span class="team-badge away">AWAY</span>
                  <span class="matchup-team-name" title="${awayTeamName}">${awayTeamName}</span>
                  <span class="matchup-team-score">${awayScore}</span>
                  ${isTop ? '<span class="batting-dot" title="Currently Batting">⚾</span>' : ''}
                </div>
                <span class="matchup-vs-pill">vs</span>
                <div class="matchup-team-pill ${isBottom ? 'active-batting' : ''}">
                  ${isBottom ? '<span class="batting-dot" title="Currently Batting">⚾</span>' : ''}
                  <span class="matchup-team-score">${homeScore}</span>
                  <span class="matchup-team-name" title="${homeTeamName}">${homeTeamName}</span>
                  <span class="team-badge home">HOME</span>
                </div>
              </div>

              <!-- Dynamic Batting Hero Section -->
              <div class="batting-team-hero">
                <div class="batting-hero-meta">
                  <div class="batting-hero-badge">
                    <span class="hero-live-indicator">⚾ NOW BATTING</span>
                    <span class="hero-team-tag ${battingTeamTag.toLowerCase()}">${battingTeamTag}</span>
                  </div>
                  <div class="hero-team-name" title="${battingTeamName}">${battingTeamName}</div>
                </div>

                <div class="batting-hero-action-row">
                  <div class="hero-score-stat">
                    <span class="hero-score-val">${battingScore}</span>
                    <span class="hero-score-label">RUNS</span>
                  </div>
                  <div class="hero-btn-actions">
                    <button id="${battingPlusId}" class="btn-hero-run plus" title="Add 1 Run to ${battingTeamName}">
                      +1 Run
                    </button>
                    <button id="${battingMinusId}" class="btn-hero-run minus" title="Subtract 1 Run from ${battingTeamName}">
                      -1
                    </button>
                  </div>
                </div>
              </div>

              <!-- Opponent / Defense Secondary Strip -->
              <div class="fielding-team-strip">
                <div class="fielding-info-wrap">
                  <span class="fielding-label">DEFENSE:</span>
                  <span class="fielding-name" title="${fieldingTeamName}">${fieldingTeamName}</span>
                  <span class="fielding-side-tag">(${fieldingTeamTag})</span>
                  <span class="fielding-score-badge">${fieldingScore} runs</span>
                </div>
                <div class="fielding-btn-group">
                  <button id="${fieldingPlusId}" class="btn-score-adjust plus btn-xs" title="Add 1 Run to ${fieldingTeamName}">+1</button>
                  <button id="${fieldingMinusId}" class="btn-score-adjust minus btn-xs" title="Subtract 1 Run from ${fieldingTeamName}">-1</button>
                </div>
              </div>
            </div>

            <!-- Half-Inning Runs & 5-Run Limit Rule -->
            <div class="half-runs-strip ${is5RunCap ? 'cap-alert' : ''}">
              <div class="half-runs-info">
                <span>Runs this half (${isTop ? 'TOP' : 'BOT'} ${curInning}): <strong>${curHalfRuns}</strong></span>
                <span class="half-runs-sub">${curInning >= 6 ? 'Open Inning (No 5-run cap in 6th)' : 'NNLL Rule 5.07: Max 5 runs/half-inning'}</span>
              </div>
              ${is5RunCap ? `
                <div class="cap-action-badge">
                  <span>🛑 5-Run Cap Reached!</span>
                  <button id="btn-end-half-5runs" class="btn btn-warning btn-sm">Flip Half Inning ❯</button>
                </div>
              ` : ''}
            </div>

            <!-- Mini 6-Inning Line Score Table -->
            <div class="linescore-table-wrap">
              <table class="linescore-table">
                <thead>
                  <tr>
                    <th>TEAM</th>
                    <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
                    <th>R</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="${isTop ? 'active-row' : ''}">
                    <td class="team-col">${awayTeamName}</td>
                    ${[1, 2, 3, 4, 5, 6].map((i) => `
                      <td class="${curInning === i && isTop ? 'current-cell' : ''}">
                        ${(runsState.innings && runsState.innings[i] && runsState.innings[i].top !== undefined) ? runsState.innings[i].top : '-'}
                      </td>
                    `).join('')}
                    <td class="total-col">${awayScore}</td>
                  </tr>
                  <tr class="${isBottom ? 'active-row' : ''}">
                    <td class="team-col">${homeTeamName}</td>
                    ${[1, 2, 3, 4, 5, 6].map((i) => `
                      <td class="${curInning === i && isBottom ? 'current-cell' : ''}">
                        ${(runsState.innings && runsState.innings[i] && runsState.innings[i].bottom !== undefined) ? runsState.innings[i].bottom : '-'}
                      </td>
                    `).join('')}
                    <td class="total-col">${homeScore}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pillar 2: Outs Tracker & Base Runners -->
          <div class="game-card game-card-outs">
            <div class="game-card-header">
              <span class="game-card-title">⏱ Outs & Base Runners</span>
              <button id="btn-game-out-reset" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 3px 8px;">Reset Outs</button>
            </div>

            <!-- Out Bubbles Indicator -->
            <div class="outs-bubbles-container">
              <div class="outs-bubble-item ${outs >= 1 ? 'filled' : ''}" data-out="1" title="Toggle 1 Out">
                <span class="bubble-circle"></span>
                <span class="bubble-label">1 OUT</span>
              </div>
              <div class="outs-bubble-item ${outs >= 2 ? 'filled' : ''}" data-out="2" title="Toggle 2 Outs">
                <span class="bubble-circle"></span>
                <span class="bubble-label">2 OUTS</span>
              </div>
              <div class="outs-bubble-item ${outs >= 3 ? 'filled' : ''}" data-out="3" title="Toggle 3 Outs">
                <span class="bubble-circle"></span>
                <span class="bubble-label">3 OUTS</span>
              </div>
            </div>

            <!-- Interactive Base Runners Diamond Widget -->
            <div class="base-diamond-section">
              <div class="diamond-grid-wrap">
                <div class="diamond-field-shape">
                  <div class="diamond-base base-2b ${runners['2B'] ? 'occupied' : ''}" data-base="2B" title="2nd Base (${r2 || 'Empty'}) - Tap to manage">
                    <span class="base-tag">2B</span>
                    ${runners['2B'] ? `<span class="base-runner-icon">🏃</span>` : ''}
                  </div>
                  <div class="diamond-base base-3b ${runners['3B'] ? 'occupied' : ''}" data-base="3B" title="3rd Base (${r3 || 'Empty'}) - Tap to manage">
                    <span class="base-tag">3B</span>
                    ${runners['3B'] ? `<span class="base-runner-icon">🏃</span>` : ''}
                  </div>
                  <div class="diamond-base base-1b ${runners['1B'] ? 'occupied' : ''}" data-base="1B" title="1st Base (${r1 || 'Empty'}) - Tap to manage">
                    <span class="base-tag">1B</span>
                    ${runners['1B'] ? `<span class="base-runner-icon">🏃</span>` : ''}
                  </div>
                  <div class="diamond-base base-hp" data-base="HP" title="Home Plate">
                    <span class="base-tag">HP</span>
                  </div>
                </div>
              </div>

              <!-- Base Runner Status Strip -->
              <div class="runners-status-strip">
                <div class="runners-desc">
                  <span class="runners-label">BASE RUNNERS:</span>
                  <span class="runners-names" title="${runnersDesc}">${runnersDesc}</span>
                </div>
                <div class="runners-quick-actions">
                  <button id="btn-quick-runner-1b" class="btn btn-secondary btn-xs" title="Toggle runner on 1st Base">
                    ${runners['1B'] ? 'Clear 1B' : '+ Runner 1B'}
                  </button>
                  <button id="btn-quick-clear-bases" class="btn btn-secondary btn-xs" ${(!runners['1B'] && !runners['2B'] && !runners['3B']) ? 'disabled' : ''} title="Clear all bases">
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            <!-- Outs Action Buttons -->
            <div class="outs-action-buttons">
              <button id="btn-game-record-out" class="btn btn-danger btn-jumbo" title="Record an out with play type, player, and base">
                <span style="font-size: 1.4rem;">🛑</span>
                <span>+1 OUT (Record Play & Base)</span>
              </button>
              ${outs >= 3 ? `
                <button id="btn-game-end-half" class="btn btn-warning btn-jumbo pulse-attention">
                  <span>🔔 3 Outs! End Half Inning ❯</span>
                </button>
              ` : ''}
            </div>

            <!-- Current Half-Inning Outs Feed -->
            ${currentHalfOuts.length > 0 ? `
              <div class="recent-outs-feed">
                <div class="feed-header">
                  <span>Outs Recorded (${isTop ? 'TOP' : 'BOT'} ${curInning}):</span>
                </div>
                <div class="feed-items">
                  ${currentHalfOuts.map(o => `
                    <div class="out-feed-badge">
                      <span class="out-num-pill">${o.outNumber} OUT</span>
                      <strong class="out-name">${o.playerName || 'Player'}</strong>
                      <span class="out-desc">${o.description || (o.outType === 'strikeout' ? 'Strikeout (K)' : `Out at ${o.base}`)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- 2-Outs Courtesy Runner Banner -->
            ${outs === 2 && isMyTeamBatting ? `
              <div class="courtesy-runner-box">
                <div class="courtesy-icon">🏃‍♂️</div>
                <div class="courtesy-details">
                  <strong>2-Out Courtesy Runner Permitted</strong>
                  <p>If Pitcher or Catcher (${courtesy.catcher ? courtesy.catcher.name : 'Catcher'}) is on base, runner must be: 
                  <span class="courtesy-name">${courtesy.recommendedRunner ? `${courtesy.recommendedRunner.name} (#${courtesy.recommendedRunner.jerseyNumber})` : 'player who made last out'}</span>.</p>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Pillar 3: Live Pitch Counter with Strike or Ball -->
          <div class="game-card game-card-pitch">
            <div class="game-card-header">
              <span class="game-card-title">🎯 Live Pitch Counter</span>
              <button id="btn-change-pitcher-game" class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">🔄 Switch Pitcher</button>
            </div>

            <div class="active-pitcher-profile">
              <div class="pitcher-avatar">⚾</div>
              <div class="pitcher-info">
                <div class="pitcher-name">${pitcherName}</div>
                <div class="pitcher-meta-tag">
                  Age ${pitcherAge} • Daily Max: ${maxPitches} pitches (${pitchWorkload.pitchesRemaining} left)
                </div>
                <div class="pitcher-status-sub">
                  ${isDailyMaxHit ? `🚨 Reached Daily Max (${maxPitches})` :
                    pitchWorkload.catcherThresholdExceptionApplies ? '⚠️ Catcher Threshold: Eligible if removed this at-bat' :
                    isPitchDanger ? '🚫 Cannot play Catcher rest of game' :
                    isPitchWarning ? '⚠️ Warning: Near 41-pitch catcher limit' :
                    'Active Pitcher of Record'}
                </div>
              </div>
              <div class="pitcher-count-badge ${isDailyMaxHit || isPitchDanger ? 'danger' : isPitchWarning ? 'warning' : ''}">
                <span class="count-val">${currentPitches}</span>
                <span class="count-unit">/ ${maxPitches} PITCHES</span>
              </div>
            </div>

            <div class="pitch-threshold-bar-game">
              <div class="pitch-fill ${isDailyMaxHit || isPitchDanger ? 'danger' : isPitchWarning ? 'warning' : ''}" style="width: ${fillPercent}%;"></div>
            </div>

            <div class="pitch-markers-game">
              <span>0</span>
              <span>${pitcherAge >= 15 ? '30' : '20'}</span>
              <span class="marker-c-cap">41 (C-Cap)</span>
              <span>${pitcherAge <= 8 ? '50 (Max)' : '50'}</span>
              ${pitcherAge > 8 ? `<span>65</span>` : ''}
              ${pitcherAge > 8 ? `<span>${maxPitches} (Max)</span>` : ''}
            </div>

            <div class="pitch-rest-callout">
              <div class="rest-row-main">
                <span class="rest-label">MANDATORY REST:</span>
                <span class="rest-value">${pitchWorkload.effectiveRestDaysText} (${pitchWorkload.restDays} Calendar Days)</span>
              </div>
              <div class="rest-row-sub">
                <span class="rest-date-icon">📅</span> Next Eligible to Pitch: <strong>${pitchWorkload.formattedNextEligibleDate}</strong>
              </div>
              ${pitchWorkload.thresholdExceptionActive ? `
                <div class="threshold-exception-banner">
                  ⚡ <strong>Threshold Exception:</strong> Started batter at <strong>${pitchWorkload.thresholdStartPitches}</strong> pitches. If removed after this batter, rest is charged at ${pitchWorkload.thresholdStartPitches} pitches (${pitchWorkload.effectiveRestDaysText})${pitchWorkload.catcherThresholdExceptionApplies ? ' & remains eligible to catch' : ''}!
                </div>
              ` : ''}
            </div>

            <!-- At-Bat Count Tracker (Balls & Strikes) -->
            <div class="atbat-count-box">
              <div class="count-digital-header">
                <span class="count-title">BATTER COUNT:</span>
                <span class="count-digital">${balls} - ${strikes}</span>
                <button id="btn-count-reset" class="btn btn-secondary btn-xs" title="Reset batter count to 0-0">Reset Count</button>
              </div>

              <div class="count-indicators-row">
                <!-- Balls -->
                <div class="count-indicator-group balls-group">
                  <span class="count-sub-label">BALLS:</span>
                  <div class="count-dots">
                    ${[1, 2, 3, 4].map(bNum => `
                      <span class="count-dot ball-dot ${balls >= bNum ? 'active' : ''}"></span>
                    `).join('')}
                  </div>
                </div>

                <!-- Strikes -->
                <div class="count-indicator-group strikes-group">
                  <span class="count-sub-label">STRIKES:</span>
                  <div class="count-dots">
                    ${[1, 2, 3].map(sNum => `
                      <span class="count-dot strike-dot ${strikes >= sNum ? 'active' : ''}"></span>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <!-- Primary Strike and Ball Pitch Buttons -->
            <div class="pitch-strike-ball-buttons">
              <button id="btn-pitch-strike" class="btn btn-pitch-action btn-pitch-strike" ${!pitcherId ? 'disabled' : ''}>
                <span class="btn-pitch-icon">🔴</span>
                <div class="btn-pitch-content">
                  <strong class="btn-pitch-main">STRIKE</strong>
                  <span class="btn-pitch-sub">+1 Pitch & Strike</span>
                </div>
              </button>

              <button id="btn-pitch-ball" class="btn btn-pitch-action btn-pitch-ball" ${!pitcherId ? 'disabled' : ''}>
                <span class="btn-pitch-icon">🟢</span>
                <div class="btn-pitch-content">
                  <strong class="btn-pitch-main">BALL</strong>
                  <span class="btn-pitch-sub">+1 Pitch & Ball</span>
                </div>
              </button>
            </div>

            <!-- Secondary Pitch Actions -->
            <div class="pitch-secondary-buttons">
              <button id="btn-pitch-inplay" class="btn btn-secondary btn-sm" ${!pitcherId ? 'disabled' : ''} title="Ball put in play (+1 Pitch, resets count)">
                ⚾ In Play (+1)
              </button>
              <button id="btn-pitch-foul" class="btn btn-secondary btn-sm" ${!pitcherId ? 'disabled' : ''} title="Foul ball (+1 Pitch, adds strike if < 2)">
                ⚠️ Foul (+1)
              </button>
              <button id="btn-pitch-hbp" class="btn btn-secondary btn-sm" ${!pitcherId ? 'disabled' : ''} title="Hit by pitch (+1 Pitch, awards 1B, advances forced runners & batter)">
                💥 Hit Batter (+1)
              </button>
              <button id="btn-pitch-plus1-game" class="btn btn-secondary btn-sm" ${!pitcherId ? 'disabled' : ''} title="Generic +1 pitch without count change">
                +1 Generic
              </button>
              <button id="btn-pitch-undo-game" class="btn btn-secondary btn-sm" title="Undo last pitch & count">
                ↩ Undo Pitch
              </button>
            </div>
          </div>
        </div>

        <!-- Continuous Batting Order (Due Up) -->
        <div class="game-secondary-grid">
          <div class="game-card game-card-batting">
            <div class="game-card-header">
              <div class="batting-header-info">
                <div class="batting-title-row">
                  <span class="game-card-title">📋 Continuous Batting Order (Due Up)</span>
                  <span class="batting-status-pill ${isMyTeamBatting ? 'pill-batting-myteam' : 'pill-batting-opponent'}">
                    ${isMyTeamBatting ? `⚾ ${state.teamName} (At Bat)` : `⚾ ${battingTeamName} (At Bat)`}
                  </span>
                </div>
                <span class="batting-field-sub">
                  ${isOpponentBatting
                    ? `🛡️ <strong>${state.teamName}</strong> in Field (Defense) • Opponent Lineup Active`
                    : `🛡️ <strong>${fieldingTeamName}</strong> in Field (Defense) • ${state.teamName} Offense`}
                </span>
              </div>
              <div class="batting-nav-btns">
                <button id="btn-batter-prev" class="btn btn-secondary btn-sm" title="Previous batter">❮ Prev</button>
                <button id="btn-batter-next" class="btn btn-primary btn-sm" title="Advance to next batter">Next Batter ❯</button>
              </div>
            </div>

            <div class="due-up-list">
              <div class="due-up-item at-bat-item ${isOpponentBatting ? 'opponent-atbat' : ''}">
                <div class="due-up-badge badge-atbat">AT BAT</div>
                <div class="due-up-info">
                  <strong>${atBatPlayer ? atBatPlayer.name : 'Batter 1'}</strong>
                  <span>Jersey #${atBatPlayer ? atBatPlayer.jerseyNumber : '--'} • Slot ${curSlot} (${battingTeamName})</span>
                </div>
                <span class="due-up-icon">🎯</span>
              </div>

              <div class="due-up-item on-deck-item">
                <div class="due-up-badge badge-ondeck">ON DECK</div>
                <div class="due-up-info">
                  <strong>${onDeckPlayer ? onDeckPlayer.name : 'Batter 2'}</strong>
                  <span>Jersey #${onDeckPlayer ? onDeckPlayer.jerseyNumber : '--'} • Slot ${onDeckSlot} (${battingTeamName})</span>
                </div>
                <span class="due-up-icon">🟡</span>
              </div>

              <div class="due-up-item in-hole-item">
                <div class="due-up-badge badge-inhole">IN HOLE</div>
                <div class="due-up-info">
                  <strong>${inHolePlayer ? inHolePlayer.name : 'Batter 3'}</strong>
                  <span>Jersey #${inHolePlayer ? inHolePlayer.jerseyNumber : '--'} • Slot ${inHoleSlot} (${battingTeamName})</span>
                </div>
                <span class="due-up-icon">⚪</span>
              </div>
            </div>

            <!-- In-Game Roster Modifiers / Opponent Lineup Controls -->
            <div class="game-modifiers-row">
              <span class="mod-title">${isOpponentBatting ? `Opponent Lineup (${battingTeamName}):` : `Live In-Game Adjustments (${state.teamName}):`}</span>
              ${isOpponentBatting ? `
                <button id="btn-edit-opp-lineup" class="btn btn-secondary btn-sm" title="View or edit opponent batter names and order">📋 Edit Opponent Lineup</button>
                <button id="btn-game-injured" class="btn btn-warning btn-sm" title="Record defense injury/absence">🚑 Player Injured / Out</button>
                <button id="btn-game-recalculate" class="btn btn-secondary btn-sm" title="Re-solve downstream innings">🔄 Re-solve</button>
              ` : `
                <button id="btn-game-late" class="btn btn-secondary btn-sm">➕ Late Arrival</button>
                <button id="btn-game-injured" class="btn btn-warning btn-sm">🚑 Player Injured / Out</button>
                <button id="btn-game-recalculate" class="btn btn-secondary btn-sm" title="Re-solve downstream innings">🔄 Re-solve</button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getActivePitcherName(state) {
    if (!state.activePitcherId) return 'None Selected';
    const p = state.players.find((pl) => pl.id === state.activePitcherId);
    return p ? `${p.name} (#${p.jerseyNumber})` : 'Unknown';
  }

  renderCoachProfile() {
    if (!this.authService) return '';
    const user = this.authService.getCurrentUser();
    if (!user) return '';

    const isSuper = isSuperAdmin(user.email);
    const displayName = user.displayName || user.email || 'Coach';
    const initial = displayName.charAt(0).toUpperCase();
    const role = isSuper ? '🛡️ Super Admin' : (user.isOfflineDemo ? 'Field Coach' : 'Manager');

    return `
      <div class="coach-profile-section" id="coach-profile-header-widget">
        <div class="coach-avatar" title="${user.email || displayName}">
          ${user.photoURL ? `<img src="${user.photoURL}" class="coach-avatar-img" alt="Coach photo">` : initial}
        </div>
        <div class="coach-meta">
          <span class="coach-name" title="${user.email || displayName}">${displayName}</span>
          <span class="coach-role-badge ${isSuper ? 'badge-super-admin' : ''}">${role}</span>
        </div>
        <button id="btn-coach-signout" class="btn-signout" title="Sign out of Dugout Admin">Sign Out</button>
      </div>
    `;
  }

  renderMobileNav(state) {
    const pitcherId = state.activePitcherId;
    const currentPitches = pitcherId ? state.playerPitches[pitcherId] || 0 : 0;
    const isPitchWarning = currentPitches >= NNLL_RULES.PITCH_WARNING_THRESHOLD;
    const isPitchDanger = currentPitches >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD;
    const activeTab = this.mobileTab || 'defense';

    return `
      <nav class="mobile-view-nav" aria-label="Dugout Views Menu">
        <button class="mobile-nav-btn ${activeTab === 'defense' ? 'active' : ''}" data-tab="defense" title="Lineup & Defensive Rotation">
          <span class="nav-icon">⚾</span>
          <span class="nav-label">Defense</span>
        </button>
        <button class="mobile-nav-btn ${activeTab === 'pitching' ? 'active' : ''}" data-tab="pitching" title="Live Pitch Counter">
          <span class="nav-icon">🎯</span>
          <span class="nav-label">Pitches</span>
          <span class="nav-badge ${isPitchDanger ? 'danger' : isPitchWarning ? 'warn' : ''}">
            ${currentPitches}
          </span>
        </button>
        <button class="mobile-nav-btn ${activeTab === 'game' ? 'active' : ''}" data-tab="game" title="Innings & Outs Progression">
          <span class="nav-icon">⏱</span>
          <span class="nav-label">Inn ${state.currentInning}</span>
          <span class="nav-badge">${state.currentOuts || 0}O</span>
        </button>
        <button class="mobile-nav-btn ${activeTab === 'menu' ? 'active' : ''}" data-tab="menu" title="Dugout Operations & Menu">
          <span class="nav-icon">⚡</span>
          <span class="nav-label">Menu</span>
        </button>
        <button class="mobile-nav-btn ${activeTab === 'all' ? 'active' : ''}" data-tab="all" title="Full Dashboard View">
          <span class="nav-icon">📱</span>
          <span class="nav-label">All</span>
        </button>
      </nav>
    `;
  }

  renderMobileMenuHub(state) {
    const user = this.authService ? this.authService.getCurrentUser() : null;
    const coachDisplayName = user ? (user.displayName || user.email || 'Coach') : 'Coach';
    const coachInitial = coachDisplayName.charAt(0).toUpperCase();
    const coachRole = user ? (user.isOfflineDemo ? 'Field Coach' : 'Manager') : 'Manager';

    return `
      <div class="mobile-section-menu mobile-hub-container">
        <div class="mobile-hub-header">
          <div class="mobile-hub-header-top">
            <img src="icon.jpeg" alt="dugout-admin Logo" class="hub-logo" width="44" height="44" />
            <div>
              <div class="hub-header-badge">NNLL DUGOUT OPERATIONS</div>
              <h3 class="hub-header-title">dugout-admin</h3>
            </div>
          </div>
          <p class="hub-header-subtitle">Select any dugout tool or modal below for focused single-task management.</p>
        </div>

        <div class="mobile-hub-grid">
          <button class="mobile-hub-card" id="btn-hub-lineup">
            <div class="hub-card-icon-wrap" style="background: rgba(37, 99, 235, 0.2); color: #60a5fa;">📋</div>
            <div class="hub-card-text">
              <strong class="hub-card-title">Lineup & Attendance</strong>
              <span class="hub-card-desc">Drag batting order, toggle Present / Unavailable</span>
            </div>
            <span class="hub-card-arrow">›</span>
          </button>

          <button class="mobile-hub-card" id="btn-hub-teams">
            <div class="hub-card-icon-wrap" style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7;">👥</div>
            <div class="hub-card-text">
              <strong class="hub-card-title">Teams & Season Stats</strong>
              <span class="hub-card-desc">Switch team, manage roster, safety tags & Firestore sync</span>
            </div>
            <span class="hub-card-arrow">›</span>
          </button>

          <button class="mobile-hub-card" id="btn-hub-late">
            <div class="hub-card-icon-wrap" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8;">➕</div>
            <div class="hub-card-text">
              <strong class="hub-card-title">Late Arrival</strong>
              <span class="hub-card-desc">Append late player to bottom of continuous batting order</span>
            </div>
            <span class="hub-card-arrow">›</span>
          </button>

          <button class="mobile-hub-card" id="btn-hub-injured">
            <div class="hub-card-icon-wrap" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">🚑</div>
            <div class="hub-card-text">
              <strong class="hub-card-title">Player Injured / Left Early</strong>
              <span class="hub-card-desc">Skip batting spot without penalty & rebalance field</span>
            </div>
            <span class="hub-card-arrow">›</span>
          </button>

          <button class="mobile-hub-card" id="btn-hub-resolve">
            <div class="hub-card-icon-wrap" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">🔄</div>
            <div class="hub-card-text">
              <strong class="hub-card-title">Re-solve Downstream</strong>
              <span class="hub-card-desc">Recalculate remaining defensive rotation with safety rules</span>
            </div>
            <span class="hub-card-arrow">›</span>
          </button>

          <button class="mobile-hub-card" id="btn-hub-newgame">
            <div class="hub-card-icon-wrap" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">⚙</div>
            <div class="hub-card-text">
              <strong class="hub-card-title">New Game Setup</strong>
              <span class="hub-card-desc">Start new match, load presets or custom opponent</span>
            </div>
            <span class="hub-card-arrow">›</span>
          </button>

          <button class="mobile-hub-card" id="btn-hub-print">
            <div class="hub-card-icon-wrap" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc;">🖨</div>
            <div class="hub-card-text">
              <strong class="hub-card-title">Printable Lineup Card</strong>
              <span class="hub-card-desc">Official umpire sheet & dugout printable rotation</span>
            </div>
            <span class="hub-card-arrow">›</span>
          </button>

          <button class="mobile-hub-card" id="btn-hub-install">
            <div class="hub-card-icon-wrap" style="background: rgba(249, 115, 22, 0.2); color: #fb923c;">📲</div>
            <div class="hub-card-text">
              <strong class="hub-card-title">Install Mobile App</strong>
              <span class="hub-card-desc">Add Dugout Admin to your phone's Home Screen for offline dugout use</span>
            </div>
            <span class="hub-card-arrow">›</span>
          </button>
        </div>

        <div class="mobile-hub-coach-card">
          <div class="coach-avatar">${coachInitial}</div>
          <div class="coach-details" style="flex: 1;">
            <strong style="color: #fff; font-size: 0.88rem;">${coachDisplayName}</strong>
            <div style="font-size: 0.75rem; color: #94a3b8;">${coachRole} • Project: <span style="color: #38bdf8; font-family: monospace;">dugout-admin-916c8</span></div>
          </div>
          ${user ? `<button id="btn-hub-signout" class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">Sign Out</button>` : ''}
        </div>
      </div>
    `;
  }

  renderAlerts(validation) {
    if (!validation) return '';
    const items = [];

    validation.hardViolations.forEach((v) => {
      items.push(`
        <div class="alert-banner urgent">
          <span>⚠️ <strong>Mandatory Rule Violation:</strong> ${v.message}</span>
        </div>
      `);
    });

    validation.urgentAlerts.forEach((a) => {
      items.push(`
        <div class="alert-banner warning">
          <span>🔔 <strong>Dugout Alert:</strong> ${a.message}</span>
        </div>
      `);
    });

    validation.softWarnings.forEach((w) => {
      items.push(`
        <div class="alert-banner info">
          <span>ℹ️ <strong>Heuristic Notice:</strong> ${w.message}</span>
        </div>
      `);
    });

    return items.join('');
  }

  renderPitchTracker(state) {
    const pitcherId = state.activePitcherId;
    const currentPitches = pitcherId ? state.playerPitches[pitcherId] || 0 : 0;
    const isWarning = currentPitches >= NNLL_RULES.PITCH_WARNING_THRESHOLD && currentPitches < NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD;
    const isDanger = currentPitches >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD;

    const fillPercent = Math.min(100, Math.round((currentPitches / 85) * 100));

    return `
      <div class="pitch-tracker-body">
        <div class="pitch-counter-display">
          <span class="pitch-number ${isDanger ? 'danger' : isWarning ? 'warning' : ''}">${currentPitches}</span>
          <div class="pitch-meta">
            <span>PITCHES</span>
            <span>${isDanger ? '🚫 CANNOT CATCH' : isWarning ? '⚠️ NEAR 41 CAP' : 'REGULATION'}</span>
          </div>
        </div>

        <div class="pitch-controls">
          <button id="btn-pitch-plus1" class="btn btn-primary pitch-btn-increment" ${!pitcherId ? 'disabled' : ''}>+1 Pitch</button>
          <button id="btn-pitch-plus3" class="btn btn-secondary pitch-btn-increment" ${!pitcherId ? 'disabled' : ''}>+3</button>
          <button id="btn-pitch-undo" class="btn btn-secondary btn-sm" title="Undo pitch">↩ Undo</button>
          <button id="btn-change-pitcher" class="btn btn-secondary btn-sm">🔄 Switch Pitcher</button>
        </div>

        <div class="pitch-threshold-bar">
          <div class="pitch-threshold-fill ${isDanger ? 'danger' : isWarning ? 'warning' : ''}" style="width: ${fillPercent}%;"></div>
        </div>

        <div class="threshold-markers" style="width: 100%;">
          <span>0</span>
          <span title="Rest Threshold 1">35</span>
          <span title="Catcher Prohibition Barrier (41+)">41 (C-Cap)</span>
          <span title="Threshold 2">50</span>
          <span title="Threshold 3">65</span>
          <span title="Max daily (Age 9-10)">75</span>
          <span title="Max daily (Age 11-12)">85</span>
        </div>
      </div>
    `;
  }

  renderGameControls(state) {
    const outs = state.currentOuts || 0;

    return `
      <div class="game-control-body">
        <div class="inning-selector">
          ${[1, 2, 3, 4, 5, 6].map((inn) => `
            <button class="inning-btn ${state.currentInning === inn ? 'active' : inn < state.currentInning ? 'completed' : ''}" data-inning="${inn}">
              ${inn}
            </button>
          `).join('')}
        </div>

        <div class="outs-indicator">
          <span style="font-size: 0.85rem; font-weight: 700; color: #cbd5e1; margin-right: 4px;">OUTS:</span>
          <div class="out-bubble ${outs >= 1 ? 'filled' : ''}" data-out="1" title="1 Out"></div>
          <div class="out-bubble ${outs >= 2 ? 'filled' : ''}" data-out="2" title="2 Outs"></div>
          <div class="out-bubble ${outs >= 3 ? 'filled' : ''}" data-out="3" title="3 Outs (Inning End)"></div>
          <button id="btn-record-out" class="btn btn-danger btn-sm" style="margin-left: 8px;">+1 Out</button>
        </div>
      </div>
    `;
  }

  renderCourtesyRunnerTray(state) {
    const courtesy = this.stateManager.getCourtesyRunnerRecommendation();
    if (state.currentOuts !== 2) return '';

    return `
      <div class="courtesy-runner-badge">
        <span style="font-size: 1.2rem;">🏃‍♂️</span>
        <div style="flex: 1;">
          <strong>2-Out Courtesy Runner Alert:</strong> If the Catcher (${courtesy.catcher ? courtesy.catcher.name : 'Current Catcher'}) is on base, the courtesy runner MUST be: 
          <strong>${courtesy.recommendedRunner ? `${courtesy.recommendedRunner.name} (#${courtesy.recommendedRunner.jerseyNumber})` : 'the batter who made the last out'}</strong>.
        </div>
      </div>
    `;
  }

  renderInningHeaders(state) {
    const headers = [];
    for (let i = 1; i <= state.scheduledInnings; i++) {
      const isActive = state.currentInning === i;
      headers.push(`
        <th class="col-inning ${isActive ? 'active-col' : ''}">
          Inn ${i} ${isActive ? '⚡' : ''}
        </th>
      `);
    }
    return headers.join('');
  }

  renderPlayerRows(state, validation) {
    const playerStats = validation ? validation.playerStats : {};
    const rows = [];

    // Continuous Batting Order
    state.battingOrder.forEach((pId, orderIdx) => {
      const player = state.players.find((p) => p.id === pId);
      if (!player) return;

      const st = playerStats[pId] || {};
      const isInjured = player.isOut;
      const isLate = player.isLate;

      // Check urgent Inning 4 infield warning
      const needsInfieldAlert = state.currentInning === 3 && st.inningsPlayedInfield === 0 && !player.isOut;
      const failedInfieldBy4 = state.scheduledInnings >= 4 && st.infieldInningsBy4 === 0 && !player.isOut;

      rows.push(`
        <tr class="lineup-drag-row ${isInjured ? 'row-injured' : ''} ${player.isOut ? 'row-absent' : ''}"
            draggable="true"
            data-player-id="${player.id}"
            data-slot-idx="${orderIdx}">
          <td class="col-player">
            <div class="player-cell">
              <span class="drag-handle" title="Drag up or down to reorder batting lineup" draggable="false">⠿</span>
              <div class="lineup-order-controls">
                <button class="btn-lineup-order btn-order-up" data-player-id="${player.id}" ${orderIdx === 0 ? 'disabled' : ''} title="Move ${player.name} UP in batting order">▲</button>
                <span class="batting-slot-num" title="Batting Slot #${orderIdx + 1}">${orderIdx + 1}</span>
                <button class="btn-lineup-order btn-order-down" data-player-id="${player.id}" ${orderIdx === state.battingOrder.length - 1 ? 'disabled' : ''} title="Move ${player.name} DOWN in batting order">▼</button>
              </div>
              <span class="jersey-num">#${player.jerseyNumber}</span>
              <div class="player-details">
                <div class="player-name-row">
                  <span class="player-name">${player.name}${player.age ? ` <span class="player-age-sub" style="font-size: 0.75rem; color: #94a3b8; font-weight: 500;">(Age ${player.age})</span>` : ''}</span>
                  <button class="btn-status-pill ${player.isOut ? 'pill-absent' : 'pill-present'}" data-player-id="${player.id}" title="Click to toggle Present / Unavailable">
                    ${player.isOut ? (player.outReason || 'Absent') : 'Present'}
                  </button>
                </div>
                <div class="player-tags">
                  ${(player.canPitch ?? player.eligiblePositions?.canPitch) ? '<span class="tag-badge tag-p">P</span>' : ''}
                  ${(player.canCatch ?? player.eligiblePositions?.canCatch) ? '<span class="tag-badge tag-c">C</span>' : ''}
                  ${needsInfieldAlert ? '<span class="tag-badge tag-warning">IF Req Inn 4</span>' : ''}
                  ${failedInfieldBy4 ? '<span class="tag-badge tag-danger">No IF in 1-4</span>' : ''}
                </div>
              </div>
            </div>
          </td>

          <!-- Inning Columns -->
          ${this.renderInningCells(player, state)}

          <!-- Stats Columns -->
          <td>
            <span class="stat-pill ${st.infieldInningsBy4 >= 1 ? 'ok' : failedInfieldBy4 ? 'danger' : 'warn'}">
              ${st.infieldInningsBy4 || 0}
            </span>
          </td>
          <td><span class="stat-pill">${st.inningsPlayedInfield || 0}</span></td>
          <td><span class="stat-pill">${st.inningsPlayedOutfield || 0}</span></td>
          <td>
            <span class="stat-pill ${st.totalBenchInnings > 2 ? 'danger' : st.totalBenchInnings === 2 ? 'warn' : 'ok'}">
              ${st.totalBenchInnings || 0}
            </span>
          </td>
          <td>
            <span class="stat-pill ${st.pitchesThrown >= 41 ? 'danger' : st.pitchesThrown >= 35 ? 'warn' : ''}">
              ${st.pitchesThrown || 0}
            </span>
          </td>
        </tr>
      `);
    });

    // Also display any players marked absent / unavailable not in active batting lineup
    const unlistedPlayers = state.players.filter((p) => !state.battingOrder.includes(p.id));
    unlistedPlayers.forEach((player) => {
      rows.push(`
        <tr class="row-absent">
          <td class="col-player">
            <div class="player-cell">
              <span class="batting-slot-num slot-inactive" title="Unavailable / Not in batting lineup">—</span>
              <span class="jersey-num">#${player.jerseyNumber}</span>
              <div class="player-details">
                <div class="player-name-row">
                  <span class="player-name">${player.name} (${player.outReason || 'Unavailable'})</span>
                  <button class="btn-status-pill pill-absent" data-player-id="${player.id}" title="Click to mark Present & add to lineup">
                    Set Present
                  </button>
                </div>
                <div class="player-tags">
                  ${(player.canPitch ?? player.eligiblePositions?.canPitch) ? '<span class="tag-badge tag-p">P</span>' : ''}
                  ${(player.canCatch ?? player.eligiblePositions?.canCatch) ? '<span class="tag-badge tag-c">C</span>' : ''}
                </div>
              </div>
            </div>
          </td>
          ${this.renderInningCells(player, state)}
          <td><span class="stat-pill">0</span></td>
          <td><span class="stat-pill">0</span></td>
          <td><span class="stat-pill">0</span></td>
          <td><span class="stat-pill">0</span></td>
          <td><span class="stat-pill">0</span></td>
        </tr>
      `);
    });

    return rows.join('');
  }

  renderInningCells(player, state) {
    const cells = [];
    const pId = player.id;

    for (let innIdx = 0; innIdx < state.scheduledInnings; innIdx++) {
      const inningNum = innIdx + 1;
      const inningRec = state.innings[innIdx];
      let assignedPos = 'BENCH';

      if (inningRec && inningRec.assignments) {
        for (const [pos, assignedId] of Object.entries(inningRec.assignments)) {
          if (assignedId === pId) {
            assignedPos = pos;
            break;
          }
        }
      }

      const isBench = assignedPos === 'BENCH';
      const isInfield = INFIELD_POSITIONS.includes(assignedPos);
      const isOutfield = OUTFIELD_POSITIONS.includes(assignedPos);
      const isLocked = inningNum < state.currentInning;

      const isSelected = this.selectedSwapCell &&
        this.selectedSwapCell.inningNum === inningNum &&
        this.selectedSwapCell.playerId === pId;

      let badgeClass = 'slot-bench';
      if (isInfield) {
        badgeClass = assignedPos === 'P' ? 'slot-infield p-slot' : assignedPos === 'C' ? 'slot-infield c-slot' : 'slot-infield';
      } else if (isOutfield) {
        badgeClass = 'slot-outfield';
      }

      cells.push(`
        <td class="${isLocked ? 'cell-locked' : ''}">
          <button 
            class="slot-badge ${badgeClass} ${isSelected ? 'selected-swap' : ''}"
            data-inning="${inningNum}"
            data-player-id="${pId}"
            data-position="${assignedPos}"
            title="${POSITION_NAMES[assignedPos] || assignedPos} - Click to swap"
          >
            ${assignedPos}
          </button>
        </td>
      `);
    }

    return cells.join('');
  }

  bindEvents(state) {
    if (typeof document === 'undefined') return;
    // Primary View Mode Switcher (Planning View vs Game Tracker)
    const togglePlanning = document.getElementById('toggle-mode-planning');
    if (togglePlanning) {
      togglePlanning.onclick = () => {
        this.appViewMode = 'planning';
        localStorage.setItem('dugout_app_view_mode', 'planning');
        this.render({
          state: this.stateManager.state,
          validation: this.stateManager.validate(),
          canUndo: this.stateManager.historyIndex > 0,
          canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
        });
      };
    }
    const toggleGame = document.getElementById('toggle-mode-game');
    if (toggleGame) {
      toggleGame.onclick = () => {
        this.appViewMode = 'game';
        localStorage.setItem('dugout_app_view_mode', 'game');
        this.render({
          state: this.stateManager.state,
          validation: this.stateManager.validate(),
          canUndo: this.stateManager.historyIndex > 0,
          canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
        });
      };
    }

    // Return to Black Bats from View Only mode
    const btnBackBlackBats = document.getElementById('btn-back-to-blackbats');
    if (btnBackBlackBats) {
      btnBackBlackBats.onclick = async () => {
        const { teamStorage } = await import('./team-storage.js');
        const teamId = 'team-black-bats-6589';
        const profile = await teamStorage.getTeamProfile(teamId);
        const roster = await teamStorage.getTeamRoster(teamId);
        if (profile && roster) {
          this.stateManager.initNewGame({
            teamId: profile.teamId,
            teamName: profile.teamName,
            opponentName: profile.opponentName || 'River Cats',
            isHomeTeam: true,
            players: roster,
          });
        }
      };
    }

    // --- GAME VIEW SPECIFIC EVENT HANDLERS ---
    // Subview Switches (Line-Up vs Game Tracker) - Wired to both top subnav and bottom taskbar
    const switchSubView = (tabKey) => {
      this.gameLayoutTab = tabKey;
      localStorage.setItem('dugout_game_layout_tab', tabKey);
      this.render({
        state: this.stateManager.state,
        validation: this.stateManager.validate(),
        canUndo: this.stateManager.historyIndex > 0,
        canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
      });
    };

    const btnTaskbarLineup = document.getElementById('btn-taskbar-lineup');
    if (btnTaskbarLineup) btnTaskbarLineup.onclick = () => switchSubView('lineup');

    const btnSubnavLineup = document.getElementById('btn-subnav-lineup');
    if (btnSubnavLineup) btnSubnavLineup.onclick = () => switchSubView('lineup');

    const btnTaskbarTracker = document.getElementById('btn-taskbar-tracker');
    if (btnTaskbarTracker) btnTaskbarTracker.onclick = () => switchSubView('tracker');

    const btnSubnavTracker = document.getElementById('btn-subnav-tracker');
    if (btnSubnavTracker) btnSubnavTracker.onclick = () => switchSubView('tracker');

    // --- LINE-UP SUBVIEW EVENT HANDLERS ---
    // Inning pills in Line-Up View
    document.querySelectorAll('.lineup-inn-pill').forEach((pill) => {
      pill.onclick = () => {
        this.gameLineupInning = parseInt(pill.getAttribute('data-inning'), 10);
        this.render({
          state: this.stateManager.state,
          validation: this.stateManager.validate(),
          canUndo: this.stateManager.historyIndex > 0,
          canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
        });
      };
    });

    const btnJumpLive = document.getElementById('btn-jump-live-inning');
    if (btnJumpLive) {
      btnJumpLive.onclick = () => {
        this.gameLineupInning = state.currentInning || 1;
        this.render({
          state: this.stateManager.state,
          validation: this.stateManager.validate(),
          canUndo: this.stateManager.historyIndex > 0,
          canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
        });
      };
    }

    const btnOptInning = document.getElementById('btn-optimize-this-inning');
    if (btnOptInning) {
      btnOptInning.onclick = () => {
        this.stateManager.recalculateDefensiveGrid(this.gameLineupInning || 1);
        this.stateManager.notify();
      };
    }

    // Position Selectors in Line-Up View
    document.querySelectorAll('.game-lineup-pos-select').forEach((sel) => {
      sel.onchange = (e) => {
        const playerId = e.target.getAttribute('data-player-id');
        const inningNum = parseInt(e.target.getAttribute('data-inning'), 10);
        const newPos = e.target.value;
        this.stateManager.assignPlayerToPosition(inningNum, newPos, playerId);
      };
    });

    // Batting Order Slot Adjusters in Line-Up View
    document.querySelectorAll('.btn-lineup-move-up').forEach((btn) => {
      btn.onclick = () => {
        const pId = btn.getAttribute('data-player-id');
        this.stateManager.movePlayerInBattingOrder(pId, 'UP');
      };
    });

    document.querySelectorAll('.btn-lineup-move-down').forEach((btn) => {
      btn.onclick = () => {
        const pId = btn.getAttribute('data-player-id');
        this.stateManager.movePlayerInBattingOrder(pId, 'DOWN');
      };
    });

    // Tap-to-Swap in Line-Up View
    const handleSwapTap = (pId, pos, innNum) => {
      if (!pId) return;
      if (!this.selectedSwapCell) {
        this.selectedSwapCell = { inningNum: innNum, playerId: pId, position: pos };
        this.render({
          state: this.stateManager.state,
          validation: this.stateManager.validate(),
          canUndo: this.stateManager.historyIndex > 0,
          canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
        });
      } else {
        if (this.selectedSwapCell.playerId === pId) {
          this.selectedSwapCell = null;
        } else {
          const firstPId = this.selectedSwapCell.playerId;
          this.selectedSwapCell = null;
          this.stateManager.swapPositions(innNum, firstPId, pId);
        }
        this.render({
          state: this.stateManager.state,
          validation: this.stateManager.validate(),
          canUndo: this.stateManager.historyIndex > 0,
          canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
        });
      }
    };

    document.querySelectorAll('.btn-lineup-swap-tap').forEach((btn) => {
      btn.onclick = () => {
        const pId = btn.getAttribute('data-player-id');
        const pos = btn.getAttribute('data-pos');
        const inn = parseInt(btn.getAttribute('data-inning'), 10);
        handleSwapTap(pId, pos, inn);
      };
    });

    document.querySelectorAll('.field-pos-box').forEach((box) => {
      box.onclick = () => {
        const pId = box.getAttribute('data-player-id');
        const pos = box.getAttribute('data-position');
        const inn = parseInt(box.getAttribute('data-inning'), 10);
        handleSwapTap(pId, pos, inn);
      };
    });

    // --- GAME TRACKER EVENT HANDLERS ---
    // Runs Score Adjusters
    const btnAwayPlus = document.getElementById('btn-run-away-plus');
    if (btnAwayPlus) btnAwayPlus.onclick = () => this.stateManager.recordRun(state.isHomeTeam ? 'opponent' : 'home', 1);

    const btnAwayMinus = document.getElementById('btn-run-away-minus');
    if (btnAwayMinus) btnAwayMinus.onclick = () => this.stateManager.recordRun(state.isHomeTeam ? 'opponent' : 'home', -1);

    const btnHomePlus = document.getElementById('btn-run-home-plus');
    if (btnHomePlus) btnHomePlus.onclick = () => this.stateManager.recordRun(state.isHomeTeam ? 'home' : 'opponent', 1);

    const btnHomeMinus = document.getElementById('btn-run-home-minus');
    if (btnHomeMinus) btnHomeMinus.onclick = () => this.stateManager.recordRun(state.isHomeTeam ? 'home' : 'opponent', -1);

    // Half-Inning Flips
    const btnToggleHalf = document.getElementById('btn-toggle-half');
    if (btnToggleHalf) btnToggleHalf.onclick = () => this.stateManager.switchHalfInning();

    const btnHalfFlip = document.getElementById('btn-half-flip');
    if (btnHalfFlip) btnHalfFlip.onclick = () => this.stateManager.switchHalfInning();

    const btnEndHalf5Runs = document.getElementById('btn-end-half-5runs');
    if (btnEndHalf5Runs) btnEndHalf5Runs.onclick = () => this.stateManager.switchHalfInning();

    const btnGameEndHalf = document.getElementById('btn-game-end-half');
    if (btnGameEndHalf) btnGameEndHalf.onclick = () => this.stateManager.switchHalfInning();

    // Outs Controls in Game View
    const btnGameRecordOut = document.getElementById('btn-game-record-out');
    if (btnGameRecordOut) btnGameRecordOut.onclick = () => this.showRecordOutModal(state);

    const btnGameOutReset = document.getElementById('btn-game-out-reset');
    if (btnGameOutReset) btnGameOutReset.onclick = () => this.stateManager.resetOuts();

    document.querySelectorAll('.outs-bubble-item').forEach((item) => {
      item.onclick = () => {
        const outNum = parseInt(item.getAttribute('data-out'), 10);
        this.stateManager.setOuts(outNum % 4);
      };
    });

    // Interactive Base Diamond clicks
    document.querySelectorAll('.diamond-base[data-base]').forEach((baseEl) => {
      baseEl.onclick = () => {
        const baseKey = baseEl.getAttribute('data-base');
        if (!baseKey) return;
        if (baseKey === 'HP') {
          this.showHomePlateActionsModal(state);
          return;
        }
        const runnerId = state.runnersOnBase ? state.runnersOnBase[baseKey] : null;
        if (runnerId) {
          this.showBaseRunnerActionsModal(state, baseKey, runnerId);
        } else {
          this.showPlaceRunnerModal(state, baseKey);
        }
      };
    });

    // Quick Runner Buttons
    const btnQuickRunner1b = document.getElementById('btn-quick-runner-1b');
    if (btnQuickRunner1b) {
      btnQuickRunner1b.onclick = () => {
        const r1 = state.runnersOnBase ? state.runnersOnBase['1B'] : null;
        if (r1) {
          this.stateManager.clearBaseRunner('1B');
        } else {
          const bContext = (typeof this.stateManager?.getBattingContext === 'function')
            ? this.stateManager.getBattingContext()
            : getBattingContextFromState(state);
          const order = bContext.isMyTeamBatting ? (state.battingOrder || []) : (this.stateManager?.getOpponentBattingOrder?.() || state.opponentBattingOrder || []);
          const idx = bContext.isMyTeamBatting ? (state.currentBatterIndex || 0) : (state.opponentBatterIndex || 0);
          const curBatterId = order.length > 0 ? order[idx % order.length] : null;
          if (curBatterId) {
            this.stateManager.setBaseRunner('1B', curBatterId);
          } else {
            this.showPlaceRunnerModal(state, '1B');
          }
        }
      };
    }

    const btnQuickClearBases = document.getElementById('btn-quick-clear-bases');
    if (btnQuickClearBases) {
      btnQuickClearBases.onclick = () => this.stateManager.clearAllBaseRunners();
    }

    // Pitch Controls in Game View: Strike, Ball, In Play, Foul, Hit Batter, Undo
    const btnPitchStrike = document.getElementById('btn-pitch-strike');
    if (btnPitchStrike) btnPitchStrike.onclick = () => this.stateManager.recordPitchStrike();

    const btnPitchBall = document.getElementById('btn-pitch-ball');
    if (btnPitchBall) btnPitchBall.onclick = () => this.stateManager.recordPitchBall();

    const btnPitchInPlay = document.getElementById('btn-pitch-inplay');
    if (btnPitchInPlay) btnPitchInPlay.onclick = () => this.showInPlayModal(state);

    const btnPitchFoul = document.getElementById('btn-pitch-foul');
    if (btnPitchFoul) btnPitchFoul.onclick = () => this.stateManager.recordPitchFoul();

    const btnPitchHBP = document.getElementById('btn-pitch-hbp');
    if (btnPitchHBP) btnPitchHBP.onclick = () => this.stateManager.recordPitchHitBatter();

    const btnCountReset = document.getElementById('btn-count-reset');
    if (btnCountReset) btnCountReset.onclick = () => this.stateManager.resetBatterCount();

    const btnPitchPlus1Game = document.getElementById('btn-pitch-plus1-game');
    if (btnPitchPlus1Game) btnPitchPlus1Game.onclick = () => this.stateManager.recordPitches(1);

    const btnPitchPlus3Game = document.getElementById('btn-pitch-plus3-game');
    if (btnPitchPlus3Game) btnPitchPlus3Game.onclick = () => this.stateManager.recordPitches(3);

    const btnPitchUndoGame = document.getElementById('btn-pitch-undo-game');
    if (btnPitchUndoGame) btnPitchUndoGame.onclick = () => this.stateManager.undoLastPitch();

    const btnChangePitcherGame = document.getElementById('btn-change-pitcher-game');
    if (btnChangePitcherGame) btnChangePitcherGame.onclick = () => this.showPitcherSelectModal(state);

    // Batting Carousel Controls in Game View
    const btnBatterNext = document.getElementById('btn-batter-next');
    if (btnBatterNext) btnBatterNext.onclick = () => this.stateManager.advanceBatter(1);

    const btnBatterPrev = document.getElementById('btn-batter-prev');
    if (btnBatterPrev) btnBatterPrev.onclick = () => this.stateManager.advanceBatter(-1);

    // Inning Buttons in Game View
    document.querySelectorAll('.game-inn-btn').forEach((btn) => {
      btn.onclick = () => {
        const inn = parseInt(btn.getAttribute('data-inning'), 10);
        this.stateManager.setCurrentInning(inn);
      };
    });

    // In-game Modifiers
    const btnEditOppLineup = document.getElementById('btn-edit-opp-lineup');
    if (btnEditOppLineup) btnEditOppLineup.onclick = () => this.showOpponentLineupModal(state);

    const btnGameLate = document.getElementById('btn-game-late');
    if (btnGameLate) btnGameLate.onclick = () => this.showLateArrivalModal(state);

    const btnGameInjured = document.getElementById('btn-game-injured');
    if (btnGameInjured) btnGameInjured.onclick = () => this.showPlayerOutModal(state);

    const btnGameRecalculate = document.getElementById('btn-game-recalculate');
    if (btnGameRecalculate) {
      btnGameRecalculate.onclick = () => {
        const nextInning = Math.min(state.currentInning + 1, state.scheduledInnings);
        this.stateManager.recalculateDefensiveGrid(nextInning);
        this.stateManager.notify();
      };
    }

    // --- PLANNING / SHARED VIEW EVENT HANDLERS ---
    // Pitch Buttons
    const btnPlus1 = document.getElementById('btn-pitch-plus1');
    if (btnPlus1) btnPlus1.onclick = () => this.stateManager.recordPitches(1);

    const btnPlus3 = document.getElementById('btn-pitch-plus3');
    if (btnPlus3) btnPlus3.onclick = () => this.stateManager.recordPitches(3);

    const btnUndoPitch = document.getElementById('btn-pitch-undo');
    if (btnUndoPitch) btnUndoPitch.onclick = () => this.stateManager.undoLastPitch();

    const btnSwitchPitcher = document.getElementById('btn-change-pitcher');
    if (btnSwitchPitcher) btnSwitchPitcher.onclick = () => this.showPitcherSelectModal(state);

    // Outs & Inning
    const btnRecordOut = document.getElementById('btn-record-out');
    if (btnRecordOut) btnRecordOut.onclick = () => this.showRecordOutModal(state);

    document.querySelectorAll('.inning-btn').forEach((btn) => {
      btn.onclick = () => {
        const inn = parseInt(btn.getAttribute('data-inning'), 10);
        this.stateManager.setCurrentInning(inn);
      };
    });

    document.querySelectorAll('.out-bubble').forEach((bubble) => {
      bubble.onclick = () => {
        const outNum = parseInt(bubble.getAttribute('data-out'), 10);
        this.stateManager.state.currentOuts = outNum % 4;
        this.stateManager.notify();
      };
    });

    // Undo / Redo
    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.onclick = () => this.stateManager.undo();

    const btnRedo = document.getElementById('btn-redo');
    if (btnRedo) btnRedo.onclick = () => this.stateManager.redo();

    // Roster Modifiers
    const btnLateArrival = document.getElementById('btn-late-arrival');
    if (btnLateArrival) btnLateArrival.onclick = () => this.showLateArrivalModal(state);

    const btnPlayerOut = document.getElementById('btn-player-out');
    if (btnPlayerOut) btnPlayerOut.onclick = () => this.showPlayerOutModal(state);

    const btnRecalculate = document.getElementById('btn-recalculate');
    if (btnRecalculate) {
      btnRecalculate.onclick = () => {
        const nextInning = Math.min(state.currentInning + 1, state.scheduledInnings);
        this.stateManager.recalculateDefensiveGrid(nextInning);
        this.stateManager.notify();
      };
    }

    // Lineup Reorder Up
    document.querySelectorAll('.btn-order-up').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-player-id');
        this.stateManager.movePlayerInBattingOrder(pId, 'UP');
      };
    });

    // Lineup Reorder Down
    document.querySelectorAll('.btn-order-down').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-player-id');
        this.stateManager.movePlayerInBattingOrder(pId, 'DOWN');
      };
    });

    // Player Availability / Attendance toggle
    document.querySelectorAll('.btn-status-pill').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-player-id');
        this.stateManager.setPlayerAvailability(pId);
      };
    });

    // Lineup & Attendance Modal trigger
    const btnLineupModal = document.getElementById('btn-lineup-modal');
    if (btnLineupModal) {
      btnLineupModal.onclick = () => this.showLineupAttendanceModal(state);
    }

    // Teams & Season Stats Manager
    const btnTeams = document.getElementById('btn-teams-manager');
    const headerTeamPill = document.getElementById('header-team-pill');
    const btnHeaderInvites = document.getElementById('btn-header-invites');
    if (btnTeams) btnTeams.onclick = () => this.teamManagerUI.open('teams');
    if (headerTeamPill) headerTeamPill.onclick = () => this.teamManagerUI.open('teams');
    if (btnHeaderInvites) btnHeaderInvites.onclick = () => this.teamManagerUI.open('invites');

    // New Game / Preset Selector
    const btnNewGame = document.getElementById('btn-new-game');
    if (btnNewGame) btnNewGame.onclick = () => this.showNewGameModal(state);

    // Print Lineup Card
    const btnPrint = document.getElementById('btn-print-card');
    if (btnPrint) btnPrint.onclick = () => window.print();

    // Coach Sign Out
    const btnSignOut = document.getElementById('btn-coach-signout');
    if (btnSignOut && this.authService) {
      btnSignOut.onclick = async () => {
        if (confirm('Sign out of Dugout Admin?')) {
          await this.authService.signOutUser();
        }
      };
    }

    // Two-tap Swap on Matrix Slots and Game View Field Position Chips
    document.querySelectorAll('.slot-badge, .field-position-chip').forEach((badge) => {
      badge.onclick = (e) => {
        if (isOpponentView) {
          alert(`View Only Access: You are inspecting "${state.teamName}" (Opponent Team). Defensive rotations and lineups are read-only and cannot be modified or saved.`);
          return;
        }

        const inn = parseInt(badge.getAttribute('data-inning'), 10);
        const pId = badge.getAttribute('data-player-id');
        const pos = badge.getAttribute('data-position');
        if (!pId) return;

        if (!this.selectedSwapCell) {
          // Select first cell
          this.selectedSwapCell = { inningNum: inn, playerId: pId, position: pos };
          this.render({
            state: this.stateManager.state,
            validation: this.stateManager.validate(),
            canUndo: this.stateManager.historyIndex > 0,
            canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
          });
        } else {
          // If tapped same cell, deselect
          if (this.selectedSwapCell.inningNum === inn && this.selectedSwapCell.playerId === pId) {
            this.selectedSwapCell = null;
            this.render({
              state: this.stateManager.state,
              validation: this.stateManager.validate(),
              canUndo: this.stateManager.historyIndex > 0,
              canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
            });
            return;
          }

          // If different inning, change selection to new cell
          if (this.selectedSwapCell.inningNum !== inn) {
            this.selectedSwapCell = { inningNum: inn, playerId: pId, position: pos };
            this.render({
              state: this.stateManager.state,
              validation: this.stateManager.validate(),
              canUndo: this.stateManager.historyIndex > 0,
              canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
            });
            return;
          }

          // Perform swap between selectedSwapCell and current cell in this inning!
          const playerAId = this.selectedSwapCell.playerId;
          const playerBId = pId;
          this.selectedSwapCell = null;
          this.stateManager.swapPositions(inn, playerAId, playerBId);
        }
      };
    });

    // Setup Drag-and-Drop Lineup Reordering on main matrix table (only if not in View Only mode)
    if (!isOpponentView) {
      this.setupLineupDragAndDrop(
        this.container,
        '.lineup-drag-row',
        (draggedId, targetIndex) => {
          this.stateManager.movePlayerToSlot(draggedId, targetIndex);
        }
      );
    }

    // Mobile View Navigation Switcher
    document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        if (!tab) return;
        this.mobileTab = tab;
        const mainLayout = document.querySelector('.main-layout');
        if (mainLayout) {
          mainLayout.setAttribute('data-mobile-view', tab);
        }
        document.querySelectorAll('.mobile-nav-btn').forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-tab') === tab);
        });
        if (mainLayout) {
          window.scrollTo({ top: Math.max(0, mainLayout.offsetTop - 70), behavior: 'smooth' });
        }
      };
    });

    // Mobile Hub Command Cards
    const hubLineup = document.getElementById('btn-hub-lineup');
    if (hubLineup) hubLineup.onclick = () => this.showLineupAttendanceModal(state);

    const hubTeams = document.getElementById('btn-hub-teams');
    if (hubTeams) hubTeams.onclick = () => this.teamManagerUI.open('teams');

    const hubLate = document.getElementById('btn-hub-late');
    if (hubLate) hubLate.onclick = () => this.showLateArrivalModal(state);

    const hubInjured = document.getElementById('btn-hub-injured');
    if (hubInjured) hubInjured.onclick = () => this.showPlayerOutModal(state);

    const hubResolve = document.getElementById('btn-hub-resolve');
    if (hubResolve) {
      hubResolve.onclick = () => {
        const nextInning = Math.min(state.currentInning + 1, state.scheduledInnings);
        this.stateManager.recalculateDefensiveGrid(nextInning);
        this.stateManager.notify();
      };
    }

    const hubNewGame = document.getElementById('btn-hub-newgame');
    if (hubNewGame) hubNewGame.onclick = () => this.showNewGameModal(state);

    const hubPrint = document.getElementById('btn-hub-print');
    if (hubPrint) hubPrint.onclick = () => window.print();

    const hubInstall = document.getElementById('btn-hub-install');
    if (hubInstall) hubInstall.onclick = () => this.showInstallAppModal();

    const hubSignOut = document.getElementById('btn-hub-signout');
    if (hubSignOut && this.authService) {
      hubSignOut.onclick = async () => {
        if (confirm('Sign out of Dugout Admin?')) {
          await this.authService.signOutUser();
        }
      };
    }
  }

  showModal(title, bodyHtml, footerHtml) {
    let modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'modal-container';
      document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="active-modal-backdrop">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button id="modal-close-btn" class="btn btn-secondary btn-sm">✕</button>
          </div>
          <div class="modal-body">
            ${bodyHtml}
          </div>
          <div class="modal-footer">
            ${footerHtml}
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-close-btn').onclick = () => {
      modalContainer.innerHTML = '';
    };
    document.getElementById('active-modal-backdrop').onclick = (e) => {
      if (e.target.id === 'active-modal-backdrop') {
        modalContainer.innerHTML = '';
      }
    };
  }

  closeModal() {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
  }

  showInstallAppModal() {
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (window.deferredPWAInstallPrompt) {
      window.deferredPWAInstallPrompt.prompt();
      window.deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted installation prompt');
        }
        window.deferredPWAInstallPrompt = null;
      });
      return;
    }

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px;">
        <img src="icon.jpeg" alt="Dugout Admin" style="width: 80px; height: 80px; border-radius: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.15);" />
        
        <div>
          <h4 style="color: #fff; font-family: var(--font-brand); font-size: 1.15rem; margin: 0 0 4px 0;">Dugout Admin Mobile App</h4>
          <span style="font-size: 0.8rem; color: #38bdf8; font-weight: 700;">Offline-Ready Progressive Web App (PWA)</span>
        </div>

        ${isStandalone ? `
          <div style="background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; border-radius: 10px; padding: 12px; width: 100%;">
            <strong style="color: #4ade80; display: block; font-size: 0.95rem;">✅ App Already Installed!</strong>
            <span style="font-size: 0.8rem; color: #cbd5e1;">You are running in standalone full-screen mode on your mobile device.</span>
          </div>
        ` : isIOS ? `
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 14px; text-align: left; width: 100%; display: flex; flex-direction: column; gap: 10px;">
            <strong style="color: #f8fafc; font-size: 0.88rem;">To install on iPhone or iPad (Safari):</strong>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem; color: #cbd5e1;">
              <span style="font-size: 1.1rem; background: rgba(56, 189, 248, 0.2); padding: 4px 8px; border-radius: 6px;">1️⃣</span>
              <span>Tap the <strong>Share</strong> button (square with arrow ⎙/⎋) at the bottom of Safari.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem; color: #cbd5e1;">
              <span style="font-size: 1.1rem; background: rgba(56, 189, 248, 0.2); padding: 4px 8px; border-radius: 6px;">2️⃣</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong> (➕).</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem; color: #cbd5e1;">
              <span style="font-size: 1.1rem; background: rgba(56, 189, 248, 0.2); padding: 4px 8px; border-radius: 6px;">3️⃣</span>
              <span>Tap <strong>"Add"</strong> in the top-right corner to finish.</span>
            </div>
          </div>
        ` : `
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 14px; text-align: left; width: 100%; display: flex; flex-direction: column; gap: 10px;">
            <strong style="color: #f8fafc; font-size: 0.88rem;">To install on Android or Chrome:</strong>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem; color: #cbd5e1;">
              <span style="font-size: 1.1rem; background: rgba(56, 189, 248, 0.2); padding: 4px 8px; border-radius: 6px;">1️⃣</span>
              <span>Tap the browser menu (<strong>⋮</strong> three dots in top-right).</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem; color: #cbd5e1;">
              <span style="font-size: 1.1rem; background: rgba(56, 189, 248, 0.2); padding: 4px 8px; border-radius: 6px;">2️⃣</span>
              <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</span>
            </div>
          </div>
        `}
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-primary" onclick="document.getElementById('modal-container').innerHTML=''" style="width: 100%; font-weight: 700;">Got It</button>
    `;

    this.showModal('📲 Install Dugout Admin App', bodyHtml, footerHtml);
  }

  showLateArrivalModal(state) {
    const unassignedOrInactive = state.players.filter((p) => p.isOut || p.isLate);
    const bodyHtml = `
      <p style="color: #94a3b8; font-size: 0.9rem;">
        Under NNLL Continuous Batting Order (CBO) rules, late arriving players are appended directly to the end of the batting lineup and integrated into downstream unplayed defensive innings.
      </p>
      <div class="form-group">
        <label class="form-label">Select Arrived Player:</label>
        <select id="modal-select-player" class="form-select">
          ${state.players.map((p) => `
            <option value="${p.id}">${p.name} (#${p.jerseyNumber})</option>
          `).join('')}
        </select>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
      <button id="modal-confirm-late" class="btn btn-primary">Add to Lineup & Re-solve</button>
    `;

    this.showModal('➕ Late Arrival to Dugout', bodyHtml, footerHtml);

    document.getElementById('modal-confirm-late').onclick = () => {
      const select = document.getElementById('modal-select-player');
      if (select) {
        this.stateManager.handleLateArrival(select.value);
      }
      this.closeModal();
    };
  }

  showPlayerOutModal(state) {
    const activePlayers = state.players.filter((p) => !p.isOut);
    const bodyHtml = `
      <p style="color: #94a3b8; font-size: 0.9rem;">
        Under NNLL rules, if a player is injured or leaves early, their spot in the batting order is skipped without an automatic out penalty, and downstream defensive positions are rebalanced.
      </p>
      <div class="form-group">
        <label class="form-label">Select Player:</label>
        <select id="modal-select-injured-player" class="form-select">
          ${activePlayers.map((p) => `
            <option value="${p.id}">${p.name} (#${p.jerseyNumber})</option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Reason:</label>
        <select id="modal-select-reason" class="form-select">
          <option value="INJURED">Injured during play</option>
          <option value="LEFT_EARLY">Left game early</option>
        </select>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
      <button id="modal-confirm-out" class="btn btn-danger">Mark Out & Rebalance</button>
    `;

    this.showModal('🚑 Player Injured / Left Early', bodyHtml, footerHtml);

    document.getElementById('modal-confirm-out').onclick = () => {
      const pId = document.getElementById('modal-select-injured-player').value;
      const reason = document.getElementById('modal-select-reason').value;
      this.stateManager.handlePlayerOut(pId, reason);
      this.closeModal();
    };
  }

  showPitcherSelectModal(state) {
    const activePlayers = state.players.filter((p) => !p.isOut);
    const bodyHtml = `
      <p style="color: #94a3b8; font-size: 0.9rem;">
        Select an eligible pitcher. Note: A player who was previously removed from the mound, or who has caught 4+ innings, cannot pitch.
      </p>
      <div class="form-group">
        <label class="form-label">Select Pitcher:</label>
        <select id="modal-select-pitcher" class="form-select">
          ${activePlayers.map((p) => {
            const pitches = state.playerPitches[p.id] || 0;
            const isRemoved = state.pitchersRemoved.includes(p.id);
            return `
              <option value="${p.id}" ${state.activePitcherId === p.id ? 'selected' : ''}>
                ${p.name} (#${p.jerseyNumber}) - ${pitches} pitches ${isRemoved ? '(Previously Removed)' : ''}
              </option>
            `;
          }).join('')}
        </select>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
      <button id="modal-confirm-pitcher" class="btn btn-primary">Set Active Pitcher</button>
    `;

    this.showModal('⚾ Change Active Pitcher', bodyHtml, footerHtml);

    document.getElementById('modal-confirm-pitcher').onclick = () => {
      const newPitcherId = document.getElementById('modal-select-pitcher').value;
      this.stateManager.changeActivePitcher(newPitcherId);
      this.closeModal();
    };
  }

  showRecordOutModal(state, defaults = {}) {
    const battingContext = (typeof this.stateManager?.getBattingContext === 'function')
      ? this.stateManager.getBattingContext()
      : getBattingContextFromState(state);
    const { isMyTeamBatting, battingTeamName } = battingContext;

    const players = isMyTeamBatting
      ? state.players
      : ((typeof this.stateManager?.getOpponentPlayers === 'function') ? this.stateManager.getOpponentPlayers() : getFallbackOpponentRoster(state));
    const battingOrder = isMyTeamBatting
      ? state.battingOrder
      : ((typeof this.stateManager?.getOpponentBattingOrder === 'function') ? this.stateManager.getOpponentBattingOrder() : (state.opponentBattingOrder?.length ? state.opponentBattingOrder : players.map((p) => p.id)));
    const activeIndex = isMyTeamBatting ? (state.currentBatterIndex || 0) : (state.opponentBatterIndex || 0);
    const curBatterId = battingOrder.length > 0 ? battingOrder[activeIndex % battingOrder.length] : null;
    const curBatter = players.find((p) => p.id === curBatterId);

    const runners = state.runnersOnBase || { '1B': null, '2B': null, '3B': null };
    const runner1B = runners['1B'] ? (players.find((p) => p.id === runners['1B']) || state.players.find((p) => p.id === runners['1B'])) : null;
    const runner2B = runners['2B'] ? (players.find((p) => p.id === runners['2B']) || state.players.find((p) => p.id === runners['2B'])) : null;
    const runner3B = runners['3B'] ? (players.find((p) => p.id === runners['3B']) || state.players.find((p) => p.id === runners['3B'])) : null;

    let selectedOutType = defaults.outType || 'ground_out';
    let selectedBase = defaults.base || (selectedOutType === 'fly_out' ? 'AIR' : '1B');
    let selectedPlayerId = defaults.playerId || (curBatterId || (players[0]?.id || ''));
    let fieldSequence = Array.isArray(defaults.fieldPositions) ? [...defaults.fieldPositions] : [];
    let shouldAdvanceBatter = defaults.advanceBatter !== undefined ? defaults.advanceBatter : true;

    const outTypes = [
      { id: 'ground_out', label: '⚾ Ground Out', defaultBase: '1B' },
      { id: 'fly_out', label: '🕊️ Fly Out / Line Out', defaultBase: 'AIR' },
      { id: 'force_out', label: '⚡ Force Out', defaultBase: '2B' },
      { id: 'tag_out', label: '🏷️ Tag Out', defaultBase: '2B' },
      { id: 'strikeout', label: '⚡ Strikeout (K)', defaultBase: 'HP' },
    ];

    const bases = [
      { id: '1B', label: '1B' },
      { id: '2B', label: '2B' },
      { id: '3B', label: '3B' },
      { id: 'HP', label: 'HP (Home)' },
      { id: 'AIR', label: 'AIR (Flyout)' },
    ];

    const fielders = [
      { pos: 'P', num: 1 },
      { pos: 'C', num: 2 },
      { pos: '1B', num: 3 },
      { pos: '2B', num: 4 },
      { pos: '3B', num: 5 },
      { pos: 'SS', num: 6 },
      { pos: 'LF', num: 7 },
      { pos: 'CF', num: 8 },
      { pos: 'RF', num: 9 },
    ];

    const bodyHtml = `
      <div class="record-out-modal-body" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="font-size: 0.84rem; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
          <span>Batting: <strong style="color: #fff;">${battingTeamName}</strong></span>
          <span>Out: <strong style="color: #ef4444;">#${(state.currentOuts || 0) + 1}</strong> (${state.currentHalf} ${state.currentInning})</span>
        </div>

        <!-- 1. Player Put Out -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 0.8rem; font-weight: 800; color: #38bdf8;">
            1. Player Put Out:
          </label>
          <select id="modal-out-player-select" class="form-select">
            ${curBatter ? `
              <optgroup label="Current Batter">
                <option value="${curBatter.id}" ${curBatter.id === selectedPlayerId ? 'selected' : ''}>
                  🎯 ${curBatter.name} (#${curBatter.jerseyNumber}) — Current Batter
                </option>
              </optgroup>
            ` : ''}
            ${(runner1B || runner2B || runner3B) ? `
              <optgroup label="Runners On Base">
                ${runner1B ? `<option value="${runner1B.id}" data-base="1B" ${runner1B.id === selectedPlayerId ? 'selected' : ''}>🏃 1B: ${runner1B.name} (#${runner1B.jerseyNumber})</option>` : ''}
                ${runner2B ? `<option value="${runner2B.id}" data-base="2B" ${runner2B.id === selectedPlayerId ? 'selected' : ''}>🏃 2B: ${runner2B.name} (#${runner2B.jerseyNumber})</option>` : ''}
                ${runner3B ? `<option value="${runner3B.id}" data-base="3B" ${runner3B.id === selectedPlayerId ? 'selected' : ''}>🏃 3B: ${runner3B.name} (#${runner3B.jerseyNumber})</option>` : ''}
              </optgroup>
            ` : ''}
            <optgroup label="Full Lineup / Roster">
              ${battingOrder.map((pId, idx) => {
                const p = players.find((pl) => pl.id === pId);
                if (!p || p.id === curBatterId) return '';
                return `<option value="${p.id}" ${p.id === selectedPlayerId ? 'selected' : ''}>${idx + 1}. ${p.name} (#${p.jerseyNumber})</option>`;
              }).join('')}
            </optgroup>
          </select>
        </div>

        <!-- 2. Play / Out Type -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 0.8rem; font-weight: 800; color: #38bdf8;">
            2. Play / Out Type:
          </label>
          <div class="out-type-pills-grid" id="modal-out-types-grid">
            ${outTypes.map((t) => `
              <button type="button" class="btn-out-type-pill ${t.id === selectedOutType ? 'active' : ''}" data-out-type="${t.id}" data-def-base="${t.defaultBase}">
                ${t.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 3. Base Where Out Was Made -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 0.8rem; font-weight: 800; color: #38bdf8;">
            3. Base Where Out Was Made:
          </label>
          <div class="base-select-pills-row" id="modal-out-bases-row">
            ${bases.map((b) => `
              <button type="button" class="btn-base-pill ${b.id === selectedBase ? 'active' : ''}" data-base="${b.id}">
                ${b.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 4. Defensive Sequence (Fielders Involved) -->
        <div class="form-group" style="margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label class="form-label" style="font-size: 0.8rem; font-weight: 800; color: #38bdf8; margin: 0;">
              4. Defensive Play (Tap Fielders Involved):
            </label>
            <button type="button" id="modal-btn-clear-seq" class="btn btn-secondary btn-xs" style="font-size: 0.7rem; padding: 2px 6px;">Reset</button>
          </div>
          <div class="defense-chips-grid">
            ${fielders.map((f) => `
              <button type="button" class="btn-def-chip" data-pos="${f.pos}" data-num="${f.num}" title="${f.pos} (#${f.num})">
                ${f.pos}
              </button>
            `).join('')}
          </div>
          <div id="modal-seq-preview" style="margin-top: 6px; font-size: 0.8rem; color: #cbd5e1; background: rgba(15,23,42,0.6); padding: 5px 8px; border-radius: 6px; min-height: 28px; display: flex; align-items: center;">
            Play Sequence: <span id="modal-seq-text" style="color: #38bdf8; font-weight: 700; margin-left: 6px;">${fieldSequence.length > 0 ? fieldSequence.join(' ➔ ') : '(None)'}</span>
          </div>
        </div>

        <!-- Advance Batter Checkbox -->
        <div style="display: flex; align-items: center; gap: 8px; padding-top: 4px;">
          <input type="checkbox" id="modal-check-advance-batter" ${shouldAdvanceBatter ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
          <label for="modal-check-advance-batter" style="font-size: 0.82rem; color: #cbd5e1; cursor: pointer; user-select: none;">
            Advance to next batter in order
          </label>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
      <button id="modal-confirm-out-record" class="btn btn-danger" style="font-weight: 800;">🛑 Confirm Out</button>
    `;

    this.showModal(`🛑 Record Out — ${battingTeamName}`, bodyHtml, footerHtml);

    // Pill selection logic
    const playerSelect = document.getElementById('modal-out-player-select');
    if (playerSelect) {
      playerSelect.onchange = () => {
        selectedPlayerId = playerSelect.value;
        const selectedOpt = playerSelect.selectedOptions[0];
        const runnerBase = selectedOpt?.getAttribute('data-base');
        if (runnerBase) {
          selectedBase = runnerBase;
          document.querySelectorAll('.btn-base-pill').forEach((p) => {
            p.classList.toggle('active', p.getAttribute('data-base') === runnerBase);
          });
          if (selectedOutType === 'ground_out') {
            selectedOutType = 'force_out';
            document.querySelectorAll('.btn-out-type-pill').forEach((p) => {
              p.classList.toggle('active', p.getAttribute('data-out-type') === 'force_out');
            });
          }
        }
      };
    }

    document.querySelectorAll('.btn-out-type-pill').forEach((pill) => {
      pill.onclick = () => {
        document.querySelectorAll('.btn-out-type-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        selectedOutType = pill.getAttribute('data-out-type');
        const defBase = pill.getAttribute('data-def-base');
        if (defBase) {
          selectedBase = defBase;
          document.querySelectorAll('.btn-base-pill').forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-base') === defBase);
          });
        }
      };
    });

    document.querySelectorAll('.btn-base-pill').forEach((pill) => {
      pill.onclick = () => {
        document.querySelectorAll('.btn-base-pill').forEach((b) => b.classList.remove('active'));
        pill.classList.add('active');
        selectedBase = pill.getAttribute('data-base');
      };
    });

    const updateSeqDisplay = () => {
      const textEl = document.getElementById('modal-seq-text');
      if (textEl) {
        textEl.textContent = fieldSequence.length > 0 ? fieldSequence.join(' ➔ ') : '(None)';
      }
    };

    document.querySelectorAll('.btn-def-chip').forEach((chip) => {
      chip.onclick = () => {
        const pos = chip.getAttribute('data-pos');
        if (pos) {
          fieldSequence.push(pos);
          updateSeqDisplay();
        }
      };
    });

    const btnClearSeq = document.getElementById('modal-btn-clear-seq');
    if (btnClearSeq) {
      btnClearSeq.onclick = () => {
        fieldSequence = [];
        updateSeqDisplay();
      };
    }

    document.getElementById('modal-confirm-out-record').onclick = () => {
      const advanceChecked = document.getElementById('modal-check-advance-batter')?.checked ?? true;
      let clearBase = null;
      if (runners['1B'] === selectedPlayerId) clearBase = '1B';
      else if (runners['2B'] === selectedPlayerId) clearBase = '2B';
      else if (runners['3B'] === selectedPlayerId) clearBase = '3B';
      if (defaults.clearRunnerBase) clearBase = defaults.clearRunnerBase;

      const playerObj = players.find((p) => p.id === selectedPlayerId) || state.players.find((p) => p.id === selectedPlayerId);
      const resolvedName = playerObj ? `${playerObj.name} (#${playerObj.jerseyNumber})` : null;

      if (typeof this.stateManager?.recordOut === 'function') {
        this.stateManager.recordOut({
          playerId: selectedPlayerId,
          playerName: resolvedName,
          base: selectedBase,
          outType: selectedOutType,
          fieldPositions: fieldSequence,
          clearRunnerBase: clearBase,
          advanceBatter: advanceChecked,
        });
      }
      this.closeModal();
    };
  }

  showInPlayModal(state) {
    const battingContext = (typeof this.stateManager?.getBattingContext === 'function')
      ? this.stateManager.getBattingContext()
      : getBattingContextFromState(state);
    const { isMyTeamBatting, battingTeamName } = battingContext;

    const players = isMyTeamBatting
      ? state.players
      : ((typeof this.stateManager?.getOpponentPlayers === 'function') ? this.stateManager.getOpponentPlayers() : getFallbackOpponentRoster(state));
    const battingOrder = isMyTeamBatting
      ? state.battingOrder
      : ((typeof this.stateManager?.getOpponentBattingOrder === 'function') ? this.stateManager.getOpponentBattingOrder() : (state.opponentBattingOrder?.length ? state.opponentBattingOrder : players.map((p) => p.id)));
    const activeIndex = isMyTeamBatting ? (state.currentBatterIndex || 0) : (state.opponentBatterIndex || 0);
    const curBatterId = battingOrder.length > 0 ? battingOrder[activeIndex % battingOrder.length] : null;
    const curBatter = players.find((p) => p.id === curBatterId);
    const curBatterName = curBatter ? `${curBatter.name} (#${curBatter.jerseyNumber})` : 'Current Batter';

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="font-size: 0.84rem; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
          At Bat: <strong style="color: #fff;">${curBatterName}</strong> (${battingTeamName})
        </div>

        <p style="color: #cbd5e1; font-size: 0.88rem; margin: 0;">
          Ball put in play (+1 pitch). Choose the outcome:
        </p>

        <!-- Option A: Out on Play -->
        <button id="modal-inplay-btn-out" class="btn btn-danger" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-align: left;">
          <span style="font-size: 1.5rem;">🛑</span>
          <div>
            <strong style="display: block; font-size: 0.95rem; color: #fff;">Out on Play (Batter or Runner)</strong>
            <span style="font-size: 0.78rem; color: #fca5a5;">Specify ground out, fly out, or force at base</span>
          </div>
        </button>

        <!-- Option B: Safe Hit / On Base -->
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 12px;">
          <strong style="color: #38bdf8; font-size: 0.85rem; display: block; margin-bottom: 8px;">
            🟢 Safe Hit / Batter Reaches Base:
          </strong>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px;">
            <button type="button" class="btn btn-secondary modal-btn-hit" data-hit="1B" style="font-weight: 700; font-size: 0.82rem;">
              ⚾ Single (1B)
            </button>
            <button type="button" class="btn btn-secondary modal-btn-hit" data-hit="2B" style="font-weight: 700; font-size: 0.82rem;">
              🚀 Double (2B)
            </button>
            <button type="button" class="btn btn-secondary modal-btn-hit" data-hit="3B" style="font-weight: 700; font-size: 0.82rem;">
              ⚡ Triple (3B)
            </button>
            <button type="button" class="btn btn-secondary modal-btn-hit" data-hit="HR" style="font-weight: 700; font-size: 0.82rem; color: #fbbf24;">
              🏆 Home Run
            </button>
            <button type="button" class="btn btn-secondary modal-btn-hit" data-hit="FC" style="font-weight: 700; font-size: 0.82rem;">
              👟 Error / FC (1B)
            </button>
          </div>
        </div>

        <!-- Option C: Quick In Play -->
        <button id="modal-inplay-btn-quick" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 8px; color: #94a3b8;">
          ⚡ Quick +1 Pitch (Advance batter only, no base tracking)
        </button>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
    `;

    this.showModal('⚾ Ball In Play Outcome', bodyHtml, footerHtml);

    // Option A: Out on play
    document.getElementById('modal-inplay-btn-out').onclick = () => {
      this.closeModal();
      this.stateManager.recordPitches(1);
      this.stateManager.resetBatterCount();
      this.showRecordOutModal(this.stateManager.state, {
        playerId: curBatterId,
        outType: 'ground_out',
        base: '1B',
        advanceBatter: true,
      });
    };

    // Option B: Safe Hit
    document.querySelectorAll('.modal-btn-hit').forEach((btn) => {
      btn.onclick = () => {
        const hitType = btn.getAttribute('data-hit');
        this.closeModal();
        this.stateManager.recordPitches(1);
        if (typeof this.stateManager?.recordSafeHit === 'function') {
          this.stateManager.recordSafeHit(hitType);
        } else {
          this.stateManager.resetBatterCount();
          if (hitType === '1B' || hitType === 'FC') {
            if (curBatterId) this.stateManager.setBaseRunner('1B', curBatterId);
          } else if (hitType === '2B') {
            if (curBatterId) this.stateManager.setBaseRunner('2B', curBatterId);
          } else if (hitType === '3B') {
            if (curBatterId) this.stateManager.setBaseRunner('3B', curBatterId);
          } else if (hitType === 'HR') {
            const teamKey = isMyTeamBatting ? (state.isHomeTeam ? 'home' : 'opponent') : (state.isHomeTeam ? 'opponent' : 'home');
            this.stateManager.recordRun(teamKey, 1);
          }
          this.stateManager.advanceBatter(1);
        }
      };
    });

    // Option C: Quick standard in-play
    document.getElementById('modal-inplay-btn-quick').onclick = () => {
      this.closeModal();
      this.stateManager.recordPitchInPlay();
    };
  }

  showHomePlateActionsModal(state) {
    const battingContext = (typeof this.stateManager?.getBattingContext === 'function')
      ? this.stateManager.getBattingContext()
      : getBattingContextFromState(state);
    const { isMyTeamBatting, battingTeamName } = battingContext;
    const teamKey = isMyTeamBatting ? (state.isHomeTeam ? 'home' : 'opponent') : (state.isHomeTeam ? 'opponent' : 'home');

    const runners = state.runnersOnBase || { '1B': null, '2B': null, '3B': null };
    const players = isMyTeamBatting
      ? state.players
      : ((typeof this.stateManager?.getOpponentPlayers === 'function') ? this.stateManager.getOpponentPlayers() : getFallbackOpponentRoster(state));

    const runner3B = runners['3B'] ? (players.find((p) => p.id === runners['3B']) || state.players.find((p) => p.id === runners['3B'])) : null;
    const runner2B = runners['2B'] ? (players.find((p) => p.id === runners['2B']) || state.players.find((p) => p.id === runners['2B'])) : null;
    const runner1B = runners['1B'] ? (players.find((p) => p.id === runners['1B']) || state.players.find((p) => p.id === runners['1B'])) : null;

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: rgba(37, 99, 235, 0.15); border: 1px solid rgba(96, 165, 250, 0.4); border-radius: 10px; padding: 12px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.6rem;">🏠</span>
          <div>
            <strong style="color: #60a5fa; font-size: 1rem; display: block;">Home Plate (HP) Actions</strong>
            <span style="font-size: 0.8rem; color: #cbd5e1;">Offense: <strong>${battingTeamName}</strong></span>
          </div>
        </div>

        <!-- 1. Score Runners at Home -->
        ${(runner3B || runner2B || runner1B) ? `
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
            <strong style="color: #34d399; font-size: 0.86rem; display: block;">
              🏃 Score Base Runner at Home Plate (+1 Run):
            </strong>
            ${runner3B ? `
              <button type="button" id="btn-score-runner-3b" class="btn btn-success" style="justify-content: flex-start; text-align: left; padding: 10px 14px; font-weight: 700;">
                <span style="font-size: 1.2rem;">⚡</span>
                <div>
                  <strong style="display: block; font-size: 0.92rem;">Score ${runner3B.name} (#${runner3B.jerseyNumber}) from 3B</strong>
                  <span style="font-size: 0.74rem; color: #d1fae5;">Advances 3B ➔ HP, adds +1 run to ${battingTeamName}</span>
                </div>
              </button>
            ` : ''}
            ${runner2B ? `
              <button type="button" id="btn-score-runner-2b" class="btn btn-secondary" style="justify-content: flex-start; text-align: left; padding: 10px 14px; font-weight: 700;">
                <span style="font-size: 1.2rem;">🏃</span>
                <div>
                  <strong style="display: block; font-size: 0.92rem;">Score ${runner2B.name} (#${runner2B.jerseyNumber}) from 2B</strong>
                  <span style="font-size: 0.74rem; color: #cbd5e1;">Advances 2B ➔ HP, adds +1 run to ${battingTeamName}</span>
                </div>
              </button>
            ` : ''}
            ${runner1B ? `
              <button type="button" id="btn-score-runner-1b" class="btn btn-secondary" style="justify-content: flex-start; text-align: left; padding: 10px 14px; font-weight: 700;">
                <span style="font-size: 1.2rem;">🏃</span>
                <div>
                  <strong style="display: block; font-size: 0.92rem;">Score ${runner1B.name} (#${runner1B.jerseyNumber}) from 1B</strong>
                  <span style="font-size: 0.74rem; color: #cbd5e1;">Advances 1B ➔ HP, adds +1 run to ${battingTeamName}</span>
                </div>
              </button>
            ` : ''}
          </div>
        ` : ''}

        <!-- 2. Direct Add Run -->
        <button type="button" id="btn-hp-direct-run" class="btn btn-primary" style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 10px 14px; text-align: left;">
          <span style="font-size: 1.3rem;">➕</span>
          <div>
            <strong style="display: block; font-size: 0.92rem;">Add +1 Run to Scoreboard</strong>
            <span style="font-size: 0.74rem; color: #bfdbfe;">Record run for ${battingTeamName} without clearing specific base</span>
          </div>
        </button>

        <!-- 3. Record Out at Home -->
        <button type="button" id="btn-hp-record-out" class="btn btn-danger" style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 10px 14px; text-align: left;">
          <span style="font-size: 1.3rem;">🛑</span>
          <div>
            <strong style="display: block; font-size: 0.92rem;">Record Out at Home (HP)</strong>
            <span style="font-size: 0.74rem; color: #fca5a5;">Runner tagged or forced out trying to score</span>
          </div>
        </button>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
    `;

    this.showModal('🏠 Home Plate & Scoreboard Actions', bodyHtml, footerHtml);

    if (runner3B) {
      const btn3B = document.getElementById('btn-score-runner-3b');
      if (btn3B) {
        btn3B.onclick = () => {
          this.closeModal();
          this.stateManager.advanceRunner('3B', 'HP');
        };
      }
    }

    if (runner2B) {
      const btn2B = document.getElementById('btn-score-runner-2b');
      if (btn2B) {
        btn2B.onclick = () => {
          this.closeModal();
          this.stateManager.advanceRunner('2B', 'HP');
        };
      }
    }

    if (runner1B) {
      const btn1B = document.getElementById('btn-score-runner-1b');
      if (btn1B) {
        btn1B.onclick = () => {
          this.closeModal();
          this.stateManager.advanceRunner('1B', 'HP');
        };
      }
    }

    const btnDirectRun = document.getElementById('btn-hp-direct-run');
    if (btnDirectRun) {
      btnDirectRun.onclick = () => {
        this.closeModal();
        this.stateManager.recordRun(teamKey, 1);
      };
    }

    const btnHpOut = document.getElementById('btn-hp-record-out');
    if (btnHpOut) {
      btnHpOut.onclick = () => {
        this.closeModal();
        const candidateRunner = runner3B || runner2B || runner1B;
        this.showRecordOutModal(state, {
          playerId: candidateRunner ? candidateRunner.id : null,
          playerName: candidateRunner ? `${candidateRunner.name} (#${candidateRunner.jerseyNumber})` : null,
          base: 'HP',
          outType: 'tag_out',
          clearRunnerBase: runner3B ? '3B' : (runner2B ? '2B' : (runner1B ? '1B' : null)),
          advanceBatter: false,
        });
      };
    }
  }

  showBaseRunnerActionsModal(state, baseKey, runnerId) {
    const battingContext = (typeof this.stateManager?.getBattingContext === 'function')
      ? this.stateManager.getBattingContext()
      : getBattingContextFromState(state);
    const { isMyTeamBatting } = battingContext;

    const players = isMyTeamBatting
      ? state.players
      : ((typeof this.stateManager?.getOpponentPlayers === 'function') ? this.stateManager.getOpponentPlayers() : getFallbackOpponentRoster(state));

    const runner = players.find((p) => p.id === runnerId) || state.players.find((p) => p.id === runnerId);
    const runnerName = runner ? `${runner.name} (#${runner.jerseyNumber})` : 'Runner';

    const advanceTargets = [];
    if (baseKey === '1B') {
      advanceTargets.push({ target: '2B', label: 'Advance to 2nd Base (2B)' });
      advanceTargets.push({ target: '3B', label: 'Advance to 3rd Base (3B)' });
      advanceTargets.push({ target: 'HP', label: 'Score Run at Home (HP)' });
    } else if (baseKey === '2B') {
      advanceTargets.push({ target: '3B', label: 'Advance to 3rd Base (3B)' });
      advanceTargets.push({ target: 'HP', label: 'Score Run at Home (HP)' });
    } else if (baseKey === '3B') {
      advanceTargets.push({ target: 'HP', label: 'Score Run at Home (HP)' });
    }

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.4rem;">🏃</span>
          <div>
            <strong style="color: #fbbf24; font-size: 0.95rem; display: block;">${runnerName}</strong>
            <span style="font-size: 0.78rem; color: #cbd5e1;">Currently Occupying <strong>${baseKey}</strong></span>
          </div>
        </div>

        <!-- 1. Out at Base -->
        <button id="modal-runner-btn-out" class="btn btn-danger" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; text-align: left;">
          <span>🛑</span>
          <div>
            <strong style="display: block; font-size: 0.9rem; color: #fff;">Record Out at ${baseKey}</strong>
            <span style="font-size: 0.75rem; color: #fca5a5;">Tag out, force out, or pickoff at ${baseKey}</span>
          </div>
        </button>

        <!-- 2. Advance Base -->
        ${advanceTargets.length > 0 ? `
          <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px;">
            <strong style="color: #38bdf8; font-size: 0.8rem; display: block; margin-bottom: 8px;">
              ⏩ Advance Runner:
            </strong>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${advanceTargets.map((t) => `
                <button type="button" class="btn btn-secondary modal-btn-advance-target" data-target="${t.target}" style="font-size: 0.8rem; text-align: left; padding: 8px 12px;">
                  ${t.label}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 3. Clear Base -->
        <button id="modal-runner-btn-clear" class="btn btn-secondary btn-sm" style="color: #cbd5e1; font-size: 0.78rem;">
          ❌ Clear Runner from ${baseKey} (No Out)
        </button>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
    `;

    this.showModal(`🏃 Runner Management (${baseKey})`, bodyHtml, footerHtml);

    document.getElementById('modal-runner-btn-out').onclick = () => {
      this.closeModal();
      this.showRecordOutModal(state, {
        playerId: runnerId,
        playerName: runnerName,
        base: baseKey,
        outType: 'tag_out',
        clearRunnerBase: baseKey,
        advanceBatter: false,
      });
    };

    document.querySelectorAll('.modal-btn-advance-target').forEach((btn) => {
      btn.onclick = () => {
        const target = btn.getAttribute('data-target');
        this.closeModal();
        if (typeof this.stateManager?.advanceRunner === 'function') {
          this.stateManager.advanceRunner(baseKey, target);
        } else {
          this.stateManager.clearBaseRunner(baseKey);
          if (target !== 'HP') {
            this.stateManager.setBaseRunner(target, runnerId);
          }
        }
      };
    });

    document.getElementById('modal-runner-btn-clear').onclick = () => {
      this.closeModal();
      this.stateManager.clearBaseRunner(baseKey);
    };
  }

  showPlaceRunnerModal(state, baseKey) {
    const battingContext = (typeof this.stateManager?.getBattingContext === 'function')
      ? this.stateManager.getBattingContext()
      : getBattingContextFromState(state);
    const { isMyTeamBatting, battingTeamName } = battingContext;

    const players = isMyTeamBatting
      ? state.players
      : ((typeof this.stateManager?.getOpponentPlayers === 'function') ? this.stateManager.getOpponentPlayers() : getFallbackOpponentRoster(state));
    const battingOrder = isMyTeamBatting
      ? state.battingOrder
      : ((typeof this.stateManager?.getOpponentBattingOrder === 'function') ? this.stateManager.getOpponentBattingOrder() : (state.opponentBattingOrder?.length ? state.opponentBattingOrder : players.map((p) => p.id)));
    const activeIndex = isMyTeamBatting ? (state.currentBatterIndex || 0) : (state.opponentBatterIndex || 0);

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="color: #94a3b8; font-size: 0.88rem; margin: 0;">
          Select a player to place on <strong>${baseKey}</strong> for ${battingTeamName}:
        </p>
        <div class="form-group" style="margin-bottom: 0;">
          <select id="modal-select-place-runner" class="form-select">
            ${battingOrder.map((pId, idx) => {
              const p = players.find((pl) => pl.id === pId);
              if (!p) return '';
              const isDue = (idx === (activeIndex % (battingOrder.length || 1)));
              return `<option value="${p.id}" ${isDue ? 'selected' : ''}>${idx + 1}. ${p.name} (#${p.jerseyNumber})${isDue ? ' [Current Batter]' : ''}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
      <button id="modal-btn-confirm-place" class="btn btn-primary">Place on ${baseKey}</button>
    `;

    this.showModal(`➕ Place Runner on ${baseKey}`, bodyHtml, footerHtml);

    document.getElementById('modal-btn-confirm-place').onclick = () => {
      const select = document.getElementById('modal-select-place-runner');
      if (select && select.value) {
        this.stateManager.setBaseRunner(baseKey, select.value);
      }
      this.closeModal();
    };
  }

  showOpponentLineupModal(state) {
    const oppName = state.opponentName || 'Opponents';
    const oppPlayers = (typeof this.stateManager?.getOpponentPlayers === 'function')
      ? this.stateManager.getOpponentPlayers()
      : getFallbackOpponentRoster(state);
    const oppOrder = (typeof this.stateManager?.getOpponentBattingOrder === 'function')
      ? [...this.stateManager.getOpponentBattingOrder()]
      : (state.opponentBattingOrder?.length ? [...state.opponentBattingOrder] : oppPlayers.map((p) => p.id));

    const bodyHtml = `
      <div class="lineup-modal">
        <div class="lineup-summary-strip" style="background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8;">
          <div>
            <span style="font-weight: 700; color: #fff;">${oppName} Lineup:</span>
            <span style="color: #7dd3fc; font-weight: 700; margin-left: 6px;">${oppPlayers.length} Batters</span>
          </div>
          <span style="font-size: 0.78rem; color: #94a3b8;">
            Opponent Continuous Batting Order
          </span>
        </div>

        <p style="font-size: 0.8rem; color: #94a3b8; margin: 10px 0 14px;">
          Edit opponent batter names or jersey numbers as discovered from the umpire card or opposing dugout. Use <strong>▲ / ▼</strong> to adjust batting order slots.
        </p>

        <div class="lineup-modal-list" id="opp-lineup-list">
          ${oppOrder.map((pId, idx) => {
            const player = oppPlayers.find((p) => p.id === pId);
            if (!player) return '';
            return `
              <div class="lineup-modal-item" data-player-id="${player.id}" data-slot-idx="${idx}">
                <div class="item-left" style="width: 100%;">
                  <div class="item-order-btns">
                    <button class="btn-lineup-order opp-order-up" data-player-id="${player.id}" ${idx === 0 ? 'disabled' : ''} title="Move UP">▲</button>
                    <button class="btn-lineup-order opp-order-down" data-player-id="${player.id}" ${idx === oppOrder.length - 1 ? 'disabled' : ''} title="Move DOWN">▼</button>
                  </div>
                  <span class="batting-slot-num" style="min-width: 28px; text-align: center;">${idx + 1}</span>
                  <div style="display: flex; gap: 8px; flex: 1; align-items: center;">
                    <input type="number" class="form-input opp-input-num" data-player-id="${player.id}" value="${player.jerseyNumber}" placeholder="#" style="width: 58px; text-align: center; font-weight: 700;" />
                    <input type="text" class="form-input opp-input-name" data-player-id="${player.id}" value="${player.name}" placeholder="Batter Name" style="flex: 1; font-weight: 600;" />
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
      <button id="modal-save-opp-lineup" class="btn btn-primary">Save Opponent Lineup</button>
    `;

    this.showModal(`📋 ${oppName} — Continuous Batting Order`, bodyHtml, footerHtml);

    // Bind Up / Down order buttons
    document.querySelectorAll('.opp-order-up').forEach((btn) => {
      btn.onclick = () => {
        const pId = btn.getAttribute('data-player-id');
        const idx = oppOrder.indexOf(pId);
        if (idx > 0) {
          const temp = oppOrder[idx - 1];
          oppOrder[idx - 1] = oppOrder[idx];
          oppOrder[idx] = temp;
          if (typeof this.stateManager?.setOpponentBattingOrder === 'function') {
            this.stateManager.setOpponentBattingOrder(oppOrder);
          } else {
            state.opponentBattingOrder = [...oppOrder];
            if (typeof this.stateManager?.notify === 'function') this.stateManager.notify();
          }
          this.showOpponentLineupModal(this.stateManager?.state || state);
        }
      };
    });

    document.querySelectorAll('.opp-order-down').forEach((btn) => {
      btn.onclick = () => {
        const pId = btn.getAttribute('data-player-id');
        const idx = oppOrder.indexOf(pId);
        if (idx < oppOrder.length - 1) {
          const temp = oppOrder[idx + 1];
          oppOrder[idx + 1] = oppOrder[idx];
          oppOrder[idx] = temp;
          if (typeof this.stateManager?.setOpponentBattingOrder === 'function') {
            this.stateManager.setOpponentBattingOrder(oppOrder);
          } else {
            state.opponentBattingOrder = [...oppOrder];
            if (typeof this.stateManager?.notify === 'function') this.stateManager.notify();
          }
          this.showOpponentLineupModal(this.stateManager?.state || state);
        }
      };
    });

    // Save changes
    document.getElementById('modal-save-opp-lineup').onclick = () => {
      document.querySelectorAll('#opp-lineup-list .lineup-modal-item').forEach((row) => {
        const pId = row.getAttribute('data-player-id');
        const nameInput = row.querySelector('.opp-input-name');
        const numInput = row.querySelector('.opp-input-num');
        const newName = nameInput ? nameInput.value.trim() : null;
        const newNum = numInput ? parseInt(numInput.value, 10) : null;
        if (newName || !isNaN(newNum)) {
          const updates = {
            name: newName || 'Batter',
            jerseyNumber: isNaN(newNum) ? 0 : newNum,
          };
          if (typeof this.stateManager?.updateOpponentPlayer === 'function') {
            this.stateManager.updateOpponentPlayer(pId, updates);
          } else {
            const p = oppPlayers.find((pl) => pl.id === pId);
            if (p) Object.assign(p, updates);
            state.opponentPlayers = oppPlayers;
          }
        }
      });
      if (typeof this.stateManager?.notify === 'function') this.stateManager.notify();
      this.closeModal();
    };
  }

  showLineupAttendanceModal(state) {
    const manager = teamStorage.getCurrentManager();
    const isSuper = isSuperAdmin(manager?.email);
    const isMcollins = !isSuper && manager?.email?.toLowerCase() === 'mcollinswork6@gmail.com';
    const isOpponentView = isSuper
      ? false
      : (isMcollins
        ? (state.teamId !== 'team-black-bats-6589' && state.teamId !== 'nnll-black-bats' && !state.teamName?.toLowerCase().includes('black bats'))
        : false);

    const presentCount = state.players.filter((p) => !p.isOut).length;
    const absentCount = state.players.filter((p) => p.isOut).length;

    const bodyHtml = `
      <div class="lineup-modal">
        ${isOpponentView ? `
          <div class="view-only-notice-box">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.2rem;">👁️</span>
                <strong style="color: #f87171;">View Only: ${state.teamName} Lineup</strong>
              </div>
              <span class="badge-save-view-only">🔒 Save: View Only</span>
            </div>
            <p style="margin: 4px 0 0; color: #cbd5e1; font-size: 0.8rem;">
              You are viewing this opponent's continuous batting order. Reordering and attendance toggling cannot be edited or saved.
            </p>
          </div>
        ` : ''}

        <div class="lineup-summary-strip">
          <div>
            <span style="font-weight: 700; color: #fff;">${state.teamName} Attendance:</span>
            <span style="color: #6ee7b7; font-weight: 700; margin-left: 6px;">${presentCount} Present</span>
            ${absentCount > 0 ? `<span style="color: #fca5a5; font-weight: 700; margin-left: 8px;">${absentCount} Absent</span>` : ''}
          </div>
          <span style="font-size: 0.78rem; color: #94a3b8;">
            CBO Continuous Batting Order
          </span>
        </div>

        <p style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 12px;">
          ${isOpponentView ? 'Opponent continuous batting order (Read-only).' : 'Drag <strong>⠿</strong> or any row up/down to reorder the continuous batting order. You can also use <strong>▲ / ▼</strong> or toggle <strong>Present / Unavailable</strong>.'}
        </p>

        <div class="lineup-modal-list">
          ${state.battingOrder.map((pId, idx) => {
            const player = state.players.find((p) => p.id === pId);
            if (!player) return '';
            const isAbsent = player.isOut;
            return `
              <div class="lineup-modal-item ${isAbsent ? 'item-absent' : ''}"
                   draggable="${!isOpponentView}"
                   data-player-id="${player.id}"
                   data-slot-idx="${idx}">
                <div class="item-left">
                  <span class="drag-handle" title="${isOpponentView ? 'View only' : 'Drag up or down to reorder'}" draggable="false" style="${isOpponentView ? 'opacity: 0.3; cursor: default;' : ''}">⠿</span>
                  <div class="item-order-btns">
                    <button class="btn-lineup-order modal-order-up" data-player-id="${player.id}" ${idx === 0 || isOpponentView ? 'disabled' : ''} title="Move UP">▲</button>
                    <button class="btn-lineup-order modal-order-down" data-player-id="${player.id}" ${idx === state.battingOrder.length - 1 || isOpponentView ? 'disabled' : ''} title="Move DOWN">▼</button>
                  </div>
                  <span class="batting-slot-num" style="min-width: 28px; text-align: center;">${idx + 1}</span>
                  <span class="jersey-num">#${player.jerseyNumber}</span>
                  <div class="item-player-info">
                    <strong style="color: #fff;">${player.name}${player.age ? ` <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-left: 4px;">(Age ${player.age})</span>` : ''}</strong>
                    <div class="item-tags">
                      ${(player.canPitch ?? player.eligiblePositions?.canPitch) ? '<span class="tag-badge tag-p">P</span>' : ''}
                      ${(player.canCatch ?? player.eligiblePositions?.canCatch) ? '<span class="tag-badge tag-c">C</span>' : ''}
                    </div>
                  </div>
                </div>
                <div class="item-right">
                  <button class="btn-status-pill modal-toggle-status ${isAbsent ? 'pill-absent' : 'pill-present'}" data-player-id="${player.id}" ${isOpponentView ? 'disabled style="opacity: 0.8; cursor: default;"' : ''}>
                    ${isAbsent ? '❌ Absent / Unavailable' : '✅ Present (Active)'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
          ${state.players.filter((p) => !state.battingOrder.includes(p.id)).map((player) => `
            <div class="lineup-modal-item item-absent">
              <div class="item-left">
                <span class="batting-slot-num slot-inactive">—</span>
                <span class="jersey-num">#${player.jerseyNumber}</span>
                <div class="item-player-info">
                  <span style="color: #94a3b8;">${player.name}</span>
                </div>
              </div>
              <div class="item-right">
                <button class="btn-status-pill modal-toggle-status pill-absent" data-player-id="${player.id}" ${isOpponentView ? 'disabled style="opacity: 0.8; cursor: default;"' : ''}>
                  ❌ Absent (Mark Present)
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const footerHtml = `
      ${isOpponentView ? '<span class="badge-save-view-only" style="margin-right: auto;">🔒 Save: View Only</span>' : ''}
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Done</button>
    `;

    this.showModal(isOpponentView ? '👁️ Opponent Batting Lineup (View Only)' : '📋 Batting Lineup & Attendance Manager', bodyHtml, footerHtml);

    if (!isOpponentView) {
      // Event handlers in modal
      document.querySelectorAll('.modal-order-up').forEach((btn) => {
        btn.onclick = () => {
          const pId = btn.getAttribute('data-player-id');
          this.stateManager.movePlayerInBattingOrder(pId, 'UP');
          this.showLineupAttendanceModal(this.stateManager.state);
        };
      });

      document.querySelectorAll('.modal-order-down').forEach((btn) => {
        btn.onclick = () => {
          const pId = btn.getAttribute('data-player-id');
          this.stateManager.movePlayerInBattingOrder(pId, 'DOWN');
          this.showLineupAttendanceModal(this.stateManager.state);
        };
      });

      document.querySelectorAll('.modal-toggle-status').forEach((btn) => {
        btn.onclick = () => {
          const pId = btn.getAttribute('data-player-id');
          this.stateManager.setPlayerAvailability(pId);
          this.showLineupAttendanceModal(this.stateManager.state);
        };
      });

      // Setup Drag-and-Drop in modal
      this.setupLineupDragAndDrop(
        document.getElementById('modal-container'),
        '.lineup-modal-item',
        (draggedId, targetIndex) => {
          this.stateManager.movePlayerToSlot(draggedId, targetIndex);
          this.showLineupAttendanceModal(this.stateManager.state);
        }
      );
    }
  }

  async showNewGameModal(state) {
    const { SAMPLE_TEAMS } = await import('./sample-data.js');
    const { teamStorage } = await import('./team-storage.js');

    let createdTeams = [];
    try {
      createdTeams = await teamStorage.listTeams();
    } catch (e) {
      console.warn('Could not load teams from teamStorage:', e);
    }

    // Merge registered teams and sample teams without duplicates
    const allTeamsMap = new Map();
    SAMPLE_TEAMS.forEach((t) => {
      allTeamsMap.set(t.teamName.toLowerCase(), {
        teamId: t.teamId,
        teamName: t.teamName,
        opponentName: t.opponentName || 'Opponents',
        isPreset: true,
        playerCount: t.players ? t.players.length : 0,
      });
    });
    createdTeams.forEach((t) => {
      allTeamsMap.set(t.teamName.toLowerCase(), {
        teamId: t.teamId,
        teamName: t.teamName,
        opponentName: t.opponentName || 'Opponents',
        isPreset: false,
        playerCount: t.playerCount || 0,
      });
    });

    // Current manager and their managed team
    const currentManager = teamStorage.getCurrentManager();
    const managedTeam = await teamStorage.getManagedTeam(currentManager?.uid);

    // Current selection defaults
    const currentTeamName = (managedTeam ? managedTeam.teamName : state.teamName) || 'Black Bats';
    const currentOpponentName = (state.opponentName && state.opponentName.toLowerCase() !== currentTeamName.toLowerCase()) ? state.opponentName : 'River Cats';

    const bodyHtml = `
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 14px;">
        Configure your next match, select your active team roster, and pick an opponent from all created teams.
      </p>

      <div class="form-group">
        <label class="form-label" style="display: flex; justify-content: space-between;">
          <span>Your Team (Roster & Profile):</span>
          <span style="font-size: 0.75rem; color: #38bdf8;">${allTeams.length} teams available</span>
        </label>
        <select id="modal-select-team" class="form-select">
          ${allTeams.map((t) => {
            const isMyTeam = (managedTeam && (t.teamId === managedTeam.teamId || t.teamName.toLowerCase() === managedTeam.teamName.toLowerCase())) || (t.teamName.toLowerCase() === currentTeamName.toLowerCase());
            return `
              <option value="${t.teamId}" data-name="${t.teamName}" ${isMyTeam ? 'selected' : ''}>
                ${managedTeam && (t.teamId === managedTeam.teamId || t.teamName.toLowerCase() === managedTeam.teamName.toLowerCase()) ? '👑' : '⚾'} ${t.teamName} ${managedTeam && (t.teamId === managedTeam.teamId || t.teamName.toLowerCase() === managedTeam.teamName.toLowerCase()) ? '(Your Managed Team)' : ''} ${t.playerCount ? `(${t.playerCount} players)` : ''}
              </option>
            `;
          }).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Your Team Name:</label>
        <input id="modal-input-team" class="form-input" value="${currentTeamName}" placeholder="Enter your team name..." />
      </div>

      <div class="form-group" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px;">
        <label class="form-label" style="color: #38bdf8; font-weight: 800; display: flex; align-items: center; justify-content: space-between;">
          <span>⚔️ Opponent Team (Select from Created Teams):</span>
          <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 600;">Choose from list or type custom</span>
        </label>
        <select id="modal-select-opponent" class="form-select" style="margin-bottom: 10px; font-weight: 600;">
          <option value="">-- Choose Opponent from Created Teams --</option>
          ${allTeams.map((t) => `
            <option value="${t.teamName}" ${t.teamName.toLowerCase() === currentOpponentName.toLowerCase() ? 'selected' : ''}>
              ⚾ ${t.teamName}
            </option>
          `).join('')}
          <option value="__custom__">➕ Other / Custom Opponent...</option>
        </select>
        
        <label class="form-label" style="font-size: 0.78rem; color: #94a3b8;">Opponent Name (Confirmed):</label>
        <input id="modal-input-opponent" class="form-input" value="${currentOpponentName}" placeholder="Enter or select opponent team name..." />
      </div>

      <div class="checkbox-group" style="margin-top: 12px;">
        <input type="checkbox" id="modal-check-home" ${state.isHomeTeam ? 'checked' : ''} />
        <label for="modal-check-home">We are Home Team (field top of inning, bat bottom)</label>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
      <button id="modal-btn-start-game" class="btn btn-primary">Initialize & Optimize Lineup</button>
    `;

    this.showModal('⚙ New Game / Roster Setup', bodyHtml, footerHtml);

    // Interactive event bindings for the modal
    const selectTeam = document.getElementById('modal-select-team');
    const inputTeam = document.getElementById('modal-input-team');
    const selectOpponent = document.getElementById('modal-select-opponent');
    const inputOpponent = document.getElementById('modal-input-opponent');

    if (selectTeam && inputTeam) {
      selectTeam.onchange = () => {
        const selectedOpt = selectTeam.options[selectTeam.selectedIndex];
        const teamName = selectedOpt ? selectedOpt.getAttribute('data-name') : selectTeam.value;
        if (teamName) {
          inputTeam.value = teamName;
        }
      };
    }

    if (selectOpponent && inputOpponent) {
      selectOpponent.onchange = () => {
        const val = selectOpponent.value;
        if (val === '__custom__') {
          inputOpponent.value = '';
          inputOpponent.focus();
        } else if (val) {
          inputOpponent.value = val;
        }
      };

      inputOpponent.oninput = () => {
        const typed = inputOpponent.value.trim().toLowerCase();
        const matched = Array.from(selectOpponent.options).find(
          (opt) => opt.value.toLowerCase() === typed
        );
        if (matched) {
          selectOpponent.value = matched.value;
        } else {
          selectOpponent.value = '__custom__';
        }
      };
    }

    document.getElementById('modal-btn-start-game').onclick = async () => {
      const teamIdSelected = selectTeam ? selectTeam.value : state.teamId;
      const teamName = (inputTeam ? inputTeam.value : state.teamName).trim() || 'NNLL Team';
      const opponentName = (inputOpponent ? inputOpponent.value : state.opponentName).trim() || 'Opponents';
      const isHomeTeam = document.getElementById('modal-check-home').checked;

      // Load roster for the selected team
      let playersToUse = null;
      let finalTeamId = teamIdSelected;

      try {
        const fullTeam = await teamStorage.getTeam(teamIdSelected);
        if (fullTeam && fullTeam.roster && fullTeam.roster.length > 0) {
          playersToUse = fullTeam.roster;
          finalTeamId = fullTeam.teamId;
        }
      } catch (e) {
        console.warn('Could not load team from teamStorage:', e);
      }

      if (!playersToUse || playersToUse.length === 0) {
        const preset = SAMPLE_TEAMS.find((t) => t.teamId === teamIdSelected) || SAMPLE_TEAMS[0];
        playersToUse = preset.players;
      }

      // Auto-register or update team into teamStorage respecting 1-team-per-manager rule
      try {
        const existingTeams = await teamStorage.listTeams();
        let matchedTeam = existingTeams.find((t) => t.teamName.toLowerCase() === teamName.toLowerCase());

        if (!matchedTeam) {
          const canCreate = await teamStorage.canManagerCreateTeam(currentManager?.uid);
          if (canCreate.allowed) {
            matchedTeam = await teamStorage.createTeam({
              teamName,
              opponentName,
              headCoach: currentManager?.displayName || 'Coach Collins',
            });
            await teamStorage.saveTeamRoster(matchedTeam.teamId, playersToUse);
          } else if (canCreate.existingTeam) {
            matchedTeam = canCreate.existingTeam;
            await teamStorage.updateTeamProfile(matchedTeam.teamId, { opponentName });
          }
        } else {
          await teamStorage.updateTeamProfile(matchedTeam.teamId, { opponentName });
        }
        if (matchedTeam) finalTeamId = matchedTeam.teamId;
      } catch (e) {
        console.warn('Could not auto-register team into teamStorage:', e);
      }

      // Check if opponent roster exists in teamStorage or sample teams
      let oppPlayers = null;
      try {
        const oppTeams = await teamStorage.listTeams();
        const matchedOpp = oppTeams.find((t) => t.teamName.toLowerCase() === opponentName.toLowerCase());
        if (matchedOpp) {
          const oppFull = await teamStorage.getTeam(matchedOpp.teamId);
          if (oppFull && oppFull.roster && oppFull.roster.length > 0) {
            oppPlayers = oppFull.roster;
          }
        }
      } catch (e) {
        console.warn('Could not load opponent roster from teamStorage:', e);
      }
      if (!oppPlayers || oppPlayers.length === 0) {
        const sampleOpp = SAMPLE_TEAMS.find((t) =>
          t.teamName.toLowerCase().includes(opponentName.toLowerCase()) ||
          opponentName.toLowerCase().includes(t.teamName.toLowerCase().split(' ')[0])
        );
        if (sampleOpp && sampleOpp.players) {
          oppPlayers = sampleOpp.players;
        }
      }

      this.stateManager.initNewGame({
        teamId: finalTeamId,
        teamName,
        opponentName,
        isHomeTeam,
        players: playersToUse,
        opponentPlayers: oppPlayers,
      });

      this.closeModal();
    };
  }

  /**
   * Setup Drag-and-Drop Lineup Reordering for desktop mouse and mobile/tablet touch.
   * Enables dragging players up and down to change their slot in the continuous batting order.
   * @param {HTMLElement} container
   * @param {string} itemSelector
   * @param {Function} onReorder (playerId, targetIndex) => void
   */
  setupLineupDragAndDrop(container, itemSelector, onReorder) {
    if (!container) return;
    const items = container.querySelectorAll(itemSelector);
    if (!items.length) return;

    let activeDrag = null;

    items.forEach((item) => {
      // 1. Desktop HTML5 Drag Events
      item.addEventListener('dragstart', (e) => {
        // Prevent accidental drag when clicking interactive buttons
        if (e.target.closest('button, input, select, .btn-lineup-order, .btn-status-pill, .slot-badge')) {
          e.preventDefault();
          return;
        }

        const pId = item.getAttribute('data-player-id');
        const fromIdx = parseInt(item.getAttribute('data-slot-idx'), 10);
        if (!pId || isNaN(fromIdx)) {
          e.preventDefault();
          return;
        }

        activeDrag = { playerId: pId, fromIdx, sourceEl: item };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', pId);
        document.body.classList.add('dragging-lineup-active');

        // Apply is-dragging slightly asynchronously so drag ghost image captures full opacity
        setTimeout(() => {
          if (activeDrag && activeDrag.sourceEl) {
            activeDrag.sourceEl.classList.add('is-dragging');
          }
        }, 0);
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!activeDrag || activeDrag.sourceEl === item) return;

        const rect = item.getBoundingClientRect();
        const isAfter = e.clientY > (rect.top + rect.height / 2);

        item.classList.toggle('drag-over-top', !isAfter);
        item.classList.toggle('drag-over-bottom', isAfter);
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over-top', 'drag-over-bottom');
        if (!activeDrag) return;

        const hoverIdx = parseInt(item.getAttribute('data-slot-idx'), 10);
        const { playerId, fromIdx } = activeDrag;

        if (!isNaN(hoverIdx) && playerId && fromIdx !== hoverIdx) {
          const rect = item.getBoundingClientRect();
          const isAfter = e.clientY > (rect.top + rect.height / 2);

          let targetIndex = hoverIdx;
          if (fromIdx < hoverIdx) {
            targetIndex = isAfter ? hoverIdx : hoverIdx - 1;
          } else if (fromIdx > hoverIdx) {
            targetIndex = isAfter ? hoverIdx + 1 : hoverIdx;
          }

          onReorder(playerId, targetIndex);
        }

        activeDrag = null;
        document.body.classList.remove('dragging-lineup-active');
      });

      item.addEventListener('dragend', () => {
        items.forEach((it) => it.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom'));
        document.body.classList.remove('dragging-lineup-active');
        activeDrag = null;
      });

      // 2. Mobile / Tablet Touch Events (for dugouts using iPad or phones)
      const touchHandle = item.querySelector('.drag-handle') || item.querySelector('.col-player') || item;
      let touchState = null;

      touchHandle.addEventListener('touchstart', (e) => {
        if (e.target.closest('button, input, select, .btn-lineup-order, .btn-status-pill, .slot-badge')) return;
        const pId = item.getAttribute('data-player-id');
        const fromIdx = parseInt(item.getAttribute('data-slot-idx'), 10);
        if (!pId || isNaN(fromIdx)) return;

        const touch = e.touches[0];
        touchState = {
          playerId: pId,
          fromIdx,
          sourceEl: item,
          startY: touch.clientY,
          lastHoverEl: null,
          isAfter: false,
        };

        item.classList.add('is-dragging');
        document.body.classList.add('dragging-lineup-active');
      }, { passive: true });

      touchHandle.addEventListener('touchmove', (e) => {
        if (!touchState) return;
        const touch = e.touches[0];
        const targetUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!targetUnderFinger) return;

        const hoverItem = targetUnderFinger.closest(itemSelector);

        if (touchState.lastHoverEl && touchState.lastHoverEl !== hoverItem) {
          touchState.lastHoverEl.classList.remove('drag-over-top', 'drag-over-bottom');
        }

        if (hoverItem && hoverItem !== touchState.sourceEl) {
          e.preventDefault(); // Prevent page scroll when hovering over another slot
          const rect = hoverItem.getBoundingClientRect();
          const isAfter = touch.clientY > (rect.top + rect.height / 2);

          hoverItem.classList.toggle('drag-over-top', !isAfter);
          hoverItem.classList.toggle('drag-over-bottom', isAfter);

          touchState.lastHoverEl = hoverItem;
          touchState.isAfter = isAfter;
        }
      }, { passive: false });

      const finishTouch = () => {
        if (!touchState) return;
        const { playerId, fromIdx, sourceEl, lastHoverEl, isAfter } = touchState;

        sourceEl.classList.remove('is-dragging');
        if (lastHoverEl) {
          lastHoverEl.classList.remove('drag-over-top', 'drag-over-bottom');
          const hoverIdx = parseInt(lastHoverEl.getAttribute('data-slot-idx'), 10);
          if (!isNaN(hoverIdx) && hoverIdx !== fromIdx) {
            let targetIndex = hoverIdx;
            if (fromIdx < hoverIdx) {
              targetIndex = isAfter ? hoverIdx : hoverIdx - 1;
            } else if (fromIdx > hoverIdx) {
              targetIndex = isAfter ? hoverIdx + 1 : hoverIdx;
            }
            onReorder(playerId, targetIndex);
          }
        }

        document.body.classList.remove('dragging-lineup-active');
        touchState = null;
      };

      touchHandle.addEventListener('touchend', finishTouch);
      touchHandle.addEventListener('touchcancel', finishTouch);
    });
  }
}
