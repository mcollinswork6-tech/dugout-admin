/**
 * NNLL Minor AAA Rule Validator & Compliance Engine
 */

import {
  FIELD_POSITIONS,
  INFIELD_POSITIONS,
  OUTFIELD_POSITIONS,
  NNLL_RULES,
} from './constants.js';

/**
 * Calculates per-player stats up to or across specified innings
 * @param {Array} players - Array of PlayerProfile
 * @param {Array} innings - Array of InningRecord
 * @param {Object} playerPitches - Map of playerId -> pitchesThrown
 * @param {Array} pitchersRemoved - Array of playerIds who pitched and were removed from the mound
 */
export function calculatePlayerStats(players, innings, playerPitches = {}, pitchersRemoved = []) {
  const stats = {};

  players.forEach((player) => {
    stats[player.id] = {
      playerId: player.id,
      name: player.name,
      jerseyNumber: player.jerseyNumber,
      inningsPlayedInfield: 0,
      infieldInningsBy4: 0,
      inningsPlayedOutfield: 0,
      totalBenchInnings: 0,
      consecutiveBenchInnings: 0,
      maxConsecutiveBench: 0,
      inningsCaught: 0,
      inningsPitched: 0,
      pitchesThrown: playerPitches[player.id] || 0,
      hasPitched: false,
      isRemovedPitcher: pitchersRemoved.includes(player.id),
      positionHistory: [], // Array of position strings for each inning
      benchViolations: [],
      infieldDeadlineViolation: false,
      pitcherCatcherViolation: false,
      catcherPitcherViolation: false,
      safetyTagViolations: [],
    };
  });

  let prevBench = new Set();

  innings.forEach((inningRec, inningIdx) => {
    const inningNum = inningIdx + 1;
    const currentBench = new Set(inningRec.benchPlayerIds || []);

    // Also check assignments map
    const assignedPlayers = new Set();
    Object.entries(inningRec.assignments || {}).forEach(([pos, pId]) => {
      if (!pId) return;
      assignedPlayers.add(pId);
      const st = stats[pId];
      if (!st) return;

      st.positionHistory[inningIdx] = pos;

      if (pos === 'P') {
        st.inningsPitched += 1;
        st.hasPitched = true;
      }
      if (pos === 'C') {
        st.inningsCaught += 1;
      }
      if (INFIELD_POSITIONS.includes(pos)) {
        st.inningsPlayedInfield += 1;
        if (inningNum <= NNLL_RULES.INFIELD_DEADLINE_INNING) {
          st.infieldInningsBy4 += 1;
        }
      } else if (OUTFIELD_POSITIONS.includes(pos)) {
        st.inningsPlayedOutfield += 1;
      }

      // Reset consecutive bench
      st.consecutiveBenchInnings = 0;
    });

    // Check bench players
    players.forEach((player) => {
      const pId = player.id;
      const st = stats[pId];
      if (!st) return;

      if (!assignedPlayers.has(pId)) {
        st.positionHistory[inningIdx] = 'BENCH';
        st.totalBenchInnings += 1;
        st.consecutiveBenchInnings += 1;
        if (st.consecutiveBenchInnings > st.maxConsecutiveBench) {
          st.maxConsecutiveBench = st.consecutiveBenchInnings;
        }
        if (st.consecutiveBenchInnings > NNLL_RULES.MAX_CONSECUTIVE_BENCH) {
          st.benchViolations.push({
            inning: inningNum,
            type: 'CONSECUTIVE_BENCH',
            message: `${player.name} benched for ${st.consecutiveBenchInnings} consecutive innings at Inning ${inningNum}.`,
          });
        }
      }
    });

    prevBench = currentBench;
  });

  // Evaluate final & cross-inning hard rules
  players.forEach((player) => {
    const st = stats[player.id];
    if (!st) return;

    // Rule 1: Max 2 total bench innings across 6 innings (for <= 12 players)
    const activeRosterCount = players.filter(p => !p.isOut).length;
    const maxBenchAllowed = activeRosterCount <= 12 ? NNLL_RULES.MAX_TOTAL_BENCH_6_INNINGS : 3;
    if (st.totalBenchInnings > maxBenchAllowed && innings.length === NNLL_RULES.REGULATION_INNINGS) {
      st.benchViolations.push({
        type: 'TOTAL_BENCH_EXCEEDED',
        message: `${player.name} benched ${st.totalBenchInnings} times (max allowed: ${maxBenchAllowed}).`,
      });
    }

    // Rule 2: Infield by 4th inning (if at least 4 innings planned/evaluated)
    if (innings.length >= NNLL_RULES.INFIELD_DEADLINE_INNING) {
      if (st.infieldInningsBy4 < 1 && !player.isOut) {
        st.infieldDeadlineViolation = true;
      }
    }

    // Rule 3: Pitcher & Catcher Interaction:
    // A pitcher who delivers 41 or more pitches cannot play catcher for remainder of that game
    if (st.pitchesThrown >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD) {
      // Check if player is assigned to C in any subsequent/current inning
      const catchInningsAfter41 = [];
      innings.forEach((inn, idx) => {
        if (inn.assignments && inn.assignments.C === player.id) {
          catchInningsAfter41.push(idx + 1);
        }
      });
      if (catchInningsAfter41.length > 0) {
        st.pitcherCatcherViolation = true;
      }
    }

    // Rule 4: A player who catches 4 or more innings is ineligible to pitch on that calendar day
    if (st.inningsCaught >= 4 && (st.inningsPitched > 0 || st.hasPitched)) {
      st.catcherPitcherViolation = true;
    }

    // Rule 5: Safety tags check
    if (player.eligiblePositions) {
      innings.forEach((inn, idx) => {
        const assignedPos = inn.assignments ? Object.entries(inn.assignments).find(([_, pid]) => pid === player.id)?.[0] : null;
        if (assignedPos === 'P' && player.eligiblePositions.canPitch === false) {
          st.safetyTagViolations.push({ inning: idx + 1, position: 'P', message: `${player.name} is marked as unable to pitch.` });
        }
        if (assignedPos === 'C' && player.eligiblePositions.canCatch === false) {
          st.safetyTagViolations.push({ inning: idx + 1, position: 'C', message: `${player.name} is marked as unable to catch.` });
        }
        if (assignedPos === '1B' && player.eligiblePositions.canPlayFirstBase === false) {
          st.safetyTagViolations.push({ inning: idx + 1, position: '1B', message: `${player.name} is marked as unable to play 1B.` });
        }
      });
    }
  });

  return stats;
}

/**
 * Validates the full game state against all NNLL rules and returns hard errors and soft warnings
 */
export function validateGameRules(gameState) {
  const { players, innings, playerPitches, pitchersRemoved, currentInning } = gameState;
  const hardViolations = [];
  const softWarnings = [];
  const urgentAlerts = [];

  const stats = calculatePlayerStats(players, innings, playerPitches || {}, pitchersRemoved || []);

  players.forEach((player) => {
    const st = stats[player.id];
    if (!st || player.isOut) return;

    // Hard Rule: Consecutive bench
    if (st.benchViolations.length > 0) {
      st.benchViolations.forEach((v) => {
        hardViolations.push({
          playerId: player.id,
          playerName: player.name,
          type: v.type,
          inning: v.inning,
          message: v.message,
        });
      });
    }

    // Hard Rule: Infield by end of 4th inning
    if (innings.length >= 4) {
      if (st.infieldInningsBy4 === 0) {
        hardViolations.push({
          playerId: player.id,
          playerName: player.name,
          type: 'NO_INFIELD_BY_4TH',
          message: `Mandatory Play: ${player.name} has 0 infield innings through the 4th inning.`,
        });
      }
    } else if (currentInning === 3 && st.inningsPlayedInfield === 0) {
      // Inning 4 approaching urgent alert!
      urgentAlerts.push({
        playerId: player.id,
        playerName: player.name,
        type: 'INFIELD_REQUIRED_NEXT_INNING',
        message: `High Priority: ${player.name} must play Infield in Inning 4 to meet NNLL mandatory play rule.`,
      });
    }

    // Hard Rule: 41+ pitches cannot catch
    if (st.pitchesThrown >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD) {
      const catches = [];
      innings.forEach((inn, idx) => {
        if (inn.assignments && inn.assignments.C === player.id) {
          catches.push(idx + 1);
        }
      });
      if (catches.length > 0) {
        hardViolations.push({
          playerId: player.id,
          playerName: player.name,
          type: 'PITCHER_EXCEEDED_40_CATCHING',
          message: `${player.name} threw ${st.pitchesThrown} pitches (>= 41) and cannot play Catcher in Inning(s) ${catches.join(', ')}.`,
        });
      }
    }

    // Hard Rule: Caught 4+ innings cannot pitch
    if (st.inningsCaught >= 4 && (st.inningsPitched > 0 || st.hasPitched)) {
      hardViolations.push({
        playerId: player.id,
        playerName: player.name,
        type: 'CATCHER_EXCEEDED_3_PITCHING',
        message: `${player.name} caught ${st.inningsCaught} innings (>= 4) and is ineligible to pitch on this calendar day.`,
      });
    }

    // Hard Rule: Removed pitcher cannot return to mound
    if (st.isRemovedPitcher) {
      innings.forEach((inn, idx) => {
        // If assigned to pitch in an inning after being removed
        if (idx + 1 > (gameState.pitcherRemovalInning?.[player.id] || 0) && inn.assignments && inn.assignments.P === player.id) {
          hardViolations.push({
            playerId: player.id,
            playerName: player.name,
            type: 'REMOVED_PITCHER_RETURNED',
            message: `${player.name} was removed from the mound and cannot return to pitch in Inning ${idx + 1}.`,
          });
        }
      });
    }

    // Safety tag warnings
    if (st.safetyTagViolations.length > 0) {
      st.safetyTagViolations.forEach((sv) => {
        softWarnings.push({
          playerId: player.id,
          playerName: player.name,
          type: 'SAFETY_TAG_OVERRIDE',
          inning: sv.inning,
          message: sv.message,
        });
      });
    }

    // Soft Rule: Bench balance heuristic check
    if (innings.length >= 5 && st.totalBenchInnings > 2) {
      softWarnings.push({
        playerId: player.id,
        playerName: player.name,
        type: 'BENCH_BALANCE',
        message: `${player.name} is benched ${st.totalBenchInnings} innings. Check roster balance.`,
      });
    }
  });

  // Pitch count live alerts
  const activePitcherId = gameState.activePitcherId;
  if (activePitcherId && playerPitches?.[activePitcherId] !== undefined) {
    const pitches = playerPitches[activePitcherId];
    const pitcherObj = players.find(p => p.id === activePitcherId);
    const pName = pitcherObj ? pitcherObj.name : 'Active Pitcher';

    if (pitches >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD) {
      urgentAlerts.push({
        playerId: activePitcherId,
        playerName: pName,
        type: 'PITCH_COUNT_CATCHER_CAP',
        message: `Threshold Cap: ${pName} has thrown ${pitches} pitches. Ineligible to play Catcher for remainder of game.`,
      });
    } else if (pitches >= NNLL_RULES.PITCH_WARNING_THRESHOLD) {
      urgentAlerts.push({
        playerId: activePitcherId,
        playerName: pName,
        type: 'PITCH_COUNT_WARNING',
        message: `Alert: ${pName} has thrown ${pitches} pitches (approaching 41-pitch catcher threshold & rest tiers).`,
      });
    }
  }

  return {
    isValid: hardViolations.length === 0,
    hardViolations,
    softWarnings,
    urgentAlerts,
    playerStats: stats,
  };
}
