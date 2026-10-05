/**
 * Firebase Authentication UI Component for NNLL Minor AAA Dugout Admin
 */

import { authService } from './auth.js';
import {
  isFirebaseConfigured,
  getActiveFirebaseConfig,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig
} from './firebase-config.js';

export class AuthUI {
  constructor(options = {}) {
    this.container = null;
    this.onAuthSuccess = options.onAuthSuccess || (() => {});
    this.activeTab = 'signin'; // 'signin' | 'signup' | 'forgot'
    this.isLoading = false;
    this.errorMessage = null;
    this.successMessage = null;
    this.showConfigModal = false;

    // Check for commissioner invite URL parameters
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    this.inviteParam = urlParams && urlParams.get('invite') ? {
      id: urlParams.get('invite'),
      token: urlParams.get('token'),
      email: urlParams.get('email') || '',
      team: urlParams.get('team') || '',
      role: urlParams.get('role') || 'manager'
    } : null;

    if (this.inviteParam) {
      this.activeTab = 'signup';
    }
  }

  init(containerElement) {
    this.container = containerElement;
    this.render();
  }

  setTab(tab) {
    this.activeTab = tab;
    this.errorMessage = null;
    this.successMessage = null;
    this.render();
  }

  showError(msg) {
    this.errorMessage = msg;
    this.successMessage = null;
    this.render();
  }

  showSuccess(msg) {
    this.successMessage = msg;
    this.errorMessage = null;
    this.render();
  }

  setLoading(loading) {
    this.isLoading = loading;
    const submitBtn = document.getElementById('auth-submit-btn');
    const googleBtn = document.getElementById('auth-google-btn');
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.innerHTML = loading
        ? `<span class="auth-spinner"></span> Processing...`
        : (this.activeTab === 'signin' ? 'Sign In' : this.activeTab === 'signup' ? 'Create Account' : 'Send Reset Link');
    }
    if (googleBtn) {
      googleBtn.disabled = loading;
    }
  }

  render() {
    if (!this.container) return;

    const isConfigured = isFirebaseConfigured();
    const config = getActiveFirebaseConfig();

    this.container.innerHTML = `
      <div class="auth-overlay">
        <div class="auth-card">
          <!-- Card Header & Branding -->
          <div class="auth-header">
            <div class="auth-badge">NNLL MINOR AAA BASEBALL</div>
            <div class="auth-icon-wrap">
              <span class="auth-baseball-icon">⚾</span>
            </div>
            <h2 class="auth-title">Dugout Admin Portal</h2>
            <p class="auth-subtitle">Coaches & Managers Defensive Rotation Optimizer</p>
          </div>

          ${!isConfigured ? this.renderSetupNotice(config) : ''}

          <!-- Alert Notices -->
          ${this.errorMessage ? `
            <div class="auth-alert auth-alert-error" role="alert">
              <span class="alert-icon">⚠️</span>
              <div class="alert-text">${this.errorMessage}</div>
            </div>
          ` : ''}

          ${this.successMessage ? `
            <div class="auth-alert auth-alert-success" role="alert">
              <span class="alert-icon">✅</span>
              <div class="alert-text">${this.successMessage}</div>
            </div>
          ` : ''}

          <!-- Invite Welcome Notice -->
          ${this.inviteParam ? `
            <div class="auth-alert" style="background: rgba(168, 85, 247, 0.18); border: 1px solid #a855f7; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 1.3rem;">✉️</span>
              <div style="font-size: 0.82rem; line-height: 1.45; color: #f3e8ff;">
                <strong>Welcome! You've been invited to Dugout Admin:</strong><br>
                <span>Invited by Commissioner Matthew Collins</span><br>
                ${this.inviteParam.role ? `• Assigned Role: <strong style="color: #c084fc;">${this.inviteParam.role}</strong><br>` : ''}
                ${this.inviteParam.team ? `• Assigned Team: <strong style="color: #6ee7b7;">${this.inviteParam.team}</strong><br>` : ''}
                <span style="font-size: 0.78rem; color: #cbd5e1; margin-top: 4px; display: block;">Create your coach password below to activate your account.</span>
              </div>
            </div>
          ` : ''}

          <!-- Tab Bar -->
          <div class="auth-tabs">
            <button class="auth-tab ${this.activeTab === 'signin' ? 'active' : ''}" id="tab-btn-signin">Sign In</button>
            <button class="auth-tab ${this.activeTab === 'signup' ? 'active' : ''}" id="tab-btn-signup">Create Account</button>
            <button class="auth-tab ${this.activeTab === 'forgot' ? 'active' : ''}" id="tab-btn-forgot">Forgot Password</button>
          </div>

          <!-- Main Auth Form -->
          <div class="auth-body">
            ${this.activeTab !== 'forgot' ? `
              <!-- Google One-Click Auth -->
              <button id="auth-google-btn" class="btn-google" type="button" ${!isConfigured ? 'title="Requires Firebase credentials"' : ''}>
                <svg class="google-svg" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div class="auth-divider">
                <span>or continue with email</span>
              </div>
            ` : ''}

            <form id="auth-main-form" autocomplete="on">
              ${this.activeTab === 'signup' ? `
                <div class="form-group">
                  <label class="form-label" for="auth-input-name">Coach / Manager Full Name</label>
                  <input type="text" id="auth-input-name" class="form-input" placeholder="e.g., Coach Collins" required autocomplete="name">
                </div>
              ` : ''}

              <div class="form-group">
                <label class="form-label" for="auth-input-email">Email Address</label>
                <input type="email" id="auth-input-email" class="form-input" value="${this.inviteParam?.email || ''}" placeholder="coach@example.com" required autocomplete="email">
              </div>

              ${this.activeTab !== 'forgot' ? `
                <div class="form-group">
                  <div class="form-label-row">
                    <label class="form-label" for="auth-input-password">Password</label>
                    ${this.activeTab === 'signin' ? `
                      <button type="button" class="btn-link-subtle" id="link-forgot-pw">Forgot?</button>
                    ` : ''}
                  </div>
                  <div class="password-input-wrap">
                    <input type="password" id="auth-input-password" class="form-input" placeholder="••••••••" required autocomplete="${this.activeTab === 'signup' ? 'new-password' : 'current-password'}" minlength="6">
                    <button type="button" class="btn-toggle-pw" id="btn-toggle-pw" title="Show or hide password">👁️</button>
                  </div>
                  ${this.activeTab === 'signup' ? `<span class="form-help">Minimum 6 characters</span>` : ''}
                </div>
              ` : `
                <p class="form-help" style="margin-bottom: 16px;">
                  Enter your email address and we'll send you a secure link to reset your password.
                </p>
              `}

              <button type="submit" id="auth-submit-btn" class="btn btn-primary auth-submit-btn">
                ${this.activeTab === 'signin' ? 'Sign In to Dugout Admin' : this.activeTab === 'signup' ? 'Create Coach Account' : 'Send Password Reset Email'}
              </button>
            </form>

            <!-- Offline / Dugout Field Fallback & Instant Super Admin -->
            <div class="auth-field-mode-card">
              <div class="field-mode-header">
                <span class="field-mode-icon">📋</span>
                <div class="field-mode-info">
                  <strong>Instant Access & Testing Modes:</strong>
                  <span>Instant login for game management or commissioner admin</span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                <button type="button" id="btn-super-admin-mode" class="btn btn-primary" style="background: linear-gradient(135deg, #7e22ce, #6b21a8); border-color: #a855f7; font-weight: 700; font-size: 0.84rem; justify-content: center; display: flex; align-items: center; gap: 6px; padding: 9px 14px;">
                  🛡️ Enter as Super User Admin (matthew.h.collins6@gmail.com)
                </button>
                <button type="button" id="btn-field-mode" class="btn btn-field-mode" style="justify-content: center;">
                  ⚾ Enter as Black Bats Coach (mcollinswork6@gmail.com)
                </button>
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="auth-footer">
            <div class="auth-footer-actions">
              <button type="button" id="btn-open-config" class="btn-config-link">
                ⚙️ ${isConfigured ? 'Firebase Configured' : 'Connect Firebase Credentials'}
              </button>
            </div>
            <div class="auth-footer-copyright">
              Little League Minor AAA • Strict CBO & Rotation Rules
            </div>
          </div>
        </div>
      </div>

      <!-- Config Helper Modal -->
      ${this.showConfigModal ? this.renderConfigModal(config, isConfigured) : ''}
    `;

    this.bindEvents();
  }

  renderSetupNotice(config) {
    return `
      <div class="setup-notice-banner">
        <div class="setup-notice-head">
          <span class="setup-badge">Notice</span>
          <strong>Firebase Keys Needed for Cloud Auth</strong>
        </div>
        <p class="setup-notice-body">
          Replace placeholders in <code>src/firebase-config.js</code> or paste your config JSON via the settings button below.
        </p>
      </div>
    `;
  }

  renderConfigModal(config, isConfigured) {
    const jsonExample = JSON.stringify(config, null, 2);
    return `
      <div class="modal-backdrop" id="config-modal-backdrop">
        <div class="modal-content auth-config-modal">
          <div class="modal-header">
            <h3 class="modal-title">⚙️ Firebase Project Credentials</h3>
            <button id="btn-close-config-modal" class="btn btn-secondary btn-sm">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.88rem; color: #cbd5e1; margin-bottom: 12px;">
              Get your Web App credentials from the
              <a href="https://console.firebase.google.com" target="_blank" rel="noopener" style="color: #60a5fa; text-decoration: underline;">
                Firebase Console
              </a>:
            </p>
            <ol style="font-size: 0.82rem; color: #94a3b8; padding-left: 20px; margin-bottom: 16px; line-height: 1.6;">
              <li>Go to <strong>Project Settings > General > Your Apps > Web App</strong></li>
              <li>Enable <strong>Authentication > Email/Password</strong> and <strong>Google</strong></li>
              <li>Paste your <code>firebaseConfig</code> JSON below or edit <code>src/firebase-config.js</code> directly:</li>
            </ol>

            <textarea id="config-json-input" class="config-textarea" rows="7" placeholder="{\n  apiKey: '...',\n  authDomain: '...',\n  projectId: '...'\n}">${isConfigured ? jsonExample : ''}</textarea>
            <div id="config-modal-error" style="color: #ef4444; font-size: 0.8rem; margin-top: 6px; display: none;"></div>
          </div>
          <div class="modal-footer">
            ${isConfigured ? `
              <button id="btn-clear-config" class="btn btn-danger btn-sm" style="margin-right: auto;">Reset to Default</button>
            ` : ''}
            <button id="btn-cancel-config" class="btn btn-secondary btn-sm">Close</button>
            <button id="btn-save-config" class="btn btn-primary btn-sm">Save & Connect</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Tab switching
    const tabSignin = document.getElementById('tab-btn-signin');
    const tabSignup = document.getElementById('tab-btn-signup');
    const tabForgot = document.getElementById('tab-btn-forgot');
    const linkForgot = document.getElementById('link-forgot-pw');

    if (tabSignin) tabSignin.onclick = () => this.setTab('signin');
    if (tabSignup) tabSignup.onclick = () => this.setTab('signup');
    if (tabForgot) tabForgot.onclick = () => this.setTab('forgot');
    if (linkForgot) linkForgot.onclick = () => this.setTab('forgot');

    // Password visibility toggle
    const btnTogglePw = document.getElementById('btn-toggle-pw');
    const inputPw = document.getElementById('auth-input-password');
    if (btnTogglePw && inputPw) {
      btnTogglePw.onclick = () => {
        if (inputPw.type === 'password') {
          inputPw.type = 'text';
          btnTogglePw.textContent = '🔒';
        } else {
          inputPw.type = 'password';
          btnTogglePw.textContent = '👁️';
        }
      };
    }

    // Google Sign-In button
    const btnGoogle = document.getElementById('auth-google-btn');
    if (btnGoogle) {
      btnGoogle.onclick = async () => {
        this.setLoading(true);
        this.errorMessage = null;
        try {
          await authService.signInWithGoogle();
          this.onAuthSuccess(authService.getCurrentUser());
        } catch (err) {
          this.showError(err.message);
        } finally {
          this.setLoading(false);
        }
      };
    }

    // Form submission
    const form = document.getElementById('auth-main-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-input-email')?.value || '';
        const password = document.getElementById('auth-input-password')?.value || '';
        const name = document.getElementById('auth-input-name')?.value || '';

        this.setLoading(true);
        this.errorMessage = null;

        try {
          if (this.activeTab === 'signin') {
            await authService.signInWithEmail(email, password);
            this.onAuthSuccess(authService.getCurrentUser());
          } else if (this.activeTab === 'signup') {
            await authService.signUpWithEmail(email, password, name);
            this.showSuccess('Account created successfully! Welcome to Dugout Admin.');
            setTimeout(() => {
              this.onAuthSuccess(authService.getCurrentUser());
            }, 600);
          } else if (this.activeTab === 'forgot') {
            await authService.sendPasswordReset(email);
            this.showSuccess(`Password reset instructions sent to ${email}. Check your inbox!`);
          }
        } catch (err) {
          this.showError(err.message);
        } finally {
          this.setLoading(false);
        }
      };
    }

    // Super User Admin mode button
    const btnSuperAdminMode = document.getElementById('btn-super-admin-mode');
    if (btnSuperAdminMode) {
      btnSuperAdminMode.onclick = () => {
        authService.loginSuperAdmin(true);
        this.onAuthSuccess(authService.getCurrentUser());
      };
    }

    // Dugout Field / Offline Mode button (Black Bats Coach)
    const btnFieldMode = document.getElementById('btn-field-mode');
    if (btnFieldMode) {
      btnFieldMode.onclick = () => {
        authService.loginOfflineDemo('Coach Collins', true);
        this.onAuthSuccess(authService.getCurrentUser());
      };
    }

    // Config modal triggers
    const btnOpenConfig = document.getElementById('btn-open-config');
    if (btnOpenConfig) {
      btnOpenConfig.onclick = () => {
        this.showConfigModal = true;
        this.render();
      };
    }

    const btnCloseConfig = document.getElementById('btn-close-config-modal');
    const btnCancelConfig = document.getElementById('btn-cancel-config');
    const configBackdrop = document.getElementById('config-modal-backdrop');

    if (btnCloseConfig) btnCloseConfig.onclick = () => { this.showConfigModal = false; this.render(); };
    if (btnCancelConfig) btnCancelConfig.onclick = () => { this.showConfigModal = false; this.render(); };
    if (configBackdrop) {
      configBackdrop.onclick = (e) => {
        if (e.target.id === 'config-modal-backdrop') {
          this.showConfigModal = false;
          this.render();
        }
      };
    }

    // Save config button
    const btnSaveConfig = document.getElementById('btn-save-config');
    if (btnSaveConfig) {
      btnSaveConfig.onclick = () => {
        const text = document.getElementById('config-json-input')?.value || '';
        const errorEl = document.getElementById('config-modal-error');
        try {
          // Parse JSON or JS object format
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (e1) {
            // Try cleaning loose JS object format (e.g. unquoted keys)
            const clean = text.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
            parsed = JSON.parse(clean);
          }

          saveCustomFirebaseConfig(parsed);
          this.showConfigModal = false;
          this.showSuccess('Firebase configuration saved successfully! Initializing connection...');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Invalid configuration format. Please paste valid JSON matching the firebaseConfig template.';
          }
        }
      };
    }

    // Reset config button
    const btnClearConfig = document.getElementById('btn-clear-config');
    if (btnClearConfig) {
      btnClearConfig.onclick = () => {
        clearCustomFirebaseConfig();
        this.showConfigModal = false;
        window.location.reload();
      };
    }
  }
}
