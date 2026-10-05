/**
 * Offline Storage Module for NNLL Dugout Optimizer
 * Uses IndexedDB with transparent LocalStorage fallback
 */

const DB_NAME = 'NNLL_Dugout_DB';
const DB_VERSION = 1;
const STORE_GAMES = 'games';
const STORE_ROSTERS = 'rosters';

let dbInstance = null;

async function initDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }
  if (dbInstance) return dbInstance;

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_GAMES)) {
          db.createObjectStore(STORE_GAMES, { keyPath: 'gameId' });
        }
        if (!db.objectStoreNames.contains(STORE_ROSTERS)) {
          db.createObjectStore(STORE_ROSTERS, { keyPath: 'teamId' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = () => {
        console.warn('IndexedDB initialization failed, falling back to LocalStorage');
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB not accessible, falling back to LocalStorage', e);
      resolve(null);
    }
  });
}

export async function saveGame(gameState) {
  try {
    const db = await initDB();
    if (db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_GAMES], 'readwrite');
        const store = tx.objectStore(STORE_GAMES);
        const req = store.put(gameState);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e);
      });
    }
  } catch (err) {
    console.warn('IndexedDB save failed, using LocalStorage', err);
  }

  // LocalStorage fallback
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`nnll_game_${gameState.gameId}`, JSON.stringify(gameState));
      localStorage.setItem('nnll_active_game_id', gameState.gameId);
      return true;
    }
  } catch (e) {
    console.error('LocalStorage save failed', e);
  }
  return false;
}

export async function loadGame(gameId) {
  try {
    const db = await initDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_GAMES], 'readonly');
        const store = tx.objectStore(STORE_GAMES);
        const req = store.get(gameId);
        req.onsuccess = (e) => resolve(e.target.result || null);
        req.onerror = () => resolve(null);
      });
    }
  } catch (err) {
    console.warn('IndexedDB load failed, trying LocalStorage', err);
  }

  // LocalStorage fallback
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(`nnll_game_${gameId}`);
      if (data) return JSON.parse(data);
    }
  } catch (e) {
    console.error('LocalStorage load failed', e);
  }
  return null;
}

export async function loadLatestActiveGame() {
  try {
    if (typeof localStorage !== 'undefined') {
      const activeId = localStorage.getItem('nnll_active_game_id');
      if (activeId) {
        const game = await loadGame(activeId);
        if (game) return game;
      }
    }
  } catch (e) {
    console.error('Error loading latest active game', e);
  }
  return null;
}

export async function saveTeamRoster(team) {
  try {
    const db = await initDB();
    if (db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_ROSTERS], 'readwrite');
        const store = tx.objectStore(STORE_ROSTERS);
        const req = store.put(team);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e);
      });
    }
  } catch (err) {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`nnll_team_${team.teamId}`, JSON.stringify(team));
      return true;
    }
  } catch (e) {}
  return false;
}

export async function getAllSavedGames() {
  try {
    const db = await initDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_GAMES], 'readonly');
        const store = tx.objectStore(STORE_GAMES);
        const req = store.getAll();
        req.onsuccess = (e) => resolve(e.target.result || []);
        req.onerror = () => resolve([]);
      });
    }
  } catch (e) {}

  const games = [];
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nnll_game_')) {
          const item = JSON.parse(localStorage.getItem(key));
          if (item) games.push(item);
        }
      }
    }
  } catch (e) {}
  return games;
}
