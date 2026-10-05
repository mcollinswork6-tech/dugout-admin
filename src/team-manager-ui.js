/**
 * Team Selector & Organization Manager UI for NNLL Dugout Admin
 * Manages Teams, Rosters, Cumulative Stats, Firebase Storage Sync, and User Invitations.
 */

import { teamStorage } from './team-storage.js';
import { LEAGUE_CONFIG, isSuperAdmin, LEAGUE_ROLES } from './constants.js';

export class TeamManagerUI {
  constructor(stateManager, onTeamSwitched = () => {}) {
    this.stateManager = stateManager;
    this.onTeamSwitched = onTeamSwitched;
    this.activeTab = 'teams'; // 'teams' | 'roster' | 'stats' | 'invites' | 'storage'
    this.currentTeamId = null;
    this.teams = [];
    this.activeTeamProfile = null;
    this.roster = [];
    this.stats = null;
    this.isAddingPlayer = false;
    this.isAddingTeam = false;
    this.modalEl = null;
    this.message = null; // { type: 'success'|'error', text: '' }
    this.currentManager = null;
    this.managedTeam = null;
    this.canCreateTeam = { allowed: true };
    this.isSuperAdmin = false;
    this.invitations = [];
  }

  async open(initialTab = 'teams') {
    this.activeTab = initialTab;
    await this.loadData();
    this.render();
  }

  close() {
    const container = document.getElementById('modal-container');
    if (container) container.innerHTML = '';
  }

  async loadData() {
    this.currentManager = teamStorage.getCurrentManager();
    this.isSuperAdmin = isSuperAdmin(this.currentManager?.email);
    this.managedTeam = await teamStorage.getManagedTeam(this.currentManager?.uid);
    this.canCreateTeam = await teamStorage.canManagerCreateTeam(this.currentManager?.uid);
    this.teams = await teamStorage.listTeams();
    this.currentTeamId = await teamStorage.getActiveTeamId();
    if (!this.currentTeamId && this.teams.length > 0) {
      this.currentTeamId = this.managedTeam ? this.managedTeam.teamId : this.teams[0].teamId;
    }

    if (this.currentTeamId) {
      this.activeTeamProfile = await teamStorage.getTeamProfile(this.currentTeamId);
      this.roster = await teamStorage.getTeamRoster(this.currentTeamId);
      this.stats = await teamStorage.getTeamStats(this.currentTeamId);
      this.isCurrentTeamAdmin = this.isSuperAdmin || await teamStorage.isTeamAdmin(this.currentTeamId, this.currentManager?.uid);
    }

    if (this.isSuperAdmin) {
      this.invitations = await teamStorage.listInvitations();
    }
  }

  render() {
    const container = document.getElementById('modal-container');
    if (!container) return;

    const syncInfo = teamStorage.getSyncInfo();
    const canEdit = this.isSuperAdmin || !!this.isCurrentTeamAdmin;

    container.innerHTML = `
      <div class="modal-backdrop" id="team-modal-backdrop">
        <div class="modal-content team-manager-modal">
          <!-- Prominent View Only Banner on Top of the Screen/Modal for Opponent Teams (Hidden for Super Admin) -->
          ${!canEdit && !this.isSuperAdmin ? `
            <div class="modal-top-view-only-banner">
              <div style="display: flex; align-items: center; gap: 10px; width: 100%; flex-wrap: wrap;">
                <span class="view-only-tag">👁️ VIEW ONLY</span>
                <span class="badge-save-view-only">🔒 Save: View Only</span>
                <span style="color: #fecaca; font-size: 0.84rem; flex: 1;">
                  Viewing <strong>${this.activeTeamProfile?.teamName || 'Opponent'}</strong> (Opponent Team). You have view-only access to inspect their <strong>Roster</strong> and <strong>Season Record</strong>. Edits and saves are disabled.
                </span>
                ${this.managedTeam && this.managedTeam.teamId !== this.currentTeamId ? `
                  <button id="btn-modal-return-managed" class="btn btn-primary btn-xs" data-team-id="${this.managedTeam.teamId}" style="margin-left: auto; font-weight: 700;">
                    👑 Return to ${this.managedTeam.teamName} (My Team)
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Modal Header -->
          <div class="modal-header team-modal-header">
            <div class="team-modal-title-wrap">
              <span class="team-brand-pill">ORGANIZATION & TEAMS</span>
              <h3 class="modal-title">⚾ Team & Roster Manager</h3>
              ${this.isSuperAdmin ? `
                <span class="badge-super-admin" title="League Commissioner / Super User Admin - Full administrative and editing access across all teams">
                  🛡️ Super User Admin (All Teams)
                </span>
              ` : !canEdit ? `
                <span class="badge-view-only-pill" title="Opponent team - Read Only Access">👁️ VIEW ONLY (Opponent)</span>
                <span class="badge-save-view-only" title="Saves are disabled for opponent teams">🔒 Save: View Only</span>
              ` : `
                <span class="league-policy-pill" title="${LEAGUE_CONFIG.POLICY_STATEMENT}">
                  🛡️ Admin: ${this.activeTeamProfile?.teamName || 'Your Team'}
                </span>
              `}
              <div class="cloud-sync-status-badge ${syncInfo.status}">
                <span class="sync-dot"></span>
                <span>${syncInfo.status === 'synced' ? '☁️ Firebase Storage Synced' : syncInfo.status === 'syncing' ? '⏳ Syncing...' : '💾 Local / Offline Cache'}</span>
              </div>
            </div>
            <button id="btn-close-team-modal" class="btn btn-secondary btn-sm">✕</button>
          </div>

          <!-- Tab Navigation -->
          <div class="team-modal-tabs">
            <button class="team-tab-btn ${this.activeTab === 'teams' ? 'active' : ''}" id="tab-teams">
              👥 Teams Catalog (${this.teams.length})
            </button>
            <button class="team-tab-btn ${this.activeTab === 'roster' ? 'active' : ''}" id="tab-roster">
              📋 ${!canEdit && !this.isSuperAdmin ? 'Opponent Roster' : 'Active Roster'} (${this.roster.length} Players)${!canEdit && !this.isSuperAdmin ? ' 👁️' : ''}
            </button>
            <button class="team-tab-btn ${this.activeTab === 'stats' ? 'active' : ''}" id="tab-stats">
              📊 ${!canEdit && !this.isSuperAdmin ? 'Opponent Record & Workload' : 'Cumulative Season Stats'}${!canEdit && !this.isSuperAdmin ? ' 👁️' : ''}
            </button>
            ${this.isSuperAdmin ? `
              <button class="team-tab-btn ${this.activeTab === 'invites' ? 'active' : ''}" id="tab-invites" style="border-bottom-color: ${this.activeTab === 'invites' ? '#c084fc' : 'transparent'};">
                ✉️ User & Coach Invites (${this.invitations.length})
              </button>
            ` : ''}
            ${canEdit ? `
              <button class="team-tab-btn ${this.activeTab === 'storage' ? 'active' : ''}" id="tab-storage">
                ☁️ Cloud Storage Explorer
              </button>
            ` : ''}
          </div>

          <!-- Alert Notice -->
          ${this.message ? `
            <div class="team-alert team-alert-${this.message.type}">
              <span>${this.message.type === 'success' ? '✅' : '⚠️'}</span>
              <span>${this.message.text}</span>
            </div>
          ` : ''}

          <!-- Modal Body Content -->
          <div class="modal-body team-modal-body">
            ${this.activeTab === 'teams' ? this.renderTeamsTab() : ''}
            ${this.activeTab === 'roster' ? this.renderRosterTab() : ''}
            ${this.activeTab === 'stats' ? this.renderStatsTab() : ''}
            ${this.activeTab === 'invites' && this.isSuperAdmin ? this.renderInvitesTab() : ''}
            ${this.activeTab === 'storage' && canEdit ? this.renderStorageTab() : ''}
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer team-modal-footer">
            <span class="active-team-indicator">
              Viewing: <strong>${this.activeTeamProfile?.teamName || 'None Selected'}</strong>
              ${this.isSuperAdmin ? ' <span class="badge-super-admin" style="margin-left: 6px;">🛡️ Super Admin Access</span>' : (!canEdit ? ' <span class="badge-view-only-pill">👁️ View Only (Opponent)</span> <span class="badge-save-view-only" style="margin-left: 6px;">🔒 Save: View Only</span>' : ' <span style="color: #10b981; font-weight: 700;">(👑 Managed by You)</span>')}
            </span>
            <div class="footer-actions">
              ${!canEdit && !this.isSuperAdmin ? `
                <span class="badge-save-view-only" style="margin-right: 8px;">🔒 Save: View Only</span>
                <button id="btn-load-into-optimizer" class="btn btn-secondary btn-sm" title="Inspect opponent lineup and rotation in Dugout Optimizer (View Only)">
                  👁️ View Lineup in Optimizer
                </button>
              ` : `
                <button id="btn-load-into-optimizer" class="btn btn-primary btn-sm">
                  ⚾ Load Roster into Dugout Optimizer
                </button>
              `}
              <button id="btn-team-modal-done" class="btn btn-secondary btn-sm">Done</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  /* ========================================================================
     Tabs Rendering
     ======================================================================== */

  renderTeamsTab() {
    const isSuper = this.isSuperAdmin;

    return `
      <div class="teams-tab-content">
        <!-- League Policy / Super Admin Banner -->
        ${isSuper ? `
          <div class="super-admin-banner">
            <div class="super-admin-icon">🛡️</div>
            <div class="super-admin-body">
              <div class="super-admin-title">
                <strong>Super User Admin Mode:</strong> Commissioner Full Access Enabled
              </div>
              <div class="super-admin-desc">
                Logged in as <strong style="color: #f3e8ff;">${this.currentManager?.email || 'matthew.h.collins6@gmail.com'}</strong>. You have unrestricted administrative and editing control over all <strong>${this.teams.length}</strong> teams in the division. You can create teams, manage rosters, inspect records, and send coach invitations.
              </div>
            </div>
            <button id="btn-quick-open-invites" class="btn btn-secondary btn-sm" style="white-space: nowrap; border-color: rgba(168, 85, 247, 0.5); color: #e9d5ff;">
              ✉️ Send User Invites
            </button>
          </div>
        ` : `
          <div class="league-policy-banner">
            <div class="league-policy-icon">🛡️</div>
            <div class="league-policy-body">
              <div class="league-policy-title">
                <strong>League Policy Active:</strong> Single-Team Manager & Admin Limit
              </div>
              <div class="league-policy-desc">
                ${this.currentManager?.email?.toLowerCase() === 'mcollinswork6@gmail.com' ? `
                  <strong style="color: #38bdf8;">${this.currentManager.email}</strong> is officially designated as the Head Coach & Admin for the <strong style="color: #fde047;">Black Bats</strong> only.
                ` : this.managedTeam ? `
                  You are currently the Admin & Manager for <strong style="color: #38bdf8;">${this.managedTeam.teamName}</strong>.
                ` : `
                  You currently have 0 managed teams. You may create 1 team or claim an unassigned league preset.
                `}
              </div>
            </div>
          </div>
        `}

        <div class="tab-action-bar">
          <p class="tab-subtitle">
            ${isSuper ? 'Full administrative access to manage all Little League teams and rosters.' : 'Manage your Little League teams stored in Firebase Storage (<code>teams/{teamId}/...</code>).'}
          </p>
          ${isSuper ? `
            <div class="team-limit-actions" style="display: flex; gap: 8px;">
              <button id="btn-open-create-team" class="btn btn-primary btn-sm">
                ➕ Add New Team
              </button>
              <button id="btn-open-invites-from-action" class="btn btn-secondary btn-sm" style="border-color: rgba(168, 85, 247, 0.4); color: #d8b4fe;">
                ✉️ Invite Users
              </button>
            </div>
          ` : this.managedTeam ? `
            <div class="team-limit-actions">
              <button id="btn-open-create-team" class="btn btn-secondary btn-sm" disabled title="${this.currentManager?.email?.toLowerCase() === 'mcollinswork6@gmail.com' ? 'mcollinswork6@gmail.com can manage Black Bats only.' : 'League policy limits each manager to 1 team.'}">
                🔒 Add Team (${this.currentManager?.email?.toLowerCase() === 'mcollinswork6@gmail.com' ? 'Black Bats Manager Only' : '1/1 Limit Reached'})
              </button>
              <button id="btn-jump-managed-team" class="btn btn-primary btn-sm" data-team-id="${this.managedTeam.teamId}">
                👑 Manage ${this.managedTeam.teamName}
              </button>
            </div>
          ` : `
            <button id="btn-open-create-team" class="btn btn-primary btn-sm">
              ➕ Add New Team
            </button>
          `}
        </div>

        ${this.isAddingTeam ? this.renderCreateTeamForm() : ''}

        <div class="team-cards-grid">
          ${this.teams.map((t) => {
            const isMcollins = !isSuper && this.currentManager?.email?.toLowerCase() === 'mcollinswork6@gmail.com';
            const isBlackBats = t.teamId === 'team-black-bats-6589' || t.teamId === 'nnll-black-bats' || t.teamName.toLowerCase().includes('black bats');
            const isManagerTeam = isSuper || (isMcollins && isBlackBats) || (!isMcollins && t.adminUid && t.adminUid === this.currentManager?.uid);
            const isOtherAdmin = !isSuper && !isManagerTeam && (t.adminUid && t.adminUid !== this.currentManager?.uid);
            const isUnassigned = !isSuper && !isManagerTeam && !t.adminUid;
            const isActive = t.teamId === this.currentTeamId;

            return `
              <div class="team-card ${isActive ? 'active-team-card' : ''} ${isManagerTeam ? 'managed-team-card' : ''}">
                <div class="team-card-top">
                  <div class="team-avatar-pill">${isSuper ? '🛡️' : isManagerTeam ? '👑' : '⚾'}</div>
                  <div class="team-info">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <h4 class="team-name">${t.teamName}</h4>
                      ${isSuper ? `
                        <span class="badge-super-admin">🛡️ Full Access (Super Admin)</span>
                      ` : isManagerTeam ? `
                        <span class="badge-team-admin">👑 Your Team (Admin)</span>
                      ` : `
                        <span class="badge-view-only-pill">👁️ Opponent (View Only)</span>
                      `}
                    </div>
                    <span class="team-meta">${t.division || 'Minor AAA'} • ${t.season || 'Spring 2026'}</span>
                  </div>
                  ${isActive ? `<span class="active-badge" style="${!isManagerTeam ? 'background: #991b1b; border-color: #ef4444;' : ''}">${!isManagerTeam ? '👁️ Viewing' : 'Active'}</span>` : ''}
                </div>

                <div class="team-card-details">
                  <div class="detail-row">
                    <span>Head Coach:</span>
                    <strong>${t.headCoach || 'Coach'}</strong>
                  </div>
                  <div class="detail-row">
                    <span>Admin Ownership:</span>
                    ${isSuper ? `
                      <strong style="color: #c084fc;">🛡️ Commissioner Access (${t.headCoach || 'Coach'})</strong>
                    ` : isManagerTeam ? `
                      <strong style="color: #38bdf8;">👑 You (${this.currentManager?.displayName || 'Coach Collins'})</strong>
                    ` : isOtherAdmin ? `
                      <strong style="color: #cbd5e1;">${t.adminEmail || t.headCoach || 'Opponent Coach'}</strong>
                    ` : `
                      <span style="color: #94a3b8; font-style: italic;">League Preset Team</span>
                    `}
                  </div>
                  <div class="detail-row">
                    <span>Roster Size:</span>
                    <strong>${t.playerCount || 0} Players</strong>
                  </div>
                  <div class="detail-row">
                    <span>Access Rights:</span>
                    <strong style="color: ${isManagerTeam ? '#10b981' : '#f87171'};">
                      ${isSuper ? '👑 Full Management & Admin (Super User)' : isManagerTeam ? '👑 Full Management & Admin' : '👁️ View Only (Roster & Record)'}
                    </strong>
                  </div>
                </div>

                <div class="team-card-actions">
                  <div class="action-left" style="display: flex; gap: 6px; align-items: center;">
                    ${!isActive ? `
                      <button class="btn btn-secondary btn-sm btn-select-team" data-team-id="${t.teamId}">
                        ${isSuper ? '👑 Manage Team' : isManagerTeam ? '👑 Manage Team' : '👁️ View Roster & Record'}
                      </button>
                    ` : `
                      <span class="btn btn-secondary btn-sm disabled-label" style="padding: 4px 8px; color: ${isManagerTeam ? '#fde047' : '#fca5a5'};">
                        ${isManagerTeam ? '👑 Active' : '👁️ Viewing (Read Only)'}
                      </span>
                    `}
                    ${isUnassigned && !this.managedTeam && !isMcollins ? `
                      <button class="btn btn-primary btn-sm btn-claim-team" data-team-id="${t.teamId}" title="Claim as your single managed team">
                        👑 Claim Team
                      </button>
                    ` : ''}
                  </div>
                  <div class="action-right" style="display: flex; gap: 6px; align-items: center;">
                    ${isSuper ? `
                      <button class="btn btn-secondary btn-sm btn-delete-team" data-team-id="${t.teamId}" title="Delete team">
                        🗑
                      </button>
                    ` : isManagerTeam ? `
                      ${!isMcollins ? `
                        <button class="btn btn-secondary btn-sm btn-relinquish-team" data-team-id="${t.teamId}" title="Step down as admin so you can manage another team">
                          Step Down
                        </button>
                      ` : ''}
                      <button class="btn btn-secondary btn-sm btn-delete-team" data-team-id="${t.teamId}" title="Delete team">
                        🗑
                      </button>
                    ` : `
                      <span class="btn btn-secondary btn-sm disabled-label" title="Opponent team is View Only. Edits and deletes are disabled." style="opacity: 0.6; font-size: 0.72rem; padding: 4px 8px;">
                        🔒 View Only
                      </span>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderCreateTeamForm() {
    return `
      <div class="inline-card-form">
        <h4>➕ Create New Team Profile</h4>
        <p style="font-size: 0.8rem; color: #94a3b8; margin: 0 0 12px;">
          Note: League configuration enforces <strong>1 team per manager</strong>. Creating this team will assign you as its head coach & administrator.
        </p>
        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">Team Name</label>
            <input type="text" id="input-new-team-name" class="form-input" placeholder="e.g., River Bandits" required>
          </div>
          <div class="form-group">
            <label class="form-label">Division</label>
            <input type="text" id="input-new-division" class="form-input" value="Minor AAA">
          </div>
          <div class="form-group">
            <label class="form-label">Season</label>
            <input type="text" id="input-new-season" class="form-input" value="Spring 2026">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Head Coach / Manager</label>
            <input type="text" id="input-new-coach" class="form-input" value="${this.currentManager?.displayName || 'Coach'}" placeholder="e.g., Coach Collins">
          </div>
          <div class="form-group">
            <label class="form-label">Default Opponent</label>
            <input type="text" id="input-new-opponent" class="form-input" placeholder="e.g., Grasshoppers">
          </div>
        </div>
        <div class="form-actions">
          <button id="btn-cancel-create-team" class="btn btn-secondary btn-sm">Cancel</button>
          <button id="btn-save-new-team" class="btn btn-primary btn-sm">Save Team</button>
        </div>
      </div>
    `;
  }

  renderRosterTab() {
    const isTeamAdmin = !!this.isCurrentTeamAdmin;

    return `
      <div class="roster-tab-content">
        ${!isTeamAdmin ? `
          <div class="view-only-notice-box">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.2rem;">👁️</span>
                <strong style="color: #f87171;">View Only: ${this.activeTeamProfile?.teamName || 'Opponent'} Roster</strong>
              </div>
              <span class="badge-save-view-only">🔒 Save: View Only</span>
            </div>
            <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 0.8rem; line-height: 1.4;">
              You are viewing this opponent's official roster. As a team manager, you have view-only access. Player additions, removals, and safety tag modifications are restricted to the team's manager.
            </p>
          </div>
        ` : ''}

        <div class="tab-action-bar">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h4 style="margin: 0; color: #fff;">${this.activeTeamProfile?.teamName || 'Active Team'} Roster</h4>
              ${isTeamAdmin ? `
                <span class="badge-team-admin" style="font-size: 0.65rem;">👑 You are Admin</span>
              ` : `
                <span class="badge-view-only-pill" style="font-size: 0.65rem;">👁️ View Only Access</span>
              `}
            </div>
            <p class="tab-subtitle" style="margin: 2px 0 0;">
              ${isTeamAdmin ? 'Manage player position safety eligibility and jersey numbers for defensive rotation constraint solving.' : 'View opponent player safety eligibility (Pitcher, Catcher, 1st Base) and jersey numbers.'}
            </p>
          </div>
          ${isTeamAdmin ? `
            <button id="btn-open-add-player" class="btn btn-primary btn-sm">
              ➕ Add Player
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.85; border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; cursor: not-allowed;" title="Edits and saves are disabled for opponent teams.">
              🔒 Save: View Only
            </button>
          `}
        </div>

        ${this.isAddingPlayer && isTeamAdmin ? this.renderAddPlayerForm() : ''}

        <div class="roster-table-wrap">
          <table class="roster-table">
            <thead>
              <tr>
                <th style="width: 60px;">Jersey</th>
                <th>Player Full Name</th>
                <th title="Can pitch safely">Can Pitch</th>
                <th title="Can catch safely">Can Catch</th>
                <th title="Can play 1st base safely">Can Play 1B</th>
                <th style="width: 80px; text-align: right;">${isTeamAdmin ? 'Actions' : 'Access'}</th>
              </tr>
            </thead>
            <tbody>
              ${this.roster.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 24px; color: #94a3b8;">
                    ${isTeamAdmin ? 'No players on this roster yet. Click <strong>➕ Add Player</strong> to add your team roster.' : 'No roster recorded yet for this opponent.'}
                  </td>
                </tr>
              ` : this.roster.map((p, idx) => `
                <tr>
                  <td>
                    <span class="jersey-pill">#${p.jerseyNumber}</span>
                  </td>
                  <td>
                    <strong>${p.name}</strong>
                  </td>
                  <td>
                    <label class="pos-tag-toggle" style="${!isTeamAdmin ? 'cursor: not-allowed; opacity: 0.8;' : ''}">
                      <input type="checkbox" class="toggle-player-tag" data-player-id="${p.id}" data-tag="canPitch" ${p.eligiblePositions?.canPitch ? 'checked' : ''} ${!isTeamAdmin ? 'disabled' : ''}>
                      <span class="pos-tag-badge pos-p">P</span>
                    </label>
                  </td>
                  <td>
                    <label class="pos-tag-toggle" style="${!isTeamAdmin ? 'cursor: not-allowed; opacity: 0.8;' : ''}">
                      <input type="checkbox" class="toggle-player-tag" data-player-id="${p.id}" data-tag="canCatch" ${p.eligiblePositions?.canCatch ? 'checked' : ''} ${!isTeamAdmin ? 'disabled' : ''}>
                      <span class="pos-tag-badge pos-c">C</span>
                    </label>
                  </td>
                  <td>
                    <label class="pos-tag-toggle" style="${!isTeamAdmin ? 'cursor: not-allowed; opacity: 0.8;' : ''}">
                      <input type="checkbox" class="toggle-player-tag" data-player-id="${p.id}" data-tag="canPlayFirstBase" ${p.eligiblePositions?.canPlayFirstBase ? 'checked' : ''} ${!isTeamAdmin ? 'disabled' : ''}>
                      <span class="pos-tag-badge pos-1b">1B</span>
                    </label>
                  </td>
                  <td style="text-align: right;">
                    ${isTeamAdmin ? `
                      <button class="btn btn-secondary btn-xs btn-remove-player" data-player-id="${p.id}" title="Remove player from roster">
                        ✕
                      </button>
                    ` : `
                      <span style="color: #64748b; font-size: 0.75rem; font-weight: 600;">🔒 View Only</span>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderAddPlayerForm() {
    return `
      <div class="inline-card-form">
        <h4>➕ Add Player to Roster</h4>
        <div class="form-grid-3">
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Player Full Name</label>
            <input type="text" id="input-player-name" class="form-input" placeholder="e.g., Liam Garcia" required>
          </div>
          <div class="form-group">
            <label class="form-label">Jersey Number</label>
            <input type="number" id="input-jersey-num" class="form-input" placeholder="e.g., 7" min="0" max="99" required>
          </div>
        </div>
        <div class="safety-tags-row">
          <span style="font-size: 0.8rem; font-weight: 600; color: #cbd5e1;">Position Safety Eligibility:</span>
          <label class="checkbox-label">
            <input type="checkbox" id="check-can-pitch" checked>
            <span>Can Pitch (P)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="check-can-catch" checked>
            <span>Can Catch (C)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="check-can-1b" checked>
            <span>Can Play 1st Base (1B)</span>
          </label>
        </div>
        <div class="form-actions">
          <button id="btn-cancel-add-player" class="btn btn-secondary btn-sm">Cancel</button>
          <button id="btn-save-new-player" class="btn btn-primary btn-sm">Add to Roster</button>
        </div>
      </div>
    `;
  }

  renderStatsTab() {
    const statsData = this.stats || { totalGamesPlayed: 0, playerStats: {}, recentGames: [] };
    const playersStatsList = Object.values(statsData.playerStats || {});
    const isTeamAdmin = !!this.isCurrentTeamAdmin;

    // Fallback: If no games tracked yet, show all roster players with 0 stats so manager can scout their full roster & pitch counts!
    const displayStatsList = playersStatsList.length > 0
      ? playersStatsList
      : this.roster.map((p) => ({
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
          violations: 0
        }));

    return `
      <div class="stats-tab-content">
        ${!isTeamAdmin ? `
          <div class="view-only-notice-box">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.2rem;">📊</span>
                <strong style="color: #f87171;">Opponent Season Record & Pitcher Workload (View Only)</strong>
              </div>
              <span class="badge-save-view-only">🔒 Save: View Only</span>
            </div>
            <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 0.8rem; line-height: 1.4;">
              Scout <strong>${this.activeTeamProfile?.teamName}</strong>'s season record and pitch counts. Little League pitch count and mandatory days of rest apply across games. Edits and saves are disabled.
            </p>
          </div>
        ` : ''}

        <div class="stats-summary-cards">
          <div class="stat-card">
            <span class="stat-card-label">Total Games Tracked</span>
            <span class="stat-card-value">${statsData.totalGamesPlayed || 0}</span>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Season Record</span>
            <span class="stat-card-value" style="color: #38bdf8;">${statsData.totalGamesPlayed ? `${statsData.wins || 0}W - ${statsData.losses || 0}L` : '0 - 0'}</span>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Active Team</span>
            <span class="stat-card-value" style="font-size: 1.05rem;">${this.activeTeamProfile?.teamName || 'None'}</span>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Access Mode</span>
            <span class="stat-card-value" style="font-size: 0.88rem; color: ${isTeamAdmin ? '#10b981' : '#f87171'}; font-weight: 700;">
              ${isTeamAdmin ? '👑 Managed Team' : '👁️ View Only'}
            </span>
          </div>
        </div>

        <div class="roster-table-wrap">
          <table class="roster-table stats-table">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Player</th>
                <th title="Games Played">GP</th>
                <th title="Total Infield Innings">Infield</th>
                <th title="Total Outfield Innings">Outfield</th>
                <th title="Total Bench Innings">Bench</th>
                <th title="Innings Pitched">IP</th>
                <th title="Total Pitches Thrown">Pitches</th>
                <th title="Innings Caught">Catching</th>
                <th title="Rule Violations Recorded">Violations</th>
              </tr>
            </thead>
            <tbody>
              ${displayStatsList.length === 0 ? `
                <tr>
                  <td colspan="10" style="text-align: center; padding: 24px; color: #94a3b8;">
                    No game stats recorded yet for this team.
                  </td>
                </tr>
              ` : displayStatsList.map((st) => `
                <tr>
                  <td><span class="jersey-pill">#${st.jerseyNumber}</span></td>
                  <td><strong>${st.name}</strong></td>
                  <td>${st.gamesPlayed}</td>
                  <td><span class="badge-infield">${st.inningsInfield} inn</span></td>
                  <td><span class="badge-outfield">${st.inningsOutfield} inn</span></td>
                  <td><span class="badge-bench">${st.inningsBench} inn</span></td>
                  <td>${st.inningsPitched} inn</td>
                  <td><strong>${st.pitchesThrown}</strong></td>
                  <td>${st.inningsCaught} inn</td>
                  <td>
                    ${st.violations > 0 ? `<span class="badge-danger">${st.violations}</span>` : `<span class="badge-clean">0</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderInvitesTab() {
    return `
      <div class="invites-tab-content">
        <!-- Header Banner -->
        <div class="invites-header-banner">
          <div class="invites-banner-icon">✉️</div>
          <div class="invites-banner-body">
            <h4>League User & Coach Invitations Hub</h4>
            <p>
              As Super User Admin (<strong>${this.currentManager?.email || 'matthew.h.collins6@gmail.com'}</strong>), you can invite new Head Coaches, Assistant Coaches, Dugout Scorekeepers, and Administrators to the league. Generating an invitation creates a secure token link and prepares an email draft with your commissioner greeting.
            </p>
          </div>
        </div>

        <!-- Invite Creation Card Form -->
        <div class="invite-card-form">
          <h4>
            <span>➕ Send New User / Coach Invite</span>
          </h4>
          <form id="form-send-invite" onsubmit="return false;">
            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label" for="invite-recipient-email">Recipient Email Address <span style="color: #ef4444;">*</span></label>
                <input type="email" id="invite-recipient-email" class="form-input" placeholder="coach@example.com" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="invite-assigned-role">League Role <span style="color: #ef4444;">*</span></label>
                <select id="invite-assigned-role" class="form-input">
                  ${LEAGUE_ROLES.map((r) => `
                    <option value="${r.id}">${r.label}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="invite-assigned-team">Assigned Team</label>
                <select id="invite-assigned-team" class="form-input">
                  <option value="">Any Team / League-wide</option>
                  ${this.teams.map((t) => `
                    <option value="${t.teamId}" ${t.teamId === this.currentTeamId ? 'selected' : ''}>${t.teamName} (${t.division || 'Minor AAA'})</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-top: 10px;">
              <label class="form-label" for="invite-custom-note">Commissioner Welcome Note (Optional)</label>
              <input type="text" id="invite-custom-note" class="form-input" placeholder="e.g., Welcome to the Spring 2026 season! You are assigned to manage this team.">
            </div>

            <div class="form-actions" style="margin-top: 14px; display: flex; gap: 10px; justify-content: flex-end; align-items: center;">
              <span id="invite-sending-status" style="font-size: 0.8rem; color: #a78bfa; margin-right: auto;"></span>
              <button type="button" id="btn-send-invite" class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #9333ea, #7c3aed); border-color: #a855f7;">
                ✉️ Generate & Send Invite Email
              </button>
            </div>
          </form>
        </div>

        <!-- Sent Invitations List -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="margin: 0; color: #e2e8f0; font-size: 0.95rem;">
            📋 Sent Invitations (${this.invitations.length})
          </h4>
          <span style="font-size: 0.78rem; color: #94a3b8;">
            Pending invitations can be copied or resent at any time.
          </span>
        </div>

        <div class="invites-table-wrap">
          <table class="roster-table stats-table">
            <thead>
              <tr>
                <th style="width: 90px;">Status</th>
                <th>Recipient Email</th>
                <th>Assigned Role</th>
                <th>Assigned Team</th>
                <th>Invited Date</th>
                <th style="text-align: right; width: 220px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.invitations.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 28px; color: #94a3b8;">
                    No invitations have been sent yet. Use the form above to invite coaches and scorekeepers.
                  </td>
                </tr>
              ` : this.invitations.map((inv) => {
                const roleObj = LEAGUE_ROLES.find((r) => r.id === inv.role);
                const roleLabel = roleObj ? roleObj.label : inv.role;
                const dateStr = inv.invitedAt ? new Date(inv.invitedAt).toLocaleDateString() : 'Recent';
                const statusBadge = inv.status === 'accepted'
                  ? `<span class="badge-status-accepted">Accepted</span>`
                  : inv.status === 'revoked'
                  ? `<span class="badge-status-revoked">Revoked</span>`
                  : `<span class="badge-status-pending">Pending</span>`;

                const origin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'http://localhost:8000/';
                const directUrl = `${origin}?invite=${inv.id}&token=${inv.token}&email=${encodeURIComponent(inv.email)}&team=${encodeURIComponent(inv.teamId || '')}&role=${encodeURIComponent(inv.role || 'manager')}`;

                return `
                  <tr>
                    <td>${statusBadge}</td>
                    <td><strong>${inv.email}</strong></td>
                    <td><span style="color: #c4b5fd; font-weight: 600;">${roleLabel}</span></td>
                    <td>${inv.teamName || 'League-wide'}</td>
                    <td style="color: #94a3b8; font-size: 0.8rem;">${dateStr}</td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                        <button class="btn btn-secondary btn-xs btn-copy-invite-link" data-url="${encodeURI(directUrl)}" title="Copy activation URL to clipboard">
                          📋 Copy Link
                        </button>
                        ${inv.status === 'pending' ? `
                          <button class="btn btn-secondary btn-xs btn-resend-invite-email" data-invite-id="${inv.id}" data-email="${inv.email}" data-role="${inv.role}" data-team="${inv.teamName || ''}" data-url="${encodeURI(directUrl)}" title="Open pre-filled email draft">
                            ✉️ Draft
                          </button>
                          <button class="btn btn-secondary btn-xs btn-revoke-invite" data-invite-id="${inv.id}" style="color: #f87171;" title="Revoke invitation">
                            ✕ Revoke
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderStorageTab() {
    const syncInfo = teamStorage.getSyncInfo();
    const isSynced = syncInfo.status === 'synced';

    return `
      <div class="storage-tab-content">
        <div class="storage-status-card">
          <div class="storage-icon-wrap">${isSynced ? '☁️' : '💾'}</div>
          <div class="storage-details" style="flex: 1;">
            <h4 style="margin: 0; color: #fff;">Firebase Cloud Database (Firestore)</h4>
            <span style="font-family: monospace; color: #38bdf8; font-size: 0.85rem;">Project: dugout-admin-916c8</span>
            <div style="font-size: 0.82rem; color: #94a3b8; margin-top: 4px;">
              Cloud Status: <strong style="color: ${isSynced ? '#6ee7b7' : '#f59e0b'};">${isSynced ? '✅ CONNECTED & SYNCED' : '⚠️ SAVED LOCALLY (CLOUD SYNC PENDING)'}</strong>
              • Last sync: ${syncInfo.lastSyncTime ? new Date(syncInfo.lastSyncTime).toLocaleTimeString() : 'Local Cache Active'}
            </div>
            ${syncInfo.lastError ? `
              <div style="margin-top: 8px; font-size: 0.78rem; color: #fca5a5; background: rgba(239, 68, 68, 0.15); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.35);">
                <strong>⚠️ Cloud Sync Notice:</strong> ${syncInfo.lastError}
              </div>
            ` : ''}
          </div>
          <button id="btn-force-sync" class="btn btn-primary btn-sm" style="margin-left: 12px; white-space: nowrap;">
            ☁️ Push All Teams to Firestore
          </button>
        </div>

        <div style="margin-top: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 8px; padding: 12px; font-size: 0.82rem; line-height: 1.5; color: #cbd5e1;">
          <h5 style="margin: 0 0 6px 0; color: #38bdf8; font-size: 0.88rem;">ℹ️ Where Your Teams Are Stored:</h5>
          <div>
            • <strong>Local Device Cache:</strong> All created teams (including custom rosters) are saved immediately to browser Local Storage, ensuring zero downtime or data loss even without internet.<br>
            • <strong>Firebase Firestore Cloud:</strong> Stored under collection <code style="color: #38bdf8; background: #1e293b; padding: 1px 4px; border-radius: 3px;">teams/{teamId}</code> and catalog <code style="color: #38bdf8; background: #1e293b; padding: 1px 4px; border-radius: 3px;">app_settings/teams_registry</code>.
          </div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; font-size: 0.78rem; color: #94a3b8;">
            If newly created teams do not appear in your <a href="https://console.firebase.google.com/u/0/project/dugout-admin-916c8/firestore/databases/-default-/data" target="_blank" style="color: #38bdf8; text-decoration: underline;">Firebase Console Data Tab</a>, check that your <a href="https://console.firebase.google.com/u/0/project/dugout-admin-916c8/firestore/rules" target="_blank" style="color: #38bdf8; text-decoration: underline;">Firestore Security Rules</a> allow writes (e.g. <code>allow read, write: if request.auth != null;</code> or <code>if true;</code> for development).
          </div>
        </div>

        <h4 style="margin: 16px 0 8px; color: #e2e8f0;">📂 Firestore Document Hierarchy</h4>
        <div class="storage-tree">
          <div class="tree-line tree-folder">📁 Collection: teams/</div>
          <div class="tree-line tree-file indent-1">📄 Document: ${this.currentTeamId}</div>
          <div class="tree-line tree-comment indent-2">├─ profile: { teamName, division, season, headCoach }</div>
          <div class="tree-line tree-comment indent-2">├─ roster: [ ${this.roster.length} player profiles & safety tags ]</div>
          <div class="tree-line tree-comment indent-2">├─ stats: { gamesPlayed, playerWorkloads, violations }</div>
          <div class="tree-line tree-comment indent-2">└─ games: { archived game snapshots }</div>
          <div class="tree-line tree-folder" style="margin-top: 8px;">📁 Collection: app_settings/</div>
          <div class="tree-line tree-file indent-1">📄 Document: teams_registry <span class="tree-comment">(Teams catalog & active pointer)</span></div>
        </div>

        <div class="storage-actions-panel" style="margin-top: 14px;">
          <button id="btn-export-json" class="btn btn-secondary btn-sm">
            ⬇️ Export Team JSON Backup
          </button>
        </div>
      </div>
    `;
  }

  /* ========================================================================
     Event Listeners
     ======================================================================== */

  bindEvents() {
    // Close modal
    const btnClose = document.getElementById('btn-close-team-modal');
    const btnDone = document.getElementById('btn-team-modal-done');
    const backdrop = document.getElementById('team-modal-backdrop');

    if (btnClose) btnClose.onclick = () => this.close();
    if (btnDone) btnDone.onclick = () => this.close();
    if (backdrop) {
      backdrop.onclick = (e) => {
        if (e.target.id === 'team-modal-backdrop') this.close();
      };
    }

    // Tabs
    const tabTeams = document.getElementById('tab-teams');
    const tabRoster = document.getElementById('tab-roster');
    const tabStats = document.getElementById('tab-stats');
    const tabInvites = document.getElementById('tab-invites');
    const tabStorage = document.getElementById('tab-storage');

    if (tabTeams) tabTeams.onclick = () => { this.activeTab = 'teams'; this.render(); };
    if (tabRoster) tabRoster.onclick = () => { this.activeTab = 'roster'; this.render(); };
    if (tabStats) tabStats.onclick = () => { this.activeTab = 'stats'; this.render(); };
    if (tabInvites) tabInvites.onclick = () => { this.activeTab = 'invites'; this.render(); };
    if (tabStorage) tabStorage.onclick = () => { this.activeTab = 'storage'; this.render(); };

    const btnQuickInvites = document.getElementById('btn-quick-open-invites');
    if (btnQuickInvites) btnQuickInvites.onclick = () => { this.activeTab = 'invites'; this.render(); };

    const btnOpenInvitesAction = document.getElementById('btn-open-invites-from-action');
    if (btnOpenInvitesAction) btnOpenInvitesAction.onclick = () => { this.activeTab = 'invites'; this.render(); };

    // Load into optimizer
    const btnLoad = document.getElementById('btn-load-into-optimizer');
    if (btnLoad) {
      btnLoad.onclick = async () => {
        await this.loadActiveTeamIntoOptimizer();
      };
    }

    // Modal return to managed team button
    const btnModalReturn = document.getElementById('btn-modal-return-managed');
    if (btnModalReturn) {
      btnModalReturn.onclick = async () => {
        const teamId = btnModalReturn.getAttribute('data-team-id');
        if (teamId) {
          await teamStorage.setActiveTeam(teamId);
          this.activeTab = 'roster';
          await this.loadData();
          this.message = { type: 'success', text: `Returned to your managed team: "${this.activeTeamProfile?.teamName}".` };
          this.render();
        }
      };
    }

    // Team selection buttons
    document.querySelectorAll('.btn-select-team').forEach((btn) => {
      btn.onclick = async () => {
        const teamId = btn.getAttribute('data-team-id');
        await teamStorage.setActiveTeam(teamId);
        await this.loadData();
        if (!this.isCurrentTeamAdmin) {
          this.activeTab = 'roster';
          this.message = { type: 'success', text: `Viewing "${this.activeTeamProfile?.teamName}" in View Only mode (Roster & Record).` };
        } else {
          this.message = { type: 'success', text: `Switched active team to "${this.activeTeamProfile?.teamName}"!` };
        }
        this.render();
      };
    });

    // Delete team button
    document.querySelectorAll('.btn-delete-team').forEach((btn) => {
      btn.onclick = async () => {
        const teamId = btn.getAttribute('data-team-id');
        const team = this.teams.find((t) => t.teamId === teamId);
        const name = team?.teamName || 'this team';
        if (confirm(`Are you sure you want to delete "${name}" and its roster?`)) {
          try {
            await teamStorage.deleteTeam(teamId);
            await this.loadData();
            this.message = { type: 'success', text: `Team "${name}" removed.` };
            this.render();
          } catch (err) {
            this.message = { type: 'error', text: err.message };
            this.render();
          }
        }
      };
    });

    // Claim preset team as admin
    document.querySelectorAll('.btn-claim-team').forEach((btn) => {
      btn.onclick = async () => {
        const teamId = btn.getAttribute('data-team-id');
        const team = this.teams.find((t) => t.teamId === teamId);
        const name = team?.teamName || 'this team';
        try {
          await teamStorage.claimTeamAsAdmin(teamId);
          await teamStorage.setActiveTeam(teamId);
          await this.loadData();
          this.message = { type: 'success', text: `👑 You are now the official Head Coach & Admin for "${name}"!` };
          this.render();
        } catch (err) {
          this.message = { type: 'error', text: err.message };
          this.render();
        }
      };
    });

    // Relinquish / step down as admin
    document.querySelectorAll('.btn-relinquish-team').forEach((btn) => {
      btn.onclick = async () => {
        const teamId = btn.getAttribute('data-team-id');
        const team = this.teams.find((t) => t.teamId === teamId);
        const name = team?.teamName || 'this team';
        if (confirm(`Step down as administrator for "${name}"? This frees your manager slot so you can manage another team.`)) {
          try {
            await teamStorage.relinquishTeamAdmin(teamId);
            await this.loadData();
            this.message = { type: 'success', text: `You have stepped down from "${name}". You may now claim or create a new team.` };
            this.render();
          } catch (err) {
            this.message = { type: 'error', text: err.message };
            this.render();
          }
        }
      };
    });

    // Jump to manage user's team directly
    const btnJumpManaged = document.getElementById('btn-jump-managed-team');
    if (btnJumpManaged) {
      btnJumpManaged.onclick = async () => {
        const teamId = btnJumpManaged.getAttribute('data-team-id');
        if (teamId) {
          await teamStorage.setActiveTeam(teamId);
          this.activeTab = 'roster';
          await this.loadData();
          this.render();
        }
      };
    }

    // Open create team form
    const btnOpenCreateTeam = document.getElementById('btn-open-create-team');
    if (btnOpenCreateTeam) {
      btnOpenCreateTeam.onclick = () => {
        if (!this.canCreateTeam.allowed) {
          this.message = { type: 'error', text: this.canCreateTeam.reason };
          this.render();
          return;
        }
        this.isAddingTeam = true;
        this.render();
      };
    }

    const btnCancelCreateTeam = document.getElementById('btn-cancel-create-team');
    if (btnCancelCreateTeam) {
      btnCancelCreateTeam.onclick = () => {
        this.isAddingTeam = false;
        this.render();
      };
    }

    const btnSaveNewTeam = document.getElementById('btn-save-new-team');
    if (btnSaveNewTeam) {
      btnSaveNewTeam.onclick = async () => {
        const teamName = document.getElementById('input-new-team-name')?.value;
        const division = document.getElementById('input-new-division')?.value || 'Minor AAA';
        const season = document.getElementById('input-new-season')?.value || 'Spring 2026';
        const headCoach = document.getElementById('input-new-coach')?.value || this.currentManager?.displayName || 'Coach';
        const opponentName = document.getElementById('input-new-opponent')?.value || 'Opponent';

        if (!teamName || !teamName.trim()) {
          alert('Please enter a team name');
          return;
        }

        try {
          await teamStorage.createTeam({ teamName: teamName.trim(), division, season, headCoach, opponentName });
          this.isAddingTeam = false;
          await this.loadData();
          this.message = { type: 'success', text: `Team "${teamName}" created and assigned as your managed team!` };
          this.render();
        } catch (err) {
          this.message = { type: 'error', text: err.message };
          this.render();
        }
      };
    }

    // Open add player form
    const btnOpenAddPlayer = document.getElementById('btn-open-add-player');
    if (btnOpenAddPlayer) {
      btnOpenAddPlayer.onclick = () => {
        this.isAddingPlayer = true;
        this.render();
      };
    }

    const btnCancelAddPlayer = document.getElementById('btn-cancel-add-player');
    if (btnCancelAddPlayer) {
      btnCancelAddPlayer.onclick = () => {
        this.isAddingPlayer = false;
        this.render();
      };
    }

    const btnSaveNewPlayer = document.getElementById('btn-save-new-player');
    if (btnSaveNewPlayer) {
      btnSaveNewPlayer.onclick = async () => {
        const name = document.getElementById('input-player-name')?.value;
        const jerseyNumber = document.getElementById('input-jersey-num')?.value;
        const canPitch = document.getElementById('check-can-pitch')?.checked;
        const canCatch = document.getElementById('check-can-catch')?.checked;
        const canPlayFirstBase = document.getElementById('check-can-1b')?.checked;

        if (!name || !name.trim()) {
          alert('Please enter a player name');
          return;
        }

        await teamStorage.addPlayerToRoster(this.currentTeamId, {
          name: name.trim(),
          jerseyNumber: parseInt(jerseyNumber, 10) || 0,
          eligiblePositions: { canPitch, canCatch, canPlayFirstBase }
        });

        this.isAddingPlayer = false;
        await this.loadData();
        this.message = { type: 'success', text: `Added ${name} to roster!` };
        this.render();
      };
    }

    // Toggle player tags in roster
    document.querySelectorAll('.toggle-player-tag').forEach((checkbox) => {
      checkbox.onchange = async () => {
        const pId = checkbox.getAttribute('data-player-id');
        const tag = checkbox.getAttribute('data-tag');
        const isChecked = checkbox.checked;

        await teamStorage.updatePlayerInRoster(this.currentTeamId, pId, {
          eligiblePositions: { [tag]: isChecked }
        });
        await this.loadData();
      };
    });

    // Remove player button
    document.querySelectorAll('.btn-remove-player').forEach((btn) => {
      btn.onclick = async () => {
        const pId = btn.getAttribute('data-player-id');
        if (confirm('Remove this player from the team roster?')) {
          await teamStorage.removePlayerFromRoster(this.currentTeamId, pId);
          await this.loadData();
          this.render();
        }
      };
    });

    // Push / Sync All Teams to Firestore
    const btnSync = document.getElementById('btn-force-sync');
    if (btnSync) {
      btnSync.onclick = async () => {
        btnSync.disabled = true;
        btnSync.textContent = '⏳ Pushing to Firestore...';
        try {
          const res = await teamStorage.syncAllLocalTeamsToFirestore();
          this.message = { type: 'success', text: `Successfully synced ${res.syncedTeams} team(s) and registry to Firebase Firestore!` };
        } catch (err) {
          this.message = { type: 'error', text: `Sync issue: ${err.message}. If permissions are denied, check your Firestore rules in Firebase Console.` };
        }
        await this.loadData();
        this.render();
      };
    }

    // Export JSON Backup
    const btnExport = document.getElementById('btn-export-json');
    if (btnExport) {
      btnExport.onclick = () => {
        const bundle = {
          exportedAt: new Date().toISOString(),
          team: this.activeTeamProfile,
          roster: this.roster,
          stats: this.stats
        };
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.activeTeamProfile?.teamName || 'team'}-backup.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    // User & Coach Invitations
    const btnSendInvite = document.getElementById('btn-send-invite');
    if (btnSendInvite) {
      btnSendInvite.onclick = async () => {
        const emailInput = document.getElementById('invite-recipient-email');
        const roleSelect = document.getElementById('invite-assigned-role');
        const teamSelect = document.getElementById('invite-assigned-team');
        const noteInput = document.getElementById('invite-custom-note');
        const statusEl = document.getElementById('invite-sending-status');

        const email = emailInput?.value?.trim();
        const role = roleSelect?.value;
        const teamId = teamSelect?.value || '';
        const selectedOption = teamSelect?.options[teamSelect.selectedIndex];
        const teamName = teamId ? (selectedOption?.text?.split(' (')[0] || '') : 'Any Team / League-wide';
        const note = noteInput?.value || '';

        if (!email || !email.includes('@')) {
          alert('Please enter a valid email address.');
          emailInput?.focus();
          return;
        }

        btnSendInvite.disabled = true;
        btnSendInvite.textContent = '⏳ Creating Invite...';
        if (statusEl) statusEl.textContent = 'Generating secure activation token...';

        try {
          const result = await teamStorage.createInvitation({
            email,
            role,
            teamId,
            teamName,
            note
          });

          // Copy direct link to clipboard
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(result.inviteUrl).catch(() => {});
          }

          // Open pre-filled email draft
          try {
            window.open(result.mailtoUrl, '_blank');
          } catch (e) {
            window.location.href = result.mailtoUrl;
          }

          this.message = {
            type: 'success',
            text: `Invite created for ${email}! Pre-filled email client opened and activation link copied to clipboard.`
          };

          await this.loadData();
          this.render();
        } catch (err) {
          if (statusEl) statusEl.textContent = '';
          btnSendInvite.disabled = false;
          btnSendInvite.textContent = '✉️ Generate & Send Invite Email';
          this.message = { type: 'error', text: err.message };
          this.render();
        }
      };
    }

    // Copy Invite Link
    document.querySelectorAll('.btn-copy-invite-link').forEach((btn) => {
      btn.onclick = async () => {
        const url = btn.getAttribute('data-url');
        if (url) {
          try {
            await navigator.clipboard.writeText(decodeURI(url));
            const orig = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = orig; }, 2000);
          } catch (e) {
            prompt('Copy this activation link:', decodeURI(url));
          }
        }
      };
    });

    // Resend Invite Email Draft
    document.querySelectorAll('.btn-resend-invite-email').forEach((btn) => {
      btn.onclick = () => {
        const email = btn.getAttribute('data-email');
        const role = btn.getAttribute('data-role');
        const team = btn.getAttribute('data-team');
        const url = decodeURI(btn.getAttribute('data-url'));

        const subject = encodeURIComponent(`⚾ Reminder: Invitation to join North Natomas Little League Dugout Admin`);
        const body = `Hello Coach,\n\n` +
          `This is a reminder of your invitation to join North Natomas Little League (NNLL) Dugout Admin as ${role} for ${team || 'the league'}.\n\n` +
          `Click the secure invite link below to activate your account and access your team roster & rotation optimizer:\n` +
          `${url}\n\n` +
          `Best regards,\n` +
          `Matthew Collins\nNorth Natomas Little League Commissioner`;

        const mailto = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      };
    });

    // Revoke Invitation
    document.querySelectorAll('.btn-revoke-invite').forEach((btn) => {
      btn.onclick = async () => {
        const inviteId = btn.getAttribute('data-invite-id');
        if (confirm('Revoke this invitation? The recipient will no longer be able to use the activation link.')) {
          try {
            await teamStorage.revokeInvitation(inviteId);
            await this.loadData();
            this.message = { type: 'success', text: 'Invitation revoked.' };
            this.render();
          } catch (err) {
            this.message = { type: 'error', text: err.message };
            this.render();
          }
        }
      };
    });
  }

  async loadActiveTeamIntoOptimizer() {
    if (!this.activeTeamProfile || !this.roster || this.roster.length === 0) {
      alert('This team does not have any players yet. Please add at least 8 players before loading.');
      return;
    }

    if (this.roster.length < 8) {
      alert(`Little League requires at least 8 players to solve defensive rotations. Current roster has ${this.roster.length}.`);
      return;
    }

    this.stateManager.initNewGame({
      teamId: this.activeTeamProfile.teamId,
      teamName: this.activeTeamProfile.teamName,
      opponentName: this.activeTeamProfile.opponentName || 'Opponent',
      isHomeTeam: true,
      players: this.roster
    });

    this.close();
    this.onTeamSwitched(this.activeTeamProfile);
  }
}
