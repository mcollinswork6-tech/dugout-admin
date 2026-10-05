/**
 * NNLL Minor AAA Dugout UI Rendering & Interaction Module
 */

import {
  FIELD_POSITIONS,
  INFIELD_POSITIONS,
  OUTFIELD_POSITIONS,
  POSITION_NAMES,
  NNLL_RULES,
  isSuperAdmin,
} from './constants.js';
import { TeamManagerUI } from './team-manager-ui.js';
import { teamStorage } from './team-storage.js';

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
        <div class="brand-section">
          <div class="brand-title-wrap">
            <span class="brand-badge">NNLL MINOR AAA</span>
            <h1 class="brand-title">⚾ Dugout Optimizer</h1>
          </div>
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
          ${this.appViewMode === 'planning' ? `
            <button id="btn-lineup-modal" class="btn btn-secondary btn-sm" title="${isOpponentView ? 'View opponent lineup and roster' : 'Reorder batting lineup & set attendance'}">📋 ${isOpponentView ? 'Opponent Lineup' : 'Lineup & Attendance'}</button>
            <button id="btn-teams-manager" class="btn btn-secondary btn-sm" title="Manage teams, rosters, and cumulative season stats">👥 Teams & Stats</button>
            <button id="btn-new-game" class="btn btn-secondary btn-sm">⚙ New Game</button>
            <button id="btn-print-card" class="btn btn-primary btn-sm">🖨 Printable Lineup Card</button>
          ` : `
            <button id="btn-teams-manager" class="btn btn-secondary btn-sm" title="Manage teams, rosters, and cumulative season stats">👥 Teams & Stats</button>
            <button id="btn-new-game" class="btn btn-secondary btn-sm">⚙ New Game</button>
          `}
          ${this.renderCoachProfile()}
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
            <h2>NNLL Minor AAA Lineup & Defensive Rotation</h2>
            <p><strong>Team:</strong> ${state.teamName} | <strong>Opponent:</strong> ${state.opponentName} | <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
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
        <!-- Subview: Line-Up vs Game Tracker -->
        ${this.gameLayoutTab === 'lineup'
          ? this.renderGameLineupSubView(state, validation)
          : this.renderGameTrackerSubView(state, validation)}

        <!-- Bottom Task Bar of Buttons -->
        <nav class="game-bottom-taskbar" id="game-bottom-taskbar" aria-label="Game Navigation Bar">
          <button id="btn-taskbar-lineup" class="taskbar-btn ${this.gameLayoutTab === 'lineup' ? 'active' : ''}">
            <span class="taskbar-icon">📋</span>
            <div class="taskbar-text-group">
              <span class="taskbar-label">Line-Up</span>
              <span class="taskbar-sub">Inning ${this.gameLineupInning} Positions</span>
            </div>
          </button>
          
          <button id="btn-taskbar-tracker" class="taskbar-btn ${this.gameLayoutTab === 'tracker' ? 'active' : ''}">
            <span class="taskbar-icon">⚾</span>
            <div class="taskbar-text-group">
              <span class="taskbar-label">Game Tracker</span>
              <span class="taskbar-sub">Outs, Score & Pitches</span>
            </div>
          </button>

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
                const canPitch = p.eligiblePositions?.canPitch;
                const canCatch = p.eligiblePositions?.canCatch;
                const can1B = p.eligiblePositions?.canPlayFirstBase;

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
                        <strong class="player-name">${p.name}</strong>
                        ${p.isOut ? '<span class="badge-player-out">ABSENT / OUT</span>' : ''}
                      </div>
                      <div class="player-tags-row">
                        ${canPitch ? '<span class="tag-elig tag-p" title="Eligible to Pitch">P</span>' : ''}
                        ${canCatch ? '<span class="tag-elig tag-c" title="Eligible to Catch">C</span>' : ''}
                        ${can1B ? '<span class="tag-elig tag-1b" title="Eligible for 1B">1B</span>' : ''}
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
              <div class="field-arc-outfield">
                <div class="field-pos-box box-lf ${assignments.LF ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'LF' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="LF" data-player-id="${assignments.LF || ''}">
                  <span class="pos-tag">LF</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments.LF)?.name || 'Empty'}</span>
                </div>
                <div class="field-pos-box box-cf ${assignments.CF ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'CF' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="CF" data-player-id="${assignments.CF || ''}">
                  <span class="pos-tag">CF</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments.CF)?.name || 'Empty'}</span>
                </div>
                <div class="field-pos-box box-rf ${assignments.RF ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'RF' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="RF" data-player-id="${assignments.RF || ''}">
                  <span class="pos-tag">RF</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments.RF)?.name || 'Empty'}</span>
                </div>
              </div>

              <div class="field-diamond-infield">
                <div class="field-pos-box box-3b ${assignments['3B'] ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === '3B' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="3B" data-player-id="${assignments['3B'] || ''}">
                  <span class="pos-tag">3B</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments['3B'])?.name || 'Empty'}</span>
                </div>
                <div class="field-pos-box box-ss ${assignments.SS ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'SS' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="SS" data-player-id="${assignments.SS || ''}">
                  <span class="pos-tag">SS</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments.SS)?.name || 'Empty'}</span>
                </div>
                <div class="field-pos-box box-2b ${assignments['2B'] ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === '2B' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="2B" data-player-id="${assignments['2B'] || ''}">
                  <span class="pos-tag">2B</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments['2B'])?.name || 'Empty'}</span>
                </div>
                <div class="field-pos-box box-1b ${assignments['1B'] ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === '1B' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="1B" data-player-id="${assignments['1B'] || ''}">
                  <span class="pos-tag">1B</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments['1B'])?.name || 'Empty'}</span>
                </div>
                <div class="field-pos-box box-p ${assignments.P ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'P' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="P" data-player-id="${assignments.P || ''}">
                  <span class="pos-tag">P</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments.P)?.name || 'Empty'}</span>
                </div>
                <div class="field-pos-box box-c ${assignments.C ? 'occupied' : 'empty'} ${this.selectedSwapCell?.position === 'C' && this.selectedSwapCell?.inningNum === selInning ? 'selected-swap' : ''}"
                  data-inning="${selInning}" data-position="C" data-player-id="${assignments.C || ''}">
                  <span class="pos-tag">C</span>
                  <span class="pos-player">${state.players.find(p => p.id === assignments.C)?.name || 'Empty'}</span>
                </div>
              </div>
            </div>

            <!-- Dugout Bench Section -->
            <div class="field-bench-section">
              <span class="bench-section-title">🛋️ Dugout / Bench (${benchIds.length}):</span>
              <div class="bench-chips-wrap">
                ${benchIds.length === 0 ? '<span class="bench-empty-text">No players on bench this inning</span>' : ''}
                ${benchIds.map((bId) => {
                  const bp = state.players.find((p) => p.id === bId);
                  const isSelected = this.selectedSwapCell?.playerId === bId && this.selectedSwapCell?.inningNum === selInning;
                  return `
                    <div class="field-pos-box box-bench ${isSelected ? 'selected-swap' : ''}"
                      data-inning="${selInning}" data-position="BENCH" data-player-id="${bId}">
                      <span class="pos-tag">BENCH</span>
                      <span class="pos-player">#${bp ? bp.jerseyNumber : '--'} ${bp ? bp.name : 'Unknown'}</span>
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

    const innRunsObj = (runsState.innings && runsState.innings[curInning]) || { top: 0, bottom: 0 };
    const curHalfRuns = isTop ? (innRunsObj.top || 0) : (innRunsObj.bottom || 0);
    const is5RunCap = curHalfRuns >= 5 && curInning < 6;

    // Active pitcher
    const pitcherId = state.activePitcherId;
    const pitcherPlayer = state.players.find((p) => p.id === pitcherId);
    const pitcherName = pitcherPlayer ? `${pitcherPlayer.name} (#${pitcherPlayer.jerseyNumber})` : 'None Selected';
    const currentPitches = pitcherId ? state.playerPitches[pitcherId] || 0 : 0;
    const isPitchWarning = currentPitches >= NNLL_RULES.PITCH_WARNING_THRESHOLD && currentPitches < NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD;
    const isPitchDanger = currentPitches >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD;
    const fillPercent = Math.min(100, Math.round((currentPitches / 85) * 100));

    // Little League Rest Days calculation
    let restDaysText = '0 Days (Eligible tomorrow)';
    if (currentPitches >= 66) restDaysText = '4 Calendar Days Rest';
    else if (currentPitches >= 51) restDaysText = '3 Calendar Days Rest';
    else if (currentPitches >= 36) restDaysText = '2 Calendar Days Rest';
    else if (currentPitches >= 21) restDaysText = '1 Calendar Day Rest';

    // Outs
    const outs = state.currentOuts || 0;

    // Count: Balls and Strikes
    const balls = state.currentBalls || 0;
    const strikes = state.currentStrikes || 0;

    // Batting Carousel / Due Up
    const bOrder = state.battingOrder || [];
    const bIndex = state.currentBatterIndex || 0;
    const atBatPlayer = bOrder.length > 0 ? state.players.find((p) => p.id === bOrder[bIndex % bOrder.length]) : null;
    const onDeckPlayer = bOrder.length > 1 ? state.players.find((p) => p.id === bOrder[(bIndex + 1) % bOrder.length]) : null;
    const inHolePlayer = bOrder.length > 2 ? state.players.find((p) => p.id === bOrder[(bIndex + 2) % bOrder.length]) : null;

    // Courtesy Runner recommendation
    const courtesy = this.stateManager.getCourtesyRunnerRecommendation();

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
            
            <div class="scoreboard-main">
              <!-- Away Team -->
              <div class="team-score-box ${isTop ? 'at-bat' : ''}">
                <div class="team-meta">
                  <div class="team-label-wrap">
                    <span class="team-name" title="${awayTeamName}">${awayTeamName}</span>
                    <span class="team-tag">AWAY</span>
                  </div>
                  ${isTop ? `<span class="at-bat-pill">⚾ BATTING</span>` : ''}
                </div>
                <div class="score-display-wrap">
                  <span class="score-number">${awayScore}</span>
                  <div class="score-btn-group">
                    <button id="btn-run-away-plus" class="btn-score-adjust plus" title="Add 1 Run to Away team">+1</button>
                    <button id="btn-run-away-minus" class="btn-score-adjust minus" title="Subtract 1 Run from Away team">-1</button>
                  </div>
                </div>
              </div>

              <div class="scoreboard-vs">VS</div>

              <!-- Home Team -->
              <div class="team-score-box ${isBottom ? 'at-bat' : ''}">
                <div class="team-meta">
                  <div class="team-label-wrap">
                    <span class="team-name" title="${homeTeamName}">${homeTeamName}</span>
                    <span class="team-tag">HOME</span>
                  </div>
                  ${isBottom ? `<span class="at-bat-pill">⚾ BATTING</span>` : ''}
                </div>
                <div class="score-display-wrap">
                  <span class="score-number">${homeScore}</span>
                  <div class="score-btn-group">
                    <button id="btn-run-home-plus" class="btn-score-adjust plus" title="Add 1 Run to Home team">+1</button>
                    <button id="btn-run-home-minus" class="btn-score-adjust minus" title="Subtract 1 Run from Home team">-1</button>
                  </div>
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

          <!-- Pillar 2: Outs Tracker -->
          <div class="game-card game-card-outs">
            <div class="game-card-header">
              <span class="game-card-title">⏱ Outs Tracker</span>
              <button id="btn-game-out-reset" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 3px 8px;">Reset Outs</button>
            </div>

            <div class="outs-bubbles-container">
              <div class="outs-bubble-item ${outs >= 1 ? 'filled' : ''}" data-out="1">
                <span class="bubble-circle"></span>
                <span class="bubble-label">1 OUT</span>
              </div>
              <div class="outs-bubble-item ${outs >= 2 ? 'filled' : ''}" data-out="2">
                <span class="bubble-circle"></span>
                <span class="bubble-label">2 OUTS</span>
              </div>
              <div class="outs-bubble-item ${outs >= 3 ? 'filled' : ''}" data-out="3">
                <span class="bubble-circle"></span>
                <span class="bubble-label">3 OUTS</span>
              </div>
            </div>

            <div class="outs-action-buttons">
              <button id="btn-game-record-out" class="btn btn-danger btn-jumbo">
                <span style="font-size: 1.4rem;">🛑</span>
                <span>+1 OUT (Record Out)</span>
              </button>
              ${outs >= 3 ? `
                <button id="btn-game-end-half" class="btn btn-warning btn-jumbo pulse-attention">
                  <span>🔔 3 Outs! End Half Inning ❯</span>
                </button>
              ` : ''}
            </div>

            <!-- 2-Outs Courtesy Runner Banner -->
            ${outs === 2 ? `
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
                <div class="pitcher-status-sub">
                  ${isPitchDanger ? '🚫 Cannot play Catcher rest of game' : isPitchWarning ? '⚠️ Warning: Near 41-pitch catcher limit' : 'Active Pitcher of Record'}
                </div>
              </div>
              <div class="pitcher-count-badge ${isPitchDanger ? 'danger' : isPitchWarning ? 'warning' : ''}">
                <span class="count-val">${currentPitches}</span>
                <span class="count-unit">PITCHES</span>
              </div>
            </div>

            <div class="pitch-threshold-bar-game">
              <div class="pitch-fill ${isPitchDanger ? 'danger' : isPitchWarning ? 'warning' : ''}" style="width: ${fillPercent}%;"></div>
            </div>

            <div class="pitch-markers-game">
              <span>0</span>
              <span>35</span>
              <span class="marker-c-cap">41 (C-Cap)</span>
              <span>50</span>
              <span>65</span>
              <span>75</span>
              <span>85</span>
            </div>

            <div class="pitch-rest-callout">
              <span class="rest-label">MANDATORY REST:</span>
              <span class="rest-value">${restDaysText}</span>
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
              <span class="game-card-title">📋 Continuous Batting Order (Due Up)</span>
              <div class="batting-nav-btns">
                <button id="btn-batter-prev" class="btn btn-secondary btn-sm" title="Previous batter">❮ Prev</button>
                <button id="btn-batter-next" class="btn btn-primary btn-sm" title="Advance to next batter">Next Batter ❯</button>
              </div>
            </div>

            <div class="due-up-list">
              <div class="due-up-item at-bat-item">
                <div class="due-up-badge badge-atbat">AT BAT</div>
                <div class="due-up-info">
                  <strong>${atBatPlayer ? atBatPlayer.name : 'None'}</strong>
                  <span>Jersey #${atBatPlayer ? atBatPlayer.jerseyNumber : '--'} • Slot ${(bIndex % bOrder.length) + 1}</span>
                </div>
                <span class="due-up-icon">🎯</span>
              </div>

              <div class="due-up-item on-deck-item">
                <div class="due-up-badge badge-ondeck">ON DECK</div>
                <div class="due-up-info">
                  <strong>${onDeckPlayer ? onDeckPlayer.name : 'None'}</strong>
                  <span>Jersey #${onDeckPlayer ? onDeckPlayer.jerseyNumber : '--'} • Slot {((bIndex + 1) % bOrder.length) + 1}</span>
                </div>
                <span class="due-up-icon">🟡</span>
              </div>

              <div class="due-up-item in-hole-item">
                <div class="due-up-badge badge-inhole">IN HOLE</div>
                <div class="due-up-info">
                  <strong>${inHolePlayer ? inHolePlayer.name : 'None'}</strong>
                  <span>Jersey #${inHolePlayer ? inHolePlayer.jerseyNumber : '--'} • Slot {((bIndex + 2) % bOrder.length) + 1}</span>
                </div>
                <span class="due-up-icon">⚪</span>
              </div>
            </div>

            <!-- In-Game Roster Modifiers -->
            <div class="game-modifiers-row">
              <span class="mod-title">Live In-Game Adjustments:</span>
              <button id="btn-game-late" class="btn btn-secondary btn-sm">➕ Late Arrival</button>
              <button id="btn-game-injured" class="btn btn-warning btn-sm">🚑 Player Injured / Out</button>
              <button id="btn-game-recalculate" class="btn btn-secondary btn-sm" title="Re-solve downstream innings">🔄 Re-solve</button>
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
          <div class="hub-header-badge">NNLL DUGOUT OPERATIONS</div>
          <h3 class="hub-header-title">⚡ Command Menu</h3>
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
                  <span class="player-name">${player.name}</span>
                  <button class="btn-status-pill ${player.isOut ? 'pill-absent' : 'pill-present'}" data-player-id="${player.id}" title="Click to toggle Present / Unavailable">
                    ${player.isOut ? (player.outReason || 'Absent') : 'Present'}
                  </button>
                </div>
                <div class="player-tags">
                  ${player.eligiblePositions?.canPitch ? '<span class="tag-badge tag-p">P</span>' : ''}
                  ${player.eligiblePositions?.canCatch ? '<span class="tag-badge tag-c">C</span>' : ''}
                  ${player.eligiblePositions?.canPlayFirstBase ? '<span class="tag-badge tag-1b">1B</span>' : ''}
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
                  ${player.eligiblePositions?.canPitch ? '<span class="tag-badge tag-p">P</span>' : ''}
                  ${player.eligiblePositions?.canCatch ? '<span class="tag-badge tag-c">C</span>' : ''}
                  ${player.eligiblePositions?.canPlayFirstBase ? '<span class="tag-badge tag-1b">1B</span>' : ''}
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
    // Bottom Task Bar Switches (Line-Up vs Game Tracker)
    const btnTaskbarLineup = document.getElementById('btn-taskbar-lineup');
    if (btnTaskbarLineup) {
      btnTaskbarLineup.onclick = () => {
        this.gameLayoutTab = 'lineup';
        localStorage.setItem('dugout_game_layout_tab', 'lineup');
        this.render({
          state: this.stateManager.state,
          validation: this.stateManager.validate(),
          canUndo: this.stateManager.historyIndex > 0,
          canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
        });
      };
    }

    const btnTaskbarTracker = document.getElementById('btn-taskbar-tracker');
    if (btnTaskbarTracker) {
      btnTaskbarTracker.onclick = () => {
        this.gameLayoutTab = 'tracker';
        localStorage.setItem('dugout_game_layout_tab', 'tracker');
        this.render({
          state: this.stateManager.state,
          validation: this.stateManager.validate(),
          canUndo: this.stateManager.historyIndex > 0,
          canRedo: this.stateManager.historyIndex < this.stateManager.history.length - 1,
        });
      };
    }

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
    if (btnGameRecordOut) btnGameRecordOut.onclick = () => this.stateManager.recordOut();

    const btnGameOutReset = document.getElementById('btn-game-out-reset');
    if (btnGameOutReset) btnGameOutReset.onclick = () => this.stateManager.resetOuts();

    document.querySelectorAll('.outs-bubble-item').forEach((item) => {
      item.onclick = () => {
        const outNum = parseInt(item.getAttribute('data-out'), 10);
        this.stateManager.setOuts(outNum % 4);
      };
    });

    // Pitch Controls in Game View: Strike, Ball, In Play, Foul, Undo
    const btnPitchStrike = document.getElementById('btn-pitch-strike');
    if (btnPitchStrike) btnPitchStrike.onclick = () => this.stateManager.recordPitchStrike();

    const btnPitchBall = document.getElementById('btn-pitch-ball');
    if (btnPitchBall) btnPitchBall.onclick = () => this.stateManager.recordPitchBall();

    const btnPitchInPlay = document.getElementById('btn-pitch-inplay');
    if (btnPitchInPlay) btnPitchInPlay.onclick = () => this.stateManager.recordPitchInPlay();

    const btnPitchFoul = document.getElementById('btn-pitch-foul');
    if (btnPitchFoul) btnPitchFoul.onclick = () => this.stateManager.recordPitchFoul();

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

  showRecordOutModal(state) {
    const curInningRec = state.innings[state.currentInning - 1];
    const catcherId = curInningRec ? curInningRec.assignments.C : null;
    const catcher = state.players.find((p) => p.id === catcherId);

    const bodyHtml = `
      <p style="color: #94a3b8; font-size: 0.9rem;">
        Record the batter who made the out to track courtesy runner eligibility (when 2 outs are reached with catcher on base).
      </p>
      <div class="form-group">
        <label class="form-label">Batter Who Made Out:</label>
        <select id="modal-select-out-batter" class="form-select">
          ${state.battingOrder.map((pId, idx) => {
            const p = state.players.find((pl) => pl.id === pId);
            return `<option value="${pId}">${idx + 1}. ${p.name} (#${p.jerseyNumber})</option>`;
          }).join('')}
        </select>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
      <button id="modal-confirm-out-record" class="btn btn-danger">+1 Out</button>
    `;

    this.showModal('🔴 Record Out & Track Courtesy Runner', bodyHtml, footerHtml);

    document.getElementById('modal-confirm-out-record').onclick = () => {
      const batterId = document.getElementById('modal-select-out-batter').value;
      this.stateManager.recordOut(batterId);
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
                    <strong style="color: #fff;">${player.name}</strong>
                    <div class="item-tags">
                      ${player.eligiblePositions?.canPitch ? '<span class="tag-badge tag-p">P</span>' : ''}
                      ${player.eligiblePositions?.canCatch ? '<span class="tag-badge tag-c">C</span>' : ''}
                      ${player.eligiblePositions?.canPlayFirstBase ? '<span class="tag-badge tag-1b">1B</span>' : ''}
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

      this.stateManager.initNewGame({
        teamId: finalTeamId,
        teamName,
        opponentName,
        isHomeTeam,
        players: playersToUse,
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
