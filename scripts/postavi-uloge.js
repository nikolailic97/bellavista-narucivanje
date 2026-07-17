// Pokreće se JEDNOM, lokalno: node scripts/postavi-uloge.js
// NIKAD kao Cloud Function — nema trajni trošak.
// Potreban service account key iz Firebase Console > Project Settings >
// Service Accounts > Generate new private key, sačuvan kao
// scripts/service-account-key.json (NE komituj ovaj fajl u git!).

const admin = require("firebase-admin");
const serviceAccount = require("./service-account-key.json");
const { getAuth } = require("firebase-admin/auth");

admin.initializeApp({ credential: admin.cert(serviceAccount) });

// Svaki nalog u svom try/catch bloku - ako jedan nalog još ne postoji u
// Authentication-u, ostali se i dalje ispravno obrađuju (ranije je jedna
// greška prekidala celu skriptu usred izvršavanja).
async function postaviUlogu(auth, email, uloga) {
  try {
    const nalog = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(nalog.uid, { role: uloga });
    console.log(`Uloga "${uloga}" postavljena za:`, nalog.email);
  } catch (greska) {
    console.error(`Greška za ${email} (uloga "${uloga}"):`, greska.message);
  }
}

async function postaviUloge() {
  const auth = getAuth();

  await postaviUlogu(auth, "kuhinja@bellavista.rs", "kuhinja");
  await postaviUlogu(auth, "admin@bellavista.rs", "admin");
  await postaviUlogu(auth, "konobar@bellavista.rs", "konobar");

  console.log(
    "\nGotovo. Korisnik mora da se ponovo uloguje (ili sačeka do 1h) da bi claim stupio na snagu.",
  );
}

postaviUloge()
  .then(() => process.exit(0))
  .catch((greska) => {
    console.error("Neočekivana greška:", greska);
    process.exit(1);
  });
