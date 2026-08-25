import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Image from "next/image";
import { klaseFontova } from "../lib/fontovi";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  danasnjiDatum,
  generisiRandomBroj,
  vremeUMilisekundama,
} from "../lib/pomocne";
import { BASE_PATH } from "../lib/constants";
import {
  KATEGORIJE,
  JELOVNIK,
  DODACI_PO_KATEGORIJI,
  TAGOVI_INFO,
  PODKATEGORIJE_RESTORAN,
} from "../lib/jelovnik";

// ============ TODO: ZAMENI KAD DOBIJEMO FINALNI NAZIV/LOGO ============
const NAZIV_RESTORANA = "Restoran"; // koristi se u title/meta/JSON-LD, logo slika ide preko /images/logo.png
const INSTAGRAM_URL = "https://www.instagram.com/bellavista_restoran/"; // TODO: zameni pravim profilom
const KONTAKT_TELEFON = "+381 63 1110009"; // TODO: zameni pravim brojem
const SAJT_ILICODE = "https://nikolailic97.github.io/ilicode-studio/";
const PRAG_BESPLATNE_DOSTAVE = 1600;
const MIN_VIDLJIVOSTI_POSLE_ZAVRSETKA = 10; // minuti - koliko dugo kupac vidi/pretražuje gotovu porudžbinu
const MIN_VIDLJIVOSTI_SPREMNO_ZA_DOSTAVU = 15; // minuti - "sigurnosna mreža": ako osoblje ne klikne "zavrseno", porudžbina ionako nestaje ovoliko posle ulaska u "spremno_za_dostavu"
const KOD_PRETRAGA_COOLDOWN_MS = 5000; // minimalno vreme između ručnih pretraga po kodu - usporava nagađanje brojeva porudžbine (dodatno uz App Check, vidi lib/firebase.js)
const CENA_DOSTAVE = 200;

// Kategorije koje se prikazuju kao VELIKE kartice (slika preko cele širine).
// To su showpiece jela od nekoliko hiljada dinara - ne mogu da izgledaju isto
// kao ćevapi od 930 RSD u istoj listi.
const VELIKE_KARTICE_PODKATEGORIJE = ["specijalitet_kuce"];
const VELIKE_KARTICE_KATEGORIJE = ["preporuceno"];

const REDOSLED_KORAKA = ["novo", "u_pripremi", "spremno_za_dostavu", "zavrseno"];

// ---- Da li je porudžbina "istekla" za KUPCA (ne briše se iz baze - osoblje
// je i dalje vidi do "Zatvori poslovni dan", samo je kupac više ne prati).
// Dva slučaja:
//   1) status "zavrseno" + prošlo 10 min od završetka
//   2) status "spremno_za_dostavu" + prošlo 15 min - sigurnosna mreža za
//      slučaj da osoblje zaboravi da klikne finalno "Označi završeno"
// ----
function jeIsteklaPorudzbina(podaci) {
  const zavrsenoMs = vremeUMilisekundama(podaci.vreme_zavrseno);
  const isteklaZavrsena =
    podaci.status === "zavrseno" &&
    zavrsenoMs &&
    Date.now() - zavrsenoMs > MIN_VIDLJIVOSTI_POSLE_ZAVRSETKA * 60000;

  const spremnoMs = vremeUMilisekundama(podaci.vreme_spremno_za_dostavu);
  const isteklaSpremna =
    podaci.status === "spremno_za_dostavu" &&
    spremnoMs &&
    Date.now() - spremnoMs > MIN_VIDLJIVOSTI_SPREMNO_ZA_DOSTAVU * 60000;

  return Boolean(isteklaZavrsena || isteklaSpremna);
}

// ---- Prezentacione pomoćne funkcije ----
// Gramaža je deo naziva u jelovniku ("Ćevapi 350g", "Sablja Bellavista 1.2kg")
// jer je kuhinji korisna na tiketu. Ovde je SAMO za prikaz izdvajamo u zaseban
// bedž, a iz naslova sklanjamo - podaci u lib/jelovnik.js ostaju netaknuti.
// NAPOMENA: kad stigne finalni meni, bolje je uvesti pravo polje `tezina` u
// jelovnik nego se oslanjati na ovaj regex.
const REGEX_TEZINA = /\s*(\d+(?:[.,]\d+)?)\s*(kg|g)\b\.?/i;

function izvuciTezinu(naziv) {
  const nadjeno = naziv.match(REGEX_TEZINA);
  if (!nadjeno) return null;
  return `${nadjeno[1].replace(",", ".")} ${nadjeno[2].toUpperCase()}`;
}
function nazivBezTezine(naziv) {
  return naziv.replace(REGEX_TEZINA, "").trim();
}

// "Preporučeno za 2-3 osobe" -> {min:2, max:3}. Isto kao gore: prezentaciono,
// bez diranja podataka.
const REGEX_PORCIJA = /za\s+(\d)\s*[-–]\s*(\d)\s+osob/i;
function izvuciPorciju(opis) {
  if (!opis) return null;
  const nadjeno = opis.match(REGEX_PORCIJA);
  if (!nadjeno) return null;
  return { min: Number(nadjeno[1]), max: Number(nadjeno[2]) };
}
function opisBezPorcije(opis) {
  if (!opis) return "";
  return opis
    .replace(/preporučeno\s+za\s+\d\s*[-–]\s*\d\s+osob[ae]\.?/i, "")
    .trim();
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

// Kratko objašnjenje ispod svakog koraka na "Prati" ekranu.
const OPIS_KORAKA = {
  sr: {
    novo: "Kuhinja je primila porudžbinu",
    u_pripremi: "Jelo se sprema",
    spremno_za_dostavu: "Kurir preuzima porudžbinu",
    zavrseno: "Porudžbina je na putu",
  },
  en: {
    novo: "The kitchen received your order",
    u_pripremi: "Your food is being prepared",
    spremno_za_dostavu: "The courier is picking it up",
    zavrseno: "Your order is on the way",
  },
};

const PREVODI = {
  sr: {
    cart: "Tvoja korpa",
    cartEmpty: "Korpa je prazna.",
    cartEmptyAction: "Pogledaj meni",
    deliveryDetails: "Podaci za dostavu",
    paymentNote: "Plaćanje pouzećem, gotovinom kuriru.",
    name: "Ime i prezime",
    namePlaceholder: "Petar Petrović",
    phone: "Telefon",
    phonePlaceholder: "064 123 4567",
    address: "Adresa",
    addressPlaceholder: "Ulica i broj, sprat/stan",
    note: "Napomena",
    optional: "Opciono",
    orderNotePlaceholder: "npr. zvonce ne radi, pozovite",
    subtotal: "Stavke",
    delivery: "Dostava",
    total: "Ukupno",
    placeOrder: "Pošalji porudžbinu",
    trackOrder: "Prati porudžbinu",
    noOrders: "Trenutno nemaš aktivnih porudžbina.",
    orderId: "Tvoj kod",
    premiumExtras: "Dodaci",
    note2: "Napomena",
    itemNotePlaceholder: "npr. bez luka, više pečeno",
    addToCart: "Dodaj u korpu",
    choose: "Izaberi",
    menuTab: "Meni",
    cartTab: "Korpa",
    trackTab: "Prati",
    estimatedWait: "Procenjeno vreme",
    notSetYet: "—",
    minutes: "min",
    almostDone: "Uskoro gotovo",
    freeDeliveryFrom: `Besplatna dostava preko ${PRAG_BESPLATNE_DOSTAVE} RSD · plaćanje pouzećem`,
    haveCode: "Imaš kod?",
    otherOrder: "Druga porudžbina",
    trackCodePlaceholder: "npr. 48213",
    trackCodeBtn: "Prati",
    orderNotFound: "Porudžbina sa ovim kodom ne postoji.",
    searchTooFast: "Sačekaj par sekundi pre nove pretrage.",
    reviewUs: "Oceni porudžbinu",
    reviewModalTitle: "Kako ti se svidela porudžbina?",
    reviewTextPlaceholder: "Reci nam više (opciono)",
    reviewSubmit: "Pošalji ocenu",
    reviewThanks: "Hvala na oceni!",
    reviewAlreadyDone: "Već si nas nedavno ocenio. Hvala!",
    people: "OSOBE",
    peopleFew: "OSOBA",
    inProgress: "U toku",
    step: "Korak",
    of: "od",
    builtBy: "Izradio",
    close: "Zatvori",
  },
  en: {
    cart: "Your cart",
    cartEmpty: "Your cart is empty.",
    cartEmptyAction: "Browse the menu",
    deliveryDetails: "Delivery details",
    paymentNote: "Cash on delivery, paid to the courier.",
    name: "Full name",
    namePlaceholder: "John Smith",
    phone: "Phone",
    phonePlaceholder: "064 123 4567",
    address: "Address",
    addressPlaceholder: "Street and number, floor/apt",
    note: "Note",
    optional: "Optional",
    orderNotePlaceholder: "e.g. doorbell broken, please call",
    subtotal: "Items",
    delivery: "Delivery",
    total: "Total",
    placeOrder: "Place order",
    trackOrder: "Track order",
    noOrders: "No active orders found.",
    orderId: "Your code",
    premiumExtras: "Extras",
    note2: "Note",
    itemNotePlaceholder: "e.g. no onions, well done",
    addToCart: "Add to cart",
    choose: "Choose",
    menuTab: "Menu",
    cartTab: "Cart",
    trackTab: "Track",
    estimatedWait: "Estimated time",
    notSetYet: "—",
    minutes: "min",
    almostDone: "Almost done",
    freeDeliveryFrom: `Free delivery over ${PRAG_BESPLATNE_DOSTAVE} RSD · cash on delivery`,
    haveCode: "Have a code?",
    otherOrder: "Another order",
    trackCodePlaceholder: "e.g. 48213",
    trackCodeBtn: "Track",
    orderNotFound: "No order found with this code.",
    searchTooFast: "Please wait a few seconds before searching again.",
    reviewUs: "Rate your order",
    reviewModalTitle: "How was your order?",
    reviewTextPlaceholder: "Tell us more (optional)",
    reviewSubmit: "Submit rating",
    reviewThanks: "Thanks for the feedback!",
    reviewAlreadyDone: "You already rated us recently. Thanks!",
    people: "PEOPLE",
    peopleFew: "PEOPLE",
    inProgress: "In progress",
    step: "Step",
    of: "of",
    builtBy: "Built by",
    close: "Close",
  },
};

// ---- Ikonice navigacije ----
function IkonicaMeni() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}
function IkonicaKorpa() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6zM3 6h18M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
function IkonicaPrati() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// ---- SIGNATURE element: merač porcije. Pet figurica pokazuje za koliko
// ljudi je jelo - to je najvažnija informacija kod platera od 1-2kg, a do
// sad se gubila u sitnom opisu. ----
function MeracPorcije({ porcija, tezina, jezik }) {
  if (!porcija) return null;
  const t = PREVODI[jezik];
  const oznaka =
    `${porcija.min}–${porcija.max} ` +
    (porcija.max > 4 ? t.peopleFew : t.people) +
    (tezina ? ` · ${tezina}` : "");
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex gap-[3px]"
        role="img"
        aria-label={`${porcija.min}–${porcija.max}`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`block w-2 h-[13px] rounded-t-full rounded-b-[3px] ${
              n <= porcija.max ? "bg-zlato" : "bg-ugalj-vis"
            }`}
          />
        ))}
      </div>
      <small className="font-num text-[10.5px] font-semibold tracking-[.05em] text-krem-tih">
        {oznaka}
      </small>
    </div>
  );
}

// ---- Bedž taga (Ljuto, Preporučeno...) prilagođen tamnoj pozadini.
// TAGOVI_INFO u jelovniku i dalje nosi Tailwind klase za SVETLU pozadinu
// (koristi ih admin panel), pa ovde mapiramo samo boju teksta/pozadine. ----
// ---- Oznake jela ----
// Tagovi rade TRI različita posla i zato izgledaju različito:
//   1) alergeni i ishrana (ljuto, orašasti, vegan...) - informacija koju
//      kupac AKTIVNO traži; tihe ikonice + reč, u zasebnom redu iznad opisa
//      (ranije su stajale UNUTAR opisa koji je skraćen na dva reda, pa su
//      jele tekst i mogle da se odseku)
//   2) marketing (novo, popularno, preporučeno) - naš glas, ne kupčeva
//      potreba; ide kao traka preko slike, potpuno odvojeno od gornjih
//   3) ništa drugo - ako se doda nov tag, pada u grupu 1
const MARKETING_TAGOVI = ["novo", "popularno", "preporuceno"];

// Boja se nosi samo tamo gde nešto znači: ljuto je jedini tag zbog kog neko
// može da vrati porudžbinu, pa je jedini obojen u punoj snazi.
const BOJA_OZNAKE = {
  ljuto: "text-ljuto",
  sadrzi_orasaste: "text-alergen",
  sadrzi_laktozu: "text-alergen",
  vegan: "text-biljno",
  vegetarijansko: "text-biljno",
  bez_glutena: "text-krem-tih",
};

function IkonicaTaga({ id }) {
  const zajednicko = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    className: "flex-none",
  };
  if (id === "ljuto") {
    // Papričica: telo + peteljka
    return (
      <svg {...zajednicko} fill="none">
        <path
          d="M16 7c2.4 0 3.8 2 3.4 4.6-.7 4.6-5.2 8.9-9.8 9.4-2.4.3-4.1-1-4.1-3 0-2.6 2.2-4.4 4.6-5.3 2-.7 3.2-1.7 3.9-3.2.5-1.1 1.1-2.5 2-2.5z"
          fill="currentColor"
        />
        <path
          d="M16 7c.3-1.7 1.5-3.1 3.3-3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === "sadrzi_orasaste" || id === "sadrzi_laktozu") {
    return (
      <svg
        {...zajednicko}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 17h.01" />
      </svg>
    );
  }
  if (id === "bez_glutena") {
    return (
      <svg
        {...zajednicko}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 21V9M12 9c0-3 2-5 5-5 0 3-2 5-5 5zM12 13c0-3-2-5-5-5 0 3 2 5 5 5z" />
        <path d="M4 4l16 16" />
      </svg>
    );
  }
  // vegan / vegetarijansko - list
  return (
    <svg {...zajednicko} fill="currentColor">
      <path d="M20 4C10 4 4 9 4 17c0 1 0 2 .3 3C9 15 13 12 18 11c-4 2-8 5-11 10 8 1 13-5 13-17z" />
    </svg>
  );
}

// Tihi red oznaka (alergeni + ishrana). Marketing tagovi se ovde preskaču -
// oni idu na sliku, vidi TrakaNaSlici.
function OznakeJela({ tagovi, jezik, klasa = "" }) {
  const oznake = (tagovi || []).filter((t) => !MARKETING_TAGOVI.includes(t));
  if (oznake.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${klasa}`}>
      {oznake.map((id, i) => {
        const info = TAGOVI_INFO[id];
        if (!info) return null;
        return (
          <span key={id} className="flex items-center gap-2">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="w-[3px] h-[3px] rounded-full bg-ugalj-vis"
              />
            )}
            <span
              className={`inline-flex items-center gap-1 text-[10.5px] font-semibold ${
                BOJA_OZNAKE[id] || "text-krem-tih"
              }`}
            >
              <IkonicaTaga id={id} />
              {info[jezik]}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// Traka preko slike - samo prvi marketing tag koji jelo ima (dva bi se
// preklapala i poništila efekat isticanja).
function TrakaNaSlici({ tagovi, jezik }) {
  const id = (tagovi || []).find((t) => MARKETING_TAGOVI.includes(t));
  if (!id) return null;
  const info = TAGOVI_INFO[id];
  if (!info) return null;
  const natpis = (info.kratko && info.kratko[jezik]) || info[jezik];
  return (
    <span
      className={`absolute left-0 top-2 z-10 font-num text-[8px] font-bold tracking-[.09em] px-[7px] py-[3px] rounded-r-[4px] whitespace-nowrap ${
        id === "novo" ? "bg-krem text-noc" : "bg-zlato text-noc"
      }`}
    >
      {natpis}
    </span>
  );
}

export default function Home() {
  const [jezik, setJezik] = useState("sr");
  const [aktivniTab, setAktivniTab] = useState("meni");
  const [selektovanaKategorija, setSelektovanaKategorija] = useState("burgeri");
  const [selektovanaPodkategorija, setSelektovanaPodkategorija] = useState(
    PODKATEGORIJE_RESTORAN[0].id,
  );
  const [otvorenPanelJelo, setOtvorenPanelJelo] = useState(null);
  const [korpa, setKorpa] = useState([]);
  const [izabraniDodaci, setIzabraniDodaci] = useState([]);
  const [kolicinaUPanelu, setKolicinaUPanelu] = useState(1);
  const [napomenaStavke, setNapomenaStavke] = useState("");
  const [forma, setForma] = useState({
    ime: "",
    telefon: "",
    adresa: "",
    napomena: "",
  });
  const [aktivniIdPorudzbine, setAktivniIdPorudzbine] = useState("");
  const [unetiKod, setUnetiKod] = useState("");
  const [statusPorudzbine, setStatusPorudzbine] = useState(null);
  const [porudzbinaNijeNadjena, setPorudzbinaNijeNadjena] = useState(false);
  const [preostaloCekanjeSek, setPreostaloCekanjeSek] = useState(null);
  const [slanjeUToku, setSlanjeUToku] = useState(false);
  const [osvezavanjeUToku, setOsvezavanjeUToku] = useState(false);
  const [pretragaPrebrza, setPretragaPrebrza] = useState(false);
  // useRef (ne useState!) - mora da čita najsvežiju vrednost odmah pri kliku,
  // bez zavisnosti od re-rendera; ranije je sličan cooldown na drugom mestu
  // pravio "stale closure" bag (klik nije radio ništa) baš zbog useState-a.
  const poslednjaPretragaRef = useRef(0);
  const [modalOcenaOtvoren, setModalOcenaOtvoren] = useState(false);
  const [izabraneZvezdice, setIzabraneZvezdice] = useState(0);
  const [tekstOcene, setTekstOcene] = useState("");
  const [slanjeOceneUToku, setSlanjeOceneUToku] = useState(false);
  const [ocenaPoslata, setOcenaPoslata] = useState(false);

  const t = PREVODI[jezik];

  // ---- Učitaj sačuvani broj porudžbine ----
  useEffect(() => {
    const sacuvan = localStorage.getItem("id_porudzbine");
    if (sacuvan) setAktivniIdPorudzbine(sacuvan);
  }, []);

  // ---- Procena preostalog čekanja - lokalno tiktakanje, bez Firestore poziva ----
  useEffect(() => {
    if (
      !statusPorudzbine ||
      !statusPorudzbine.vreme_kreiranja ||
      !statusPorudzbine.trajanje_procena_min
    ) {
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

  // ---- PRAĆENJE PORUDŽBINE: onSnapshot listener umesto ručnog getDoc-a.
  //
  // Zašto je ovo JEFTINIJE, a ne skuplje:
  // Ranije je svako otvaranje "Prati" ekrana (ili osvežavanje stranice) bilo
  // 1 čitanje - nervozan kupac koji proveri 15 puta = 15 čitanja, iako se
  // status u međuvremenu promenio svega 3 puta. Listener naplaćuje 1 čitanje
  // pri kačenju + 1 po STVARNOJ promeni dokumenta. Porudžbina ima tačno 3
  // promene statusa, znači ~4 čitanja ukupno, bez obzira koliko puta kupac
  // gleda ekran. Uz to kupac vidi promenu odmah, bez osvežavanja.
  //
  // Dva uslova da ostane jeftino (oba ispod):
  //   1) listener radi SAMO dok je "Prati" tab otvoren
  //   2) odspaja se kad korisnik prebaci tab u browseru / zaključa telefon,
  //      da otvoren tab preko noći ne drži konekciju bez potrebe
  // ----
  useEffect(() => {
    if (!aktivniIdPorudzbine || aktivniTab !== "prati") return;

    let odjavi = null;

    const obradiSnimak = (snap) => {
      setOsvezavanjeUToku(false);
      if (!snap.exists()) {
        setStatusPorudzbine(null);
        setPorudzbinaNijeNadjena(true);
        localStorage.removeItem("id_porudzbine");
        return;
      }
      const podaci = snap.data();
      if (jeIsteklaPorudzbina(podaci)) {
        setStatusPorudzbine(null);
        setPorudzbinaNijeNadjena(true);
        localStorage.removeItem("id_porudzbine");
      } else {
        setStatusPorudzbine(podaci);
        setPorudzbinaNijeNadjena(false);
      }
    };

    const zakaci = () => {
      if (odjavi) return;
      setOsvezavanjeUToku(true);
      odjavi = onSnapshot(
        doc(db, "status_porudzbine", aktivniIdPorudzbine),
        obradiSnimak,
        (greska) => {
          console.error("Greška pri praćenju statusa:", greska);
          setOsvezavanjeUToku(false);
        },
      );
    };

    const otkaci = () => {
      if (odjavi) {
        odjavi();
        odjavi = null;
      }
    };

    const naPromenuVidljivosti = () => {
      if (document.visibilityState === "hidden") otkaci();
      else zakaci();
    };

    if (document.visibilityState === "visible") zakaci();
    document.addEventListener("visibilitychange", naPromenuVidljivosti);

    return () => {
      document.removeEventListener("visibilitychange", naPromenuVidljivosti);
      otkaci();
    };
  }, [aktivniIdPorudzbine, aktivniTab]);

  // ---- Zaključaj skrol dok je modal otvoren ----
  useEffect(() => {
    const otvoren = Boolean(otvorenPanelJelo) || modalOcenaOtvoren;
    document.body.style.overflow = otvoren ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [otvorenPanelJelo, modalOcenaOtvoren]);

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
    setKolicinaUPanelu(1);
    setNapomenaStavke("");
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
        id_jela: otvorenPanelJelo.id,
        naziv: otvorenPanelJelo.naziv[jezik],
        cena_po_komadu: otvorenPanelJelo.cena + cenaDodataka,
        vreme_pripreme: otvorenPanelJelo.vreme_pripreme,
        napomena: napomenaStavke.trim(),
        dodaci: izabraniDodaci.map((d) => ({
          id: d.id,
          naziv: d.naziv[jezik],
          cena: d.cena,
        })),
        kolicina: kolicinaUPanelu,
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

  // ---- Slanje porudžbine: transakcija upisuje pun dokument + javni status dokument ----
  const posaljiPorudzbinu = async (e) => {
    e.preventDefault();
    if (korpa.length === 0 || slanjeUToku) return;
    setSlanjeUToku(true);
    try {
      // Procenjeno vreme se više ne računa automatski (gužva/množilac) - sad
      // ga ručno postavlja kuhinja/admin preko "Sačuvaj vreme", jer bolje znaju
      // stvarnu situaciju u restoranu. Kupac dotad vidi "-" umesto procene.
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
          napomena: forma.napomena || "",
          stavke: korpa,
          cena_ukupno: ukupnaCena,
          nacin_placanja: "gotovina",
          status: "novo",
          datum: danasnjiDatum(),
          vreme_kreiranja: serverTimestamp(),
          trajanje_procena_min: 0,
        });
        tx.set(statusRef, {
          status: "novo",
          datum: danasnjiDatum(),
          vreme_kreiranja: serverTimestamp(),
          trajanje_procena_min: 0,
        });
      });

      localStorage.setItem("id_porudzbine", finalniBroj);
      setAktivniIdPorudzbine(finalniBroj);
      // Odmah prikaži "Primljena" - znamo da je tako jer smo je upravo
      // kreirali, pa kupac ne gleda prazan ekran dok se listener kači.
      // Realni podaci (sa serverskim vremenom) stižu odmah zatim, prvim
      // snimkom listener-a koji se kači čim se otvori "Prati" tab ispod.
      setStatusPorudzbine({
        status: "novo",
        vreme_kreiranja: { toMillis: () => Date.now() },
        trajanje_procena_min: 0,
      });
      setPorudzbinaNijeNadjena(false);
      setKorpa([]);
      setForma({ ime: "", telefon: "", adresa: "", napomena: "" });
      setAktivniTab("prati");
    } catch (greska) {
      console.error("Greška prilikom slanja porudžbine:", greska);
      alert("Došlo je do greške prilikom slanja porudžbine. Pokušaj ponovo.");
    } finally {
      setSlanjeUToku(false);
    }
  };

  const hendlajPracenjeKoda = (e) => {
    e.preventDefault();
    if (!unetiKod || osvezavanjeUToku) return;
    const sada = Date.now();
    if (sada - poslednjaPretragaRef.current < KOD_PRETRAGA_COOLDOWN_MS) {
      setPretragaPrebrza(true);
      return;
    }
    poslednjaPretragaRef.current = sada;
    setPretragaPrebrza(false);
    const kod = unetiKod.trim();
    setUnetiKod("");
    setStatusPorudzbine(null);
    setPorudzbinaNijeNadjena(false);
    localStorage.setItem("id_porudzbine", kod);
    // Dovoljno je postaviti broj - useEffect iznad automatski kači listener
    // na taj dokument (i skida prethodni, ako ga je bilo).
    setAktivniIdPorudzbine(kod);
  };

  const otvoriModalOcene = () => {
    setIzabraneZvezdice(0);
    setTekstOcene("");
    setOcenaPoslata(false);
    setModalOcenaOtvoren(true);
  };

  // ---- Recenzija - gost sme samo da kreira, bez čitanja tuđih recenzija.
  // Interno (lokalno, localStorage) zaključavamo na 24h da sprečimo spam -
  // ovo NIJE prava bezbednosna brava (neko bi mogao da obriše localStorage),
  // ali dovoljno je za normalne korisnike, i ne zahteva Cloud Function. ----
  const POSLEDNJA_OCENA_KLJUC = "poslednja_ocena_vreme";
  const OCENA_ZAKLJUCAVANJE_MS = 24 * 60 * 60 * 1000; // 24h

  const jeOcenaZakljucana = () => {
    const poslednja = localStorage.getItem(POSLEDNJA_OCENA_KLJUC);
    if (!poslednja) return false;
    return Date.now() - Number(poslednja) < OCENA_ZAKLJUCAVANJE_MS;
  };

  const posaljiOcenu = async () => {
    if (izabraneZvezdice < 1 || slanjeOceneUToku) return;
    setSlanjeOceneUToku(true);
    try {
      await addDoc(collection(db, "recenzije"), {
        zvezdice: izabraneZvezdice,
        tekst: tekstOcene.trim(),
        datum: danasnjiDatum(),
        vreme_kreiranja: serverTimestamp(),
      });
      localStorage.setItem(POSLEDNJA_OCENA_KLJUC, String(Date.now()));
      setOcenaPoslata(true);
    } catch (greska) {
      console.error("Greška pri slanju ocene:", greska);
      alert("Došlo je do greške, pokušaj ponovo.");
    } finally {
      setSlanjeOceneUToku(false);
    }
  };

  // ---- Izračunato za prikaz ----
  const vidljivaJela = JELOVNIK.filter(
    (j) =>
      j.kategorija === selektovanaKategorija &&
      (selektovanaKategorija !== "restoran" ||
        j.podkategorija === selektovanaPodkategorija),
  );
  const koristiVelikeKartice =
    VELIKE_KARTICE_KATEGORIJE.includes(selektovanaKategorija) ||
    (selektovanaKategorija === "restoran" &&
      VELIKE_KARTICE_PODKATEGORIJE.includes(selektovanaPodkategorija));

  const nazivSekcije =
    selektovanaKategorija === "restoran"
      ? (
          PODKATEGORIJE_RESTORAN.find(
            (p) => p.id === selektovanaPodkategorija,
          ) || {}
        )[jezik]
      : (KATEGORIJE.find((k) => k.id === selektovanaKategorija) || {})[jezik];

  const cenaUPanelu = otvorenPanelJelo
    ? (otvorenPanelJelo.cena +
        izabraniDodaci.reduce((s, d) => s + d.cena, 0)) *
      kolicinaUPanelu
    : 0;

  const indeksKoraka = statusPorudzbine
    ? REDOSLED_KORAKA.indexOf(statusPorudzbine.status)
    : -1;

  return (
    <div
      className={`${klaseFontova} min-h-screen bg-noc text-krem font-body antialiased`}
    >
      <Head>
        <title>{NAZIV_RESTORANA} — Naruči online</title>
        <meta
          name="description"
          content={`Naručite omiljenu hranu online iz restorana ${NAZIV_RESTORANA}. Brza dostava, plaćanje pouzećem.`}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#14191C" />
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

      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-40 bg-noc/92 backdrop-blur-md border-b border-ugalj-vis">
        <div className="max-w-[480px] md:max-w-3xl lg:max-w-5xl mx-auto px-[18px] md:px-6 py-3.5 flex justify-between items-center gap-4">
          <div className="relative h-8 w-32">
            <Image
              src={`${BASE_PATH}/images/logo.svg`}
              alt={NAZIV_RESTORANA}
              fill
              sizes="128px"
              className="object-contain object-left"
              priority
            />
          </div>
          {/* Desktop navigacija - na mobilnom se koristi donja traka
              (nav.md:hidden na dnu stranice), ovde bi samo trošila prostor. */}
          <nav className="hidden md:flex items-center gap-1 ml-auto mr-2">
            {[
              { id: "meni", tekst: t.menuTab },
              { id: "korpa", tekst: t.cartTab },
              { id: "prati", tekst: t.trackTab },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAktivniTab(tab.id)}
                aria-pressed={aktivniTab === tab.id}
                className={`relative text-[13px] font-semibold px-3.5 py-2 rounded-lg transition-colors ${
                  aktivniTab === tab.id
                    ? "text-zlato bg-zlato/10"
                    : "text-krem-tih hover:text-krem"
                }`}
              >
                {tab.tekst}
                {tab.id === "korpa" && brojStavkiKorpe > 0 && (
                  <span className="ml-1.5 font-num text-[10px] font-bold bg-zlato text-noc px-1.5 py-0.5 rounded-full align-middle">
                    {brojStavkiKorpe}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex gap-0.5 bg-ugalj rounded-full p-[3px]">
            {["sr", "en"].map((kod) => (
              <button
                key={kod}
                onClick={() => setJezik(kod)}
                aria-pressed={jezik === kod}
                className={`text-[11px] font-semibold px-[11px] py-[5px] rounded-full transition-colors ${
                  jezik === kod
                    ? "bg-zlato text-noc"
                    : "text-krem-tih hover:text-krem"
                }`}
              >
                {kod.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[480px] md:max-w-3xl lg:max-w-5xl mx-auto pb-24 md:pb-12">
        {/* ============ MENI ============ */}
        {aktivniTab === "meni" && (
          <>
            <div className="sticky top-[61px] z-30 bg-noc border-b border-ugalj-vis">
              <div className="flex overflow-x-auto bez-scrollbara px-[18px] md:px-6">
                {KATEGORIJE.map((kat) => (
                  <button
                    key={kat.id}
                    onClick={() => setSelektovanaKategorija(kat.id)}
                    aria-pressed={selektovanaKategorija === kat.id}
                    className={`flex-none text-[13px] font-semibold px-3.5 pt-3.5 pb-3 whitespace-nowrap border-b-2 transition-colors ${
                      selektovanaKategorija === kat.id
                        ? "text-zlato border-zlato"
                        : "text-krem-tih border-transparent hover:text-krem"
                    }`}
                  >
                    {kat[jezik]}
                  </button>
                ))}
              </div>

              {selektovanaKategorija === "restoran" && (
                <div className="flex gap-[7px] overflow-x-auto bez-scrollbara px-[18px] md:px-6 py-[11px] border-t border-ugalj">
                  {PODKATEGORIJE_RESTORAN.map((pod) => (
                    <button
                      key={pod.id}
                      onClick={() => setSelektovanaPodkategorija(pod.id)}
                      aria-pressed={selektovanaPodkategorija === pod.id}
                      className={`flex-none text-[11.5px] font-semibold px-[13px] py-[7px] rounded-full border whitespace-nowrap transition-colors ${
                        selektovanaPodkategorija === pod.id
                          ? "bg-zlato border-zlato text-noc"
                          : "bg-ugalj border-ugalj-vis text-krem-tih hover:text-krem"
                      }`}
                    >
                      {pod[jezik]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="mx-[18px] md:mx-6 mt-4 mb-1 px-3.5 py-[11px] rounded-xl text-xs font-medium text-zlato-svetlo bg-gradient-to-r from-zlato/15 to-zlato/[.03] border border-zlato/25">
              {t.freeDeliveryFrom}
            </p>

            <div className="px-[18px] md:px-6 pt-6 pb-3">
              <h2 className="font-display text-[25px] leading-tight tracking-[-.015em]">
                {nazivSekcije}
              </h2>
            </div>

            {/* Mobilni: jedna kolona (lista). Desktop: mreža kartica -
                velike kartice u 2 kolone, kompaktne u 2-3, zavisno od širine. */}
            <div
              className={
                vidljivaJela.length === 0
                  ? ""
                  : koristiVelikeKartice
                    ? "md:grid md:grid-cols-2 md:gap-4 md:px-6"
                    : "md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:px-6"
              }
            >
            {vidljivaJela.length === 0 ? (
              <p className="text-center text-krem-tih text-sm py-10">—</p>
            ) : koristiVelikeKartice ? (
              /* ---- Velike kartice: specijaliteti kuće i combo ponude ---- */
              vidljivaJela.map((jelo, indeks) => {
                const porcija = izvuciPorciju(jelo.opis?.[jezik]);
                const tezina = izvuciTezinu(jelo.naziv[jezik]);
                return (
                  <button
                    key={jelo.id}
                    onClick={() => otvoriDodatke(jelo)}
                    className="block w-[calc(100%-36px)] mx-[18px] mb-3.5 md:w-full md:mx-0 md:mb-0 text-left rounded-[18px] overflow-hidden bg-ugalj border border-ugalj-vis hover:border-zlato/40 transition-colors"
                  >
                    <div className="relative h-[150px] bg-ugalj-vis">
                      <Image
                        src={jelo.slika_url}
                        alt=""
                        fill
                        sizes="(max-width: 480px) 100vw, 480px"
                        className="object-cover"
                        priority={indeks === 0}
                      />
                      <TrakaNaSlici tagovi={jelo.tagovi} jezik={jezik} />
                      {tezina && (
                        <span className="absolute left-3 bottom-3 font-num text-[11px] font-bold tracking-[.06em] bg-noc/85 backdrop-blur-sm text-zlato px-2.5 py-1.5 rounded-md border border-zlato/30">
                          {tezina}
                        </span>
                      )}
                    </div>
                    <div className="px-4 pt-[15px] pb-4">
                      <h3 className="font-display text-[19px] leading-tight mb-2">
                        {nazivBezTezine(jelo.naziv[jezik])}
                      </h3>
                      <div className="mb-2.5">
                        <MeracPorcije
                          porcija={porcija}
                          tezina={null}
                          jezik={jezik}
                        />
                      </div>
                      <OznakeJela
                        tagovi={jelo.tagovi}
                        jezik={jezik}
                        klasa="mb-2.5"
                      />
                      <p className="text-xs leading-relaxed text-krem-tih mb-3.5">
                        {jelo.sastojci?.[jezik] ||
                          opisBezPorcije(jelo.opis?.[jezik])}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="font-num text-[19px] font-bold text-zlato tracking-[-.02em]">
                          {jelo.cena.toLocaleString("sr-RS")}
                          <span className="text-[11px] font-medium text-krem-tih ml-1">
                            RSD
                          </span>
                        </span>
                        <span className="bg-zlato text-noc text-[13px] font-bold px-5 py-2.5 rounded-[10px]">
                          {t.choose}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              /* ---- Kompaktne stavke: sve ostalo ---- */
              vidljivaJela.map((jelo, indeks) => {
                const tezina = izvuciTezinu(jelo.naziv[jezik]);
                return (
                  <button
                    key={jelo.id}
                    onClick={() => otvoriDodatke(jelo)}
                    className="flex w-[calc(100%-36px)] mx-[18px] gap-3.5 items-center text-left py-3.5 border-b border-ugalj last:border-b-0 md:w-full md:mx-0 md:p-3.5 md:border md:border-ugalj-vis md:rounded-2xl md:hover:border-zlato/40 md:transition-colors"
                  >
                    <div className="relative w-16 h-16 flex-none rounded-[11px] overflow-hidden bg-ugalj-vis">
                      <Image
                        src={jelo.slika_url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                        priority={indeks === 0}
                      />
                      <TrakaNaSlici tagovi={jelo.tagovi} jezik={jezik} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14.5px] font-semibold mb-0.5">
                        {nazivBezTezine(jelo.naziv[jezik])}
                      </h4>
                      <OznakeJela
                        tagovi={jelo.tagovi}
                        jezik={jezik}
                        klasa="mb-1"
                      />
                      <p className="text-[11.5px] leading-snug text-krem-tih line-clamp-2">
                        {jelo.opis?.[jezik]}
                      </p>
                      <div className="flex items-center gap-2.5 mt-[7px]">
                        <span className="font-num text-sm font-bold text-zlato">
                          {jelo.cena.toLocaleString("sr-RS")} RSD
                        </span>
                        {tezina && (
                          <span className="font-num text-[10px] font-medium tracking-[.05em] text-krem-tih">
                            {tezina}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* grid + place-items-center drži "+" tačno u sredini
                        kvadrata - ranije je line-height gurao znak naniže */}
                    <span
                      aria-hidden="true"
                      className="w-[31px] h-[31px] flex-none grid place-items-center rounded-[9px] bg-ugalj border border-ugalj-vis text-zlato text-lg leading-none"
                    >
                      +
                    </span>
                  </button>
                );
              })
            )}
            </div>

            <Podnozje t={t} jezik={jezik} />
          </>
        )}

        {/* ============ KORPA ============ */}
        {aktivniTab === "korpa" && (
          <>
            <div className="px-[18px] md:px-6 pt-6 pb-3">
              <span className="block font-num text-[10px] font-bold tracking-[.16em] uppercase text-zlato mb-1.5">
                {t.step} 1 {t.of} 2
              </span>
              <h2 className="font-display text-[25px] leading-tight tracking-[-.015em]">
                {t.cart}
              </h2>
            </div>

            {korpa.length === 0 ? (
              <div className="px-[18px] md:px-6 py-10 text-center">
                <p className="text-krem-tih text-sm mb-4">{t.cartEmpty}</p>
                <button
                  onClick={() => setAktivniTab("meni")}
                  className="text-zlato font-bold text-sm border border-ugalj-vis rounded-xl px-5 py-2.5 hover:border-zlato transition-colors"
                >
                  {t.cartEmptyAction}
                </button>
              </div>
            ) : (
              /* Desktop: stavke levo, račun i forma desno (lepljivo) -
                 na mobilnom ostaje jedna kolona, redom. */
              <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:px-6 lg:items-start">
                <div>
                {korpa.map((stavka) => (
                  <div
                    key={stavka.id_stavke}
                    className="flex gap-3 mx-[18px] lg:mx-0 py-3.5 border-b border-ugalj"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold mb-0.5">
                        {nazivBezTezine(stavka.naziv)}
                      </h4>
                      {(stavka.dodaci.length > 0 || stavka.napomena) && (
                        <p className="text-[11px] leading-snug text-krem-tih">
                          {stavka.dodaci.map((d) => `+ ${d.naziv}`).join(", ")}
                          {stavka.dodaci.length > 0 && stavka.napomena && " · "}
                          {stavka.napomena}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() =>
                              promeniKolicinu(stavka.id_stavke, "-")
                            }
                            aria-label="−"
                            className="w-[26px] h-[26px] grid place-items-center rounded-lg bg-ugalj border border-ugalj-vis text-zlato text-[15px] leading-none"
                          >
                            −
                          </button>
                          <strong className="font-num text-[13px] min-w-4 text-center">
                            {stavka.kolicina}
                          </strong>
                          <button
                            onClick={() =>
                              promeniKolicinu(stavka.id_stavke, "+")
                            }
                            aria-label="+"
                            className="w-[26px] h-[26px] grid place-items-center rounded-lg bg-ugalj border border-ugalj-vis text-zlato text-[15px] leading-none"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-num text-sm font-bold text-zlato">
                          {(
                            stavka.cena_po_komadu * stavka.kolicina
                          ).toLocaleString("sr-RS")}{" "}
                          RSD
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                </div>

                <div className="lg:sticky lg:top-24">
                <div className="m-[18px] lg:mx-0 lg:mt-0 p-4 bg-ugalj rounded-[15px] border border-ugalj-vis">
                  <div className="flex justify-between text-[13px] text-krem-tih py-1">
                    <span>{t.subtotal}</span>
                    <b className="font-num font-medium text-krem">
                      {cenaStavki.toLocaleString("sr-RS")} RSD
                    </b>
                  </div>
                  <div className="flex justify-between text-[13px] text-krem-tih py-1">
                    <span>{t.delivery}</span>
                    <b className="font-num font-medium text-krem">
                      {trosakDostave.toLocaleString("sr-RS")} RSD
                    </b>
                  </div>
                  <div className="flex justify-between items-center text-[15px] text-krem border-t border-ugalj-vis mt-2 pt-3">
                    <span>{t.total}</span>
                    <b className="font-num text-lg font-bold text-zlato">
                      {ukupnaCena.toLocaleString("sr-RS")} RSD
                    </b>
                  </div>
                </div>

                <form onSubmit={posaljiPorudzbinu}>
                  <div className="px-[18px] md:px-6 lg:px-0 pt-4 pb-3.5">
                    <span className="block font-num text-[10px] font-bold tracking-[.16em] uppercase text-zlato mb-1.5">
                      {t.step} 2 {t.of} 2
                    </span>
                    <h2 className="font-display text-[25px] leading-tight tracking-[-.015em]">
                      {t.deliveryDetails}
                    </h2>
                  </div>

                  {[
                    {
                      kljuc: "ime",
                      labela: t.name,
                      drzac: t.namePlaceholder,
                      obavezno: true,
                      tip: "text",
                      autoComplete: "name",
                    },
                    {
                      kljuc: "telefon",
                      labela: t.phone,
                      drzac: t.phonePlaceholder,
                      obavezno: true,
                      tip: "tel",
                      autoComplete: "tel",
                    },
                    {
                      kljuc: "adresa",
                      labela: t.address,
                      drzac: t.addressPlaceholder,
                      obavezno: true,
                      tip: "text",
                      autoComplete: "street-address",
                    },
                    {
                      kljuc: "napomena",
                      labela: `${t.note} — ${t.optional.toLowerCase()}`,
                      drzac: t.orderNotePlaceholder,
                      obavezno: false,
                      tip: "text",
                      autoComplete: "off",
                    },
                  ].map((polje) => (
                    <div key={polje.kljuc} className="mx-[18px] lg:mx-0 mb-3">
                      <label
                        htmlFor={`polje-${polje.kljuc}`}
                        className="block font-num text-[10px] font-bold tracking-[.13em] uppercase text-krem-tih mb-1.5"
                      >
                        {polje.labela}
                      </label>
                      <input
                        id={`polje-${polje.kljuc}`}
                        type={polje.tip}
                        required={polje.obavezno}
                        autoComplete={polje.autoComplete}
                        value={forma[polje.kljuc]}
                        onChange={(e) =>
                          setForma({ ...forma, [polje.kljuc]: e.target.value })
                        }
                        placeholder={polje.drzac}
                        className="w-full bg-ugalj border border-ugalj-vis rounded-[11px] px-3.5 py-3 text-sm text-krem placeholder:text-krem-tih/60 focus:border-zlato focus:outline-none transition-colors"
                      />
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={slanjeUToku}
                    className="mx-[18px] lg:mx-0 mt-5 w-[calc(100%-36px)] lg:w-full bg-zlato text-noc font-bold text-[15px] py-4 rounded-[13px] disabled:opacity-60 hover:bg-zlato-svetlo transition-colors"
                  >
                    {slanjeUToku
                      ? "..."
                      : `${t.placeOrder} · ${ukupnaCena.toLocaleString("sr-RS")} RSD`}
                  </button>
                  <p className="text-center text-[11px] text-krem-tih px-[18px] lg:px-0 pt-3 pb-2">
                    {t.paymentNote}
                  </p>
                </form>
                </div>
              </div>
            )}
            <Podnozje t={t} jezik={jezik} />
          </>
        )}

        {/* ============ PRATI ============ */}
        {aktivniTab === "prati" && (
          <div className="md:max-w-xl md:mx-auto">
            <div className="px-[18px] md:px-6 pt-6 pb-3">
              {statusPorudzbine && (
                <span className="block font-num text-[10px] font-bold tracking-[.16em] uppercase text-zlato mb-1.5">
                  {t.inProgress}
                </span>
              )}
              <h2 className="font-display text-[25px] leading-tight tracking-[-.015em]">
                {t.trackOrder}
              </h2>
            </div>

            {statusPorudzbine ? (
              <>
                <div className="mx-[18px] md:mx-6 my-5 p-5 md:p-7 rounded-[18px] text-center bg-gradient-to-b from-zlato/15 to-zlato/[.02] border border-zlato/30">
                  <span className="block font-num text-[10px] font-bold tracking-[.16em] uppercase text-zlato mb-2">
                    {t.orderId}
                  </span>
                  <strong className="block font-num text-[40px] font-bold tracking-[.06em] text-krem">
                    {aktivniIdPorudzbine}
                  </strong>
                </div>

                {/* Vertikalna traka koraka */}
                <ol className="mx-[18px] md:mx-6 list-none">
                  {REDOSLED_KORAKA.map((korak, i) => {
                    const gotov = i < indeksKoraka;
                    const sad = i === indeksKoraka;
                    return (
                      <li key={korak} className="flex gap-3.5 relative pb-6 last:pb-0">
                        {i < REDOSLED_KORAKA.length - 1 && (
                          <span
                            aria-hidden="true"
                            className={`absolute left-3 top-[26px] bottom-0 w-0.5 ${
                              gotov ? "bg-zelena" : "bg-ugalj-vis"
                            }`}
                          />
                        )}
                        <span
                          aria-hidden="true"
                          className={`w-[26px] h-[26px] flex-none z-10 rounded-full grid place-items-center text-xs border-2 ${
                            gotov
                              ? "bg-zelena border-zelena text-noc"
                              : sad
                                ? "bg-noc border-zlato text-zlato ring-4 ring-zlato/15"
                                : "bg-noc border-ugalj-vis text-krem-tih"
                          }`}
                        >
                          {gotov ? "✓" : i + 1}
                        </span>
                        <div>
                          <h4
                            className={`text-[14.5px] mb-0.5 ${
                              sad
                                ? "text-zlato font-semibold"
                                : gotov
                                  ? "font-semibold"
                                  : "text-krem-tih font-medium"
                            }`}
                          >
                            {PREVOD_STATUSA[jezik][korak]}
                          </h4>
                          <p className="text-[11.5px] leading-relaxed text-krem-tih">
                            {OPIS_KORAKA[jezik][korak]}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="mx-[18px] md:mx-6 my-6 px-4 py-4 rounded-[14px] bg-ugalj border border-ugalj-vis flex justify-between items-center">
                  <span className="font-num text-[10px] font-bold tracking-[.13em] uppercase text-krem-tih">
                    {t.estimatedWait}
                  </span>
                  <strong className="font-num text-[22px] font-bold text-krem">
                    {preostaloCekanjeSek === null
                      ? t.notSetYet
                      : preostaloCekanjeSek > 0
                        ? `${Math.ceil(preostaloCekanjeSek / 60)} ${t.minutes}`
                        : t.almostDone}
                  </strong>
                </div>

                <button
                  onClick={otvoriModalOcene}
                  className="mx-[18px] md:mx-6 w-[calc(100%-36px)] md:w-[calc(100%-48px)] border border-ugalj-vis text-zlato font-bold text-[13px] py-3.5 rounded-xl hover:border-zlato transition-colors"
                >
                  ★ {t.reviewUs}
                </button>
              </>
            ) : (
              <p className="mx-[18px] md:mx-6 my-6 px-4 py-6 rounded-[14px] bg-ugalj border border-ugalj-vis text-center text-sm text-krem-tih">
                {porudzbinaNijeNadjena ? t.orderNotFound : t.noOrders}
              </p>
            )}

            <div className="px-[18px] md:px-6 pt-8 pb-3">
              <span className="block font-num text-[10px] font-bold tracking-[.16em] uppercase text-zlato mb-1.5">
                {t.otherOrder}
              </span>
              <h3 className="font-display text-[19px] leading-tight">
                {t.haveCode}
              </h3>
            </div>
            <form onSubmit={hendlajPracenjeKoda} className="flex gap-2.5 mx-[18px] md:mx-6">
              <input
                value={unetiKod}
                onChange={(e) => setUnetiKod(e.target.value)}
                placeholder={t.trackCodePlaceholder}
                inputMode="numeric"
                aria-label={t.haveCode}
                className="flex-1 bg-ugalj border border-ugalj-vis rounded-[11px] px-3.5 py-3 font-num text-[15px] font-bold tracking-[.08em] text-krem placeholder:font-medium placeholder:tracking-normal placeholder:text-krem-tih/60 focus:border-zlato focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={osvezavanjeUToku}
                className="bg-krem text-noc font-bold text-[13px] px-5 rounded-[11px] disabled:opacity-60"
              >
                {t.trackCodeBtn}
              </button>
            </form>
            {pretragaPrebrza && (
              <p className="mx-[18px] md:mx-6 mt-2 text-[11px] text-red-300">
                {t.searchTooFast}
              </p>
            )}

            <Podnozje t={t} jezik={jezik} />
          </div>
        )}
      </main>

      {/* ============ MODAL: detalji jela + dodaci ============ */}
      {otvorenPanelJelo && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-end md:items-center justify-center md:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOtvorenPanelJelo(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={otvorenPanelJelo.naziv[jezik]}
        >
          <div className="w-full max-w-[480px] max-h-[88vh] md:max-h-[85vh] overflow-y-auto bg-ugalj rounded-t-[22px] md:rounded-[22px] border-t md:border border-ugalj-vis">
            <div className="relative h-[170px] bg-ugalj-vis">
              <Image
                src={otvorenPanelJelo.slika_url}
                alt=""
                fill
                sizes="(max-width: 480px) 100vw, 480px"
                className="object-cover"
              />
              <TrakaNaSlici
                tagovi={otvorenPanelJelo.tagovi}
                jezik={jezik}
              />
              <button
                onClick={() => setOtvorenPanelJelo(null)}
                aria-label={t.close}
                className="absolute right-3 top-3 w-8 h-8 grid place-items-center rounded-full bg-noc/80 backdrop-blur-sm border border-ugalj-vis text-krem text-[17px] leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-[18px]">
              <h3 className="font-display text-[23px] leading-tight mb-2.5">
                {nazivBezTezine(otvorenPanelJelo.naziv[jezik])}
              </h3>

              <div className="mb-3">
                <MeracPorcije
                  porcija={izvuciPorciju(otvorenPanelJelo.opis?.[jezik])}
                  tezina={izvuciTezinu(otvorenPanelJelo.naziv[jezik])}
                  jezik={jezik}
                />
              </div>

              <OznakeJela
                tagovi={otvorenPanelJelo.tagovi}
                jezik={jezik}
                klasa="mb-3"
              />

              <p className="text-[13px] leading-relaxed text-krem-tih mb-4">
                {opisBezPorcije(otvorenPanelJelo.opis?.[jezik])}
                {otvorenPanelJelo.sastojci?.[jezik] && (
                  <>
                    {opisBezPorcije(otvorenPanelJelo.opis?.[jezik]) && " "}
                    {otvorenPanelJelo.sastojci[jezik]}
                  </>
                )}
              </p>

              {(DODACI_PO_KATEGORIJI[otvorenPanelJelo.kategorija] || []).length >
                0 && (
                <div className="border-t border-ugalj-vis pt-4 mb-1.5">
                  <div className="flex justify-between items-baseline mb-2.5">
                    <h5 className="font-num text-[11px] font-bold tracking-[.13em] uppercase text-zlato">
                      {t.premiumExtras}
                    </h5>
                    <span className="text-[10.5px] text-krem-tih">
                      {t.optional}
                    </span>
                  </div>
                  {DODACI_PO_KATEGORIJI[otvorenPanelJelo.kategorija].map(
                    (dodatak) => {
                      const izabran = izabraniDodaci.some(
                        (d) => d.id === dodatak.id,
                      );
                      return (
                        <button
                          key={dodatak.id}
                          type="button"
                          onClick={() => hendlajDodatak(dodatak)}
                          aria-pressed={izabran}
                          className="flex items-center gap-3 py-2.5 w-full text-left"
                        >
                          <span
                            aria-hidden="true"
                            className={`w-5 h-5 flex-none rounded-md border-[1.5px] grid place-items-center text-xs text-noc ${
                              izabran
                                ? "bg-zlato border-zlato"
                                : "border-ugalj-vis"
                            }`}
                          >
                            {izabran ? "✓" : ""}
                          </span>
                          <span className="flex-1 text-[13.5px]">
                            {dodatak.naziv[jezik]}
                          </span>
                          <b
                            className={`font-num text-xs font-bold ${
                              izabran ? "text-zlato" : "text-krem-tih"
                            }`}
                          >
                            +{dodatak.cena}
                          </b>
                        </button>
                      );
                    },
                  )}
                </div>
              )}

              <div className="border-t border-ugalj-vis pt-4">
                <div className="flex justify-between items-baseline mb-2.5">
                  <h5 className="font-num text-[11px] font-bold tracking-[.13em] uppercase text-zlato">
                    {t.note2}
                  </h5>
                  <span className="text-[10.5px] text-krem-tih">
                    {t.optional}
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={napomenaStavke}
                  onChange={(e) => setNapomenaStavke(e.target.value)}
                  placeholder={t.itemNotePlaceholder}
                  aria-label={t.note2}
                  className="w-full bg-noc border border-ugalj-vis rounded-[11px] px-3.5 py-3 text-[13px] text-krem placeholder:text-krem-tih/60 resize-none focus:border-zlato focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-center gap-4 mt-4 mb-1.5">
                <button
                  onClick={() =>
                    setKolicinaUPanelu((k) => Math.max(1, k - 1))
                  }
                  aria-label="−"
                  className="w-[38px] h-[38px] grid place-items-center rounded-[11px] bg-noc border border-ugalj-vis text-zlato text-lg leading-none"
                >
                  −
                </button>
                <strong className="font-num text-[19px] font-bold min-w-7 text-center">
                  {kolicinaUPanelu}
                </strong>
                <button
                  onClick={() => setKolicinaUPanelu((k) => k + 1)}
                  aria-label="+"
                  className="w-[38px] h-[38px] grid place-items-center rounded-[11px] bg-noc border border-ugalj-vis text-zlato text-lg leading-none"
                >
                  +
                </button>
              </div>

              <button
                onClick={dodajUKorpu}
                className="w-full bg-zlato text-noc font-bold text-[15px] py-4 rounded-[13px] mt-2 flex justify-between items-center px-5 hover:bg-zlato-svetlo transition-colors"
              >
                <span>{t.addToCart}</span>
                <b className="font-num">
                  {cenaUPanelu.toLocaleString("sr-RS")} RSD
                </b>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: ocena ============ */}
      {modalOcenaOtvoren && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 md:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOcenaOtvoren(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[380px] bg-ugalj rounded-[20px] border border-ugalj-vis p-6 text-center">
            {ocenaPoslata ? (
              <>
                <p className="text-[15px] font-semibold mb-5">
                  {t.reviewThanks}
                </p>
                <button
                  onClick={() => setModalOcenaOtvoren(false)}
                  className="w-full bg-zlato text-noc font-bold text-sm py-3 rounded-xl"
                >
                  {t.close}
                </button>
              </>
            ) : jeOcenaZakljucana() ? (
              <>
                <p className="text-sm text-krem-tih mb-5">
                  {t.reviewAlreadyDone}
                </p>
                <button
                  onClick={() => setModalOcenaOtvoren(false)}
                  className="w-full border border-ugalj-vis text-krem font-bold text-sm py-3 rounded-xl"
                >
                  {t.close}
                </button>
              </>
            ) : (
              <>
                <h3 className="font-display text-[19px] leading-tight mb-4">
                  {t.reviewModalTitle}
                </h3>
                <div className="flex justify-center gap-1.5 mb-4">
                  {[1, 2, 3, 4, 5].map((broj) => (
                    <button
                      key={broj}
                      onClick={() => setIzabraneZvezdice(broj)}
                      aria-label={`${broj}`}
                      className={`text-[34px] leading-none transition-colors ${
                        broj <= izabraneZvezdice
                          ? "text-zlato"
                          : "text-ugalj-vis"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={tekstOcene}
                  onChange={(e) => setTekstOcene(e.target.value)}
                  maxLength={500}
                  placeholder={t.reviewTextPlaceholder}
                  aria-label={t.reviewTextPlaceholder}
                  className="w-full bg-noc border border-ugalj-vis rounded-xl px-3.5 py-3 text-[13px] text-krem placeholder:text-krem-tih/60 resize-none mb-4 focus:border-zlato focus:outline-none transition-colors"
                />
                <button
                  onClick={posaljiOcenu}
                  disabled={izabraneZvezdice < 1 || slanjeOceneUToku}
                  className="w-full bg-zlato text-noc font-bold text-sm py-3.5 rounded-xl disabled:opacity-40 transition-opacity"
                >
                  {t.reviewSubmit}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============ DONJI NAV ============ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-noc/96 backdrop-blur-lg border-t border-ugalj-vis">
        <div className="max-w-[480px] mx-auto grid grid-cols-3">
          {[
            { id: "meni", ikonica: <IkonicaMeni />, tekst: t.menuTab },
            { id: "korpa", ikonica: <IkonicaKorpa />, tekst: t.cartTab },
            { id: "prati", ikonica: <IkonicaPrati />, tekst: t.trackTab },
          ].map((tab) => {
            const aktivan = aktivniTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAktivniTab(tab.id)}
                aria-pressed={aktivan}
                className={`relative flex flex-col items-center gap-1 pt-3 pb-3.5 transition-colors ${
                  aktivan ? "text-zlato" : "text-krem-tih hover:text-krem"
                }`}
              >
                {aktivan && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-zlato rounded-b-[3px]"
                  />
                )}
                {tab.ikonica}
                {tab.id === "korpa" && brojStavkiKorpe > 0 && (
                  <span className="absolute top-[7px] right-[calc(50%-20px)] bg-zlato text-noc font-num text-[9px] font-bold min-w-4 h-4 px-1 rounded-full grid place-items-center">
                    {brojStavkiKorpe}
                  </span>
                )}
                <small className="text-[10px] font-semibold">{tab.tekst}</small>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ---- Podnožje: kontakt + potpis studija ----
function Podnozje({ t, jezik }) {
  return (
    <footer className="px-[18px] md:px-6 pt-8 pb-6 mt-8 text-center border-t border-ugalj">
      <div className="font-display text-[17px] mb-1.5">
        Bella<span className="text-zlato">vista</span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-krem-tih">
        Smederevska Palanka, {jezik === "sr" ? "Srbija" : "Serbia"}
        <br />
        <a
          href={`tel:${KONTAKT_TELEFON.replace(/\s/g, "")}`}
          className="hover:text-zlato transition-colors"
        >
          {KONTAKT_TELEFON}
        </a>
        {" · "}
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zlato transition-colors"
        >
          Instagram
        </a>
      </p>
      <p className="mt-4 pt-4 border-t border-ugalj font-num text-[10.5px] font-medium tracking-[.06em] text-krem-tih/70">
        {t.builtBy}{" "}
        <a
          href={SAJT_ILICODE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zlato font-bold hover:text-zlato-svetlo transition-colors"
        >
          Ilicode Studio
        </a>
      </p>
    </footer>
  );
}