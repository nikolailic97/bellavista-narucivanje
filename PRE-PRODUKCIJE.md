# Pre produkcije — šta treba uraditi pre pravog lansiranja

Spisak stvari koje čekaju dogovor sa vlasnikom ili ručni korak u Firebase
konzoli. Kad se nešto završi, obriši ga odavde.

## 1. Radno vreme — POPUNITI (dogovor sa vlasnikom)

Sad stoji probno **svaki dan 10:00–23:00**.

- Gde: `RADNO_VREME` u `lib/constants.js` (komentar iznad objašnjava format).
- Van radnog vremena kupac može da gleda meni i puni korpu, ali dugme
  „Pošalji porudžbinu” je isključeno i piše „Trenutno ne primamo porudžbine”.
- Radno vreme se prikazuje i u podnožju sajta.
- Zatvoren dan: `null` (npr. `0: null` = nedeljom ne radimo).
- Rad posle ponoći: `["18:00", "26:00"]` = do 02:00 sledećeg dana.
- Pitati vlasnika i za praznike i kolektivni odmor — za to trenutno nema
  podrške, treba dodati ako im zatreba.

> Provera je samo na sajtu. Neko ko namerno zaobiđe sajt može da pošalje
> porudžbinu i van radnog vremena — kuhinja je tada vidi i odbije.

## 2. Zona dostave — ODLUČITI da li uvodimo

Ideja: dostava samo u okviru okruga (Smederevska Palanka i Velika Plana su u
**Podunavskom okrugu**), ili samo po spisku mesta/naselja.

Pitanja za vlasnika:

- Koja mesta/naselja pokrivaju? Da li je cena dostave ista svuda?
- Da li je minimalna porudžbina različita po zoni (npr. selo dalje od
  centra)?

Opcije za implementaciju (od najjednostavnije):

1. **Padajući meni „Mesto”** u formi (Palanka, Plana, okolna sela…) — kupac
   bira, uz svako mesto stoji cena dostave. Bez spoljnih servisa, besplatno.
2. **Provera adrese preko mape** (Google Maps / OpenStreetMap geokodiranje)
   — tačnije, ali traži API ključ i ima trošak/limite.

Ništa od ovoga još nije urađeno — čeka odluku.

## 3. Firebase — obavezni ručni koraci

### 3a. Deploy pravila i indeksa (OBAVEZNO uz ovu verziju sajta)

Nova verzija sajta i nova pravila idu zajedno: nova pravila odbijaju
porudžbine iz stare verzije sajta, a nova kuhinjska tabla traži novi indeks.
Redosled:

```bash
firebase deploy --only firestore:indexes   # 1. indeks za kuhinjsku tablu
# sačekaj da indeks bude "Enabled" u konzoli (Firestore > Indexes), par minuta
git push                                    # 2. GitHub Actions objavi novi sajt
firebase deploy --only firestore:rules      # 3. odmah posle objave sajta
```

Firebase će pitati da li da obriše stare indekse koji više nisu u fajlu —
može „yes”.

### 3b. App Check — uključiti „Enforce”

Ovo je **jedina** zaštita od skripte koja bi slala hiljade lažnih porudžbina
(pravila baze ograničavaju veličinu i oblik, ali ne i broj zahteva).

1. Proveri da GitHub secret `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` postoji
   (Settings > Secrets > Actions) i da je tajni ključ dodat u Firebase
   Console > App Check > reCAPTCHA v3.
2. Za lokalni razvoj dodaj isti ključ u `.env.local` (trenutno ga tamo nema)
   i registruj debug token (vidi komentar u `lib/firebase.js`).
3. Firebase Console > App Check > Cloud Firestore > **Enforce**.
4. Posle toga proveri da sajt, `/kuhinja` i `/admin` i dalje rade.

### 3c. Nova lozinka za admin nalog

Admin prijava sada prima pravu lozinku (bilo koji znakovi), ne samo PIN.
Admin vidi prihod i podatke svih kupaca, pa mu treba duga lozinka
(bar 12 znakova). Kuhinja ostaje na PIN-u.

```bash
node scripts/postavi-lozinku.js admin@bellavista.rs "NekaDugackaLozinka2026"
```

Skripta odjavljuje sve stare sesije tog naloga. Treba
`scripts/service-account-key.json` (isti kao za `postavi-uloge.js`).

## 4. Cena porudžbine — Cloud Function (kad se meni ustali)

Cenu i dalje šalje browser kupca. Kuhinjska tabla sada sama preračunava cenu
po cenovniku i jasno označi porudžbinu čija se cena ne slaže („Naplati po
cenovniku”), ali porudžbina i dalje uđe u bazu, a pogrešan iznos uđe u
izveštaj o prihodu.

Pravo rešenje: Cloud Function koja odbije porudžbinu sa pogrešnom cenom.
Traži prelazak na Blaze plan (plaća se po potrošnji, za ovaj obim praktično
0 RSD, ali traži karticu). Detalji u komentaru na dnu `firestore.rules`.

## 5. Ostali podaci za popunjavanje

- `KONTAKT_TELEFON` i `INSTAGRAM_URL` u `pages/index.js` (označeni TODO).
- `NAZIV_RESTORANA` u `pages/index.js` (sad piše „Restoran”).
- Kad se doda custom domen: obriši `NEXT_PUBLIC_BASE_PATH` iz
  `.github/workflows/deploy.yml` (vidi komentar u `next.config.js`).

## 6. Poznata ograničenja (za znanje, ne treba ništa raditi)

- **Automatsko zatvaranje dana u ponoć** radi samo ako je u tom trenutku
  otvorena `/kuhinja` ili `/admin` stranica (nema servera koji bi to radio
  sam). Ako je tablet ugašen, zatvaranje se desi automatski čim se neko
  sledeći put prijavi. Porudžbine koje se još spremaju u ponoć ostaju na
  tabli i arhiviraju se sledeći put.
- **Obaveštenja kupcu** („Dostava u toku”) stižu dok je stranica otvorena,
  makar u pozadini. Na iPhone-u rade samo ako je sajt dodat na početni
  ekran (ograničenje Safari-ja). Pravi „push” i kad je browser zatvoren
  traži server (Cloud Function) — vidi tačku 4.
- **Najviše 12 različitih stavki po porudžbini** (količina svake do 50).
  Limit dolazi od Firestore pravila — vidi komentar uz `validnaStavka` u
  `firestore.rules` pre nego što se menja.
- Kuhinja i dalje može da obriše porudžbinu (to joj treba za zatvaranje
  dana), pa bi u teoriji mogla da „sakrije” porudžbinu iz izveštaja. Ne može
  da smanji već upisan izveštaj — to sme samo admin.
