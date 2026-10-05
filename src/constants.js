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
    { count: 35, label: '35 Pitches (Rest Alert / Warning)' },
    { count: 41, label: '41 Pitches (Catcher Cap Barrier)' },
    { count: 50, label: '50 Pitches (Threshold 2)' },
    { count: 65, label: '65 Pitches (Threshold 3)' },
    { count: 75, label: '75 Pitches (Minor AAA Daily Max for league age 9-10)' },
    { count: 85, label: '85 Pitches (Max for league age 11-12)' },
  ]
};

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

