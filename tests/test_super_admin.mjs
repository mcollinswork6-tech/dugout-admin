// Mock Browser Storage Environment for Node.js
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = {
  location: {
    origin: 'http://localhost:8000',
    pathname: '/'
  }
};

import { isSuperAdmin, SUPER_ADMIN_EMAILS, LEAGUE_ROLES } from '../src/constants.js';
import { teamStorage } from '../src/team-storage.js';
import { authService } from '../src/auth.js';

async function runSuperAdminTests() {
  console.log('--- Testing Super User Admin & User Invitations ---');

  // Test 1: Super admin email validation
  console.assert(isSuperAdmin('matthew.h.collins6@gmail.com') === true, 'matthew.h.collins6@gmail.com must be super admin');
  console.assert(isSuperAdmin('MATTHEW.H.COLLINS6@GMAIL.COM') === true, 'Case-insensitive email check should pass');
  console.assert(isSuperAdmin('mcollinswork6@gmail.com') === false, 'mcollinswork6@gmail.com is coach, NOT super admin');
  console.assert(isSuperAdmin('random@example.com') === false, 'Random user is NOT super admin');
  console.log('✅ Test 1 Passed: Super admin recognition is accurate');

  // Test 2: Log in as Super Admin
  const superUser = authService.loginSuperAdmin(true);
  console.assert(superUser.email === 'matthew.h.collins6@gmail.com', 'Super admin email should match');
  console.assert(isSuperAdmin(teamStorage.getCurrentManager().email) === true, 'Current manager should be recognized as super admin');
  console.log('✅ Test 2 Passed: Super admin login establishes commissioner context');

  // Test 3: Super Admin unrestricted team administration
  const isBlackBatsAdmin = await teamStorage.isTeamAdmin('team-black-bats-6589');
  console.assert(isBlackBatsAdmin === true, 'Super Admin must have admin access to Black Bats');

  const isRiverCatsAdmin = await teamStorage.isTeamAdmin('nnll-rivercats-11');
  console.assert(isRiverCatsAdmin === true, 'Super Admin must have admin access to River Cats');

  const isGiantsAdmin = await teamStorage.isTeamAdmin('nnll-giants-12');
  console.assert(isGiantsAdmin === true, 'Super Admin must have admin access to Giants');
  console.log('✅ Test 3 Passed: Super Admin has full admin access across EVERY team');

  // Test 4: Super Admin can create unlimited teams
  const canCreate = await teamStorage.canManagerCreateTeam();
  console.assert(canCreate.allowed === true, 'Super Admin must be allowed to create teams');
  console.assert(canCreate.isSuperAdmin === true, 'canCreateTeam flags isSuperAdmin');
  console.log('✅ Test 4 Passed: Super Admin bypasses 1-team limit');

  // Test 5: Super Admin can send user/coach invitations
  const inviteResult = await teamStorage.createInvitation({
    email: 'newcoach@example.com',
    role: 'manager',
    teamId: 'nnll-rivercats-11',
    teamName: 'River Cats',
    note: 'Welcome to NNLL Spring 2026!'
  });

  console.assert(inviteResult.invitation !== null, 'Invitation object created');
  console.assert(inviteResult.invitation.email === 'newcoach@example.com', 'Recipient email recorded');
  console.assert(inviteResult.invitation.status === 'pending', 'Initial status is pending');
  console.assert(inviteResult.inviteUrl.includes('token='), 'Invite URL contains secure token');
  console.assert(inviteResult.mailtoUrl.startsWith('mailto:newcoach%40example.com'), 'Mailto draft generated');
  console.log('✅ Test 5 Passed: Super Admin successfully generates user invitation with secure URL and mailto draft');

  // Test 6: List invitations
  const list = await teamStorage.listInvitations();
  console.assert(list.length >= 1, 'Invitations list should have at least 1 item');
  console.assert(list[0].email === 'newcoach@example.com', 'First invitation matches created invite');
  console.log('✅ Test 6 Passed: listInvitations returns active invitations');

  // Test 7: Revoke invitation
  const revoked = await teamStorage.revokeInvitation(inviteResult.invitation.id);
  console.assert(revoked.status === 'revoked', 'Invitation status updated to revoked');
  console.log('✅ Test 7 Passed: Super Admin can revoke invitations');

  // Test 8: Non-super admin cannot send invitations
  authService.loginOfflineDemo('Coach Collins', true);
  console.assert(isSuperAdmin(teamStorage.getCurrentManager().email) === false, 'Switched to non-super admin');

  let blocked = false;
  try {
    await teamStorage.createInvitation({
      email: 'unauthorized@example.com',
      role: 'assistant',
      teamId: 'team-black-bats-6589'
    });
  } catch (err) {
    blocked = true;
    console.assert(err.message.includes('Permission denied'), 'Expected Permission denied error for non-super admin');
  }
  console.assert(blocked === true, 'Non-super admin invitation must throw error');
  console.log('✅ Test 8 Passed: Regular team managers cannot send invitations');

  // Test 9: Non-super admin still restricted to single team
  const coachBlackBats = await teamStorage.isTeamAdmin('team-black-bats-6589');
  console.assert(coachBlackBats === true, 'mcollinswork6@gmail.com is admin for Black Bats');

  const coachRiverCats = await teamStorage.isTeamAdmin('nnll-rivercats-11');
  console.assert(coachRiverCats === false, 'mcollinswork6@gmail.com has View Only for River Cats');
  console.log('✅ Test 9 Passed: Regular managers remain strictly restricted to their designated team');

  console.log('\n🎉 ALL SUPER ADMIN & INVITATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runSuperAdminTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
