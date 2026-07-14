// Pokreće se JEDNOM, lokalno: node scripts/postavi-uloge.js
// NIKAD kao Cloud Function — nema trajni trošak.
// Potreban service account key iz Firebase Console > Project Settings >
// Service Accounts > Generate new private key, sačuvan kao
// scripts/service-account-key.json (NE komituj ovaj fajl u git!).

const admin = require("firebase-admin");
const serviceAccount = require("./service-account-key.json");
const { getAuth } = require("firebase-admin/auth");

admin.initializeApp({ credential: admin.cert(serviceAccount) });

async function postaviUloge() {
  const auth = getAuth();
  const kuhinja = await auth.getUserByEmail("kuhinja@bellavista.rs");
  await auth.setCustomUserClaims(kuhinja.uid, { role: "kuhinja" });
  console.log('Uloga "kuhinja" postavljena za:', kuhinja.email);

  const adminNalog = await auth.getUserByEmail("admin@bellavista.rs");
  await auth.setCustomUserClaims(adminNalog.uid, { role: "admin" });
  console.log('Uloga "admin" postavljena za:', adminNalog.email);

  console.log(
    "\nGotovo. Korisnik mora da se ponovo uloguje (ili sačeka do 1h) da bi claim stupio na snagu.",
  );
}

postaviUloge()
  .then(() => process.exit(0))
  .catch((greska) => {
    console.error("Greška pri postavljanju uloga:", greska);
    process.exit(1);
  });
