import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase-config.js';

async function inspectTeams() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('Querying teams collection from Firestore...');
    const snap = await getDocs(collection(db, 'teams'));
    console.log(`Found ${snap.size} team documents in Firestore:`);
    snap.forEach((doc) => {
      const data = doc.data();
      console.log(`\nDoc ID: "${doc.id}"`);
      console.log(`Team Name: "${data.teamName}"`);
      console.log(`Head Coach: "${data.headCoach}"`);
      console.log(`Created At: "${data.createdAt}"`);
      console.log(`Player Count: ${data.playerCount || data.roster?.length || 0}`);
      if (data.roster && data.roster.length > 0) {
        console.log(`Roster (${data.roster.length} players):`);
        data.roster.forEach((p, i) => {
          console.log(`  ${i + 1}. #${p.jerseyNumber} ${p.name} (id: ${p.id})`);
        });
      }
    });
  } catch (err) {
    console.error('Firestore inspect error:', err);
  }
}

inspectTeams().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
