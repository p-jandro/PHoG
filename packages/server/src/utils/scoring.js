/**
 * Scoring utilities for different game modes
 */

/**
 * Calculate score for Quiz game
 * @param {string} difficulty - easy | medium | hard | impossible
 * @param {number} timeRemaining - Time remaining in milliseconds
 * @param {number} totalTime - Total time allowed in milliseconds
 * @param {boolean} isLeader - Whether player is current leader
 * @returns {number} - Points earned
 */
export function calculateQuizScore(difficulty, timeRemaining, totalTime, isLeader = false) {
  // Base points by difficulty
  const basePoints = {
    easy: 100,
    medium: 200,
    hard: 300,
    impossible: 500
  };

  const points = basePoints[difficulty] || 100;

  // Speed bonus: up to 10% extra for fast answers (minimal)
  const timePercent = timeRemaining / totalTime;
  const speedBonus = Math.floor(points * 0.1 * timePercent);

  let totalScore = points + speedBonus;

  // Leader gets 2x multiplier - REMOVED as per request
  /*
  if (isLeader) {
    totalScore *= 2;
  }
  */

  return Math.floor(totalScore);
}

/**
 * Calculate score for True/False game
 * @param {number} correctAnswers - Number of correct answers
 * @param {number} totalAnswers - Total number of answers
 * @returns {number} - Points earned
 */
export function calculateTrueFalseScore(correctAnswers, totalAnswers) {
  if (totalAnswers === 0) return 0;

  const basePoints = correctAnswers * 50;
  
  // Accuracy bonus for high accuracy
  const accuracy = correctAnswers / totalAnswers;
  let bonus = 0;
  
  if (accuracy >= 0.9) bonus = 200;
  else if (accuracy >= 0.8) bonus = 100;
  else if (accuracy >= 0.7) bonus = 50;

  return basePoints + bonus;
}

/**
 * Calculate score for Countdown word game
 * @param {string} word - The word submitted
 * @param {number} maxLength - Length of the longest word
 * @returns {number} - Points earned
 */
export function calculateCountdownScore(word, maxLength) {
  if (!word || word.length === 0) return 0;

  const length = word.length;
  
  // Points scale exponentially with length
  let points = length * length * 10;

  // Bonus for longest word
  if (length === maxLength) {
    points += 200;
  }

  return points;
}

/**
 * Get current leaderboard leader
 * @param {Map} players - Map of player IDs to player objects
 * @returns {string|null} - Player ID of leader, or null if no players
 */
export function getLeader(players) {
  if (players.size === 0) return null;

  let leader = null;
  let highestScore = -1;

  for (const [playerId, player] of players) {
    if (player.score > highestScore) {
      highestScore = player.score;
      leader = playerId;
    }
  }

  return leader;
}

/**
 * Generate leaderboard sorted by score
 * @param {Map} players - Map of player IDs to player objects
 * @returns {Array} - Array of player objects sorted by score
 */
export function generateLeaderboard(players, gameType = null, usePlacement = false) {
  const playerArray = Array.from(players.values());

  if (usePlacement) {
    const placementPlayers = playerArray.filter(p => p.totalPlacement && p.totalPlacement > 0);

    if (placementPlayers.length > 0) {
      return placementPlayers
        .sort((a, b) => a.totalPlacement - b.totalPlacement) // Lower placement = better
        .map((player, index) => ({
          rank: index + 1,
          id: player.id,
          name: player.name,
          score: player.score,
          placements: player.placements,
          totalPlacement: player.totalPlacement,
          connected: player.connected
        }));
    }
  }

  // Fallback to score-based leaderboard (during individual games)
  // For Pointless, lower score is better (ascending sort)
  const sortFn = gameType === 'pointless'
    ? (a, b) => a.score - b.score
    : (a, b) => b.score - a.score;

  return playerArray
    .sort(sortFn)
    .map((player, index) => ({
      rank: index + 1,
      id: player.id,
      name: player.name,
      score: player.score,
      placements: player.placements,
      totalPlacement: player.totalPlacement,
      connected: player.connected
    }));
}

/**
 * Calculate position change for a player
 * @param {Array} oldLeaderboard - Previous leaderboard
 * @param {Array} newLeaderboard - Current leaderboard
 * @param {string} playerId - Player ID to check
 * @returns {number} - Position change (negative = moved up, positive = moved down)
 */
export function calculatePositionChange(oldLeaderboard, newLeaderboard, playerId) {
  const oldPos = oldLeaderboard.findIndex(p => p.id === playerId);
  const newPos = newLeaderboard.findIndex(p => p.id === playerId);
  
  if (oldPos === -1 || newPos === -1) return 0;
  
  return oldPos - newPos; // Negative means moved down in ranking
}

/**
 * Calculate placements based on scores (Golf scoring: lower is better)
 * @param {Map} players - Map of player objects
 * @param {string} gameType - Game type ('quiz', 'trueFalse', 'countdown')
 * @returns {Map} Map of playerId -> placement (1, 2, 3, etc.)
 */
export function calculatePlacements(players, gameType) {
  // Create array of players with their scores
  const playerArray = Array.from(players.values())
    .map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      totalResponseTime: p.totalResponseTime || 0
    }));

  // Sort by score then response time (lower response time is always better)
  // For Pointless, lower score is better (ascending sort)
  // For other games (Quiz, Countdown), higher score is better (descending sort)
  if (gameType === 'pointless') {
    playerArray.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return (a.totalResponseTime || 0) - (b.totalResponseTime || 0);
    });
  } else {
    playerArray.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return (a.totalResponseTime || 0) - (b.totalResponseTime || 0);
    });
  }

  // Assign placements (handle ties by giving same placement)
  const placements = new Map();
  let currentPlacement = 1;
  let previousScore = null;
  let previousTime = null;
  let playersAtCurrentScore = 0;

  for (let i = 0; i < playerArray.length; i++) {
    const player = playerArray[i];
    
    let isDifferent = false;
    if (previousScore !== null) {
      if (gameType === 'pointless') {
        // Lower score is better, so if score > prev, it's worse
        isDifferent = player.score > previousScore || (player.score === previousScore && player.totalResponseTime > previousTime);
      } else {
        // Higher score is better, so if score < prev, it's worse
        isDifferent = player.score < previousScore || (player.score === previousScore && player.totalResponseTime > previousTime);
      }
    }

    if (isDifferent) {
      // Move to next placement
      currentPlacement += playersAtCurrentScore;
      playersAtCurrentScore = 1;
    } else {
      playersAtCurrentScore++;
    }

    placements.set(player.id, currentPlacement);
    previousScore = player.score;
    previousTime = player.totalResponseTime;
  }

  console.log(`[SCORING] Placements for ${gameType}:`, 
    Array.from(placements.entries()).map(([id, place]) => {
      const p = players.get(id);
      return `${p?.name}: ${place}${getOrdinalSuffix(place)} (${p?.score} pts)`;
    }).join(', ')
  );

  return placements;
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, 4th, etc.)
 */
export function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Update player placements for a specific game
 * @param {Map} players - Map of player objects
 * @param {string} gameType - Game type ('quiz', 'trueFalse', 'countdown')
 */
export function updatePlayerPlacements(players, gameType) {
  const placements = calculatePlacements(players, gameType);
  
  for (const [playerId, placement] of placements) {
    const player = players.get(playerId);
    if (player) {
      // Ensure placements object exists
      if (!player.placements) {
        player.placements = {
            quiz: null,
            trueFalse: null,
            countdown: null,
            pointless: null
        };
      }
      
      player.placements[gameType] = placement;
      
      // Recalculate total placement (sum of completed games only — null means not played)
      const completedPlacements = [
        player.placements.quiz,
        player.placements.trueFalse,
        player.placements.countdown,
        player.placements.pointless
      ].filter(p => p !== null && p !== undefined);

      player.totalPlacement = completedPlacements.reduce((sum, p) => sum + p, 0);
      
      console.log(`[SCORING] ${player.name}: ${gameType} placement = ${placement}, total = ${player.totalPlacement}`);
    }
  }

  console.log(`[SCORING] Updated placements for ${gameType}`);
}

/**
 * Generate final leaderboard based on total placements (golf scoring)
 * @param {Map} players - Map of player objects
 * @returns {Array} - Array of player objects sorted by total placement
 */
export function generatePlacementLeaderboard(players) {
  const playerArray = Array.from(players.values())
    .map(player => ({
      rank: 0, // Will be calculated after sorting
      id: player.id,
      name: player.name,
      score: player.score,
      placements: player.placements,
      totalPlacement: player.totalPlacement,
      connected: player.connected
    }));
  
  // Sort by total placement (lower is better)
  // Players with 0 placement go to the end
  playerArray.sort((a, b) => {
    if (a.totalPlacement === 0) return 1;
    if (b.totalPlacement === 0) return -1;
    return a.totalPlacement - b.totalPlacement;
  });

  // Assign ranks
  playerArray.forEach((player, index) => {
    player.rank = index + 1;
  });

  return playerArray;
}
