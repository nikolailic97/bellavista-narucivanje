import { useState, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  runTransaction,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  danasnjiDatum,
  generisiRandomBroj,
  vremeUMilisekundama,
} from "../lib/pomocne";

// ============ TODO: ZAMENI KAD DOBIJEMO FINALNI NAZIV/LOGO ============
const NAZIV_RESTORANA = "Restoran"; // koristi se u title/meta/JSON-LD, logo slika ide preko /images/logo.png
const INSTAGRAM_URL = "https://instagram.com/"; // TODO: zameni pravim profilom
const KONTAKT_TELEFON = "+381 60 000 0000"; // TODO: zameni pravim brojem
const SAJT_ILICODE = "https://ilicodes.com";
const PRAG_BESPLATNE_DOSTAVE = 1600;
const CENA_DOSTAVE = 200;

// next/image ne dodaje automatski basePath na ručno unete src putanje kad je
// output:"export" + images.unoptimized:true (samo _next/next/link to rade
// automatski) - zato ovde ručno dodajemo prefiks svuda gde referenciramo
// sliku iz /public foldera. Kad se doda custom domen, NEXT_PUBLIC_BASE_PATH
// se briše iz workflow-a i ovo automatski postaje prazan string.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// ============ STATIČNI PODACI (jelovnik se ne čuva u Firestore-u) ============
const KATEGORIJE = [
  { id: "burgeri", sr: "Burgeri", en: "Burgers" },
  { id: "pice", sr: "Pice", en: "Pizzas" },
  { id: "salate", sr: "Salate", en: "Salads" },
  { id: "deserti", sr: "Deserti", en: "Desserts" },
];

const JELOVNIK = [
  {
    id: "1",
    naziv: { sr: "Gurmanska pljeskavica", en: "Gourmet Burger" },
    opis: {
      sr: "Kačkavalj, slaninica, tucana paprika, luk...",
      en: "Cheese, bacon, roasted peppers, onion...",
    },
    sastojci: {
      sr: "300g pljeskavica od junećeg mesa, pecivo sa susamom, kačkavalj, slaninica, tucana paprika, crni luk, zelena salata, domaći sos.",
      en: "300g beef patty, sesame bun, cheese, bacon, roasted peppers, red onion, lettuce, house sauce.",
    },
    tagovi: [],
    cena: 450,
    kategorija: "burgeri",
    vreme_pripreme: 15,
    slika_url: `${BASE_PATH}/images/pljeskavica.webp`,
  },
  {
    id: "2",
    naziv: { sr: "Margarita Pica", en: "Margherita Pizza" },
    opis: {
      sr: "Pelat, kačkavalj, masline, origano...",
      en: "Tomato sauce, cheese, olives, oregano...",
    },
    sastojci: {
      sr: "Domaće testo, pelat sos od paradajza, kačkavalj, masline, sveži bosiljak, origano, maslinovo ulje.",
      en: "House dough, tomato sauce, cheese, olives, fresh basil, oregano, olive oil.",
    },
    tagovi: ["vegetarijansko"],
    cena: 800,
    kategorija: "pice",
    vreme_pripreme: 25,
    slika_url: `${BASE_PATH}/images/margarita.webp`,
  },
  {
    id: "3",
    naziv: { sr: "Cezar salata", en: "Caesar Salad" },
    opis: {
      sr: "Piletina, krutoni, cezar dresing...",
      en: "Chicken, croutons, caesar dressing...",
    },
    sastojci: {
      sr: "Piletina na žaru, listovi rimske salate, krutoni, parmezan, cezar dresing.",
      en: "Grilled chicken, romaine lettuce, croutons, parmesan, caesar dressing.",
    },
    tagovi: [],
    cena: 650,
    kategorija: "salate",
    vreme_pripreme: 10,
    slika_url: `${BASE_PATH}/images/cezar-salata.webp`,
  },
  {
    id: "4",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    sastojci: {
      sr: "Tanka palačinka, čokoladni krem, mrvice plazma keksa, šlag, listić nane.",
      en: "Thin pancake, chocolate spread, crushed biscuits, whipped cream, mint leaf.",
    },
    tagovi: ["vegetarijansko"],
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "5",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "6",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "7",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "8",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "9",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "10",
    naziv: { sr: "Gurmanska pljeskavica", en: "Gourmet Burger" },
    opis: {
      sr: "Kačkavalj, slaninica, tucana paprika, luk...",
      en: "Cheese, bacon, roasted peppers, onion...",
    },
    cena: 450,
    kategorija: "burgeri",
    vreme_pripreme: 15,
    slika_url: `${BASE_PATH}/images/pljeskavica.webp`,
  },
  {
    id: "11",
    naziv: { sr: "Margarita Pica", en: "Margherita Pizza" },
    opis: {
      sr: "Pelat, kačkavalj, masline, origano...",
      en: "Tomato sauce, cheese, olives, oregano...",
    },
    cena: 800,
    kategorija: "pice",
    vreme_pripreme: 25,
    slika_url: `${BASE_PATH}/images/margarita.webp`,
  },
  {
    id: "12",
    naziv: { sr: "Cezar salata", en: "Caesar Salad" },
    opis: {
      sr: "Piletina, krutoni, cezar dresing...",
      en: "Chicken, croutons, caesar dressing...",
    },
    cena: 650,
    kategorija: "salate",
    vreme_pripreme: 10,
    slika_url: `${BASE_PATH}/images/cezar-salata.webp`,
  },
  {
    id: "13",
    naziv: { sr: "Gurmanska pljeskavica", en: "Gourmet Burger" },
    opis: {
      sr: "Kačkavalj, slaninica, tucana paprika, luk...",
      en: "Cheese, bacon, roasted peppers, onion...",
    },
    cena: 450,
    kategorija: "burgeri",
    vreme_pripreme: 15,
    slika_url: `${BASE_PATH}/images/pljeskavica.webp`,
  },
  {
    id: "14",
    naziv: { sr: "Margarita Pica", en: "Margherita Pizza" },
    opis: {
      sr: "Pelat, kačkavalj, masline, origano...",
      en: "Tomato sauce, cheese, olives, oregano...",
    },
    cena: 800,
    kategorija: "pice",
    vreme_pripreme: 25,
    slika_url: `${BASE_PATH}/images/margarita.webp`,
  },
  {
    id: "15",
    naziv: { sr: "Cezar salata", en: "Caesar Salad" },
    opis: {
      sr: "Piletina, krutoni, cezar dresing...",
      en: "Chicken, croutons, caesar dressing...",
    },
    cena: 650,
    kategorija: "salate",
    vreme_pripreme: 10,
    slika_url: `${BASE_PATH}/images/cezar-salata.webp`,
  },
  {
    id: "16",
    naziv: { sr: "Gurmanska pljeskavica", en: "Gourmet Burger" },
    opis: {
      sr: "Kačkavalj, slaninica, tucana paprika, luk...",
      en: "Cheese, bacon, roasted peppers, onion...",
    },
    cena: 450,
    kategorija: "burgeri",
    vreme_pripreme: 15,
    slika_url: `${BASE_PATH}/images/pljeskavica.webp`,
  },
  {
    id: "17",
    naziv: { sr: "Margarita Pica", en: "Margherita Pizza" },
    opis: {
      sr: "Pelat, kačkavalj, masline, origano...",
      en: "Tomato sauce, cheese, olives, oregano...",
    },
    cena: 800,
    kategorija: "pice",
    vreme_pripreme: 25,
    slika_url: `${BASE_PATH}/images/margarita.webp`,
  },
  {
    id: "18",
    naziv: { sr: "Cezar salata", en: "Caesar Salad" },
    opis: {
      sr: "Piletina, krutoni, cezar dresing...",
      en: "Chicken, croutons, caesar dressing...",
    },
    cena: 650,
    kategorija: "salate",
    vreme_pripreme: 10,
    slika_url: `${BASE_PATH}/images/cezar-salata.webp`,
  },
];

const DODACI_PO_KATEGORIJI = {
  burgeri: [
    { id: "k1", naziv: { sr: "Kajmak", en: "Kaymak" }, cena: 80 },
    { id: "s1", naziv: { sr: "Slaninica", en: "Bacon" }, cena: 60 },
    {
      id: "d1",
      naziv: { sr: "Dupli kačkavalj", en: "Extra cheese" },
      cena: 100,
    },
  ],
  pice: [
    { id: "p1", naziv: { sr: "Ekstra sir", en: "Extra cheese" }, cena: 100 },
    { id: "p2", naziv: { sr: "Pečurke", en: "Mushrooms" }, cena: 80 },
    { id: "p3", naziv: { sr: "Šunka", en: "Ham" }, cena: 90 },
    {
      id: "p4",
      naziv: { sr: "Ljuta papričica", en: "Chili peppers" },
      cena: 50,
    },
  ],
  salate: [
    {
      id: "sl1",
      naziv: { sr: "Ekstra piletina", en: "Extra chicken" },
      cena: 120,
    },
    { id: "sl2", naziv: { sr: "Avokado", en: "Avocado" }, cena: 100 },
    { id: "sl3", naziv: { sr: "Feta sir", en: "Feta cheese" }, cena: 80 },
    { id: "sl4", naziv: { sr: "Susam", en: "Sesame seeds" }, cena: 40 },
  ],
  deserti: [
    { id: "de1", naziv: { sr: "Banana", en: "Banana" }, cena: 50 },
    { id: "de2", naziv: { sr: "Jagode", en: "Strawberries" }, cena: 70 },
    { id: "de3", naziv: { sr: "Lešnici", en: "Crushed hazelnuts" }, cena: 60 },
    {
      id: "de4",
      naziv: { sr: "Kugla sladoleda", en: "Scoop of ice cream" },
      cena: 90,
    },
  ],
};

// Tagovi na stavkama menija (npr. zeleni "VEGAN" u desnom uglu kartice).
// Dodaj "tagovi: ['vegan']" (ili koji god ključ) na stavku u JELOVNIK-u.
const TAGOVI_INFO = {
  vegan: { sr: "Vegan", en: "Vegan", boja: "bg-emerald-100 text-emerald-700" },
  vegetarijansko: {
    sr: "Vegetarijansko",
    en: "Vegetarian",
    boja: "bg-emerald-100 text-emerald-700",
  },
  ljuto: { sr: "Ljuto", en: "Spicy", boja: "bg-red-100 text-red-600" },
  novo: { sr: "Novo", en: "New", boja: "bg-amber-100 text-amber-700" },
};

// Konstante za procenu vremena pripreme - lako se štimuju kasnije
const MNOZIOCI_GUZVE = [
  { doAktivnih: 5, mnozilac: 1 },
  { doAktivnih: 10, mnozilac: 1.3 },
  { doAktivnih: Infinity, mnozilac: 1.6 },
];

function izracunajMnozilacGuzve(brojAktivnih) {
  const stepenik = MNOZIOCI_GUZVE.find((s) => brojAktivnih <= s.doAktivnih);
  return stepenik ? stepenik.mnozilac : 1;
}

// Status tekst za KUPCA - prati jezik toggle. Interno "zavrseno" znači da je
// kuhinja gotova i porudžbina je predata dostavljaču - kupcu to prikazujemo
// kao "Dostava u toku", ne "Završeno" (zbunjivalo je kupce da misle da je
// porudžbina stigla kad zapravo tek kreće dostava).
const PREVOD_STATUSA = {
  sr: {
    novo: "Primljena",
    u_pripremi: "U pripremi",
    spremno_za_dostavu: "Spremno za dostavu",
    zavrseno: "Dostava u toku",
  },
  en: {
    novo: "Received",
    u_pripremi: "In preparation",
    spremno_za_dostavu: "Ready for delivery",
    zavrseno: "Out for delivery",
  },
};

const PREVODI = {
  sr: {
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
    premiumExtras: "Izaberi dodatke:",
    addToCart: "Dodaj u korpu",
    menuTab: "Meni",
    cartTab: "Korpa",
    trackTab: "Prati",
    estimatedWait: "Procenjeno vreme čekanja",
    almostDone: "Uskoro gotovo",
    viewCart: "Pogledaj korpu",
    removeItem: "Ukloni",
    freeDeliveryFrom: `Besplatna dostava od ${PRAG_BESPLATNE_DOSTAVE} RSD`,
    enterCode: "Unesi kod porudžbine",
    trackCodePlaceholder: "npr. 48213",
    trackCodeBtn: "Prati",
    orLastOrder: "ili tvoja poslednja porudžbina:",
    orderNotFound: "Porudžbina sa ovim kodom ne postoji:",
  },
  en: {
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
    premiumExtras: "Choose extras:",
    addToCart: "Add to Cart",
    menuTab: "Menu",
    cartTab: "Cart",
    trackTab: "Track",
    estimatedWait: "Estimated wait time",
    almostDone: "Almost done",
    viewCart: "View cart",
    removeItem: "Remove",
    freeDeliveryFrom: `Free delivery from ${PRAG_BESPLATNE_DOSTAVE} RSD`,
    enterCode: "Enter order code",
    trackCodePlaceholder: "e.g. 48213",
    trackCodeBtn: "Track",
    orLastOrder: "or your last order:",
    orderNotFound: "No order found with this code:",
  },
};

// ---- Jednostavne, čiste SVG ikonice za navigaciju (bez emoji-ja) ----
function IkonicaMeni({ aktivna }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={aktivna ? 2.4 : 1.8}
      strokeLinecap="round"
    >
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function IkonicaKorpa({ aktivna }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={aktivna ? 2.4 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8V6a6 6 0 0112 0v2M4 8h16l-1.2 12.2a2 2 0 01-2 1.8H7.2a2 2 0 01-2-1.8L4 8z" />
    </svg>
  );
}
function IkonicaPrati({ aktivna }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={aktivna ? 2.4 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="6" width="14" height="10" />
      <path d="M15 10h4l3 3v3h-7z" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="17.5" cy="19" r="2" />
    </svg>
  );
}

export default function Home() {
  const [jezik, setJezik] = useState("sr");
  const [aktivniTab, setAktivniTab] = useState("meni");
  const [selektovanaKategorija, setSelektovanaKategorija] = useState("burgeri");
  const [otvorenPanelJelo, setOtvorenPanelJelo] = useState(null);
  const [korpa, setKorpa] = useState([]);
  const [izabraniDodaci, setIzabraniDodaci] = useState([]);
  const [forma, setForma] = useState({ ime: "", telefon: "", adresa: "" });
  const [aktivniIdPorudzbine, setAktivniIdPorudzbine] = useState("");
  const [unetiKod, setUnetiKod] = useState("");
  const [statusPorudzbine, setStatusPorudzbine] = useState(null);
  const [porudzbinaNijeNadjena, setPorudzbinaNijeNadjena] = useState(false);
  const [preostaloVreme, setPreostaloVreme] = useState(0); // interno rate-limitovanje, NE prikazuje se korisniku
  const [preostaloCekanjeSek, setPreostaloCekanjeSek] = useState(null);
  const [slanjeUToku, setSlanjeUToku] = useState(false);
  const [osvezavanjeUToku, setOsvezavanjeUToku] = useState(false);

  const t = PREVODI[jezik];

  // ---- Učitaj sačuvani broj porudžbine ----
  useEffect(() => {
    const sacuvan = localStorage.getItem("id_porudzbine");
    if (sacuvan) setAktivniIdPorudzbine(sacuvan);
  }, []);

  // ---- Interni cooldown tajmer (180s) - koristimo ga da zaštitimo Firestore
  // troškove od prečestih poziva, ali ovo se NIKAD ne prikazuje korisniku ----
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

  // ---- Auto-učitaj status porudžbine kad korisnik otvori "Prati" sa sačuvanim brojem ----
  useEffect(() => {
    if (aktivniIdPorudzbine && !statusPorudzbine) {
      osveziStatusPorudzbine(aktivniIdPorudzbine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktivniIdPorudzbine]);

  const cenaStavki = korpa.reduce(
    (sum, item) => sum + item.cena_po_komadu * item.kolicina,
    0,
  );
  const trosakDostave =
    cenaStavki > 0 && cenaStavki < PRAG_BESPLATNE_DOSTAVE ? CENA_DOSTAVE : 0;
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
        naziv: otvorenPanelJelo.naziv[jezik],
        cena_po_komadu: otvorenPanelJelo.cena + cenaDodataka,
        vreme_pripreme: otvorenPanelJelo.vreme_pripreme,
        dodaci: izabraniDodaci.map((d) => ({
          naziv: d.naziv[jezik],
          cena: d.cena,
        })),
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

  // ---- Procena trajanja pripreme: bazno vreme najsporije stavke x množilac gužve ----
  const izracunajTrajanjeProcene = async () => {
    const bazno = Math.max(...korpa.map((item) => item.vreme_pripreme || 15));
    let mnozilac = 1;
    try {
      // Gost nema pravo čitanja "porudzbine" (štiti ime/telefon/adresu ostalih
      // kupaca) - zato brojimo preko javne "status_porudzbine" kolekcije, koja
      // ima samo status/vreme, bez ličnih podataka.
      const q = query(
        collection(db, "status_porudzbine"),
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
          datum: danasnjiDatum(),
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

  // ---- Osvežavanje statusa - i dalje interno limitirano na 180s (štiti
  // Firestore troškove), ali se to nikad ne pokazuje korisniku ----
  const osveziStatusPorudzbine = async (kod) => {
    const ciljniKod = kod || aktivniIdPorudzbine;
    if (!ciljniKod || preostaloVreme > 0 || osvezavanjeUToku) return;
    setOsvezavanjeUToku(true);
    try {
      const snap = await getDoc(doc(db, "status_porudzbine", ciljniKod));
      if (snap.exists()) {
        setStatusPorudzbine(snap.data());
        setPorudzbinaNijeNadjena(false);
      } else {
        setStatusPorudzbine(null);
        setPorudzbinaNijeNadjena(true);
        if (ciljniKod === aktivniIdPorudzbine) {
          localStorage.removeItem("id_porudzbine");
        }
      }
      setPreostaloVreme(180);
    } catch (greska) {
      console.error("Greška pri osvežavanju statusa:", greska);
    } finally {
      setOsvezavanjeUToku(false);
    }
  };

  const hendlajPracenjeKoda = (e) => {
    e.preventDefault();
    if (!unetiKod || osvezavanjeUToku) return;
    const kod = unetiKod;
    const noviKod = kod !== aktivniIdPorudzbine;
    if (noviKod) setPreostaloVreme(0); // nov kod = dozvoli odmah prvu proveru
    setStatusPorudzbine(null);
    setPorudzbinaNijeNadjena(false);
    localStorage.setItem("id_porudzbine", kod);
    setAktivniIdPorudzbine(kod);
    setUnetiKod("");
    osveziStatusPorudzbine(kod); // odmah prikaži - ne čekaj poseban klik na "osveži"
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800 flex flex-col">
      <Head>
        <title>{NAZIV_RESTORANA} — Naruči online</title>
        <meta
          name="description"
          content={`Naručite omiljenu hranu online iz restorana ${NAZIV_RESTORANA}. Brza dostava, plaćanje pouzećem.`}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Restaurant",
              name: NAZIV_RESTORANA,
              servesCuisine: "Balkan",
              priceRange: "$$",
              telephone: KONTAKT_TELEFON,
              areaServed: [
                { "@type": "City", name: "Smederevska Palanka" },
                { "@type": "City", name: "Velika Plana" },
              ],
            }),
          }}
        />
      </Head>

      <header className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-40">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="relative h-9 w-36">
            <Image
              src={`${BASE_PATH}/images/logo.svg`}
              alt={NAZIV_RESTORANA}
              fill
              sizes="144px"
              className="object-contain object-left"
              priority
            />
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setAktivniTab("meni")}
              className={`text-sm font-bold transition-all ${aktivniTab === "meni" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t.menuTab}
            </button>
            <button
              onClick={() => setAktivniTab("korpa")}
              className={`text-sm font-bold transition-all ${aktivniTab === "korpa" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t.cartTab} {brojStavkiKorpe > 0 && `(${brojStavkiKorpe})`}
            </button>
            <button
              onClick={() => setAktivniTab("prati")}
              className={`text-sm font-bold transition-all ${aktivniTab === "prati" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t.trackTab}
            </button>
          </nav>

          <button
            onClick={() => setJezik(jezik === "sr" ? "en" : "sr")}
            className="text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-all uppercase"
            aria-label="Promeni jezik"
          >
            {jezik === "sr" ? "EN" : "SR"}
          </button>
        </div>
      </header>

      <div className="flex-1 w-full pb-24 md:pb-8">
        {aktivniTab === "meni" && (
          <main className="p-4 max-w-7xl mx-auto">
            <div className="flex gap-2 overflow-x-auto pb-4 whitespace-nowrap">
              {KATEGORIJE.map((kat) => (
                <button
                  key={kat.id}
                  onClick={() => setSelektovanaKategorija(kat.id)}
                  className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${
                    selektovanaKategorija === kat.id
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-white text-slate-600 border border-slate-100"
                  }`}
                >
                  {kat[jezik]}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold text-emerald-600 mb-3">
              {t.freeDeliveryFrom}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {JELOVNIK.filter(
                (j) => j.kategorija === selektovanaKategorija,
              ).map((jelo) => (
                <div key={jelo.id} className="flex flex-col">
                  {jelo.tagovi && jelo.tagovi.length > 0 && (
                    <span
                      className={`self-start mb-1.5 ml-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${TAGOVI_INFO[jelo.tagovi[0]].boja}`}
                    >
                      {TAGOVI_INFO[jelo.tagovi[0]][jezik]}
                    </span>
                  )}
                  <div
                    onClick={() => otvoriDodatke(jelo)}
                    className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 cursor-pointer hover:border-slate-200 transition-all"
                  >
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100">
                      <Image
                        src={jelo.slika_url}
                        alt={jelo.naziv[jezik]}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-base truncate">
                        {jelo.naziv[jezik]}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {jelo.opis[jezik]}
                      </p>
                      <p className="font-extrabold text-slate-900 mt-2">
                        {jelo.cena} RSD
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        otvoriDodatke(jelo);
                      }}
                      aria-label={`${t.addToCart} ${jelo.naziv[jezik]}`}
                      className="bg-slate-900 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-md flex-shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}

        {aktivniTab === "korpa" && (
          <main className="p-4 max-w-xl mx-auto">
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
                    <span className="font-bold">
                      {trosakDostave === 0
                        ? "0 RSD 🎉"
                        : `${trosakDostave} RSD`}
                    </span>
                  </div>
                  {trosakDostave > 0 && (
                    <p className="text-[11px] text-emerald-600 font-bold">
                      {t.freeDeliveryFrom}
                    </p>
                  )}
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
                    onChange={(e) =>
                      setForma({ ...forma, ime: e.target.value })
                    }
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
          <main className="p-4 text-center max-w-md mx-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-6">
              {t.trackOrder}
            </h2>

            <form onSubmit={hendlajPracenjeKoda} className="flex gap-2 mb-6">
              <input
                type="text"
                inputMode="numeric"
                value={unetiKod}
                onChange={(e) => setUnetiKod(e.target.value.replace(/\D/g, ""))}
                placeholder={t.trackCodePlaceholder}
                className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm text-center"
                aria-label={t.enterCode}
              />
              <button
                type="submit"
                className="bg-slate-900 text-white font-bold text-sm px-5 rounded-lg"
              >
                {t.trackCodeBtn}
              </button>
            </form>

            {!aktivniIdPorudzbine ? (
              <p className="text-slate-500 text-sm py-8">{t.noOrders}</p>
            ) : porudzbinaNijeNadjena ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-sm text-slate-500">
                  {t.orderNotFound}{" "}
                  <span className="font-bold text-slate-900">
                    #{aktivniIdPorudzbine}
                  </span>
                </p>
              </div>
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
              </div>
            )}
          </main>
        )}
      </div>

      {otvorenPanelJelo && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={() => setOtvorenPanelJelo(null)}
        >
          <div
            className="bg-white w-full max-w-md md:rounded-3xl rounded-t-3xl p-5 space-y-4 shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {otvorenPanelJelo.naziv[jezik]}
                </h3>
                {otvorenPanelJelo.tagovi &&
                  otvorenPanelJelo.tagovi.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5">
                      {otvorenPanelJelo.tagovi.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${TAGOVI_INFO[tag].boja}`}
                        >
                          {TAGOVI_INFO[tag][jezik]}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
              <button
                onClick={() => setOtvorenPanelJelo(null)}
                className="text-slate-500 hover:text-slate-600 font-bold text-xl p-1"
                aria-label="Zatvori"
              >
                ✕
              </button>
            </div>

            {otvorenPanelJelo.sastojci && (
              <p className="text-sm text-slate-600 leading-relaxed -mt-1">
                {otvorenPanelJelo.sastojci[jezik]}
              </p>
            )}

            <div className="space-y-2.5">
              {(DODACI_PO_KATEGORIJI[otvorenPanelJelo.kategorija] || [])
                .length > 0 && (
                <>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.premiumExtras}
                  </span>
                  {DODACI_PO_KATEGORIJI[otvorenPanelJelo.kategorija].map(
                    (dodatak) => {
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
                          <span>{dodatak.naziv[jezik]}</span>
                          <span>+{dodatak.cena} RSD</span>
                        </button>
                      );
                    },
                  )}
                </>
              )}
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
          className="fixed bottom-[72px] md:bottom-6 left-4 right-4 max-w-md md:max-w-sm md:left-auto md:right-6 mx-auto md:mx-0 bg-emerald-600 text-white font-bold text-sm py-3.5 rounded-xl shadow-lg z-40 flex justify-between items-center px-5"
          aria-label={t.viewCart}
        >
          <span>
            {t.viewCart} ({brojStavkiKorpe})
          </span>
          <span>{cenaStavki} RSD</span>
        </button>
      )}

      {/* Bottom tab bar - samo mobilni; desktop koristi header nav gore */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 py-2 px-4 flex justify-around items-center shadow-lg z-40">
        <button
          onClick={() => setAktivniTab("meni")}
          className={`flex flex-col items-center gap-0.5 ${aktivniTab === "meni" ? "text-slate-900" : "text-slate-500"}`}
        >
          <IkonicaMeni aktivna={aktivniTab === "meni"} />
          <span className="text-[10px] font-bold">{t.menuTab}</span>
        </button>
        <button
          onClick={() => setAktivniTab("korpa")}
          className={`flex flex-col items-center gap-0.5 relative ${aktivniTab === "korpa" ? "text-slate-900" : "text-slate-500"}`}
        >
          <IkonicaKorpa aktivna={aktivniTab === "korpa"} />
          {brojStavkiKorpe > 0 && (
            <span className="absolute -top-1 right-1.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {brojStavkiKorpe}
            </span>
          )}
          <span className="text-[10px] font-bold">{t.cartTab}</span>
        </button>
        <button
          onClick={() => setAktivniTab("prati")}
          className={`flex flex-col items-center gap-0.5 ${aktivniTab === "prati" ? "text-slate-900" : "text-slate-500"}`}
        >
          <IkonicaPrati aktivna={aktivniTab === "prati"} />
          <span className="text-[10px] font-bold">{t.trackTab}</span>
        </button>
      </nav>

      {/* Footer - vidljiv na svim ekranima; na mobilnom ima extra padding
          na dnu da ne bude prekriven fiksnim nav-om */}
      <footer className="bg-white border-t border-slate-100 mt-8 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 text-sm text-slate-500">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative h-9 w-9 flex-shrink-0">
                <Image
                  src={`${BASE_PATH}/images/logo.svg`}
                  alt={NAZIV_RESTORANA}
                  fill
                  sizes="36px"
                  className="object-contain"
                />
              </div>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="hover:text-slate-800 transition-all"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle
                    cx="17.5"
                    cy="6.5"
                    r="0.6"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </a>
            </div>
            <p className="text-xs">Smederevska Palanka, Srbija</p>
            <a
              href={`tel:${KONTAKT_TELEFON.replace(/\s/g, "")}`}
              className="text-xs block mt-0.5 hover:text-slate-800 transition-all"
            >
              {KONTAKT_TELEFON}
            </a>
          </div>
          <a
            href={SAJT_ILICODE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:text-slate-800 transition-all"
          >
            created by <span className="font-bold">Ilicode Studio</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
