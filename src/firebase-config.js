/**
 * Firebase Configuration for NNLL Dugout & Lineup Optimizer
 *
 * --------------------------------------------------------------------------
 * INSTRUCTIONS FOR ENABLING FIREBASE AUTHENTICATION:
 * --------------------------------------------------------------------------
 * 1. Visit the Firebase Console:
 *    https://console.firebase.google.com/
 *
 * 2. Select or create your Firebase project (e.g., "nnll-dugout-admin").
 *
 * 3. In the sidebar, click Project Settings (gear icon) > "General":
 *    - Scroll down to "Your apps".
 *    - Click the Web icon (</>) to register a web app.
 *    - Copy the `firebaseConfig` object and replace the placeholder values below.
 *
 * 4. In Firebase Console > "Build" > "Authentication":
 *    - Click "Get Started".
 *    - Under the "Sign-in method" tab:
 *      * Enable "Email/Password".
 *      * Enable "Google" (select your project support email and save).
 *    - Under the "Settings" tab > "Authorized domains":
 *      * Ensure "localhost" and your production domains are listed.
 * --------------------------------------------------------------------------
 */

export const firebaseConfig = {
  apiKey: "AIzaSyCNl2DHtvqxq1tP5PNxf6iyUc8lPcEkCOg",
  authDomain: "dugout-admin-916c8.firebaseapp.com",
  projectId: "dugout-admin-916c8",
  storageBucket: "dugout-admin-916c8.firebasestorage.app",
  messagingSenderId: "530704546378",
  appId: "1:530704546378:web:663b6723c438aa101144b3",
  measurementId: "G-PE0LJM6XRP"
};

/**
 * Storage key for user-provided custom Firebase config entered directly in the UI
 */
export const CUSTOM_CONFIG_STORAGE_KEY = 'nnll_dugout_custom_firebase_config';

/**
 * Validates whether a config object has real values rather than default placeholders.
 */
export function isValidFirebaseConfig(config) {
  if (!config || typeof config !== 'object') return false;
  const apiKey = String(config.apiKey || '').trim();
  const projectId = String(config.projectId || '').trim();
  const authDomain = String(config.authDomain || '').trim();

  if (!apiKey || apiKey === 'YOUR_API_KEY') return false;
  if (!projectId || projectId === 'YOUR_PROJECT_ID') return false;
  if (!authDomain || authDomain.startsWith('YOUR_PROJECT_ID')) return false;

  return true;
}

/**
 * Returns the active Firebase config.
 * Prioritizes custom config saved via the in-app config modal,
 * then window.__FIREBASE_CONFIG__, then the config exported above.
 */
export function getActiveFirebaseConfig() {
  // 1. Check window override (useful for hosting environments / env scripts)
  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__ && isValidFirebaseConfig(window.__FIREBASE_CONFIG__)) {
    return window.__FIREBASE_CONFIG__;
  }

  // 2. Check localStorage saved config from in-app settings
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidFirebaseConfig(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved Firebase config:', e);
    }
  }

  // 3. Fall back to code export
  return firebaseConfig;
}

/**
 * Checks if Firebase is currently configured with valid credentials.
 */
export function isFirebaseConfigured() {
  return isValidFirebaseConfig(getActiveFirebaseConfig());
}

/**
 * Save custom config to localStorage (from in-app modal)
 */
export function saveCustomFirebaseConfig(configObj) {
  if (!isValidFirebaseConfig(configObj)) {
    throw new Error('Invalid Firebase configuration object. Please ensure apiKey and projectId are provided.');
  }
  localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(configObj));
}

/**
 * Clears custom config from localStorage
 */
export function clearCustomFirebaseConfig() {
  localStorage.removeItem(CUSTOM_CONFIG_STORAGE_KEY);
}
