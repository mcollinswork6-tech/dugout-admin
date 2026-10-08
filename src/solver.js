/**
 * NNLL Minor AAA Constraint Satisfaction Engine & Dynamic Re-Solver
 * Uses Backtracking with Forward Checking, MRV, and Heuristic Weighting
 */

import {
  FIELD_POSITIONS,
  INFIELD_POSITIONS,
  OUTFIELD_POSITIONS,
  NNLL_RULES,
} from './constants.js';

/**
 * Checks if assigning player to position in inning is valid according to hard constraints
 */
function isAssignmentValid(
  player,
  position,
  inningNum,
  currentAssignments,
  playerHistories,
  playerPitches,
  pitchersRemoved
) {
  const pId = player.id;
  const history = playerHistories[pId] || {
    positions: [],
    infieldCount: 0,
    benchCount: 0,
    consecutiveBench: 0,
    inningsCaught: 0,
    inningsPitched: 0,
  };

  // 1. Safety Tags
  if (position === 'P' && (player.canPitch === false || player.eligiblePositions?.canPitch === false)) return false;
  if (position === 'C' && (player.canCatch === false || player.eligiblePositions?.canCatch === false)) return false;

  // 2. Pitcher/Catcher Interaction Rules
  // A pitcher who delivers 41+ pitches cannot catch
  if (position === 'C') {
    const pitches = playerPitches[pId] || 0;
    if (pitches >= NNLL_RULES.PITCHER_CATCHER_PITCH_THRESHOLD) {
      return false;
    }
  }

  // A player who caught 4 or more innings is ineligible to pitch
  if (position === 'P') {
    if (history.inningsCaught >= 4) {
      return false;
    }
    // Once removed from mound, cannot return to pitch
    if (pitchersRemoved.includes(pId)) {
      return false;
    }
  }

  // 3. Max consecutive bench
  if (position === 'BENCH') {
    const prevPos = history.positions[inningNum - 2];
    if (prevPos === 'BENCH') {
      // Cannot have 2 consecutive bench innings
      return false;
    }
  }

  return true;
}

/**
 * Score a potential assignment for soft constraint optimization
 */
function evaluateAssignmentScore(
  player,
  position,
  inningNum,
  totalInnings,
  history,
  activePlayerCount
) {
  let score = 100;

  // Emergency Infield Priority: Inning 4 or 3 when infieldCount is 0
  if (INFIELD_POSITIONS.includes(position)) {
    if (history.infieldCount === 0) {
      if (inningNum === 4) score += 500; // MUST get infield in inning 4
      else if (inningNum === 3) score += 200;
      else if (inningNum <= 2) score += 50;
    } else {
      // Already has infield; if someone else desperately needs it, slightly lower
      score += 10;
    }
  }

  // Bench Equalization
  const maxBenchAllowed = activePlayerCount <= 12 ? 2 : 3;
  if (position === 'BENCH') {
    // If player already benched max times, heavily penalize
    if (history.benchCount >= maxBenchAllowed) {
      score -= 1000;
    } else {
      // Prefer benching players with fewer bench innings
      score -= history.benchCount * 50;
    }
  } else {
    // Playing in field is preferred if player has benched more
    score += history.benchCount * 20;
  }

  // Outfield / Infield Balance: Aim for balanced variety
  if (OUTFIELD_POSITIONS.includes(position)) {
    if (history.infieldCount > history.outfieldCount) {
      score += 25; // Good balance
    }
  }

  return score;
}

/**
 * Deep clones history state for backtracking
 */
function cloneHistories(histories) {
  const cloned = {};
  for (const [pId, h] of Object.entries(histories)) {
    cloned[pId] = {
      positions: [...h.positions],
      infieldCount: h.infieldCount,
      outfieldCount: h.outfieldCount,
      benchCount: h.benchCount,
      consecutiveBench: h.consecutiveBench,
      inningsCaught: h.inningsCaught,
      inningsPitched: h.inningsPitched,
    };
  }
  return cloned;
}

/**
 * Updates a player's history with a new assignment
 */
function recordAssignment(histories, pId, pos, inningIdx) {
  const h = histories[pId];
  h.positions[inningIdx] = pos;
  if (INFIELD_POSITIONS.includes(pos)) {
    h.infieldCount += 1;
    h.consecutiveBench = 0;
  } else if (OUTFIELD_POSITIONS.includes(pos)) {
    h.outfieldCount += 1;
    h.consecutiveBench = 0;
  } else if (pos === 'BENCH') {
    h.benchCount += 1;
    h.consecutiveBench += 1;
  }
  if (pos === 'P') h.inningsPitched += 1;
  if (pos === 'C') h.inningsCaught += 1;
}

/**
 * Generates or dynamically re-solves a 6-inning defensive schedule
 *
 * @param {Object} params
 * @param {Array} params.players - Array of player profiles
 * @param {Array} params.lockedInnings - Array of InningRecord for locked (completed/current) innings
 * @param {number} params.startInning - Inning index to start solving (1-indexed, e.g. 1 for full game, 3 for re-solve from 3)
 * @param {number} params.totalInnings - Total innings to plan (default 6)
 * @param {Object} params.playerPitches - Map of playerId -> pitches thrown
 * @param {Array} params.pitchersRemoved - Array of removed pitcher IDs
 * @returns {Array} Full 6-inning InningRecord array
 */
export function solveDefensiveGrid({
  players,
  lockedInnings = [],
  startInning = 1,
  totalInnings = NNLL_RULES.REGULATION_INNINGS,
  playerPitches = {},
  pitchersRemoved = [],
}) {
  const activePlayers = players.filter((p) => !p.isOut);
  const activeCount = activePlayers.length;

  if (activeCount < 8) {
    throw new Error('Minimum 8 active players required to field a team.');
  }

  // Initialize player histories up to startInning - 1
  const playerHistories = {};
  players.forEach((p) => {
    playerHistories[p.id] = {
      positions: [],
      infieldCount: 0,
      outfieldCount: 0,
      benchCount: 0,
      consecutiveBench: 0,
      inningsCaught: 0,
      inningsPitched: 0,
    };
  });

  const fullGrid = [];

  // Populate locked innings history
  for (let i = 0; i < startInning - 1; i++) {
    const lockedRec = lockedInnings[i];
    if (lockedRec) {
      fullGrid[i] = JSON.parse(JSON.stringify(lockedRec));
      const assigned = new Set();
      Object.entries(lockedRec.assignments || {}).forEach(([pos, pId]) => {
        if (pId && playerHistories[pId]) {
          assigned.add(pId);
          recordAssignment(playerHistories, pId, pos, i);
        }
      });
      // Bench players for this locked inning
      players.forEach((p) => {
        if (!assigned.has(p.id) && !p.isOut && playerHistories[p.id]) {
          recordAssignment(playerHistories, p.id, 'BENCH', i);
        }
      });
    }
  }

  // Positions to fill per inning
  // If 8 players: fill 8 positions, 1 outfield position will be unfilled or bench is 0
  const positionsToFill = activeCount >= 9
    ? [...FIELD_POSITIONS]
    : FIELD_POSITIONS.slice(0, activeCount); // When 8 players, field 8

  /**
   * Recursive solver for inning by inning
   */
  function solveInning(inningIndex, currentHistories) {
    const inningNum = inningIndex + 1;
    if (inningIndex >= totalInnings) {
      // Reached the end! Validate final constraints
      let allValid = true;
      activePlayers.forEach((p) => {
        const h = currentHistories[p.id];
        // Hard rule: Infield by 4th inning
        if (totalInnings >= 4 && h.infieldCount === 0) {
          allValid = false;
        }
        // Hard rule: Max bench
        const maxBenchAllowed = activeCount <= 12 ? 2 : 3;
        if (h.benchCount > maxBenchAllowed) {
          allValid = false;
        }
      });
      return allValid ? [] : null;
    }

    // Determine who must play infield in Inning 4 (Emergency Infield Allocation)
    const mustPlayInfield = new Set();
    if (inningNum === 4) {
      activePlayers.forEach((p) => {
        const h = currentHistories[p.id];
        if (h.infieldCount === 0) {
          mustPlayInfield.add(p.id);
        }
      });
    }

    // Also if Inning 3 and player has 0 infield innings, high preference for infield
    const emergencyInfieldCount = mustPlayInfield.size;
    const availableInfieldSlots = INFIELD_POSITIONS.length; // 6
    if (emergencyInfieldCount > availableInfieldSlots) {
      // Infeasible configuration (too many players need infield in a single inning)
      return null;
    }

    // Determine bench capacity for this inning
    const numBenchSlots = Math.max(0, activeCount - positionsToFill.length);

    // Rank candidate assignments for each position
    // We solve assignments for the 9 (or activeCount) positions, remaining active players go to BENCH
    const positions = [...positionsToFill];

    // Position-by-position assignment backtracking
    function assignPosition(posIdx, assignedInInning, usedPlayersInInning, historiesSoFar) {
      if (posIdx >= positions.length) {
        // All field positions assigned! Assign remaining active players to bench
        const benchPlayers = [];
        let benchValid = true;

        activePlayers.forEach((p) => {
          if (!usedPlayersInInning.has(p.id)) {
            // Player is on bench
            if (!isAssignmentValid(p, 'BENCH', inningNum, assignedInInning, historiesSoFar, playerPitches, pitchersRemoved)) {
              benchValid = false;
            }
            benchPlayers.push(p.id);
          }
        });

        if (!benchValid) return null;

        // If inning 4, ensure no player needing infield is on the bench
        if (inningNum === 4) {
          for (const bId of benchPlayers) {
            if (mustPlayInfield.has(bId)) {
              return null; // Emergency violation
            }
          }
        }

        // Clone history and record bench
        const nextHistories = cloneHistories(historiesSoFar);
        benchPlayers.forEach((bId) => {
          recordAssignment(nextHistories, bId, 'BENCH', inningIndex);
        });

        const thisInningRecord = {
          inningNumber: inningNum,
          isCompleted: false,
          assignments: { ...assignedInInning },
          benchPlayerIds: benchPlayers,
        };

        // Recurse to next inning
        const futureInnings = solveInning(inningIndex + 1, nextHistories);
        if (futureInnings !== null) {
          return [thisInningRecord, ...futureInnings];
        }
        return null;
      }

      const currentPos = positions[posIdx];
      const isInfield = INFIELD_POSITIONS.includes(currentPos);

      // Filter and rank candidate players for currentPos
      const candidates = [];

      for (const player of activePlayers) {
        if (usedPlayersInInning.has(player.id)) continue;

        // If inning 4 and position is OUTFIELD, don't give it to someone who MUST play infield
        if (inningNum === 4 && !isInfield && mustPlayInfield.has(player.id)) {
          continue;
        }

        if (isAssignmentValid(player, currentPos, inningNum, assignedInInning, historiesSoFar, playerPitches, pitchersRemoved)) {
          const score = evaluateAssignmentScore(
            player,
            currentPos,
            inningNum,
            totalInnings,
            historiesSoFar[player.id],
            activeCount
          );
          candidates.push({ player, score });
        }
      }

      // Sort candidates by heuristic score descending
      candidates.sort((a, b) => b.score - a.score);

      for (const { player } of candidates) {
        // Try assigning player to currentPos
        const nextHistories = cloneHistories(historiesSoFar);
        recordAssignment(nextHistories, player.id, currentPos, inningIndex);

        assignedInInning[currentPos] = player.id;
        usedPlayersInInning.add(player.id);

        const result = assignPosition(posIdx + 1, assignedInInning, usedPlayersInInning, nextHistories);
        if (result !== null) {
          return result;
        }

        // Backtrack
        delete assignedInInning[currentPos];
        usedPlayersInInning.delete(player.id);
      }

      return null;
    }

    const assignedInInning = {};
    const usedPlayersInInning = new Set();
    return assignPosition(0, assignedInInning, usedPlayersInInning, currentHistories);
  }

  // Run solver starting from startInning - 1
  const solvedRemaining = solveInning(startInning - 1, playerHistories);

  if (!solvedRemaining) {
    // If strict balance was too tight, retry with relaxed soft scoring
    console.warn('Strict solve failed, trying relaxed solve...');
    const relaxedRemaining = solveInningFallback(
      startInning - 1,
      playerHistories,
      activePlayers,
      totalInnings,
      positionsToFill,
      playerPitches,
      pitchersRemoved
    );
    if (!relaxedRemaining) {
      throw new Error('Unable to generate valid defensive grid satisfying NNLL mandatory play constraints.');
    }
    for (let i = 0; i < relaxedRemaining.length; i++) {
      fullGrid[startInning - 1 + i] = relaxedRemaining[i];
    }
    return fullGrid;
  }

  for (let i = 0; i < solvedRemaining.length; i++) {
    fullGrid[startInning - 1 + i] = solvedRemaining[i];
  }

  return fullGrid;
}

/**
 * Fallback solver with greedy heuristic relaxation when standard backtracking is constrained
 */
function solveInningFallback(
  startIndex,
  initialHistories,
  activePlayers,
  totalInnings,
  positionsToFill,
  playerPitches,
  pitchersRemoved
) {
  const result = [];
  const currentHistories = cloneHistories(initialHistories);

  for (let innIdx = startIndex; innIdx < totalInnings; innIdx++) {
    const inningNum = innIdx + 1;
    const assigned = {};
    const used = new Set();

    // 1. Identify players requiring emergency infield in Inning 4
    if (inningNum === 4) {
      const emergencyPlayers = activePlayers.filter(
        (p) => currentHistories[p.id].infieldCount === 0
      );
      const infieldSlots = [...INFIELD_POSITIONS];
      for (const ep of emergencyPlayers) {
        const slot = infieldSlots.find(
          (s) => !assigned[s] && isAssignmentValid(ep, s, inningNum, assigned, currentHistories, playerPitches, pitchersRemoved)
        );
        if (slot) {
          assigned[slot] = ep.id;
          used.add(ep.id);
          recordAssignment(currentHistories, ep.id, slot, innIdx);
        }
      }
    }

    // 2. Assign remaining positions
    for (const pos of positionsToFill) {
      if (assigned[pos]) continue;

      // Find best available candidate
      let bestPlayer = null;
      let bestScore = -Infinity;

      for (const p of activePlayers) {
        if (used.has(p.id)) continue;
        if (isAssignmentValid(p, pos, inningNum, assigned, currentHistories, playerPitches, pitchersRemoved)) {
          const score = evaluateAssignmentScore(
            p,
            pos,
            inningNum,
            totalInnings,
            currentHistories[p.id],
            activePlayers.length
          );
          if (score > bestScore) {
            bestScore = score;
            bestPlayer = p;
          }
        }
      }

      if (bestPlayer) {
        assigned[pos] = bestPlayer.id;
        used.add(bestPlayer.id);
        recordAssignment(currentHistories, bestPlayer.id, pos, innIdx);
      }
    }

    // 3. Bench remaining players
    const benchPlayers = [];
    activePlayers.forEach((p) => {
      if (!used.has(p.id)) {
        benchPlayers.push(p.id);
        recordAssignment(currentHistories, p.id, 'BENCH', innIdx);
      }
    });

    result.push({
      inningNumber: inningNum,
      isCompleted: false,
      assignments: assigned,
      benchPlayerIds: benchPlayers,
    });
  }

  return result;
}
