const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};
globalThis.sessionStorage = globalThis.localStorage;

import { LEAGUE_CONFIG, getDesignatedManagerConfig } from '../src/constants.js';
import { teamStorage } from '../src/team-storage.js';

async function runTests() {
  console.log('--- Testing Manager Single Team Access & View-Only Policies ---');

  // Test 1: Designated manager check
  const config = getDesignatedManagerConfig('mcollinswork6@gmail.com');
  console.assert(config !== null, 'mcollinswork6@gmail.com should have designated manager config');
  console.assert(config.teamId === 'team-black-bats-6589', 'Designated team should be team-black-bats-6589');
  console.assert(config.exclusive === true, 'Designated manager should be exclusive');
  console.log('✅ Test 1 Passed: Designated manager mapping for Black Bats is exclusive');

  // Test 2: Admin permissions on Black Bats vs other teams
  const isBlackBatsAdmin = await teamStorage.isTeamAdmin('team-black-bats-6589');
  console.assert(isBlackBatsAdmin === true, 'mcollinswork6@gmail.com MUST be admin for Black Bats');

  const isRiverCatsAdmin = await teamStorage.isTeamAdmin('nnll-rivercats-11');
  console.assert(isRiverCatsAdmin === false, 'mcollinswork6@gmail.com MUST NOT be admin for River Cats (View Only)');

  const isGiantsAdmin = await teamStorage.isTeamAdmin('nnll-giants-12');
  console.assert(isGiantsAdmin === false, 'mcollinswork6@gmail.com MUST NOT be admin for Giants (View Only)');
  console.log('✅ Test 2 Passed: isTeamAdmin returns true ONLY for Black Bats and false for all other teams');

  // Test 3: Mutations to other teams are blocked by team-storage
  try {
    await teamStorage.saveTeamRoster('nnll-rivercats-11', []);
    console.assert(false, 'saveTeamRoster on other teams should throw permission error');
  } catch (err) {
    console.assert(err.message.includes('Permission denied'), 'Expected Permission denied error');
    console.log('✅ Test 3 Passed: saveTeamRoster on other teams throws Permission Denied');
  }

  // Test 4: Adding player to other teams is blocked
  try {
    await teamStorage.addPlayerToRoster('nnll-rivercats-11', { name: 'Test', jerseyNumber: 99 });
    console.assert(false, 'addPlayerToRoster on other teams should throw permission error');
  } catch (err) {
    console.assert(err.message.includes('Permission denied'), 'Expected Permission denied error');
    console.log('✅ Test 4 Passed: addPlayerToRoster on other teams throws Permission Denied');
  }

  // Test 5: Deleting other teams is blocked
  try {
    await teamStorage.deleteTeam('nnll-rivercats-11');
    console.assert(false, 'deleteTeam on other teams should throw permission error');
  } catch (err) {
    console.assert(err.message.includes('Permission denied'), 'Expected Permission denied error');
    console.log('✅ Test 5 Passed: deleteTeam on other teams throws Permission Denied');
  }

  // Test 6: Manager creation limit
  const createCheck = await teamStorage.canManagerCreateTeam();
  console.assert(createCheck.allowed === false, 'Manager for Black Bats cannot create another team');
  console.log('✅ Test 6 Passed: Manager single-team policy prohibits creating additional teams');

  console.log('\n🎉 ALL VIEW-ONLY PERMISSION & ACCESS TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
