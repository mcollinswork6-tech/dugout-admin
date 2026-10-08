#!/usr/bin/env python3
"""
Unit tests for Player JSON Schema & Active Roster Tuple Editing
Validates:
1. JSON schema: jersey, Player First Name, Player Last name, Can Pitch flag, can catch flag
2. Removal of can play 1B
3. Editing Active Roster tuples after input (not just removal)
"""

import unittest
import json

def normalize_player(p):
    """Python mirror of JavaScript normalizePlayer()"""
    jersey = int(p.get('jersey', p.get('jerseyNumber', p.get('Jersey', 0))))
    first_name = p.get('firstName', p.get('Player First Name', p.get('first_name', '')))
    last_name = p.get('lastName', p.get('Player Last name', p.get('Player Last Name', p.get('last_name', ''))))

    if not first_name and not last_name and p.get('name'):
        parts = p['name'].strip().split()
        first_name = parts[0] if parts else ''
        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

    first_name = str(first_name).strip()
    last_name = str(last_name).strip()
    full_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else (p.get('name') or '')

    raw_age = p.get('age', p.get('Player Age', p.get('playerAge', 10)))
    try:
        age = int(raw_age) if int(raw_age) > 0 else 10
    except (ValueError, TypeError):
        age = 10

    el = p.get('eligiblePositions', {})
    can_pitch = bool(p.get('canPitch', p.get('Can Pitch flag', el.get('canPitch', True))))
    can_catch = bool(p.get('canCatch', p.get('can catch flag', el.get('canCatch', True))))

    return {
        'id': p.get('id', 'p_test'),
        'jersey': jersey,
        'jerseyNumber': jersey,
        'firstName': first_name,
        'lastName': last_name,
        'name': full_name,
        'age': age,
        'Player Age': age,
        'canPitch': can_pitch,
        'canCatch': can_catch,
        'Player First Name': first_name,
        'Player Last name': last_name,
        'Can Pitch flag': can_pitch,
        'can catch flag': can_catch,
        'eligiblePositions': {
            'canPitch': can_pitch,
            'canCatch': can_catch
        }
    }

class TestRosterSchemaAndEditing(unittest.TestCase):
    def test_schema_keys_present(self):
        raw = {
            'id': 'p1',
            'name': 'Elias Collins',
            'jerseyNumber': 33,
            'eligiblePositions': {'canPitch': True, 'canCatch': True, 'canPlayFirstBase': True}
        }
        player = normalize_player(raw)
        
        # Verify required keys
        self.assertIn('jersey', player)
        self.assertEqual(player['jersey'], 33)
        self.assertIn('Player First Name', player)
        self.assertEqual(player['Player First Name'], 'Elias')
        self.assertIn('Player Last name', player)
        self.assertEqual(player['Player Last name'], 'Collins')
        self.assertIn('Can Pitch flag', player)
        self.assertTrue(player['Can Pitch flag'])
        self.assertIn('can catch flag', player)
        self.assertTrue(player['can catch flag'])

        self.assertIn('age', player)
        self.assertEqual(player['age'], 10)
        self.assertIn('Player Age', player)
        self.assertEqual(player['Player Age'], 10)

        # Verify removal of canPlayFirstBase
        self.assertNotIn('canPlayFirstBase', player)
        self.assertNotIn('canPlayFirstBase', player['eligiblePositions'])

    def test_json_serialization(self):
        raw = {
            'firstName': 'Hunter',
            'lastName': 'Huston',
            'jersey': 5,
            'age': 11,
            'canPitch': True,
            'canCatch': True
        }
        player = normalize_player(raw)
        serialized = json.dumps(player)
        data = json.loads(serialized)

        self.assertEqual(data['jersey'], 5)
        self.assertEqual(data['Player First Name'], 'Hunter')
        self.assertEqual(data['Player Last name'], 'Huston')
        self.assertEqual(data['age'], 11)
        self.assertEqual(data['Player Age'], 11)
        self.assertTrue(data['Can Pitch flag'])
        self.assertTrue(data['can catch flag'])
        self.assertNotIn('canPlayFirstBase', data.get('eligiblePositions', {}))

    def test_edit_roster_tuple_after_input(self):
        roster = [
            normalize_player({'firstName': 'Jason', 'lastName': 'Clark', 'jersey': 10, 'age': 10, 'canPitch': True, 'canCatch': False}),
            normalize_player({'firstName': 'Larry', 'lastName': 'Parsons', 'jersey': 12, 'age': 11, 'canPitch': False, 'canCatch': True})
        ]

        # Simulate editing tuple in place (e.g. changing jersey, last name, age, and catcher eligibility)
        p_to_edit = roster[0]
        updates = {
            'jersey': 11,
            'lastName': 'Clark Jr.',
            'age': 11,
            'canCatch': True
        }
        merged = {**p_to_edit, **updates}
        roster[0] = normalize_player(merged)

        # Assert modifications are preserved without removing the player
        self.assertEqual(len(roster), 2)
        self.assertEqual(roster[0]['jersey'], 11)
        self.assertEqual(roster[0]['Player Last name'], 'Clark Jr.')
        self.assertEqual(roster[0]['name'], 'Jason Clark Jr.')
        self.assertEqual(roster[0]['age'], 11)
        self.assertEqual(roster[0]['Player Age'], 11)
        self.assertTrue(roster[0]['canCatch'])
        self.assertTrue(roster[0]['can catch flag'])

if __name__ == '__main__':
    unittest.main()
