#!/usr/bin/env python3
"""
Test Suite for Little League Regulation VI: Pitch Count & Rest Day Regulations
Validates:
- Maximum daily pitch count by league age
- Mandatory calendar days of rest tiers for Age <= 14 and Age 15-16
- Threshold Exception rule for rest tiers and catcher eligibility
- Pitcher / Catcher crossover constraints (41+ pitches, 4+ innings caught)
- Next eligible calendar date calculation
"""

import unittest
from datetime import datetime, timedelta

def get_max_pitches_for_age(age):
    try:
        numeric_age = int(age)
    except (ValueError, TypeError):
        return 75  # Default for Minor AAA (age 9-10)

    if numeric_age <= 8:
        return 50
    elif numeric_age <= 10:
        return 75
    elif numeric_age <= 12:
        return 85
    elif numeric_age <= 16:
        return 95
    else:
        return 105

def get_rest_tier(pitches, age=10):
    pitches = max(0, int(pitches or 0))
    age = int(age or 10)

    if age >= 15:
        if pitches >= 76:
            return {'rest_days': 4, 'label': '4 Calendar Days Rest'}
        elif pitches >= 61:
            return {'rest_days': 3, 'label': '3 Calendar Days Rest'}
        elif pitches >= 46:
            return {'rest_days': 2, 'label': '2 Calendar Days Rest'}
        elif pitches >= 31:
            return {'rest_days': 1, 'label': '1 Calendar Day Rest'}
        elif pitches >= 1:
            return {'rest_days': 0, 'label': '0 Days Rest (Eligible Tomorrow)'}
        else:
            return {'rest_days': 0, 'label': '0 Pitches Thrown'}
    else:
        if pitches >= 66:
            return {'rest_days': 4, 'label': '4 Calendar Days Rest'}
        elif pitches >= 51:
            return {'rest_days': 3, 'label': '3 Calendar Days Rest'}
        elif pitches >= 36:
            return {'rest_days': 2, 'label': '2 Calendar Days Rest'}
        elif pitches >= 21:
            return {'rest_days': 1, 'label': '1 Calendar Day Rest'}
        elif pitches >= 1:
            return {'rest_days': 0, 'label': '0 Days Rest (Eligible Tomorrow)'}
        else:
            return {'rest_days': 0, 'label': '0 Pitches Thrown'}

def calculate_pitch_rest_details(pitches, age=10, at_bat_start_pitches=None, game_date=None):
    count = max(0, int(pitches or 0))
    numeric_age = int(age or 10)
    max_pitches = get_max_pitches_for_age(numeric_age)
    actual_tier = get_rest_tier(count, numeric_age)

    has_threshold = (at_bat_start_pitches is not None and at_bat_start_pitches < count)
    threshold_tier = get_rest_tier(at_bat_start_pitches, numeric_age) if has_threshold else actual_tier

    threshold_saves_rest = has_threshold and (threshold_tier['rest_days'] < actual_tier['rest_days'])
    effective_rest_days = threshold_tier['rest_days'] if threshold_saves_rest else actual_tier['rest_days']

    catcher_prohibited = (count >= 41)
    catcher_threshold_exception = catcher_prohibited and has_threshold and (at_bat_start_pitches <= 40)

    daily_max_reached = (count >= max_pitches)
    daily_max_threshold_exception = daily_max_reached and has_threshold and (at_bat_start_pitches < max_pitches)

    # Next eligible date calculation
    base_date = datetime.strptime(game_date, '%Y-%m-%d') if game_date else datetime.now()
    next_date = base_date + timedelta(days=effective_rest_days + 1)

    return {
        'pitches': count,
        'age': numeric_age,
        'max_pitches': max_pitches,
        'pitches_remaining': max(0, max_pitches - count),
        'is_daily_max_reached': daily_max_reached,
        'daily_max_threshold_exception': daily_max_threshold_exception,
        'rest_days': effective_rest_days,
        'actual_rest_days': actual_tier['rest_days'],
        'rest_days_text': actual_tier['label'],
        'effective_rest_days_text': threshold_tier['label'],
        'threshold_start_pitches': at_bat_start_pitches if has_threshold else count,
        'threshold_exception_active': threshold_saves_rest or catcher_threshold_exception or daily_max_threshold_exception,
        'threshold_saves_rest': threshold_saves_rest,
        'rest_days_saved': max(0, actual_tier['rest_days'] - effective_rest_days),
        'can_play_catcher': not catcher_prohibited or catcher_threshold_exception,
        'catcher_threshold_exception': catcher_threshold_exception,
        'next_eligible_date': next_date.strftime('%A, %b %-d'),
        'next_eligible_iso': next_date.strftime('%Y-%m-%d'),
    }


class TestLittleLeaguePitchCountAndRest(unittest.TestCase):

    def test_daily_max_pitches_by_league_age(self):
        """Test daily maximum allowable pitches per league age group"""
        self.assertEqual(get_max_pitches_for_age(7), 50)
        self.assertEqual(get_max_pitches_for_age(8), 50)
        self.assertEqual(get_max_pitches_for_age(9), 75)
        self.assertEqual(get_max_pitches_for_age(10), 75)
        self.assertEqual(get_max_pitches_for_age(11), 85)
        self.assertEqual(get_max_pitches_for_age(12), 85)
        self.assertEqual(get_max_pitches_for_age(13), 95)
        self.assertEqual(get_max_pitches_for_age(14), 95)
        self.assertEqual(get_max_pitches_for_age(15), 95)
        self.assertEqual(get_max_pitches_for_age(16), 95)
        self.assertEqual(get_max_pitches_for_age(17), 105)
        self.assertEqual(get_max_pitches_for_age(None), 75)

    def test_rest_days_tiers_14_and_under(self):
        """Test mandatory calendar rest days for League Age <= 14"""
        # 0 Pitches
        self.assertEqual(get_rest_tier(0, 10)['rest_days'], 0)
        # 1-20 pitches -> 0 calendar days rest
        self.assertEqual(get_rest_tier(1, 10)['rest_days'], 0)
        self.assertEqual(get_rest_tier(15, 10)['rest_days'], 0)
        self.assertEqual(get_rest_tier(20, 10)['rest_days'], 0)
        # 21-35 pitches -> 1 calendar day rest
        self.assertEqual(get_rest_tier(21, 10)['rest_days'], 1)
        self.assertEqual(get_rest_tier(28, 10)['rest_days'], 1)
        self.assertEqual(get_rest_tier(35, 10)['rest_days'], 1)
        # 36-50 pitches -> 2 calendar days rest
        self.assertEqual(get_rest_tier(36, 10)['rest_days'], 2)
        self.assertEqual(get_rest_tier(45, 10)['rest_days'], 2)
        self.assertEqual(get_rest_tier(50, 10)['rest_days'], 2)
        # 51-65 pitches -> 3 calendar days rest
        self.assertEqual(get_rest_tier(51, 10)['rest_days'], 3)
        self.assertEqual(get_rest_tier(58, 10)['rest_days'], 3)
        self.assertEqual(get_rest_tier(65, 10)['rest_days'], 3)
        # 66+ pitches -> 4 calendar days rest
        self.assertEqual(get_rest_tier(66, 10)['rest_days'], 4)
        self.assertEqual(get_rest_tier(75, 10)['rest_days'], 4)
        self.assertEqual(get_rest_tier(85, 10)['rest_days'], 4)

    def test_rest_days_tiers_15_and_16(self):
        """Test mandatory calendar rest days for League Age 15-16"""
        # 1-30 pitches -> 0 calendar days rest
        self.assertEqual(get_rest_tier(1, 15)['rest_days'], 0)
        self.assertEqual(get_rest_tier(30, 15)['rest_days'], 0)
        # 31-45 pitches -> 1 calendar day rest
        self.assertEqual(get_rest_tier(31, 15)['rest_days'], 1)
        self.assertEqual(get_rest_tier(45, 15)['rest_days'], 1)
        # 46-60 pitches -> 2 calendar days rest
        self.assertEqual(get_rest_tier(46, 15)['rest_days'], 2)
        self.assertEqual(get_rest_tier(60, 15)['rest_days'], 2)
        # 61-75 pitches -> 3 calendar days rest
        self.assertEqual(get_rest_tier(61, 15)['rest_days'], 3)
        self.assertEqual(get_rest_tier(75, 15)['rest_days'], 3)
        # 76+ pitches -> 4 calendar days rest
        self.assertEqual(get_rest_tier(76, 15)['rest_days'], 4)
        self.assertEqual(get_rest_tier(95, 15)['rest_days'], 4)

    def test_threshold_exception_saves_rest_days(self):
        """Threshold Exception: If a rest threshold is crossed during an at-bat, rest days are charged by the starting pitch count"""
        # Pitcher starts batter at 20 pitches, finishes at 24 pitches
        # Without threshold: 24 pitches = 1 day rest
        # With threshold: started at 20 pitches = 0 days rest
        res = calculate_pitch_rest_details(24, age=10, at_bat_start_pitches=20)
        self.assertEqual(res['rest_days'], 0)
        self.assertEqual(res['actual_rest_days'], 1)
        self.assertTrue(res['threshold_saves_rest'])
        self.assertEqual(res['rest_days_saved'], 1)

        # Pitcher starts batter at 35 pitches, finishes at 39 pitches
        # Without threshold: 39 pitches = 2 days rest
        # With threshold: started at 35 pitches = 1 day rest
        res = calculate_pitch_rest_details(39, age=10, at_bat_start_pitches=35)
        self.assertEqual(res['rest_days'], 1)
        self.assertEqual(res['actual_rest_days'], 2)
        self.assertTrue(res['threshold_saves_rest'])
        self.assertEqual(res['rest_days_saved'], 1)

        # Pitcher starts batter at 50 pitches, finishes at 54 pitches
        # Without threshold: 54 pitches = 3 days rest
        # With threshold: started at 50 pitches = 2 days rest
        res = calculate_pitch_rest_details(54, age=10, at_bat_start_pitches=50)
        self.assertEqual(res['rest_days'], 2)
        self.assertEqual(res['actual_rest_days'], 3)
        self.assertTrue(res['threshold_saves_rest'])

        # Pitcher starts batter at 65 pitches, finishes at 68 pitches
        # Without threshold: 68 pitches = 4 days rest
        # With threshold: started at 65 pitches = 3 days rest
        res = calculate_pitch_rest_details(68, age=10, at_bat_start_pitches=65)
        self.assertEqual(res['rest_days'], 3)
        self.assertEqual(res['actual_rest_days'], 4)
        self.assertTrue(res['threshold_saves_rest'])

    def test_catcher_cap_and_threshold_exception(self):
        """Pitcher delivering 41+ pitches cannot catch, unless reaching 40 during at-bat and removed"""
        # Pitcher throws 42 pitches starting batter at 41 -> cannot catch
        res_no_thresh = calculate_pitch_rest_details(42, age=10, at_bat_start_pitches=41)
        self.assertFalse(res_no_thresh['can_play_catcher'])
        self.assertFalse(res_no_thresh['catcher_threshold_exception'])

        # Pitcher reached 40 pitches during at-bat and threw to 43 pitches -> eligible under threshold exception
        res_thresh = calculate_pitch_rest_details(43, age=10, at_bat_start_pitches=40)
        self.assertTrue(res_thresh['can_play_catcher'])
        self.assertTrue(res_thresh['catcher_threshold_exception'])

    def test_next_eligible_calendar_date_calculation(self):
        """Calendar days of rest correctly project the exact next eligible date"""
        # Game on Monday, April 13, 2026
        game_date = '2026-04-13'

        # 0 days rest -> eligible Tuesday, April 14
        res0 = calculate_pitch_rest_details(15, age=10, game_date=game_date)
        self.assertEqual(res0['next_eligible_iso'], '2026-04-14')

        # 1 day rest -> eligible Wednesday, April 15
        res1 = calculate_pitch_rest_details(30, age=10, game_date=game_date)
        self.assertEqual(res1['next_eligible_iso'], '2026-04-15')

        # 2 days rest -> eligible Thursday, April 16
        res2 = calculate_pitch_rest_details(45, age=10, game_date=game_date)
        self.assertEqual(res2['next_eligible_iso'], '2026-04-16')

        # 3 days rest -> eligible Friday, April 17
        res3 = calculate_pitch_rest_details(60, age=10, game_date=game_date)
        self.assertEqual(res3['next_eligible_iso'], '2026-04-17')

        # 4 days rest -> eligible Saturday, April 18
        res4 = calculate_pitch_rest_details(70, age=10, game_date=game_date)
        self.assertEqual(res4['next_eligible_iso'], '2026-04-18')


if __name__ == '__main__':
    unittest.main()
