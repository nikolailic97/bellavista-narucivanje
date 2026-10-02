// Postavlja novu lozinku za interni nalog. Pokreće se lokalno:
//   node scripts/postavi-lozinku.js admin@bellavista.rs "NovaDugackaLozinka"
// Firebase konzola ne dozvoljava da se lozinka upiše ručno (samo "reset"
// mejlom), a interni nalozi nemaju pravo sanduče - zato ova skripta.
// Isti service account key kao za scripts/postavi-uloge.js (NE komituj ga).

const admin = require("firebase-admin");
const serviceAccount = require("./service-account-key.json");
const { getAuth } = require("firebase-admin/auth");

const [email, lozinka] = process.argv.slice(2);

if (!email || !lozinka) {
  console.error(
    'Upotreba: node scripts/postavi-lozinku.js <email> "<nova lozinka>"',
  );
  process.exit(1);
}

// Admin nalog vidi prihod i podatke svih kupaca - traži se duža lozinka.
// Kuhinja i dalje sme da ima numerički PIN (min 6 cifara, pravilo Firebase-a).
const minDuzina = email.startsWith("admin") ? 12 : 6;
if (lozinka.length < minDuzina) {
  console.error(`Lozinka za ${email} mora imati bar ${minDuzina} znakova.`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.cert(serviceAccount) });

(async () => {
  const auth = getAuth();
  const nalog = await auth.getUserByEmail(email);
  await auth.updateUser(nalog.uid, { password: lozinka });
  // Odjavljuje sve postojeće sesije tog naloga (npr. ako je stara lozinka
  // procurela) - prijava traži novu lozinku na svakom uređaju.
  await auth.revokeRefreshTokens(nalog.uid);
  console.log(`Lozinka promenjena za ${email}. Sve stare sesije su odjavljene.`);
  process.exit(0);
})().catch((greska) => {
  console.error("Greška:", greska.message);
  process.exit(1);
});
