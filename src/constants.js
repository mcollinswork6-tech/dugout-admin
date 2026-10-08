/**
 * NNLL Minor AAA Roster & Dugout Optimizer Constants
 */

export const POSITIONS = {
  P: 'P',
  C: 'C',
  '1B': '1B',
  '2B': '2B',
  '3B': '3B',
  SS: 'SS',
  LF: 'LF',
  CF: 'CF',
  RF: 'RF',
  BENCH: 'BENCH',
};

export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

export const INFIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS'];

export const OUTFIELD_POSITIONS = ['LF', 'CF', 'RF'];

export const POSITION_NAMES = {
  P: 'Pitcher',
  C: 'Catcher',
  '1B': 'First Base',
  '2B': 'Second Base',
  '3B': 'Third Base',
  SS: 'Shortstop',
  LF: 'Left Field',
  CF: 'Center Field',
  RF: 'Right Field',
  BENCH: 'Bench',
};

export const NNLL_RULES = {
  REGULATION_INNINGS: 6,
  INFIELD_DEADLINE_INNING: 4, // Must have >= 1 infield inning by end of inning 4
  MAX_CONSECUTIVE_BENCH: 1,  // Max 1 consecutive inning on bench
  MAX_TOTAL_BENCH_6_INNINGS: 2, // Max 2 bench innings per player in 6-inning game (for rosters <= 12)
  PITCHER_CATCHER_MAX_PITCHES: 40, // 41+ pitches means cannot play catcher rest of game
  PITCHER_CATCHER_PITCH_THRESHOLD: 41, // Threshold that triggers prohibition
  CATCHER_PITCHER_MAX_INNINGS: 3,  // Catching 4+ innings means cannot pitch on that calendar day
  PITCH_WARNING_THRESHOLD: 35, // Visual warning threshold
  PITCH_HARD_CAPS: [
    { count: 20, label: '20 Pitches (0 Days Rest Threshold)' },
    { count: 35, label: '35 Pitches (1 Day Rest / Alert)' },
    { count: 41, label: '41 Pitches (Catcher Cap Barrier)' },
    { count: 50, label: '50 Pitches (2 Days Rest / Age 7-8 Max)' },
    { count: 65, label: '65 Pitches (3 Days Rest Threshold)' },
    { count: 75, label: '75 Pitches (Minor AAA Daily Max for league age 9-10)' },
    { count: 85, label: '85 Pitches (Max for league age 11-12)' },
    { count: 95, label: '95 Pitches (Max for league age 13-16)' },
  ]
};

/**
 * Official Little League Baseball Pitch Count & Rest Day Regulations (Regulation VI)
 */
export const LITTLE_LEAGUE_PITCH_RULES = {
  // Max pitches per day by age
  MAX_PITCHES_BY_AGE: [
    { minAge: 0, maxAge: 8, maxPitches: 50, label: 'League Age 6-8' },
    { minAge: 9, maxAge: 10, maxPitches: 75, label: 'League Age 9-10 (Minor AAA)' },
    { minAge: 11, maxAge: 12, maxPitches: 85, label: 'League Age 11-12 (Majors)' },
    { minAge: 13, maxAge: 16, maxPitches: 95, label: 'League Age 13-16 (Junior/Senior)' },
    { minAge: 17, maxAge: 99, maxPitches: 105, label: 'League Age 17+ (Challenger/Big League)' },
  ],
  DEFAULT_MAX_PITCHES: 75, // Default for Minor AAA (age 9-10)

  // Calendar days of rest tiers for League Age 14 and under
  REST_TIERS_14_UNDER: [
    { min: 66, max: Infinity, restDays: 4, label: '4 Calendar Days Rest' },
    { min: 51, max: 65, restDays: 3, label: '3 Calendar Days Rest' },
    { min: 36, max: 50, restDays: 2, label: '2 Calendar Days Rest' },
    { min: 21, max: 35, restDays: 1, label: '1 Calendar Day Rest' },
    { min: 1, max: 20, restDays: 0, label: '0 Days Rest (Eligible Tomorrow)' },
    { min: 0, max: 0, restDays: 0, label: '0 Pitches Thrown' },
  ],

  // Calendar days of rest tiers for League Age 15-16
  REST_TIERS_15_16: [
    { min: 76, max: Infinity, restDays: 4, label: '4 Calendar Days Rest' },
    { min: 61, max: 75, restDays: 3, label: '3 Calendar Days Rest' },
    { min: 46, max: 60, restDays: 2, label: '2 Calendar Days Rest' },
    { min: 31, max: 45, restDays: 1, label: '1 Calendar Day Rest' },
    { min: 1, max: 30, restDays: 0, label: '0 Days Rest (Eligible Tomorrow)' },
    { min: 0, max: 0, restDays: 0, label: '0 Pitches Thrown' },
  ],

  // Pitcher / Catcher crossover limits
  PITCHER_TO_CATCHER_MAX_PITCHES: 40, // 41+ pitches prohibits catching for rest of day
  PITCHER_TO_CATCHER_THRESHOLD: 41,
  CATCHER_TO_PITCHER_MAX_INNINGS: 3,  // 4+ innings caught prohibits pitching for day
  CATCHER_TO_PITCHER_RETURN_MAX_PITCHES_14_UNDER: 20, // Caught <=3 inn, pitches >=21 cannot return to C
  CATCHER_TO_PITCHER_RETURN_MAX_PITCHES_15_16: 30,    // Caught <=3 inn, pitches >=31 cannot return to C
  MAX_CONSECUTIVE_DAYS_PITCHING: 2, // Under no circumstance shall a player pitch 3 consecutive days
};

/**
 * Returns daily max pitch count for a given player age.
 * @param {number|string} age - Player age
 * @returns {number} Maximum allowable pitches per day
 */
export function getMaxPitchesForAge(age) {
  const numericAge = Number(age);
  if (!numericAge || isNaN(numericAge)) {
    return LITTLE_LEAGUE_PITCH_RULES.DEFAULT_MAX_PITCHES;
  }
  for (const tier of LITTLE_LEAGUE_PITCH_RULES.MAX_PITCHES_BY_AGE) {
    if (numericAge <= tier.maxAge) {
      return tier.maxPitches;
    }
  }
  return LITTLE_LEAGUE_PITCH_RULES.DEFAULT_MAX_PITCHES;
}

/**
 * Returns the rest tier object for a given pitch count and league age.
 * @param {number} pitches - Pitches thrown
 * @param {number} age - Player league age
 * @returns {Object} Rest tier configuration
 */
export function getRestTier(pitches, age = 10) {
  const numericPitches = Math.max(0, Number(pitches) || 0);
  const numericAge = Number(age) || 10;
  const tiers = numericAge >= 15
    ? LITTLE_LEAGUE_PITCH_RULES.REST_TIERS_15_16
    : LITTLE_LEAGUE_PITCH_RULES.REST_TIERS_14_UNDER;

  for (const tier of tiers) {
    if (numericPitches >= tier.min && numericPitches <= tier.max) {
      return tier;
    }
  }
  return tiers[tiers.length - 1];
}

/**
 * Computes comprehensive Little League rest day and workload metrics,
 * including threshold exception calculations and next eligible date.
 * @param {number} pitches - Current pitches thrown
 * @param {number} age - Player league age (default 10)
 * @param {number|null} atBatStartPitches - Pitch count when facing current batter began
 * @param {string|Date|null} gameDate - Date of the game (defaults to current date)
 * @returns {Object} Detailed pitch workload & rest analysis
 */
export function calculatePitchRestDetails(pitches, age = 10, atBatStartPitches = null, gameDate = null) {
  const count = Math.max(0, Number(pitches) || 0);
  const numericAge = Number(age) || 10;
  const maxPitches = getMaxPitchesForAge(numericAge);
  const actualTier = getRestTier(count, numericAge);

  // Threshold exception: if atBatStartPitches is provided and is strictly lower than current pitches
  const hasThreshold = atBatStartPitches !== null && atBatStartPitches !== undefined && atBatStartPitches < count;
  const thresholdTier = hasThreshold ? getRestTier(atBatStartPitches, numericAge) : actualTier;

  // Under Regulation VI(c) Note 2, rest is charged by the first pitch thrown to the batter
  const thresholdSavesRest = hasThreshold && thresholdTier.restDays < actualTier.restDays;
  const effectiveRestDays = thresholdSavesRest ? thresholdTier.restDays : actualTier.restDays;

  // Catcher eligibility under Rule VI(a)
  // Pitcher delivering 41+ pitches cannot catch.
  // Exception: If reached 40 pitches while facing batter and removed before facing next batter, can catch.
  const catcherProhibited = count >= LITTLE_LEAGUE_PITCH_RULES.PITCHER_TO_CATCHER_THRESHOLD;
  const catcherThresholdExceptionApplies = catcherProhibited && hasThreshold && atBatStartPitches <= LITTLE_LEAGUE_PITCH_RULES.PITCHER_TO_CATCHER_MAX_PITCHES;

  // Catcher to pitcher return limit (caught <= 3 innings, moved to pitcher)
  const returnCutoff = numericAge >= 15
    ? LITTLE_LEAGUE_PITCH_RULES.CATCHER_TO_PITCHER_RETURN_MAX_PITCHES_15_16
    : LITTLE_LEAGUE_PITCH_RULES.CATCHER_TO_PITCHER_RETURN_MAX_PITCHES_14_UNDER;
  const returnToCatchProhibited = count > returnCutoff;
  const returnToCatchThresholdApplies = returnToCatchProhibited && hasThreshold && atBatStartPitches <= returnCutoff;

  // Daily max threshold exception: reached daily max while facing batter
  const dailyMaxReached = count >= maxPitches;
  const dailyMaxThresholdExceptionApplies = dailyMaxReached && hasThreshold && atBatStartPitches < maxPitches;

  // Next eligible date calculation (Calendar days of rest)
  // E.g., 0 days rest -> eligible next day (baseDate + 1)
  // 1 day rest -> 1 calendar day between games -> eligible baseDate + 2
  // N days rest -> eligible baseDate + (N + 1)
  const baseDate = gameDate ? new Date(gameDate) : new Date();
  const nextDate = new Date(baseDate.getTime());
  nextDate.setDate(nextDate.getDate() + effectiveRestDays + 1);

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedNextEligibleDate = `${daysOfWeek[nextDate.getDay()]}, ${months[nextDate.getMonth()]} ${nextDate.getDate()}`;

  return {
    pitches: count,
    age: numericAge,
    maxPitches,
    pitchesRemaining: Math.max(0, maxPitches - count),
    isDailyMaxReached: dailyMaxReached,
    dailyMaxThresholdExceptionApplies,
    restDays: effectiveRestDays,
    actualRestDays: actualTier.restDays,
    restDaysText: actualTier.label,
    effectiveRestDaysText: thresholdTier.label,
    thresholdStartPitches: hasThreshold ? atBatStartPitches : count,
    thresholdExceptionActive: thresholdSavesRest || catcherThresholdExceptionApplies || returnToCatchThresholdApplies || dailyMaxThresholdExceptionApplies,
    thresholdSavesRest,
    restDaysSaved: Math.max(0, actualTier.restDays - effectiveRestDays),
    canPlayCatcher: !catcherProhibited || catcherThresholdExceptionApplies,
    catcherProhibited,
    catcherThresholdExceptionApplies,
    canReturnToCatcher: !returnToCatchProhibited || returnToCatchThresholdApplies,
    nextEligibleDate: nextDate,
    formattedNextEligibleDate,
  };
}

/**
 * League Administrative & Manager Configuration
 */
export const LEAGUE_CONFIG = {
  ORGANIZATION_NAME: 'North Natomas Little League (NNLL)',
  DIVISION: 'Minor AAA',
  SEASON: 'Spring 2026',
  MAX_TEAMS_PER_MANAGER: 1,
  ENFORCE_ONE_TEAM_PER_MANAGER: true,
  ALLOW_MANAGER_TRANSFER: false, // Strict: coach is bound to their designated team
  DESIGNATED_MANAGERS: {
    'mcollinswork6@gmail.com': {
      teamId: 'team-black-bats-6589',
      teamName: 'Black Bats',
      headCoach: 'Coach Collins',
      exclusive: true, // mcollinswork6@gmail.com can manage Black Bats ONLY
    }
  },
  SUPER_ADMINS: [
    'matthew.h.collins6@gmail.com'
  ],
  POLICY_STATEMENT: 'A manager can only manage one team and be the admin for one team in the division. Super Admins have league-wide administrative access.'
};

/**
 * Super Administrator List (Commissioners with access to all teams and user invitation rights)
 */
export const SUPER_ADMIN_EMAILS = [
  'matthew.h.collins6@gmail.com'
];

/**
 * Checks whether an email belongs to a Super User Admin.
 */
export function isSuperAdmin(email) {
  if (!email) return false;
  const key = String(email).trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.includes(key) || (Array.isArray(LEAGUE_CONFIG.SUPER_ADMINS) && LEAGUE_CONFIG.SUPER_ADMINS.includes(key));
}

/**
 * League Roles available for user invitations
 */
export const LEAGUE_ROLES = [
  { id: 'manager', label: '👑 Head Coach & Team Manager', description: 'Full administrative control over assigned team and roster' },
  { id: 'assistant', label: '⚾ Assistant Coach', description: 'Can view roster, plan lineups, and run game rotations' },
  { id: 'scorekeeper', label: '📝 Dugout Scorekeeper', description: 'Tracks live game pitch counts, outs, and runs' },
  { id: 'super_admin', label: '🛡️ League Commissioner / Super Admin', description: 'Full access to all teams, rosters, records, and invitations' },
];

/**
 * Returns the designated team configuration for a manager by email.
 */
export function getDesignatedManagerConfig(email) {
  if (!email) return null;
  const key = String(email).trim().toLowerCase();
  return LEAGUE_CONFIG.DESIGNATED_MANAGERS[key] || null;
}

