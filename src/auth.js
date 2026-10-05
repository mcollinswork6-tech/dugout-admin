/**
 * Firebase Authentication Service for NNLL Minor AAA Dugout Admin
 */

import {
  getActiveFirebaseConfig,
  isFirebaseConfigured,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig
} from './firebase-config.js';

const OFFLINE_COACH_SESSION_KEY = 'nnll_offline_coach_session';

class AuthService {
  constructor() {
    this.auth = null;
    this.app = null;
    this.currentUser = null;
    this.isInitialized = false;
    this.listeners = new Set();
    this.firebaseModules = null;
  }

  /**
   * Lazily loads Firebase modular dependencies
   */
  async loadFirebaseSDK() {
    if (this.firebaseModules) {
      return this.firebaseModules;
    }

    try {
      const [appMod, authMod] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth')
      ]);

      this.firebaseModules = {
        initializeApp: appMod.initializeApp,
        getApps: appMod.getApps,
        getApp: appMod.getApp,
        getAuth: authMod.getAuth,
        signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
        createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
        signInWithPopup: authMod.signInWithPopup,
        GoogleAuthProvider: authMod.GoogleAuthProvider,
        signOut: authMod.signOut,
        onAuthStateChanged: authMod.onAuthStateChanged,
        sendPasswordResetEmail: authMod.sendPasswordResetEmail,
        updateProfile: authMod.updateProfile
      };

      return this.firebaseModules;
    } catch (err) {
      console.warn('Could not load Firebase Modular SDK from importmap/CDN:', err);
      return null;
    }
  }

  /**
   * Initialize Authentication
   */
  async init() {
    if (this.isInitialized) return this.currentUser;

    const config = getActiveFirebaseConfig();
    const configured = isFirebaseConfigured();

    if (configured) {
      const sdk = await this.loadFirebaseSDK();
      if (sdk) {
        try {
          const apps = sdk.getApps();
          this.app = apps.length ? sdk.getApp() : sdk.initializeApp(config);
          this.auth = sdk.getAuth(this.app);

          // Optionally initialize Analytics if measurementId is configured
          if (config.measurementId && typeof window !== 'undefined') {
            import('firebase/analytics')
              .then(async (mod) => {
                if (mod && await mod.isSupported()) {
                  this.analytics = mod.getAnalytics(this.app);
                }
              })
              .catch(() => {});
          }

          // Listen for Firebase auth changes
          sdk.onAuthStateChanged(this.auth, (firebaseUser) => {
            if (firebaseUser) {
              this.currentUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Coach',
                photoURL: firebaseUser.photoURL,
                providerId: firebaseUser.providerData?.[0]?.providerId || 'password',
                isOfflineDemo: false
              };
              // Clear any offline session if real user logged in
              sessionStorage.removeItem(OFFLINE_COACH_SESSION_KEY);
            } else {
              // If not logged into Firebase, check if offline session exists
              const offline = this.getSavedOfflineSession();
              this.currentUser = offline;
            }
            this.notify();
          });

          this.isInitialized = true;
          return this.currentUser;
        } catch (e) {
          console.error('Firebase Auth initialization error:', e);
        }
      }
    }

    // If Firebase not configured or offline, check for existing offline session
    const offline = this.getSavedOfflineSession();
    if (offline) {
      this.currentUser = offline;
    }

    this.isInitialized = true;
    this.notify();
    return this.currentUser;
  }

  /**
   * Check offline coach session
   */
  getSavedOfflineSession() {
    try {
      const data = sessionStorage.getItem(OFFLINE_COACH_SESSION_KEY) || localStorage.getItem(OFFLINE_COACH_SESSION_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {}
    return null;
  }

  /**
   * Sign In with Email and Password
   */
  async signInWithEmail(email, password) {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase credentials are not yet configured. Please set your credentials in src/firebase-config.js or use Dugout Field Mode.');
    }

    const sdk = await this.loadFirebaseSDK();
    if (!sdk || !this.auth) {
      throw new Error('Firebase Auth is not available. Please check your internet connection or importmap.');
    }

    try {
      const userCredential = await sdk.signInWithEmailAndPassword(this.auth, email.trim(), password);
      return userCredential.user;
    } catch (err) {
      throw new Error(this.formatAuthError(err));
    }
  }

  /**
   * Sign Up with Email, Password, and Display Name
   */
  async signUpWithEmail(email, password, displayName) {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase credentials are not yet configured. Please set your credentials in src/firebase-config.js.');
    }

    const sdk = await this.loadFirebaseSDK();
    if (!sdk || !this.auth) {
      throw new Error('Firebase Auth is not available.');
    }

    try {
      const userCredential = await sdk.createUserWithEmailAndPassword(this.auth, email.trim(), password);
      if (displayName && displayName.trim()) {
        await sdk.updateProfile(userCredential.user, {
          displayName: displayName.trim()
        });
      }
      return userCredential.user;
    } catch (err) {
      throw new Error(this.formatAuthError(err));
    }
  }

  /**
   * Sign In with Google Provider
   */
  async signInWithGoogle() {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase credentials are not yet configured. Please set your credentials in src/firebase-config.js or configure in the modal.');
    }

    const sdk = await this.loadFirebaseSDK();
    if (!sdk || !this.auth) {
      throw new Error('Firebase Auth is not available.');
    }

    try {
      const provider = new sdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await sdk.signInWithPopup(this.auth, provider);
      return userCredential.user;
    } catch (err) {
      throw new Error(this.formatAuthError(err));
    }
  }

  /**
   * Send Password Reset Email
   */
  async sendPasswordReset(email) {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase credentials are not yet configured.');
    }

    const sdk = await this.loadFirebaseSDK();
    if (!sdk || !this.auth) {
      throw new Error('Firebase Auth is not available.');
    }

    try {
      await sdk.sendPasswordResetEmail(this.auth, email.trim());
      return true;
    } catch (err) {
      throw new Error(this.formatAuthError(err));
    }
  }

  /**
   * Log In as Offline Coach (Field / Demo Mode)
   */
  loginOfflineDemo(coachName = 'Coach Collins', remember = false) {
    const offlineUser = {
      uid: 'offline-coach-mcollins',
      email: 'mcollinswork6@gmail.com',
      displayName: coachName || 'Coach Collins',
      photoURL: null,
      providerId: 'offline-field-mode',
      isOfflineDemo: true
    };

    this.currentUser = offlineUser;
    const json = JSON.stringify(offlineUser);
    sessionStorage.setItem(OFFLINE_COACH_SESSION_KEY, json);
    if (remember) {
      localStorage.setItem(OFFLINE_COACH_SESSION_KEY, json);
    }
    this.notify();
    return offlineUser;
  }

  /**
   * Log In as Super User Admin (Matthew Collins)
   */
  loginSuperAdmin(remember = false) {
    const superUser = {
      uid: 'super-admin-matthew-collins',
      email: 'matthew.h.collins6@gmail.com',
      displayName: 'Matthew Collins (Commissioner)',
      photoURL: null,
      providerId: 'commissioner-admin-mode',
      isOfflineDemo: true
    };

    this.currentUser = superUser;
    const json = JSON.stringify(superUser);
    sessionStorage.setItem(OFFLINE_COACH_SESSION_KEY, json);
    if (remember) {
      localStorage.setItem(OFFLINE_COACH_SESSION_KEY, json);
    }
    this.notify();
    return superUser;
  }

  /**
   * Sign Out
   */
  async signOutUser() {
    sessionStorage.removeItem(OFFLINE_COACH_SESSION_KEY);
    localStorage.removeItem(OFFLINE_COACH_SESSION_KEY);

    if (this.auth && this.currentUser && !this.currentUser.isOfflineDemo) {
      const sdk = await this.loadFirebaseSDK();
      if (sdk) {
        try {
          await sdk.signOut(this.auth);
        } catch (e) {
          console.warn('Sign out error:', e);
        }
      }
    }

    this.currentUser = null;
    this.notify();
  }

  /**
   * Get Current User
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if User is Logged In
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Subscribe to Auth State Changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.currentUser);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify Subscribers
   */
  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentUser);
      } catch (e) {
        console.error('Error in auth listener:', e);
      }
    });
  }

  /**
   * Human-friendly error translation
   */
  formatAuthError(error) {
    if (!error) return 'An unexpected error occurred.';
    const code = error.code || '';
    const message = error.message || '';

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please verify your credentials.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in window was closed before completing.';
      case 'auth/popup-blocked':
        return 'Popup blocked by browser. Please allow popups for this site.';
      case 'auth/unauthorized-domain':
        return 'Domain unauthorized in Firebase Console. Please add "localhost" under Firebase Auth > Settings > Authorized domains.';
      case 'auth/network-request-failed':
        return 'Network error: Cannot connect to Firebase. Check internet connection.';
      case 'auth/too-many-requests':
        return 'Access temporarily blocked due to many failed login attempts. Try again later or reset password.';
      case 'auth/operation-not-allowed':
        return 'This sign-in provider is disabled in Firebase Console. Please enable Email/Password or Google under Authentication > Sign-in method.';
      default:
        return message || 'Authentication failed. Please check your credentials.';
    }
  }
}

export const authService = new AuthService();
