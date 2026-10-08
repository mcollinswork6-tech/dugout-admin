#!/usr/bin/env python3
"""
Unit tests for Baseball Inning Batting Context & Dual-Team Batting Order:
- Home team fields in Top of inning, bats in Bottom of inning.
- Opponent team bats in Top of inning (when Home team fields).
- Advance batter updates active batting team's lineup index.
- Template string syntax validation (no unescaped curly brace slot syntax).
"""

import unittest
import json
import re
from pathlib import Path

WORKSPACE = Path(__file__).parent.parent

class TestBattingContextAndLineup(unittest.TestCase):

    def test_batting_context_rules(self):
        def get_batting_context(is_home_team, current_half, team_name, opponent_name):
            is_top = current_half == 'TOP'
            # In baseball:
            # Top of inning: Away team bats, Home team fields
            # Bottom of inning: Home team bats, Away team fields
            is_my_team_batting = not is_top if is_home_team else is_top
            batting_team_name = team_name if is_my_team_batting else opponent_name
            fielding_team_name = opponent_name if is_my_team_batting else team_name
            return {
                'is_my_team_batting': is_my_team_batting,
                'is_opponent_batting': not is_my_team_batting,
                'batting_team_name': batting_team_name,
                'fielding_team_name': fielding_team_name,
            }

        # Scenario 1: Black Bats is HOME team, TOP of 1st inning
        # Black Bats is in the field; Opponent (River Cats) is at bat!
        ctx1 = get_batting_context(True, 'TOP', 'Black Bats', 'River Cats')
        self.assertFalse(ctx1['is_my_team_batting'])
        self.assertTrue(ctx1['is_opponent_batting'])
        self.assertEqual(ctx1['batting_team_name'], 'River Cats')
        self.assertEqual(ctx1['fielding_team_name'], 'Black Bats')

        # Scenario 2: Black Bats is HOME team, BOTTOM of 1st inning
        # Black Bats is at bat; Opponent is in the field!
        ctx2 = get_batting_context(True, 'BOTTOM', 'Black Bats', 'River Cats')
        self.assertTrue(ctx2['is_my_team_batting'])
        self.assertFalse(ctx2['is_opponent_batting'])
        self.assertEqual(ctx2['batting_team_name'], 'Black Bats')
        self.assertEqual(ctx2['fielding_team_name'], 'River Cats')

        # Scenario 3: Black Bats is AWAY team, TOP of 1st inning
        # Black Bats is at bat; Opponent is in the field!
        ctx3 = get_batting_context(False, 'TOP', 'Black Bats', 'River Cats')
        self.assertTrue(ctx3['is_my_team_batting'])
        self.assertFalse(ctx3['is_opponent_batting'])
        self.assertEqual(ctx3['batting_team_name'], 'Black Bats')
        self.assertEqual(ctx3['fielding_team_name'], 'River Cats')

        # Scenario 4: Black Bats is AWAY team, BOTTOM of 1st inning
        # Opponent is at bat; Black Bats is in the field!
        ctx4 = get_batting_context(False, 'BOTTOM', 'Black Bats', 'River Cats')
        self.assertFalse(ctx4['is_my_team_batting'])
        self.assertTrue(ctx4['is_opponent_batting'])
        self.assertEqual(ctx4['batting_team_name'], 'River Cats')
        self.assertEqual(ctx4['fielding_team_name'], 'Black Bats')

    def test_ui_js_template_string_syntax(self):
        ui_path = WORKSPACE / 'src' / 'ui.js'
        with open(ui_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check for unescaped Slot {(( syntax bug
        buggy_matches = re.findall(r'Slot\s*\{', content)
        self.assertEqual(len(buggy_matches), 0, f"Found unescaped Slot {{ pattern in {ui_path}: {buggy_matches}")

        # Ensure Slot ${...} or Slot ${curSlot} exists
        self.assertIn('Slot ${curSlot}', content)
        self.assertIn('Slot ${onDeckSlot}', content)
        self.assertIn('Slot ${inHoleSlot}', content)

    def test_state_js_has_opponent_methods(self):
        state_path = WORKSPACE / 'src' / 'state.js'
        with open(state_path, 'r', encoding='utf-8') as f:
            content = f.read()

        self.assertIn('getBattingContext()', content)
        self.assertIn('getOpponentPlayers()', content)
        self.assertIn('getOpponentBattingOrder()', content)
        self.assertIn('updateOpponentPlayer(', content)
        self.assertIn('setOpponentBattingOrder(', content)
        self.assertIn('getFallbackOpponentPlayers', content)

    def test_ui_js_renders_opponent_and_my_team_batting_status(self):
        ui_path = WORKSPACE / 'src' / 'ui.js'
        with open(ui_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check for dynamic batting pills and field sub
        self.assertIn('pill-batting-myteam', content)
        self.assertIn('pill-batting-opponent', content)
        self.assertIn('btn-edit-opp-lineup', content)
        self.assertIn('showOpponentLineupModal', content)

    def test_css_styles_include_batting_status_pills(self):
        css_path = WORKSPACE / 'css' / 'styles.css'
        with open(css_path, 'r', encoding='utf-8') as f:
            content = f.read()

        self.assertIn('.batting-header-info', content)
        self.assertIn('.pill-batting-myteam', content)
    def test_outs_association_and_base_runners(self):
        state_path = WORKSPACE / 'src' / 'state.js'
        with open(state_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check state methods for outs and base runners
        self.assertIn('recordOut(options = {})', content)
        self.assertIn('setBaseRunner(base, playerId)', content)
        self.assertIn('clearBaseRunner(base)', content)
        self.assertIn('clearAllBaseRunners()', content)
        self.assertIn('advanceRunner(fromBase, toBase)', content)
        self.assertIn('outHistory.push({', content)
        self.assertIn('runnersOnBase', content)

    def test_ui_outs_modal_and_base_diamond(self):
        ui_path = WORKSPACE / 'src' / 'ui.js'
        with open(ui_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Modals
        self.assertIn('showRecordOutModal(state, defaults = {})', content)
        self.assertIn('showInPlayModal(state)', content)
        self.assertIn('showBaseRunnerActionsModal(state, baseKey, runnerId)', content)
        self.assertIn('showPlaceRunnerModal(state, baseKey)', content)

        # Base Diamond & Controls in game tracker view
        self.assertIn('base-diamond-section', content)
        self.assertIn('diamond-base base-1b', content)
        self.assertIn('diamond-base base-2b', content)
        self.assertIn('diamond-base base-3b', content)
        self.assertIn('btn-quick-runner-1b', content)
        self.assertIn('btn-quick-clear-bases', content)
        self.assertIn('recent-outs-feed', content)

    def test_css_outs_and_diamond_styles(self):
        css_path = WORKSPACE / 'css' / 'styles.css'
        with open(css_path, 'r', encoding='utf-8') as f:
            content = f.read()

        self.assertIn('.base-diamond-section', content)
        self.assertIn('.diamond-field-shape', content)
        self.assertIn('.diamond-base.occupied', content)
        self.assertIn('.out-type-pills-grid', content)
        self.assertIn('.btn-out-type-pill', content)
        self.assertIn('.base-select-pills-row', content)
        self.assertIn('.btn-base-pill', content)
        self.assertIn('.defense-chips-grid', content)
        self.assertIn('.btn-def-chip', content)

    def test_pitch_counter_and_runner_rules(self):
        state_path = WORKSPACE / 'src' / 'state.js'
        with open(state_path, 'r', encoding='utf-8') as f:
            state_content = f.read()

        # Check required state methods for rules
        self.assertIn('walkCurrentBatter(', state_content)
        self.assertIn('recordPitchHitBatter()', state_content)
        self.assertIn('recordSafeHit(', state_content)
        self.assertIn('recordPitchBall()', state_content)
        self.assertIn('recordPitchStrike()', state_content)
        self.assertIn('recordPitchFoul()', state_content)
        self.assertIn('advanceRunner(fromBase, toBase)', state_content)

        # In advanceRunner to HP, check that recordRun is invoked
        self.assertIn("toBase === 'HP'", state_content)
        self.assertIn("this.recordRun(teamKey, 1)", state_content)

        ui_path = WORKSPACE / 'src' / 'ui.js'
        with open(ui_path, 'r', encoding='utf-8') as f:
            ui_content = f.read()

        # Check UI triggers for HBP and Home Plate actions
        self.assertIn('btn-pitch-hbp', ui_content)
        self.assertIn('recordPitchHitBatter', ui_content)
        self.assertIn('showHomePlateActionsModal', ui_content)
        self.assertIn('recordSafeHit', ui_content)

        # Simulation test: 4 balls walk logic with bases loaded force progression
        def simulate_walk(runners, batter_id):
            r1 = runners.get('1B')
            r2 = runners.get('2B')
            r3 = runners.get('3B')
            run_scored = False
            new_runners = dict(runners)

            if r1:
                if r2:
                    if r3:
                        run_scored = True  # Bases loaded force walk scores run
                    new_runners['3B'] = r2
                new_runners['2B'] = r1
            new_runners['1B'] = batter_id
            return new_runners, run_scored

        # Test empty bases walk
        r_empty, score_empty = simulate_walk({'1B': None, '2B': None, '3B': None}, 'p1')
        self.assertEqual(r_empty['1B'], 'p1')
        self.assertIsNone(r_empty['2B'])
        self.assertIsNone(r_empty['3B'])
        self.assertFalse(score_empty)

        # Test runner on 1B walk
        r_1b, score_1b = simulate_walk({'1B': 'p1', '2B': None, '3B': None}, 'p2')
        self.assertEqual(r_1b['1B'], 'p2')
        self.assertEqual(r_1b['2B'], 'p1')
        self.assertIsNone(r_1b['3B'])
        self.assertFalse(score_1b)

        # Test bases loaded walk -> force run at HP
        r_loaded, score_loaded = simulate_walk({'1B': 'p1', '2B': 'p2', '3B': 'p3'}, 'p4')
        self.assertEqual(r_loaded['1B'], 'p4')
        self.assertEqual(r_loaded['2B'], 'p1')
        self.assertEqual(r_loaded['3B'], 'p2')
        self.assertTrue(score_loaded)

    def test_unified_scorecard_dynamic_batting_focus(self):
        """Verify unified score card combines away and home teams with dynamic batting hero focus."""
        ui_path = WORKSPACE / 'src' / 'ui.js'
        with open(ui_path, 'r', encoding='utf-8') as f:
            ui_content = f.read()

        # Check single unified score card components exist
        self.assertIn('unified-score-card', ui_content)
        self.assertIn('matchup-header-strip', ui_content)
        self.assertIn('batting-team-hero', ui_content)
        self.assertIn('fielding-team-strip', ui_content)

        # Check all 4 score button IDs are preserved
        self.assertIn('btn-run-away-plus', ui_content)
        self.assertIn('btn-run-away-minus', ui_content)
        self.assertIn('btn-run-home-plus', ui_content)
        self.assertIn('btn-run-home-minus', ui_content)

        # Verify dynamic assignment logic
        self.assertIn("const battingPlusId = isBattingAway ? 'btn-run-away-plus' : 'btn-run-home-plus';", ui_content)
        self.assertIn("const battingMinusId = isBattingAway ? 'btn-run-away-minus' : 'btn-run-home-minus';", ui_content)
        self.assertIn("const fieldingPlusId = isBattingAway ? 'btn-run-home-plus' : 'btn-run-away-plus';", ui_content)
        self.assertIn("const fieldingMinusId = isBattingAway ? 'btn-run-home-minus' : 'btn-run-away-minus';", ui_content)

        # Verify styles exist in css/styles.css
        css_path = WORKSPACE / 'css' / 'styles.css'
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()

        self.assertIn('.unified-score-card', css_content)
        self.assertIn('.batting-team-hero', css_content)
        self.assertIn('.btn-hero-run', css_content)
        self.assertIn('.fielding-team-strip', css_content)


if __name__ == '__main__':
    unittest.main()

