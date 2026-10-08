# NNLL Minor AAA Roster & Dugout Optimizer ⚾

An offline-first dugout management web application designed to automate defensive rotations, manage continuous batting orders (CBO), and guarantee strict compliance with **North Natomas Little League (NNLL)** Minor AAA baseball regulations.

---

## 🚀 Key Features

### 1. Hard Constraint & Rule Enforcement
- **Continuous Batting Order (CBO)**: Fixed lineup; late arrivals are appended to the bottom; injured or departed players are skipped without automatic out penalty; 8-player teams skip the 9th slot without penalty.
- **Mandatory Defensive Play**:
  - Maximum of **1 consecutive inning on the bench** (no back-to-back benching).
  - Maximum of **2 total bench innings** across a regulation 6-inning game.
  - **Infield by 4th Inning Requirement**: Every player must play at least 1 full defensive inning at an infield position (P, C, 1B, 2B, 3B, SS) by the end of Inning 4.
- **Pitcher & Catcher Interaction Rules**:
  - **41+ Pitch Cap**: Any pitcher delivering 41 or more pitches is ineligible to catch for the remainder of that game.
  - **4-Inning Catcher Cap**: Any player who catches 4 or more innings cannot pitch on that calendar day.
  - **Mound Removal**: Once removed from the mound, a player cannot return to pitch in that game.
- **Safety Tags**: Respects player tags (`canPitch`, `canCatch`).

### 2. Algorithmic Backtracking CSP Solver & Dynamic Re-Solver
- Solves an optimal 6-inning defensive matrix satisfying all hard constraints while equalizing bench time and infield/outfield balance.
- **Immutable Historical Locking**: Completed and active innings ($1 \dots K$) are locked as immutable.
- **Emergency Infield Allocation**: Automatically locks players with 0 infield innings into Inning 4 infield slots before solving downstream frames.
- **Event-Driven Dynamic Re-Solve**: Rebalances unplayed innings ($K+1 \dots 6$) upon late arrivals, player departures/injuries, or pitch count caps.

### 3. Dugout Touch Interface
- **High-Contrast Outdoor Theme**: Optimized for tablet & mobile screen visibility under direct sunlight.
- **Interactive Two-Tap & Drag Swapping**: Instantly swap player positions within an inning with live validation feedback.
- **Live Pitch Counter**: Touch buttons (+1, +3, undo), threshold progress bar (35, 41, 50, 65, 85), and automatic catcher restriction warnings.
- **2-Out Catcher Courtesy Runner Alert**: Automatically detects 2 outs and displays the exact eligible courtesy runner (the batter who made the last out).
- **1-Page Printable Lineup Card**: Clean `@media print` layout formatting the continuous batting order, defensive rotation grid, and pitch log on a single printable sheet.
- **Offline First**: Uses IndexedDB with LocalStorage fallback for zero-network dugout reliability.

---

## 📂 Project Structure

```
├── index.html                 # Application entry page & Firebase import map
├── css/
│   └── styles.css             # High-contrast dugout theme, auth overlay, & print styling
├── src/
│   ├── firebase-config.js     # Firebase configuration template & credential validator
│   ├── auth.js                # Firebase Auth service (Google, Email/Password, reset, field mode)
│   ├── auth-ui.js             # Fullscreen coach authentication portal overlay & modals
│   ├── constants.js           # NNLL rules, position lists, and pitch thresholds
│   ├── rules.js               # Rule validator & player statistics calculator
│   ├── solver.js              # Backtracking CSP solver & dynamic re-solver
│   ├── team-storage.js        # Firebase Firestore database adapter (teams, rosters, cumulative stats)
│   ├── team-manager-ui.js     # Team switcher, roster editor, cumulative stats modal & explorer
│   ├── state.js               # GameStateManager (CBO, outs, pitches, undo/redo)
│   ├── storage.js             # IndexedDB & LocalStorage persistence adapter
│   ├── sample-data.js         # Pre-configured NNLL team rosters (8 to 12 players)
│   ├── ui.js                  # Matrix grid rendering, coach profile widget, & modals
│   └── app.js                 # App bootstrapper with auth guard & team loader
├── tests/
│   └── test_rules_and_solver.py # Python test suite for rules & CSP engine
└── README.md
```

---

## ⚾ Team Organization & Firebase Firestore Architecture

Dugout Admin organizes all team profiles, rosters, games, and cumulative stats purely via **Firebase Firestore** (no Google Cloud Storage or CORS bucket configuration required):

```
Firestore:
├── Collection: teams
│   └── Document: {teamId}
│         ├── profile:  { teamName, division, season, headCoach, opponentName }
│         ├── roster:   [ player profiles & safety tags (jersey, firstName, lastName, canPitch, canCatch) ]
│         ├── stats:    { cumulative innings, pitches, violations }
│         └── games:    { archived game snapshots & rotation matrices }
└── Collection: app_settings
    └── Document: teams_registry (Catalog of teams & active team pointer)
```

### Features:
- **100% Pure Firebase**: Communicates natively from web browsers without any Google Cloud CORS preflight errors.
- **Team Switching & Management**: Click **"👥 Teams & Stats"** in the header to switch teams or create new teams.
- **Roster & Safety Tag Editor**: Add players, edit active roster tuples, assign jersey numbers, and toggle safety eligibility (`canPitch`, `canCatch`).
- **Cumulative Season Tracking**: Automatically aggregates player stats across games (Infield, Outfield, Bench innings, Pitches thrown, Infield-by-4 compliance).
- **Zero-Network Dugout Reliability**: Transparently mirrors all data to LocalStorage so coaches on the field have uninterrupted access even without internet.

---

## 🔐 Firebase Authentication Setup

Dugout Admin includes a full authentication portal supporting **Google Sign-In** and **Email & Password** authentication, plus a zero-network **Dugout Field Mode** for coaches at the field.

### Quick Setup:
1. Open [Firebase Console](https://console.firebase.google.com/) and create or select your project.
2. Under **Project Settings > General > Your Apps**, create a Web App and copy the config.
3. Under **Authentication > Sign-in method**:
   - Enable **Email/Password**
   - Enable **Google** (set support email and ensure `localhost` is in Authorized Domains)
4. Either:
   - Edit [firebase-config.js](file:///Users/matthewcollins/Documents/antigravity/dugout_admin/src/firebase-config.js) and paste your keys into `firebaseConfig`, OR
   - Click **"⚙️ Connect Firebase Credentials"** in the app's login portal footer to paste your JSON directly!

---

## 🏃‍♂️ How to Run

### Option 1: Open in Any Web Browser
Because this application uses standard ES Modules and client-side web technologies, you can open `index.html` directly in modern web browsers or host it with a local static server:

```bash
# Using Python 3 built-in HTTP server:
python3 -m http.server 8000
```
Then navigate to `http://localhost:8000` on your computer, iPad, or mobile device.

### Option 2: Run Automated Tests
```bash
python3 tests/test_rules_and_solver.py
```

---

## 📋 Rule Compliance Reference Matrix

| Rule | Constraint Type | Description |
| :--- | :--- | :--- |
| **Max Consecutive Bench** | Hard | Player cannot sit on bench $\ge 2$ consecutive innings |
| **Max Total Bench** | Hard | Player benched at most 2 times in 6 innings (3 for 13+ rosters) |
| **Infield by Inning 4** | Hard | Every player must play $\ge 1$ infield inning in innings 1–4 |
| **Pitcher $\ge 41$ Pitches** | Hard | Cannot play Catcher for remainder of game |
| **Catcher $\ge 4$ Innings** | Hard | Ineligible to pitch on that calendar day |
| **Mound Removal** | Hard | Once removed from pitcher, cannot return to pitch |
| **Continuous Batting Order** | Hard | Late arrivals bat at end; injured skipped without penalty |
| **2-Out Courtesy Runner** | Hard/Procedure | Applies with 2 outs and Catcher on base; runner is last out |
| **Bench & Field Balance** | Soft | Equal distribution of bench innings and varied positions |
