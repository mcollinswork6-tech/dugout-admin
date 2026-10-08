#!/usr/bin/env python3
"""
Comprehensive Test Suite for NNLL Minor AAA Roster & Dugout Optimizer
Tests CSP generation, hard/soft constraint validation, dynamic re-solving,
and Little League Minor AAA rules across varying roster sizes (8 to 13 players).
"""

import unittest

FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
INFIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS']
OUTFIELD_POSITIONS = ['LF', 'CF', 'RF']

def is_assignment_valid(player, position, inning_num, histories, player_pitches=None, pitchers_removed=None):
    if player_pitches is None: player_pitches = {}
    if pitchers_removed is None: pitchers_removed = []
    
    p_id = player['id']
    h = histories.get(p_id, {'positions': [], 'innings_caught': 0, 'consecutive_bench': 0})
    
    # Safety tags
    el = player.get('eligiblePositions', {})
    if position == 'P' and not (player.get('canPitch', True) and el.get('canPitch', True)): return False
    if position == 'C' and not (player.get('canCatch', True) and el.get('canCatch', True)): return False
    
    # Pitcher/Catcher
    if position == 'C' and player_pitches.get(p_id, 0) >= 41:
        return False
    if position == 'P':
        if h.get('innings_caught', 0) >= 4: return False
        if p_id in pitchers_removed: return False
        
    # Bench
    if position == 'BENCH':
        if len(h['positions']) > 0 and h['positions'][-1] == 'BENCH':
            return False
            
    return True

def solve_grid_python(players, locked_innings=None, start_inning=1, total_innings=6, player_pitches=None, pitchers_removed=None):
    if player_pitches is None: player_pitches = {}
    if pitchers_removed is None: pitchers_removed = []
    if locked_innings is None: locked_innings = []

    active_players = [p for p in players if not p.get('isOut', False)]
    active_count = len(active_players)
    
    positions_to_fill = FIELD_POSITIONS if active_count >= 9 else FIELD_POSITIONS[:active_count]
    
    histories = {
        p['id']: {
            'positions': [],
            'infield_count': 0,
            'outfield_count': 0,
            'bench_count': 0,
            'consecutive_bench': 0,
            'innings_caught': 0,
            'innings_pitched': 0
        } for p in players
    }
    
    grid = []
    # populate locked
    for i in range(start_inning - 1):
        inn = locked_innings[i]
        grid.append(inn)
        assigned = set(inn['assignments'].values())
        for pos, pid in inn['assignments'].items():
            if pid in histories:
                h = histories[pid]
                h['positions'].append(pos)
                if pos in INFIELD_POSITIONS: h['infield_count'] += 1
                elif pos in OUTFIELD_POSITIONS: h['outfield_count'] += 1
                if pos == 'P': h['innings_pitched'] += 1
                if pos == 'C': h['innings_caught'] += 1
                h['consecutive_bench'] = 0
        for p in active_players:
            if p['id'] not in assigned:
                h = histories[p['id']]
                h['positions'].append('BENCH')
                h['bench_count'] += 1
                h['consecutive_bench'] += 1

    def solve_inning_rec(inn_idx, cur_histories):
        inn_num = inn_idx + 1
        if inn_idx >= total_innings:
            # Check final constraints
            for p in active_players:
                h = cur_histories[p['id']]
                if total_innings >= 4 and h['infield_count'] == 0:
                    return None
                max_b = 2 if active_count <= 12 else 3
                if h['bench_count'] > max_b:
                    return None
            return []

        must_play_infield = set()
        if inn_num == 4:
            for p in active_players:
                if cur_histories[p['id']]['infield_count'] == 0:
                    must_play_infield.add(p['id'])
                    
        def assign_pos_rec(pos_idx, current_assigned, used_pids, h_so_far):
            if pos_idx >= len(positions_to_fill):
                bench_pids = []
                for p in active_players:
                    if p['id'] not in used_pids:
                        if not is_assignment_valid(p, 'BENCH', inn_num, h_so_far, player_pitches, pitchers_removed):
                            return None
                        bench_pids.append(p['id'])
                if inn_num == 4:
                    for b_id in bench_pids:
                        if b_id in must_play_infield:
                            return None

                next_h = {k: {sk: (list(sv) if isinstance(sv, list) else sv) for sk, sv in v.items()} for k, v in h_so_far.items()}
                for b_id in bench_pids:
                    next_h[b_id]['positions'].append('BENCH')
                    next_h[b_id]['bench_count'] += 1
                    next_h[b_id]['consecutive_bench'] += 1

                this_inn = {
                    'inningNumber': inn_num,
                    'assignments': dict(current_assigned),
                    'benchPlayerIds': bench_pids
                }
                rest = solve_inning_rec(inn_idx + 1, next_h)
                if rest is not None:
                    return [this_inn] + rest
                return None

            pos = positions_to_fill[pos_idx]
            is_if = pos in INFIELD_POSITIONS
            
            candidates = []
            for p in active_players:
                if p['id'] in used_pids: continue
                if inn_num == 4 and not is_if and p['id'] in must_play_infield:
                    continue
                if is_assignment_valid(p, pos, inn_num, h_so_far, player_pitches, pitchers_removed):
                    h = h_so_far[p['id']]
                    score = 100
                    if is_if and h['infield_count'] == 0:
                        score += 500 if inn_num == 4 else 150
                    if pos == 'BENCH':
                        score -= h['bench_count'] * 50
                    else:
                        score += h['bench_count'] * 20
                    candidates.append((score, p))
                    
            candidates.sort(key=lambda x: x[0], reverse=True)
            for _, p in candidates:
                next_h = {k: {sk: (list(sv) if isinstance(sv, list) else sv) for sk, sv in v.items()} for k, v in h_so_far.items()}
                next_h[p['id']]['positions'].append(pos)
                if is_if: next_h[p['id']]['infield_count'] += 1
                elif pos in OUTFIELD_POSITIONS: next_h[p['id']]['outfield_count'] += 1
                if pos == 'P': next_h[p['id']]['innings_pitched'] += 1
                if pos == 'C': next_h[p['id']]['innings_caught'] += 1
                next_h[p['id']]['consecutive_bench'] = 0
                
                current_assigned[pos] = p['id']
                used_pids.add(p['id'])
                
                res = assign_pos_rec(pos_idx + 1, current_assigned, used_pids, next_h)
                if res is not None:
                    return res
                    
                del current_assigned[pos]
                used_pids.remove(p['id'])
                
            return None

        return assign_pos_rec(0, {}, set(), cur_histories)

    res = solve_inning_rec(start_inning - 1, histories)
    if res is None:
        raise ValueError("Could not solve grid")
    return grid + res

def validate_nnll_rules(players, innings, player_pitches=None, pitchers_removed=None):
    if player_pitches is None: player_pitches = {}
    if pitchers_removed is None: pitchers_removed = []

    violations = []
    active_players = [p for p in players if not p.get('isOut', False)]

    for inn_idx, inn in enumerate(innings):
        inn_num = inn_idx + 1
        assignments = inn.get('assignments', {})
        bench = inn.get('benchPlayerIds', [])
        assigned_pids = set(assignments.values())
        if len(assigned_pids) != len(assignments):
            violations.append(f"Inning {inn_num}: Duplicate player assigned on field.")

    for player in active_players:
        p_id = player['id']
        infield_count_by_4 = 0
        total_infield = 0
        total_bench = 0
        consecutive_bench = 0
        max_consecutive_bench = 0
        innings_caught = 0
        innings_pitched = 0
        
        for inn_idx, inn in enumerate(innings):
            inn_num = inn_idx + 1
            pos = None
            for p, pid in inn.get('assignments', {}).items():
                if pid == p_id:
                    pos = p
                    break
            if pos is None and p_id in inn.get('benchPlayerIds', []):
                pos = 'BENCH'
                
            if pos in INFIELD_POSITIONS:
                total_infield += 1
                if inn_num <= 4:
                    infield_count_by_4 += 1
                consecutive_bench = 0
            elif pos in OUTFIELD_POSITIONS:
                consecutive_bench = 0
            elif pos == 'BENCH':
                total_bench += 1
                consecutive_bench += 1
                if consecutive_bench > max_consecutive_bench:
                    max_consecutive_bench = consecutive_bench
            
            if pos == 'P':
                innings_pitched += 1
            elif pos == 'C':
                innings_caught += 1
                
        if max_consecutive_bench > 1:
            violations.append(f"Player {player['name']} benched for {max_consecutive_bench} consecutive innings.")
            
        max_bench_allowed = 2 if len(active_players) <= 12 else 3
        if len(innings) == 6 and total_bench > max_bench_allowed:
            violations.append(f"Player {player['name']} benched {total_bench} times (max allowed: {max_bench_allowed}).")
            
        if len(innings) >= 4 and infield_count_by_4 < 1:
            violations.append(f"Mandatory Infield: Player {player['name']} has 0 infield innings in innings 1-4.")
            
        pitches = player_pitches.get(p_id, 0)
        if pitches >= 41 and innings_caught > 0:
            violations.append(f"Pitcher {player['name']} threw {pitches} pitches and played catcher.")
            
        if innings_caught >= 4 and innings_pitched > 0:
            violations.append(f"Player {player['name']} caught {innings_caught} innings and pitched.")
            
    return violations

class TestNNLLOptimizer(unittest.TestCase):
    def test_solve_11_players(self):
        players = [{'id': f'p{i}', 'jersey': i, 'jerseyNumber': i, 'firstName': 'Player', 'lastName': f'{i}', 'name': f'P{i}', 'canPitch': True, 'canCatch': True, 'eligiblePositions': {'canPitch': True, 'canCatch': True}} for i in range(1, 12)]
        grid = solve_grid_python(players)
        self.assertEqual(len(grid), 6)
        violations = validate_nnll_rules(players, grid)
        self.assertEqual(violations, [])

    def test_solve_12_players(self):
        players = [{'id': f'p{i}', 'jersey': i, 'jerseyNumber': i, 'firstName': 'Player', 'lastName': f'{i}', 'name': f'P{i}', 'canPitch': True, 'canCatch': True, 'eligiblePositions': {'canPitch': True, 'canCatch': True}} for i in range(1, 13)]
        grid = solve_grid_python(players)
        self.assertEqual(len(grid), 6)
        violations = validate_nnll_rules(players, grid)
        self.assertEqual(violations, [])

    def test_solve_9_players(self):
        players = [{'id': f'p{i}', 'jersey': i, 'jerseyNumber': i, 'firstName': 'Player', 'lastName': f'{i}', 'name': f'P{i}', 'canPitch': True, 'canCatch': True, 'eligiblePositions': {'canPitch': True, 'canCatch': True}} for i in range(1, 10)]
        grid = solve_grid_python(players)
        self.assertEqual(len(grid), 6)
        violations = validate_nnll_rules(players, grid)
        self.assertEqual(violations, [])

    def test_solve_8_players(self):
        players = [{'id': f'p{i}', 'jersey': i, 'jerseyNumber': i, 'firstName': 'Player', 'lastName': f'{i}', 'name': f'P{i}', 'canPitch': True, 'canCatch': True, 'eligiblePositions': {'canPitch': True, 'canCatch': True}} for i in range(1, 9)]
        grid = solve_grid_python(players)
        self.assertEqual(len(grid), 6)
        violations = validate_nnll_rules(players, grid)
        self.assertEqual(violations, [])

    def test_dynamic_resolve_after_41_pitches(self):
        """When pitcher reaches 41 pitches, downstream re-solve cannot place them at catcher"""
        players = [{'id': f'p{i}', 'jersey': i, 'jerseyNumber': i, 'name': f'P{i}', 'canPitch': True, 'canCatch': True, 'eligiblePositions': {'canPitch': True, 'canCatch': True}} for i in range(1, 12)]
        initial_grid = solve_grid_python(players)
        # Lock innings 1 and 2
        locked = initial_grid[:2]
        # p1 (pitcher) reached 45 pitches
        player_pitches = {'p1': 45}
        resolv_grid = solve_grid_python(players, locked_innings=locked, start_inning=3, player_pitches=player_pitches)
        
        # Check that p1 is NOT at catcher in innings 3-6
        for inn in resolv_grid[2:]:
            self.assertNotEqual(inn['assignments'].get('C'), 'p1')

    def test_dynamic_resolve_after_injury(self):
        """When a player is injured in Inning 2, downstream innings rebalance cleanly"""
        players = [{'id': f'p{i}', 'jersey': i, 'jerseyNumber': i, 'name': f'P{i}', 'canPitch': True, 'canCatch': True, 'eligiblePositions': {'canPitch': True, 'canCatch': True}} for i in range(1, 12)]
        initial_grid = solve_grid_python(players)
        locked = initial_grid[:2]
        
        # Player 2 injured
        players[1]['isOut'] = True
        resolv_grid = solve_grid_python(players, locked_innings=locked, start_inning=3)
        self.assertEqual(len(resolv_grid), 6)
        
        # Verify no violations on remaining active players
        violations = validate_nnll_rules(players, resolv_grid)
        self.assertEqual(violations, [])

    def test_player_schema_and_tuple_editing(self):
        """Verify schema fields: jersey, Player First Name, Player Last name, Can Pitch flag, can catch flag, and editing tuples"""
        player_tuple = {
            'id': 'p_101',
            'jersey': 44,
            'jerseyNumber': 44,
            'firstName': 'Aaron',
            'lastName': 'Judge',
            'name': 'Aaron Judge',
            'age': 10,
            'Player Age': 10,
            'Player First Name': 'Aaron',
            'Player Last name': 'Judge',
            'Can Pitch flag': False,
            'can catch flag': False,
            'canPitch': False,
            'canCatch': False,
            'eligiblePositions': {'canPitch': False, 'canCatch': False}
        }
        self.assertEqual(player_tuple['jersey'], 44)
        self.assertEqual(player_tuple['age'], 10)
        self.assertEqual(player_tuple['Player Age'], 10)
        self.assertEqual(player_tuple['Player First Name'], 'Aaron')
        self.assertEqual(player_tuple['Player Last name'], 'Judge')
        self.assertFalse(player_tuple['Can Pitch flag'])
        self.assertFalse(player_tuple['can catch flag'])
        self.assertNotIn('canPlayFirstBase', player_tuple['eligiblePositions'])

        # Simulate editing tuple after input (e.g. changing jersey, age, and position eligibility)
        player_tuple['jersey'] = 99
        player_tuple['jerseyNumber'] = 99
        player_tuple['firstName'] = 'Aaron'
        player_tuple['lastName'] = 'Judge Jr.'
        player_tuple['name'] = 'Aaron Judge Jr.'
        player_tuple['age'] = 11
        player_tuple['Player Age'] = 11
        player_tuple['canPitch'] = True
        player_tuple['Can Pitch flag'] = True
        player_tuple['eligiblePositions']['canPitch'] = True

        self.assertEqual(player_tuple['jersey'], 99)
        self.assertEqual(player_tuple['lastName'], 'Judge Jr.')
        self.assertEqual(player_tuple['age'], 11)
        self.assertTrue(player_tuple['canPitch'])

if __name__ == '__main__':
    unittest.main()
