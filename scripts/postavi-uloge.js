// Pokreće se JEDNOM, lokalno: node scripts/postavi-uloge.js
// NIKAD kao Cloud Function — nema trajni trošak.
// Potreban service account key iz Firebase Console > Project Settings >
// Service Accounts > Generate new private key, sačuvan kao
// scripts/service-account-key.json (NE komituj ovaj fajl u git!).

const admin = require("firebase-admin");
const serviceAccount = require("./service-account-key.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function postaviUloge() {
  const kuhinja = await admin
    .auth()
    .getUserByEmail("kuhinja@internal.gradskizalogaj.rs");
  await admin.auth().setCustomUserClaims(kuhinja.uid, { role: "kuhinja" });
  console.log('Uloga "kuhinja" postavljena za:', kuhinja.email);

  const adminNalog = await admin
    .auth()
    .getUserByEmail("admin@internal.gradskizalogaj.rs");
  await admin.auth().setCustomUserClaims(adminNalog.uid, { role: "admin" });
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
