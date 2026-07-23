import { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { REDOSLED_STATUSA } from "../lib/constants";
import { danasnjiDatum } from "../lib/pomocne";
import { NAZIV_JELA_SR } from "../lib/jelovnik";

// Zvono za novu porudžbinu - generisano direktno u kodu (Web Audio API), bez
// posebnog audio fajla. JEDAN trajni AudioContext za celu sesiju (ne nov
// svaki put) - browseri blokiraju zvuk dok ne postoji prava korisnička
// interakcija, a "otključani" kontekst ostaje otključan dok god je isti objekat.
let deljeniAudioKontekst = null;

function dobijAudioKontekst() {
  if (!deljeniAudioKontekst) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    deljeniAudioKontekst = new AudioCtx();
  }
  return deljeniAudioKontekst;
}

// Pozvati OBAVEZNO iz prave korisničke interakcije (npr. klik na "Prijavi se")
// da se zvuk otključa za ostatak sesije - inače prvi pokušaj puštanja zvuka
// (kad stigne porudžbina, bez direktnog klika u tom trenutku) ostaje nem.
function otkljucajZvuk() {
  try {
    const ctx = dobijAudioKontekst();
    if (ctx.state === "suspended") ctx.resume();
  } catch (greska) {
    console.error("Greška pri otključavanju zvuka:", greska);
  }
}

function odsviracZvonce() {
  try {
    const ctx = dobijAudioKontekst();
    if (ctx.state === "suspended") ctx.resume();
    const sada = ctx.currentTime;

    // Kompresor sprečava da glasniji, složeniji ton (osnovni ton + harmonik)
    // izobliči zvuk - omogućava da guramo jačinu bez "pucanja".
    const kompresor = ctx.createDynamicsCompressor();
    kompresor.threshold.setValueAtTime(-18, sada);
    kompresor.ratio.setValueAtTime(6, sada);
    kompresor.connect(ctx.destination);

    const odsviracJedanDing = (pocetak) => {
      // Osnovni ton (C6) + harmonik oktavu iznad - zajedno zvuče punije/glasnije
      [1046.5, 2093].forEach((frekvencija, i) => {
        const oscilator = ctx.createOscillator();
        const pojacalo = ctx.createGain();
        oscilator.type = "sine";
        oscilator.frequency.setValueAtTime(frekvencija, pocetak);
        const vrhJacine = i === 0 ? 1 : 0.5;
        pojacalo.gain.setValueAtTime(0, pocetak);
        pojacalo.gain.linearRampToValueAtTime(vrhJacine, pocetak + 0.02);
        pojacalo.gain.exponentialRampToValueAtTime(0.001, pocetak + 0.9);
        oscilator.connect(pojacalo);
        pojacalo.connect(kompresor);
        oscilator.start(pocetak);
        oscilator.stop(pocetak + 0.95);
      });
    };

    odsviracJedanDing(sada);
    odsviracJedanDing(sada + 0.32);
    odsviracJedanDing(sada + 0.64);
  } catch (greska) {
    console.error("Greška pri puštanju zvuka za novu porudžbinu:", greska);
  }
}

// dozvoljeneUloge: npr. ['kuhinja','admin'] za /kuhinja, ili ['admin'] za /admin
// porukaZabranjenogPristupa: tekst koji se prikaže ako se uloguje nalog koji nema pristup ovoj strani
export function useInternoOsoblje(dozvoljeneUloge, porukaZabranjenogPristupa) {
  const [uloga, setUloga] = useState(null);
  const [ucitavanjeUloge, setUcitavanjeUloge] = useState(true);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [prijavaUToku, setPrijavaUToku] = useState(false);
  const [greskaPristupa, setGreskaPristupa] = useState("");

  const [porudzbine, setPorudzbine] = useState([]);
  const [sadaTick, setSadaTick] = useState(Date.now());
  const [zatvaranjeUToku, setZatvaranjeUToku] = useState(false);

  const imaPristup = Boolean(uloga && dozvoljeneUloge.includes(uloga));

  // ---- Fallback otključavanje zvuka - ako je sesija već aktivna (tablet
  // ostaje ulogovan ceo dan), login klik se ne dešava ponovo, pa hvatamo
  // PRVU interakciju bilo gde na stranici umesto toga. Uklanja se sam posle
  // prvog okidanja. ----
  useEffect(() => {
    const otkljucaj = () => {
      otkljucajZvuk();
      document.removeEventListener("click", otkljucaj);
      document.removeEventListener("touchstart", otkljucaj);
    };
    document.addEventListener("click", otkljucaj);
    document.addEventListener("touchstart", otkljucaj);
    return () => {
      document.removeEventListener("click", otkljucaj);
      document.removeEventListener("touchstart", otkljucaj);
    };
  }, []);

  // ---- Firebase Auth state + custom claim uloga ----
  useEffect(() => {
    const odjava = onAuthStateChanged(auth, async (korisnik) => {
      if (korisnik) {
        const tokenRezultat = await korisnik.getIdTokenResult();
        const dobijenaUloga = tokenRezultat.claims.role || null;
        if (dobijenaUloga && !dozvoljeneUloge.includes(dobijenaUloga)) {
          setGreskaPristupa(
            porukaZabranjenogPristupa ||
              "Ovaj nalog nema pristup ovoj stranici.",
          );
          await signOut(auth);
          setUloga(null);
        } else {
          setUloga(dobijenaUloga);
        }
      } else {
        setUloga(null);
      }
      setUcitavanjeUloge(false);
    });
    return () => odjava();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Realtime kuhinjska tabla (aktivna dok god je nalog autorizovan za ovu stranicu) ----
  const prviUcitanRef = useRef(true);
  useEffect(() => {
    if (!imaPristup) {
      setPorudzbine([]);
      return;
    }
    prviUcitanRef.current = true;
    const q = query(
      collection(db, "porudzbine"),
      where("datum", "==", danasnjiDatum()),
      where("status", "in", ["novo", "u_pripremi", "spremno_za_dostavu"]),
      orderBy("vreme_kreiranja", "asc"),
    );
    const odjava = onSnapshot(
      q,
      (snap) => {
        setPorudzbine(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        // Preskoči zvuk na prvo učitavanje (sve postojeće porudžbine se tada
        // "dodaju" u listu, to nije nova porudžbina) - samo na STVARNO nove
        // dokumente koji stignu dok je stranica već otvorena.
        if (prviUcitanRef.current) {
          prviUcitanRef.current = false;
        } else {
          const imaNovih = snap
            .docChanges()
            .some((promena) => promena.type === "added");
          if (imaNovih) odsviracZvonce();
        }
      },
      (greska) => console.error("Greška pri praćenju porudžbina:", greska),
    );
    return () => odjava();
  }, [imaPristup]);

  // ---- Osvežavanje "kasni" indikatora na svakih 30s ----
  useEffect(() => {
    const interval = setInterval(() => setSadaTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // ---- Prijava - pravi Firebase Auth, PIN = lozinka (min 6 cifara) ----
  // Korisnik sad unosi i email i PIN direktno - nema više nagađanja koji je
  // nalog u pitanju (jednostavnije i bez ikakve dvosmislenosti).
  const hendlajLogin = async (e) => {
    e.preventDefault();
    setGreskaPristupa("");
    if (!email || pin.length < 6 || prijavaUToku) return;
    otkljucajZvuk(); // klik na dugme = prava korisnička interakcija, otključava zvuk za ostatak sesije
    setPrijavaUToku(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pin);
    } catch (greska) {
      setGreskaPristupa("Netačan email ili PIN kod!");
    }
    setPin("");
    setPrijavaUToku(false);
  };

  const hendlajOdjavu = async () => {
    await signOut(auth);
  };

  // ---- Pomeranje statusa na sledeći korak (oba dokumenta u istom batch-u) ----
  const napredujStatus = async (porudzbina) => {
    const indeks = REDOSLED_STATUSA.indexOf(porudzbina.status);
    const sledeci = REDOSLED_STATUSA[indeks + 1];
    if (!sledeci) return;
    try {
      const batch = writeBatch(db);
      const azuriranjePorudzbine = { status: sledeci };
      const azuriranjeStatusa = { status: sledeci };
      // Kad porudžbina stigne do finalnog statusa ("zavrseno"), beležimo kad
      // se to desilo - kupac prestaje da vidi/pretražuje tu porudžbinu ~10min
      // posle ovog trenutka (vidi pages/index.js osveziStatusPorudzbine).
      if (sledeci === "zavrseno") {
        azuriranjePorudzbine.vreme_zavrseno = serverTimestamp();
        azuriranjeStatusa.vreme_zavrseno = serverTimestamp();
      }
      batch.update(doc(db, "porudzbine", porudzbina.id), azuriranjePorudzbine);
      batch.update(
        doc(db, "status_porudzbine", porudzbina.broj),
        azuriranjeStatusa,
      );
      await batch.commit();
    } catch (greska) {
      console.error("Greška pri promeni statusa:", greska);
      alert("Nije uspelo ažuriranje statusa, pokušaj ponovo.");
    }
  };

  // ---- Ručna izmena procenjenog vremena pripreme (npr. konobar zna da je
  // gužva u restoranu pa produžava vreme) - oba dokumenta u istom batch-u,
  // kupac vidi novo vreme sledeći put kad proveri "Prati" ----
  const azurirajVreme = async (porudzbina, novoVremeMin) => {
    const broj = Number(novoVremeMin);
    if (!broj || broj <= 0) {
      alert("Unesi ispravan broj minuta.");
      return;
    }
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "porudzbine", porudzbina.id), {
        trajanje_procena_min: broj,
      });
      batch.update(doc(db, "status_porudzbine", porudzbina.broj), {
        trajanje_procena_min: broj,
      });
      await batch.commit();
    } catch (greska) {
      console.error("Greška pri izmeni vremena:", greska);
      alert("Nije uspelo ažuriranje vremena, pokušaj ponovo.");
    }
  };

  // ---- Zatvaranje poslovnog dana: agregacija (increment, ne prepisivanje -
  // sme se pozvati više puta istog dana, npr. ako stignu nove porudžbine
  // nakon prvog zatvaranja, ništa se ne gubi) + batch brisanje (≤500 po paketu) ----
  const zatvoriPoslovniDan = async () => {
    if (zatvaranjeUToku) return false;
    if (
      !window.confirm(
        "Da li si siguran? Sve trenutne porudžbine za danas će biti arhivirane i obrisane.",
      )
    )
      return false;
    setZatvaranjeUToku(true);
    try {
      const q = query(
        collection(db, "porudzbine"),
        where("datum", "==", danasnjiDatum()),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        alert(
          "Nema porudžbina za arhiviranje (dan je već zatvoren i nema novih porudžbina od tada).",
        );
        return false;
      }

      let ukupnoPorudzbina = 0;
      let ukupanPrihod = 0;
      const najprodavanije = {};

      snap.docs.forEach((d) => {
        const podaci = d.data();
        ukupnoPorudzbina += 1;
        ukupanPrihod += podaci.cena_ukupno || 0;
        (podaci.stavke || []).forEach((stavka) => {
          const naziv = NAZIV_JELA_SR[stavka.id_jela] || stavka.naziv;
          najprodavanije[naziv] =
            (najprodavanije[naziv] || 0) + stavka.kolicina;
        });
      });

      // increment() radi i ako polje/dokument još ne postoji (tretira ga kao
      // 0) - zato ovo bezbedno radi i za prvo I za svako sledeće zatvaranje
      // istog dana, bez potrebe da se prethodno pročita postojeći izveštaj
      // (kuhinja nema pravo čitanja izvestaji, samo admin - increment to zaobilazi).
      const azuriranje = {
        total_orders: increment(ukupnoPorudzbina),
        total_revenue: increment(ukupanPrihod),
        poslednje_azuriranje: serverTimestamp(),
      };
      Object.entries(najprodavanije).forEach(([naziv, kolicina]) => {
        azuriranje[`top_items.${naziv}`] = increment(kolicina);
      });

      const izvestajRef = doc(db, "izvestaji", danasnjiDatum());
      const paketIzvestaja = writeBatch(db);
      paketIzvestaja.set(izvestajRef, azuriranje, { merge: true });
      paketIzvestaja.set(
        doc(db, "izvestaji_status", danasnjiDatum()),
        { zatvoren: true, zatvoren_u: serverTimestamp() },
        { merge: true },
      );
      await paketIzvestaja.commit();

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

      alert(`Arhivirano ${ukupnoPorudzbina} porudžbina.`);
      return true;
    } catch (greska) {
      console.error("Greška pri zatvaranju poslovnog dana:", greska);
      alert("Došlo je do greške. Pokušaj ponovo.");
      return false;
    } finally {
      setZatvaranjeUToku(false);
    }
  };

  return {
    uloga,
    ucitavanjeUloge,
    imaPristup,
    email,
    setEmail,
    pin,
    setPin,
    prijavaUToku,
    greskaPristupa,
    hendlajLogin,
    hendlajOdjavu,
    porudzbine,
    sadaTick,
    napredujStatus,
    azurirajVreme,
    zatvoriPoslovniDan,
    zatvaranjeUToku,
  };
}
