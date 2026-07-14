import { useState, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  documentId,
  runTransaction,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

// ============ FIREBASE INIT ============
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Fiksni identifikatori internih naloga (NISU tajna - lozinka/PIN jeste)
const KUHINJA_EMAIL = "kuhinja@internal.gradskizalogaj.rs";
const ADMIN_EMAIL = "admin@internal.gradskizalogaj.rs";

// ============ STATIČNI PODACI (jelovnik se ne čuva u Firestore-u) ============
const JELOVNIK = [
  {
    id: "1",
    naziv: "Gurmanska pljeskavica",
    opis: "Kačkavalj, slaninica, tucana paprika, luk...",
    cena: 450,
    kategorija: "Burgers",
    vreme_pripreme: 15,
    slika_url: "/images/pljeskavica.jpg",
  },
  {
    id: "2",
    naziv: "Margarita Pica",
    opis: "Pelat, kačkavalj, masline, origano...",
    cena: 800,
    kategorija: "Pizzas",
    vreme_pripreme: 25,
    slika_url: "/images/margarita.jpg",
  },
  {
    id: "3",
    naziv: "Cezar salata",
    opis: "Piletina, krutoni, cezar dresing...",
    cena: 650,
    kategorija: "Salads",
    vreme_pripreme: 10,
    slika_url: "/images/cezar-salata.jpg",
  },
  {
    id: "4",
    naziv: "Domaća palačinka",
    opis: "Nutela, plazma, šlag...",
    cena: 350,
    kategorija: "Desserts",
    vreme_pripreme: 8,
    slika_url: "/images/palacinka.jpg",
  },
];

const KATEGORIJE = ["Burgers", "Pizzas", "Salads", "Desserts"];
const DODACI_MENI = [
  { id: "k1", naziv: "Kajmak", cena: 80 },
  { id: "s1", naziv: "Slaninica", cena: 60 },
  { id: "d1", naziv: "Dupli kačkavalj", cena: 100 },
];

// Konstante za procenu vremena pripreme - lako se štimuju kasnije
const BUFFER_KASNJENJA_MIN = 10;
const MNOZIOCI_GUZVE = [
  { doAktivnih: 5, mnozilac: 1 },
  { doAktivnih: 10, mnozilac: 1.3 },
  { doAktivnih: Infinity, mnozilac: 1.6 },
];

const REDOSLED_STATUSA = [
  "novo",
  "u_pripremi",
  "spremno_za_dostavu",
  "zavrseno",
];

// Kuhinja/admin panel ostaje UVEK na srpskom, ne prati jezik kupca
const NAZIV_STATUSA = {
  novo: "Novo",
  u_pripremi: "U pripremi",
  spremno_za_dostavu: "Spremno za dostavu",
  zavrseno: "Završeno",
};
const NAZIV_SLEDECE_AKCIJE = {
  novo: "Započni pripremu",
  u_pripremi: "Spremno za dostavu",
  spremno_za_dostavu: "Označi završeno",
};

// Status tekst za KUPCA - prati jezik toggle
const PREVOD_STATUSA = {
  sr: {
    novo: "Primljena",
    u_pripremi: "U pripremi",
    spremno_za_dostavu: "Spremno za dostavu",
    zavrseno: "Završeno",
  },
  en: {
    novo: "Received",
    u_pripremi: "In preparation",
    spremno_za_dostavu: "Ready for delivery",
    zavrseno: "Completed",
  },
};

const PREVODI = {
  sr: {
    openNow: "Otvoreno",
    cart: "Tvoja korpa",
    cartEmpty: "Korpa je prazna. Dodaj nešto sa menija!",
    deliveryDetails: "Podaci za dostavu (Plaćanje pouzećem)",
    name: "Tvoje ime",
    phone: "Broj telefona",
    address: "Adresa i stan",
    subtotal: "Cena hrane",
    delivery: "Dostava",
    total: "Ukupno za plaćanje",
    placeOrder: "Potvrdi i naruči",
    trackOrder: "Status porudžbine",
    noOrders: "Trenutno nemaš aktivnih porudžbina.",
    orderId: "Kod tvoje porudžbine",
    statusLabel: "Trenutni status",
    refreshBtn: "Osveži status porudžbine",
    wait: "Sačekaj",
    cooldownNote: "Status možeš proveriti jednom na svaka 3 minuta.",
    premiumExtras: "Izaberi dodatke:",
    addToCart: "Dodaj u korpu",
    menuTab: "Meni",
    cartTab: "Korpa",
    trackTab: "Prati",
    staffTab: "Zaposleni",
    estimatedWait: "Procenjeno vreme čekanja",
    almostDone: "Uskoro gotovo",
    viewCart: "Pogledaj korpu",
    removeItem: "Ukloni",
  },
  en: {
    openNow: "Open Now",
    cart: "Your Cart",
    cartEmpty: "Your cart is empty. Add items from the menu!",
    deliveryDetails: "Delivery Details (Cash on Delivery)",
    name: "Your Name",
    phone: "Phone Number",
    address: "Delivery Address",
    subtotal: "Subtotal",
    delivery: "Delivery",
    total: "Total Payment",
    placeOrder: "Place Order",
    trackOrder: "Track Order",
    noOrders: "No active orders found.",
    orderId: "Your Order ID",
    statusLabel: "Status",
    refreshBtn: "Refresh Status",
    wait: "Wait",
    cooldownNote: "Updates can be requested once every 3 minutes.",
    premiumExtras: "Choose extras:",
    addToCart: "Add to Cart",
    menuTab: "Menu",
    cartTab: "Cart",
    trackTab: "Track",
    staffTab: "Staff",
    estimatedWait: "Estimated wait time",
    almostDone: "Almost done",
    viewCart: "View cart",
    removeItem: "Remove",
  },
};

// ============ POMOĆNE FUNKCIJE ============
function danasnjiDatum() {
  const d = new Date();
  const godina = d.getFullYear();
  const mesec = String(d.getMonth() + 1).padStart(2, "0");
  const dan = String(d.getDate()).padStart(2, "0");
  return `${godina}-${mesec}-${dan}`;
}

function generisiRandomBroj() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function izracunajMnozilacGuzve(brojAktivnih) {
  const stepenik = MNOZIOCI_GUZVE.find((s) => brojAktivnih <= s.doAktivnih);
  return stepenik ? stepenik.mnozilac : 1;
}

function vremeUMilisekundama(vreme) {
  if (!vreme) return null;
  if (typeof vreme.toMillis === "function") return vreme.toMillis();
  if (vreme.seconds) return vreme.seconds * 1000;
  return null;
}

function jeliKasni(porudzbina, sadaMs) {
  const kreiranoMs = vremeUMilisekundama(porudzbina.vreme_kreiranja);
  if (!kreiranoMs || !porudzbina.trajanje_procena_min) return false;
  const pragMs =
    kreiranoMs +
    (porudzbina.trajanje_procena_min - BUFFER_KASNJENJA_MIN) * 60000;
  return sadaMs > pragMs;
}

// ============ KUHINJSKA TABLA (deljena između kuhinja i admin uloge) ============
function KuhinjskaTabla({
  porudzbine,
  sadaTick,
  naNapredujStatus,
  naZatvoriDan,
  zatvaranjeUToku,
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
        <button
          onClick={naZatvoriDan}
          disabled={zatvaranjeUToku}
          className="bg-amber-600 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm hover:bg-amber-700 transition-all"
          aria-label="Zatvori poslovni dan i arhiviraj porudžbine"
        >
          {zatvaranjeUToku
            ? "Zatvaranje u toku..."
            : "Zatvori poslovni dan (Arhiviraj)"}
        </button>
      </div>

      {porudzbine.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">
          Trenutno nema aktivnih porudžbina.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {porudzbine.map((p) => {
            const kasni = jeliKasni(p, sadaTick);
            return (
              <div
                key={p.id}
                className={`bg-white p-4 rounded-xl border shadow-sm ${kasni ? "border-red-500 border-dashed border-2" : "border-slate-100"}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-black text-lg text-slate-900">
                    #{p.broj}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                      kasni
                        ? "bg-red-100 text-red-600"
                        : p.status === "novo"
                          ? "bg-orange-100 text-orange-600"
                          : p.status === "u_pripremi"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {kasni ? "KASNI" : NAZIV_STATUSA[p.status]}
                  </span>
                </div>
                <ul className="text-sm text-slate-700 space-y-1 mb-3">
                  {(p.stavke || []).map((stavka, i) => (
                    <li key={i}>
                      {stavka.kolicina}x {stavka.naziv}
                      {stavka.dodaci && stavka.dodaci.length > 0 && (
                        <span className="text-slate-500">
                          {" "}
                          (+{stavka.dodaci.map((d) => d.naziv).join(", ")})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {NAZIV_SLEDECE_AKCIJE[p.status] && (
                  <button
                    onClick={() => naNapredujStatus(p)}
                    className={`w-full text-white font-bold text-xs py-2.5 rounded-lg transition-all ${
                      kasni
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-slate-900 hover:bg-slate-800"
                    }`}
                    aria-label={`Promeni status porudžbine ${p.broj}`}
                  >
                    {NAZIV_SLEDECE_AKCIJE[p.status]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [jezik, setJezik] = useState("sr");
  const [aktivniTab, setAktivniTab] = useState("meni");
  const [selektovanaKategorija, setSelektovanaKategorija] = useState("Burgers");
  const [otvorenPanelJelo, setOtvorenPanelJelo] = useState(null);
  const [korpa, setKorpa] = useState([]);
  const [izabraniDodaci, setIzabraniDodaci] = useState([]);
  const [forma, setForma] = useState({ ime: "", telefon: "", adresa: "" });
  const [aktivniIdPorudzbine, setAktivniIdPorudzbine] = useState("");
  const [statusPorudzbine, setStatusPorudzbine] = useState(null);
  const [preostaloVreme, setPreostaloVreme] = useState(0);
  const [preostaloCekanjeSek, setPreostaloCekanjeSek] = useState(null);
  const [slanjeUToku, setSlanjeUToku] = useState(false);
  const [osvezavanjeUToku, setOsvezavanjeUToku] = useState(false);

  // Interni panel - auth
  const [pin, setPin] = useState("");
  const [prijavaUToku, setPrijavaUToku] = useState(false);
  const [uloga, setUloga] = useState(null); // 'kuhinja' | 'admin' | null
  const [adminPregled, setAdminPregled] = useState("analitika"); // 'analitika' | 'kuhinja'

  // Kuhinja
  const [porudzbineKuhinja, setPorudzbineKuhinja] = useState([]);
  const [sadaTick, setSadaTick] = useState(Date.now());
  const [zatvaranjeUToku, setZatvaranjeUToku] = useState(false);

  // Admin analitika
  const [analitikaVreme, setAnalitikaVreme] = useState("danas");
  const [analitikaPodaci, setAnalitikaPodaci] = useState([]);
  const [analitikaUcitavanje, setAnalitikaUcitavanje] = useState(false);

  const t = PREVODI[jezik];

  // ---- Učitaj sačuvani broj porudžbine ----
  useEffect(() => {
    const sacuvan = localStorage.getItem("id_porudzbine");
    if (sacuvan) setAktivniIdPorudzbine(sacuvan);
  }, []);

  // ---- Cooldown tajmer (180s) ----
  useEffect(() => {
    if (preostaloVreme <= 0) return;
    const interval = setInterval(() => setPreostaloVreme((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [preostaloVreme]);

  // ---- Procena preostalog čekanja - lokalno tiktakanje, bez Firestore poziva ----
  useEffect(() => {
    if (!statusPorudzbine || !statusPorudzbine.vreme_kreiranja) {
      setPreostaloCekanjeSek(null);
      return;
    }
    const izracunaj = () => {
      const kreiranoMs = vremeUMilisekundama(statusPorudzbine.vreme_kreiranja);
      if (!kreiranoMs) return;
      const krajMs = kreiranoMs + statusPorudzbine.trajanje_procena_min * 60000;
      setPreostaloCekanjeSek(Math.round((krajMs - Date.now()) / 1000));
    };
    izracunaj();
    const interval = setInterval(izracunaj, 1000);
    return () => clearInterval(interval);
  }, [statusPorudzbine]);

  // ---- Firebase Auth state + custom claim uloga ----
  useEffect(() => {
    const odjava = onAuthStateChanged(auth, async (korisnik) => {
      if (korisnik) {
        const tokenRezultat = await korisnik.getIdTokenResult();
        setUloga(tokenRezultat.claims.role || null);
      } else {
        setUloga(null);
      }
    });
    return () => odjava();
  }, []);

  // ---- Realtime kuhinjska tabla (kuhinja uloga, ili admin kad izabere prikaz) ----
  useEffect(() => {
    const prikaziKuhinju =
      uloga === "kuhinja" || (uloga === "admin" && adminPregled === "kuhinja");
    if (!prikaziKuhinju) {
      setPorudzbineKuhinja([]);
      return;
    }
    const q = query(
      collection(db, "porudzbine"),
      where("datum", "==", danasnjiDatum()),
      where("status", "in", ["novo", "u_pripremi", "spremno_za_dostavu"]),
      orderBy("vreme_kreiranja", "asc"),
    );
    const odjava = onSnapshot(
      q,
      (snap) =>
        setPorudzbineKuhinja(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (greska) => console.error("Greška pri praćenju porudžbina:", greska),
    );
    return () => odjava();
  }, [uloga, adminPregled]);

  // ---- Osvežavanje "kasni" indikatora na svakih 30s ----
  useEffect(() => {
    const interval = setInterval(() => setSadaTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // ---- Učitaj analitiku kad se promeni period ili tab ----
  useEffect(() => {
    if (uloga === "admin" && adminPregled === "analitika") {
      ucitajAnalitiku(analitikaVreme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uloga, adminPregled, analitikaVreme]);

  // ---- Auto-učitaj status porudžbine kad korisnik otvori "Prati" sa sačuvanim brojem ----
  useEffect(() => {
    if (aktivniIdPorudzbine && !statusPorudzbine) {
      osveziStatusPorudzbine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktivniIdPorudzbine]);

  const cenaStavki = korpa.reduce(
    (sum, item) => sum + item.cena_po_komadu * item.kolicina,
    0,
  );
  const trosakDostave = cenaStavki > 0 && cenaStavki < 1500 ? 200 : 0;
  const ukupnaCena = cenaStavki + trosakDostave;
  const brojStavkiKorpe = korpa.reduce((s, i) => s + i.kolicina, 0);

  const otvoriDodatke = (jelo) => {
    setOtvorenPanelJelo(jelo);
    setIzabraniDodaci([]);
  };

  const hendlajDodatak = (dodatak) => {
    setIzabraniDodaci((prev) =>
      prev.find((d) => d.id === dodatak.id)
        ? prev.filter((d) => d.id !== dodatak.id)
        : [...prev, dodatak],
    );
  };

  const dodajUKorpu = () => {
    const cenaDodataka = izabraniDodaci.reduce((sum, d) => sum + d.cena, 0);
    setKorpa((prev) => [
      ...prev,
      {
        id_stavke: Date.now().toString(),
        naziv: otvorenPanelJelo.naziv,
        cena_po_komadu: otvorenPanelJelo.cena + cenaDodataka,
        vreme_pripreme: otvorenPanelJelo.vreme_pripreme,
        dodaci: izabraniDodaci,
        kolicina: 1,
      },
    ]);
    setOtvorenPanelJelo(null);
  };

  const promeniKolicinu = (id_stavke, smer) => {
    setKorpa((prev) =>
      prev
        .map((item) => {
          if (item.id_stavke !== id_stavke) return item;
          const novaKolicina =
            smer === "+" ? item.kolicina + 1 : item.kolicina - 1;
          return { ...item, kolicina: novaKolicina };
        })
        .filter((item) => item.kolicina > 0),
    );
  };

  const ukloniStavku = (id_stavke) => {
    setKorpa((prev) => prev.filter((item) => item.id_stavke !== id_stavke));
  };

  // ---- Prijava osoblja - pravi Firebase Auth, PIN = lozinka (min 6 cifara) ----
  const hendlajLogin = async (e) => {
    e.preventDefault();
    if (pin.length < 6 || prijavaUToku) return;
    setPrijavaUToku(true);
    try {
      await signInWithEmailAndPassword(auth, KUHINJA_EMAIL, pin);
    } catch (greskaKuhinja) {
      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pin);
      } catch (greskaAdmin) {
        alert("Netačan PIN kod!");
      }
    } finally {
      setPin("");
      setPrijavaUToku(false);
    }
  };

  const hendlajOdjavu = async () => {
    await signOut(auth);
    setAdminPregled("analitika");
  };

  // ---- Procena trajanja pripreme: bazno vreme najsporije stavke x množilac gužve ----
  const izracunajTrajanjeProcene = async () => {
    const bazno = Math.max(...korpa.map((item) => item.vreme_pripreme || 15));
    let mnozilac = 1;
    try {
      const q = query(
        collection(db, "porudzbine"),
        where("datum", "==", danasnjiDatum()),
        where("status", "in", ["novo", "u_pripremi"]),
      );
      const rezultat = await getCountFromServer(q);
      mnozilac = izracunajMnozilacGuzve(rezultat.data().count);
    } catch (greska) {
      console.error(
        "Greška pri proveri gužve, koristim podrazumevani množilac:",
        greska,
      );
    }
    return Math.round(bazno * mnozilac);
  };

  // ---- Slanje porudžbine: transakcija upisuje pun dokument + javni status dokument ----
  const posaljiPorudzbinu = async (e) => {
    e.preventDefault();
    if (korpa.length === 0 || slanjeUToku) return;
    setSlanjeUToku(true);
    try {
      const trajanjeProcena = await izracunajTrajanjeProcene();
      let finalniBroj = "";

      await runTransaction(db, async (tx) => {
        let broj = generisiRandomBroj();
        let statusRef = doc(db, "status_porudzbine", broj);
        let statusSnap = await tx.get(statusRef);
        let pokusaji = 0;
        while (statusSnap.exists() && pokusaji < 5) {
          broj = generisiRandomBroj();
          statusRef = doc(db, "status_porudzbine", broj);
          statusSnap = await tx.get(statusRef);
          pokusaji++;
        }
        finalniBroj = broj;

        const porudzbinaRef = doc(collection(db, "porudzbine"));
        tx.set(porudzbinaRef, {
          broj,
          ime: forma.ime,
          telefon: forma.telefon,
          adresa: forma.adresa,
          stavke: korpa,
          cena_ukupno: ukupnaCena,
          nacin_placanja: "gotovina",
          status: "novo",
          datum: danasnjiDatum(),
          vreme_kreiranja: serverTimestamp(),
          trajanje_procena_min: trajanjeProcena,
        });
        tx.set(statusRef, {
          status: "novo",
          vreme_kreiranja: serverTimestamp(),
          trajanje_procena_min: trajanjeProcena,
        });
      });

      localStorage.setItem("id_porudzbine", finalniBroj);
      setAktivniIdPorudzbine(finalniBroj);
      setStatusPorudzbine(null);
      setKorpa([]);
      setForma({ ime: "", telefon: "", adresa: "" });
      setAktivniTab("prati");
    } catch (greska) {
      console.error("Greška prilikom slanja porudžbine:", greska);
      alert("Došlo je do greške prilikom slanja porudžbine. Pokušaj ponovo.");
    } finally {
      setSlanjeUToku(false);
    }
  };

  // ---- Ručno osvežavanje statusa (i inicijalni auto-load), 180s cooldown ----
  const osveziStatusPorudzbine = async () => {
    if (!aktivniIdPorudzbine || preostaloVreme > 0 || osvezavanjeUToku) return;
    setOsvezavanjeUToku(true);
    try {
      const snap = await getDoc(
        doc(db, "status_porudzbine", aktivniIdPorudzbine),
      );
      if (snap.exists()) {
        setStatusPorudzbine(snap.data());
      } else {
        setStatusPorudzbine(null);
        localStorage.removeItem("id_porudzbine");
        setAktivniIdPorudzbine("");
      }
      setPreostaloVreme(180);
    } catch (greska) {
      console.error("Greška pri osvežavanju statusa:", greska);
    } finally {
      setOsvezavanjeUToku(false);
    }
  };

  // ---- Kuhinja: pomeranje statusa na sledeći korak (oba dokumenta u batch-u) ----
  const napredujStatus = async (porudzbina) => {
    const indeks = REDOSLED_STATUSA.indexOf(porudzbina.status);
    const sledeci = REDOSLED_STATUSA[indeks + 1];
    if (!sledeci) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "porudzbine", porudzbina.id), { status: sledeci });
      batch.update(doc(db, "status_porudzbine", porudzbina.broj), {
        status: sledeci,
      });
      await batch.commit();
    } catch (greska) {
      console.error("Greška pri promeni statusa:", greska);
      alert("Nije uspelo ažuriranje statusa, pokušaj ponovo.");
    }
  };

  // ---- Zatvaranje poslovnog dana: agregacija + arhiviranje + batch brisanje (≤500 po paketu) ----
  const zatvoriPoslovniDan = async () => {
    if (zatvaranjeUToku) return;
    if (
      !window.confirm(
        "Da li si siguran? Sve današnje porudžbine će biti arhivirane i obrisane.",
      )
    )
      return;
    setZatvaranjeUToku(true);
    try {
      // Napomena: izvestaji/{datum} sme da čita samo admin (poverljivi prihodi),
      // pa se provera "da li je dan već zatvoren" radi preko lakšeg javnog
      // markera izvestaji_status/{datum} koji sme da čita i kuhinja.
      const statusZatvaranjaRef = doc(db, "izvestaji_status", danasnjiDatum());
      const postojeciStatusZatvaranja = await getDoc(statusZatvaranjaRef);
      if (postojeciStatusZatvaranja.exists()) {
        alert("Poslovni dan je već zatvoren za danas.");
        return;
      }

      const q = query(
        collection(db, "porudzbine"),
        where("datum", "==", danasnjiDatum()),
      );
      const snap = await getDocs(q);

      let ukupnoPorudzbina = 0;
      let ukupanPrihod = 0;
      const najprodavanije = {};

      snap.docs.forEach((d) => {
        const podaci = d.data();
        ukupnoPorudzbina += 1;
        ukupanPrihod += podaci.cena_ukupno || 0;
        (podaci.stavke || []).forEach((stavka) => {
          najprodavanije[stavka.naziv] =
            (najprodavanije[stavka.naziv] || 0) + stavka.kolicina;
        });
      });

      const izvestajRef = doc(db, "izvestaji", danasnjiDatum());
      const paketIzvestaja = writeBatch(db);
      paketIzvestaja.set(izvestajRef, {
        total_orders: ukupnoPorudzbina,
        total_revenue: ukupanPrihod,
        top_items: najprodavanije,
        kreiran: serverTimestamp(),
      });
      paketIzvestaja.set(statusZatvaranjaRef, {
        zatvoren: true,
        zatvoren_u: serverTimestamp(),
      });
      await paketIzvestaja.commit();

      // 2 brisanja po porudžbini (porudzbine + status_porudzbine) => max 250 porudžbina po paketu od 500
      const VELICINA_PAKETA = 250;
      for (let i = 0; i < snap.docs.length; i += VELICINA_PAKETA) {
        const paket = writeBatch(db);
        const grupa = snap.docs.slice(i, i + VELICINA_PAKETA);
        grupa.forEach((d) => {
          paket.delete(doc(db, "porudzbine", d.id));
          paket.delete(doc(db, "status_porudzbine", d.data().broj));
        });
        await paket.commit();
      }

      alert(`Dan zatvoren. Arhivirano ${ukupnoPorudzbina} porudžbina.`);
    } catch (greska) {
      console.error("Greška pri zatvaranju poslovnog dana:", greska);
      alert("Došlo je do greške. Pokušaj ponovo.");
    } finally {
      setZatvaranjeUToku(false);
    }
  };

  // ---- Admin analitika: čita samo izveštaje, ručno osvežavanje ----
  const ucitajAnalitiku = async (period) => {
    setAnalitikaUcitavanje(true);
    try {
      if (period === "danas") {
        const snap = await getDoc(doc(db, "izvestaji", danasnjiDatum()));
        setAnalitikaPodaci(snap.exists() ? [snap.data()] : []);
        return;
      }

      let q;
      if (period === "nedelja") {
        q = query(
          collection(db, "izvestaji"),
          orderBy(documentId(), "desc"),
          limit(7),
        );
      } else if (period === "mesec") {
        q = query(
          collection(db, "izvestaji"),
          orderBy(documentId(), "desc"),
          limit(30),
        );
      } else {
        const godina = new Date().getFullYear();
        q = query(
          collection(db, "izvestaji"),
          where(documentId(), ">=", `${godina}-01-01`),
          where(documentId(), "<=", `${godina}-12-31`),
          orderBy(documentId(), "asc"),
        );
      }
      const snap = await getDocs(q);
      setAnalitikaPodaci(snap.docs.map((d) => d.data()));
    } catch (greska) {
      console.error("Greška pri učitavanju analitike:", greska);
      setAnalitikaPodaci([]);
    } finally {
      setAnalitikaUcitavanje(false);
    }
  };

  const zbirAnalitike = analitikaPodaci.reduce(
    (zbir, izvestaj) => {
      zbir.ukupnoPorudzbina += izvestaj.total_orders || 0;
      zbir.ukupanPrihod += izvestaj.total_revenue || 0;
      Object.entries(izvestaj.top_items || {}).forEach(([naziv, kolicina]) => {
        zbir.topStavke[naziv] = (zbir.topStavke[naziv] || 0) + kolicina;
      });
      return zbir;
    },
    { ukupnoPorudzbina: 0, ukupanPrihod: 0, topStavke: {} },
  );

  const topPetStavki = Object.entries(zbirAnalitike.topStavke)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-24 font-sans antialiased text-slate-800">
      <Head>
        <title>Gradski Zalogaj — Naruči online</title>
        <meta
          name="description"
          content="Naručite omiljenu hranu online iz Gradskog Zalogaja. Brza dostava, plaćanje pouzećem."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Restaurant",
              name: "Gradski Zalogaj",
              servesCuisine: "Balkan",
              priceRange: "$$",
            }),
          }}
        />
      </Head>

      <header className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-40">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Gradski Zalogaj
          </h1>
          <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>{" "}
            {t.openNow}
          </p>
        </div>
        <button
          onClick={() => setJezik(jezik === "sr" ? "en" : "sr")}
          className="text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-all uppercase"
          aria-label="Promeni jezik"
        >
          {jezik === "sr" ? "EN" : "SR"}
        </button>
      </header>

      {aktivniTab === "meni" && (
        <main className="p-4">
          <div className="flex gap-2 overflow-x-auto pb-4 whitespace-nowrap">
            {KATEGORIJE.map((kat) => (
              <button
                key={kat}
                onClick={() => setSelektovanaKategorija(kat)}
                className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${
                  selektovanaKategorija === kat
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-white text-slate-600 border border-slate-100"
                }`}
              >
                {kat}
              </button>
            ))}
          </div>

          <div className="space-y-3 mt-2">
            {JELOVNIK.filter((j) => j.kategorija === selektovanaKategorija).map(
              (jelo) => (
                <div
                  key={jelo.id}
                  className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3"
                >
                  <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100">
                    <Image
                      src={jelo.slika_url}
                      alt={jelo.naziv}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base truncate">
                      {jelo.naziv}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {jelo.opis}
                    </p>
                    <p className="font-extrabold text-slate-900 mt-2">
                      {jelo.cena} RSD
                    </p>
                  </div>
                  <button
                    onClick={() => otvoriDodatke(jelo)}
                    aria-label={`Dodaj ${jelo.naziv}`}
                    className="bg-slate-900 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-md flex-shrink-0"
                  >
                    +
                  </button>
                </div>
              ),
            )}
          </div>
        </main>
      )}

      {aktivniTab === "korpa" && (
        <main className="p-4">
          <h2 className="text-lg font-bold text-slate-900 mb-4">{t.cart}</h2>
          {korpa.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              {t.cartEmpty}
            </p>
          ) : (
            <div className="space-y-3">
              {korpa.map((item) => (
                <div
                  key={item.id_stavke}
                  className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {item.naziv}
                    </h4>
                    {item.dodaci.length > 0 && (
                      <p className="text-[11px] text-slate-500 font-medium">
                        + {item.dodaci.map((d) => d.naziv).join(", ")}
                      </p>
                    )}
                    <p className="font-bold text-slate-900 text-xs mt-1">
                      {item.cena_po_komadu * item.kolicina} RSD
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 rounded-lg flex items-center p-1 gap-2">
                      <button
                        onClick={() => promeniKolicinu(item.id_stavke, "-")}
                        className="px-2 font-bold text-slate-700"
                        aria-label="Smanji količinu"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-slate-900">
                        {item.kolicina}
                      </span>
                      <button
                        onClick={() => promeniKolicinu(item.id_stavke, "+")}
                        className="px-2 font-bold text-slate-700"
                        aria-label="Povećaj količinu"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => ukloniStavku(item.id_stavke)}
                      className="text-slate-500 hover:text-red-600 font-bold text-sm p-1"
                      aria-label={`${t.removeItem} ${item.naziv}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-xs space-y-2 mt-4">
                <div className="flex justify-between text-slate-500">
                  <span>{t.subtotal}:</span>
                  <span className="font-bold">{cenaStavki} RSD</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>{t.delivery}:</span>
                  <span className="font-bold">{trosakDostave} RSD</span>
                </div>
                <hr className="border-slate-100 my-1" />
                <div className="flex justify-between text-slate-950 font-black text-sm">
                  <span>{t.total}:</span>
                  <span>{ukupnaCena} RSD</span>
                </div>
              </div>

              <form
                onSubmit={posaljiPorudzbinu}
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mt-4 space-y-3"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {t.deliveryDetails}
                </h3>
                <input
                  required
                  type="text"
                  placeholder={t.name}
                  value={forma.ime}
                  onChange={(e) => setForma({ ...forma, ime: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                  aria-label={t.name}
                />
                <input
                  required
                  type="tel"
                  placeholder={t.phone}
                  value={forma.telefon}
                  onChange={(e) =>
                    setForma({ ...forma, telefon: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                  aria-label={t.phone}
                />
                <input
                  required
                  type="text"
                  placeholder={t.address}
                  value={forma.adresa}
                  onChange={(e) =>
                    setForma({ ...forma, adresa: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                  aria-label={t.address}
                />
                <button
                  type="submit"
                  disabled={slanjeUToku}
                  className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-bold p-3.5 rounded-xl shadow-md text-sm transition-all hover:bg-slate-800"
                >
                  {slanjeUToku ? "..." : t.placeOrder}
                </button>
              </form>
            </div>
          )}
        </main>
      )}

      {aktivniTab === "prati" && (
        <main className="p-4 text-center">
          <h2 className="text-lg font-bold text-slate-900 mb-6">
            {t.trackOrder}
          </h2>
          {!aktivniIdPorudzbine ? (
            <p className="text-slate-500 text-sm py-8">{t.noOrders}</p>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                {t.orderId}
              </span>
              <p className="text-2xl font-black text-slate-900 mt-0">
                #{aktivniIdPorudzbine}
              </p>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm">
                <span className="text-xs text-slate-500 block mb-0.5">
                  {t.statusLabel}:
                </span>
                <span className="font-extrabold text-amber-600">
                  {statusPorudzbine
                    ? PREVOD_STATUSA[jezik][statusPorudzbine.status]
                    : "—"}
                </span>
              </div>

              {statusPorudzbine && statusPorudzbine.status !== "zavrseno" && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm">
                  <span className="text-xs text-slate-500 block mb-0.5">
                    {t.estimatedWait}:
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {preostaloCekanjeSek === null
                      ? "—"
                      : preostaloCekanjeSek <= 0
                        ? t.almostDone
                        : `~${Math.ceil(preostaloCekanjeSek / 60)} min`}
                  </span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 font-medium">
                {t.cooldownNote}
              </p>
              <button
                onClick={osveziStatusPorudzbine}
                disabled={preostaloVreme > 0 || osvezavanjeUToku}
                className={`w-full font-bold text-sm p-3.5 rounded-xl shadow-sm transition-all ${
                  preostaloVreme > 0 || osvezavanjeUToku
                    ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
                aria-label={t.refreshBtn}
              >
                {preostaloVreme > 0
                  ? `${t.wait} (${Math.floor(preostaloVreme / 60)}:${String(preostaloVreme % 60).padStart(2, "0")})`
                  : osvezavanjeUToku
                    ? "..."
                    : t.refreshBtn}
              </button>
            </div>
          )}
        </main>
      )}

      {aktivniTab === "interni" && (
        <main className="p-4">
          {!uloga ? (
            <form
              onSubmit={hendlajLogin}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center space-y-4 max-w-sm mx-auto mt-12"
            >
              <h2 className="text-lg font-bold text-slate-900">Staff Portal</h2>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Unesi 6-cifreni PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-slate-200 rounded-lg p-3 text-center text-lg tracking-widest focus:outline-none focus:border-slate-400"
                aria-label="PIN kod"
              />
              <button
                type="submit"
                disabled={prijavaUToku}
                className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-bold p-3 rounded-xl text-sm"
              >
                {prijavaUToku ? "Prijava..." : "Login"}
              </button>
            </form>
          ) : uloga === "kuhinja" ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">
                  Kitchen Display
                </h2>
                <button
                  onClick={hendlajOdjavu}
                  className="text-xs text-red-500 font-bold"
                >
                  Logout
                </button>
              </div>
              <KuhinjskaTabla
                porudzbine={porudzbineKuhinja}
                sadaTick={sadaTick}
                naNapredujStatus={napredujStatus}
                naZatvoriDan={zatvoriPoslovniDan}
                zatvaranjeUToku={zatvaranjeUToku}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">
                  Owner Dashboard
                </h2>
                <button
                  onClick={hendlajOdjavu}
                  className="text-xs text-red-500 font-bold"
                >
                  Logout
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setAdminPregled("analitika")}
                  className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${adminPregled === "analitika" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  Analitika
                </button>
                <button
                  onClick={() => setAdminPregled("kuhinja")}
                  className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${adminPregled === "kuhinja" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  Kuhinja
                </button>
              </div>

              {adminPregled === "kuhinja" ? (
                <KuhinjskaTabla
                  porudzbine={porudzbineKuhinja}
                  sadaTick={sadaTick}
                  naNapredujStatus={napredujStatus}
                  naZatvoriDan={zatvoriPoslovniDan}
                  zatvaranjeUToku={zatvaranjeUToku}
                />
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl">
                    {["danas", "nedelja", "mesec", "godina"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAnalitikaVreme(v)}
                        className={`text-[11px] uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${analitikaVreme === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  {analitikaUcitavanje ? (
                    <p className="text-center text-slate-500 text-sm py-6">
                      Učitavanje...
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">
                            Porudžbine
                          </span>
                          <span className="text-xl font-black text-slate-800">
                            {zbirAnalitike.ukupnoPorudzbina}
                          </span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">
                            Prihod
                          </span>
                          <span className="text-xl font-black text-emerald-600">
                            {zbirAnalitike.ukupanPrihod.toLocaleString("sr-RS")}{" "}
                            RSD
                          </span>
                        </div>
                      </div>

                      {topPetStavki.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">
                            Najprodavanije
                          </span>
                          <ul className="text-sm space-y-1">
                            {topPetStavki.map(([naziv, kolicina]) => (
                              <li key={naziv} className="flex justify-between">
                                <span className="text-slate-700">{naziv}</span>
                                <span className="font-bold text-slate-900">
                                  {kolicina}x
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        onClick={() => ucitajAnalitiku(analitikaVreme)}
                        className="w-full text-xs font-bold text-slate-500 py-2"
                      >
                        Osveži
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      )}

      {otvorenPanelJelo && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={() => setOtvorenPanelJelo(null)}
        >
          <div
            className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 space-y-4 shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">
                {otvorenPanelJelo.naziv}
              </h3>
              <button
                onClick={() => setOtvorenPanelJelo(null)}
                className="text-slate-500 hover:text-slate-600 font-bold text-xl p-1"
                aria-label="Zatvori"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t.premiumExtras}
              </span>
              {DODACI_MENI.map((dodatak) => {
                const jeIzabran = izabraniDodaci.some(
                  (d) => d.id === dodatak.id,
                );
                return (
                  <button
                    key={dodatak.id}
                    onClick={() => hendlajDodatak(dodatak)}
                    className={`w-full flex justify-between items-center p-3 rounded-xl border text-sm font-bold transition-all ${
                      jeIzabran
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{dodatak.naziv}</span>
                    <span>+{dodatak.cena} RSD</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={dodajUKorpu}
              className="w-full bg-slate-900 text-white font-bold p-4 rounded-xl text-sm transition-all hover:bg-slate-800 shadow-md"
            >
              {t.addToCart}
            </button>
          </div>
        </div>
      )}

      {aktivniTab === "meni" && korpa.length > 0 && (
        <button
          onClick={() => setAktivniTab("korpa")}
          className="fixed bottom-[72px] left-4 right-4 max-w-md mx-auto bg-emerald-600 text-white font-bold text-sm py-3.5 rounded-xl shadow-lg z-40 flex justify-between items-center px-5"
          aria-label={t.viewCart}
        >
          <span>
            {t.viewCart} ({brojStavkiKorpe}{" "}
            {brojStavkiKorpe === 1 ? "stavka" : "stavke"})
          </span>
          <span>{cenaStavki} RSD</span>
        </button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 py-2 px-4 flex justify-between items-center shadow-lg z-40">
        <button
          onClick={() => setAktivniTab("meni")}
          className={`flex flex-col items-center gap-0.5 ${aktivniTab === "meni" ? "text-slate-900 font-bold" : "text-slate-500"}`}
        >
          <span className="text-lg" role="img" aria-label="Meni">
            📋
          </span>
          <span className="text-[10px]">{t.menuTab}</span>
        </button>
        <button
          onClick={() => setAktivniTab("korpa")}
          className={`flex flex-col items-center gap-0.5 ${aktivniTab === "korpa" ? "text-slate-900 font-bold" : "text-slate-500"}`}
        >
          <span className="text-lg" role="img" aria-label="Korpa">
            🛍️
          </span>
          <span className="text-[10px]">{t.cartTab}</span>
        </button>
        <button
          onClick={() => setAktivniTab("prati")}
          className={`flex flex-col items-center gap-0.5 ${aktivniTab === "prati" ? "text-slate-900 font-bold" : "text-slate-500"}`}
        >
          <span className="text-lg" role="img" aria-label="Prati">
            ⏱️
          </span>
          <span className="text-[10px]">{t.trackTab}</span>
        </button>
        <button
          onClick={() => setAktivniTab("interni")}
          className={`flex flex-col items-center gap-0.5 ${aktivniTab === "interni" ? "text-slate-900 font-bold" : "text-slate-500"}`}
        >
          <span className="text-lg" role="img" aria-label="Zaposleni">
            🔒
          </span>
          <span className="text-[10px]">{t.staffTab}</span>
        </button>
      </nav>
    </div>
  );
}
