import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase-config.js';

async function syncRealBlackBats() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log('1. Fetching real Black Bats (team-black-bats-6589)...');
  const realSnap = await getDoc(doc(db, 'teams/team-black-bats-6589'));
  if (!realSnap.exists()) {
    console.error('team-black-bats-6589 does not exist in Firestore!');
    return;
  }
  const realTeam = realSnap.data();
  console.log(`Found team-black-bats-6589: ${realTeam.teamName} (${realTeam.roster.length} players)`);

  // Ensure admin email is set to mcollinswork6@gmail.com
  await setDoc(doc(db, 'teams/team-black-bats-6589'), {
    adminEmail: 'mcollinswork6@gmail.com',
    headCoach: 'Coach Collins'
  }, { merge: true });
  console.log('Updated team-black-bats-6589 adminEmail and headCoach');

  // Delete the dummy nnll-black-bats document from Firestore
  try {
    const dummySnap = await getDoc(doc(db, 'teams/nnll-black-bats'));
    if (dummySnap.exists()) {
      await deleteDoc(doc(db, 'teams/nnll-black-bats'));
      console.log('Deleted dummy teams/nnll-black-bats from Firestore');
    }
  } catch (e) {
    console.warn('Could not delete dummy team:', e.message);
  }

  // Update app_settings/teams_registry in Firestore
  console.log('2. Updating app_settings/teams_registry in Firestore...');
  const regSnap = await getDoc(doc(db, 'app_settings/teams_registry'));
  const currentReg = regSnap.exists() ? regSnap.data() : { teams: [] };

  // Fetch all real teams from Firestore
  const allTeamsSnap = await getDocs(collection(db, 'teams'));
  const teamList = [];
  allTeamsSnap.forEach((tDoc) => {
    const tData = tDoc.data();
    if (tDoc.id !== 'nnll-black-bats') {
      teamList.push({
        teamId: tDoc.id,
        teamName: tData.teamName,
        division: tData.division || 'Minor AAA',
        season: tData.season || 'Spring 2026',
        headCoach: tData.headCoach || 'Coach',
        opponentName: tData.opponentName || 'Opponent',
        playerCount: tData.roster ? tData.roster.length : (tData.playerCount || 0),
        adminUid: tData.adminUid || null,
        adminEmail: tData.adminEmail || null,
        createdAt: tData.createdAt || new Date().toISOString(),
        updatedAt: tData.updatedAt || new Date().toISOString()
      });
    }
  });

  // Sort team-black-bats-6589 to front
  teamList.sort((a, b) => {
    if (a.teamId === 'team-black-bats-6589') return -1;
    if (b.teamId === 'team-black-bats-6589') return 1;
    return a.teamName.localeCompare(b.teamName);
  });

  const newRegistry = {
    updatedAt: new Date().toISOString(),
    activeTeamId: 'team-black-bats-6589',
    teams: teamList
  };

  await setDoc(doc(db, 'app_settings/teams_registry'), newRegistry);
  console.log('Updated app_settings/teams_registry:');
  console.log(`Active Team: ${newRegistry.activeTeamId}`);
  console.log(`Total Teams: ${newRegistry.teams.length}`);
  newRegistry.teams.forEach(t => {
    console.log(` - ${t.teamName} [${t.teamId}]: ${t.playerCount} players (Coach: ${t.headCoach})`);
  });
}

syncRealBlackBats().then(() => {
  console.log('✅ Firestore sync completed successfully');
  process.exit(0);
}).catch(e => {
  console.error('Sync failed:', e);
  process.exit(1);
});
