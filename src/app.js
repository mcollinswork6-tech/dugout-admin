/**
 * Main Application Bootstrapper with Firebase Authentication Guard
 */

import { GameStateManager } from './state.js';
import { DugoutUI } from './ui.js';
import { SAMPLE_TEAMS } from './sample-data.js';
import { loadLatestActiveGame } from './storage.js';
import { authService } from './auth.js';
import { AuthUI } from './auth-ui.js';

let stateManager = null;
let dugoutUI = null;
let isDugoutInitialized = false;

async function initDugoutApp(appContainer) {
  if (isDugoutInitialized) {
    if (stateManager) stateManager.notify();
    return;
  }

  stateManager = new GameStateManager();
  dugoutUI = new DugoutUI(stateManager, authService);
  dugoutUI.init(appContainer);

  const user = authService.currentUser;
  const isMcollins = user?.email?.toLowerCase() === 'mcollinswork6@gmail.com';

  // Try loading saved game or initialize default sample team
  try {
    const saved = await loadLatestActiveGame();
    if (saved && saved.players && saved.players.length >= 8) {
      // Discard stale game cache if it has dummy sample players (e.g. Liam Garcia) or wrong player count for Black Bats
      const isStaleDummyBlackBats = saved.players.some((p) => p.name === 'Liam Garcia' || p.name === 'Noah Davis') ||
        (saved.teamName && saved.teamName.toLowerCase().includes('black bats') && saved.players.length !== 12);

      if (!isStaleDummyBlackBats) {
        // If mcollinswork6@gmail.com, ensure they are in their designated Black Bats game
        if (!isMcollins || (saved.teamName && saved.teamName.toLowerCase().includes('black bats'))) {
          stateManager.state = saved;
          stateManager.saveSnapshot();
          stateManager.notify();
          isDugoutInitialized = true;
          return;
        }
      } else {
        console.info('Stale placeholder Black Bats roster detected in cache; clearing cache and loading official 12-player roster.');
        try { localStorage.removeItem('dugout_active_game_v1'); } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('Could not restore previous game', e);
  }

  // Try loading active team and roster from Firebase Cloud Storage / teamStorage
  try {
    const { teamStorage } = await import('./team-storage.js');
    const activeTeamId = await teamStorage.getActiveTeamId();
    if (activeTeamId) {
      const profile = await teamStorage.getTeamProfile(activeTeamId);
      const roster = await teamStorage.getTeamRoster(activeTeamId);
      if (profile && roster && roster.length >= 8) {
        stateManager.initNewGame({
          teamId: profile.teamId,
          teamName: profile.teamName,
          opponentName: profile.opponentName || 'Opponent',
          isHomeTeam: true,
          players: roster,
        });
        isDugoutInitialized = true;
        return;
      }
    }
  } catch (e) {
    console.warn('Could not load team from teamStorage:', e);
  }

  // Fallback: Initialize with 11-player River Cats
  const defaultTeam = SAMPLE_TEAMS[0];
  stateManager.initNewGame({
    teamId: defaultTeam.teamId,
    teamName: defaultTeam.teamName,
    opponentName: defaultTeam.opponentName,
    isHomeTeam: true,
    players: defaultTeam.players,
  });

  isDugoutInitialized = true;
}

async function bootstrap() {
  const appContainer = document.getElementById('app-root');
  let authContainer = document.getElementById('auth-root');

  if (!authContainer) {
    authContainer = document.createElement('div');
    authContainer.id = 'auth-root';
    document.body.prepend(authContainer);
  }

  // Instantiate Auth UI
  const authUI = new AuthUI({
    onAuthSuccess: (user) => {
      // Transition handled via authService listener
    }
  });
  authUI.init(authContainer);

  // Subscribe to auth state changes
  authService.subscribe(async (user) => {
    if (user) {
      // User is authenticated (Firebase or Dugout Field Mode)
      authContainer.style.display = 'none';
      if (appContainer) {
        appContainer.style.display = 'block';
        await initDugoutApp(appContainer);
      }
    } else {
      // User is not authenticated -> show login overlay
      authContainer.style.display = 'block';
      authUI.render();
      if (appContainer) {
        appContainer.style.display = 'none';
      }
    }
  });

  // Initialize Auth Service
  try {
    await authService.init();
  } catch (err) {
    console.error('Failed to initialize auth service:', err);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
