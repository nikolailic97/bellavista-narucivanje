import { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseAuth, db } from "../lib/firebase";
import { REDOSLED_STATUSA } from "../lib/constants";
import { danasnjiDatum, datumPorudzbine, pocetakDana } from "../lib/pomocne";
import { NAZIV_JELA_SR } from "../lib/jelovnik";
import { prikaziPoruku, potvrdi } from "../lib/obavestenja";

// Statusi koji se smatraju "predatim kuriru" - njih automatsko zatvaranje
// dana sme da arhivira. Sve ostalo (još se sprema) ostaje na tabli.
const ZAVRSENI_STATUSI = ["zavrseno", "spremno_za_dostavu"];

// ---- Arhiviranje: upisuje zbirne brojke u izvestaji/{datum} i briše
// porudžbine. Datum se računa iz serverskog vremena kreiranja svake
// porudžbine (lokalno vreme), pa porudžbina od 23:58 ide u jučerašnji
// izveštaj čak i ako se dan zatvori posle ponoći.
//
// Sve ide kroz transakcije, po 100 porudžbina: transakcija PONOVO čita
// svaku porudžbinu i preskače one koje više ne postoje. Zato je bezbedno
// kad kuhinja i admin u isto vreme (npr. tačno u ponoć) pokrenu zatvaranje -
// ista porudžbina se nikad ne sabere dva puta. Vraća broj arhiviranih. ----
const VELICINA_PAKETA = 100;

async function arhivirajPorudzbine(dokumenti) {
  let arhivirano = 0;
  for (let i = 0; i < dokumenti.length; i += VELICINA_PAKETA) {
    const paket = dokumenti.slice(i, i + VELICINA_PAKETA);
    arhivirano += await runTransaction(db, async (tx) => {
      // 1) Sva čitanja pre svih upisa (pravilo Firestore transakcija)
      const snimci = await Promise.all(paket.map((d) => tx.get(d.ref)));
      const postojece = snimci.filter((s) => s.exists());
      if (postojece.length === 0) return 0;

      const poDatumu = {};
      postojece.forEach((s) => {
        const podaci = s.data();
        const datum = datumPorudzbine(podaci);
        if (!poDatumu[datum]) {
          poDatumu[datum] = { porudzbina: 0, prihod: 0, stavke: {} };
        }
        const zbir = poDatumu[datum];
        zbir.porudzbina += 1;
        zbir.prihod += podaci.cena_ukupno || 0;
        (podaci.stavke || []).forEach((stavka) => {
          const naziv = NAZIV_JELA_SR[stavka.id_jela] || stavka.naziv;
          zbir.stavke[naziv] = (zbir.stavke[naziv] || 0) + stavka.kolicina;
        });
      });

      const datumi = Object.keys(poDatumu);
      const izvestaji = await Promise.all(
        datumi.map((datum) => tx.get(doc(db, "izvestaji", datum))),
      );

      // 2) Upisi
      // NAPOMENA: ceo dokument se upisuje sa .set() (pročitaj-spoji-upiši).
      // batch.set(ref, {"top_items.X": ...}, {merge:true}) NE pravi
      // ugnježdeno polje - .set() tretira ključ sa tačkom bukvalno.
      datumi.forEach((datum, indeks) => {
        const postojeci = izvestaji[indeks].exists()
          ? izvestaji[indeks].data()
          : { total_orders: 0, total_revenue: 0, top_items: {} };
        const zbir = poDatumu[datum];
        const topItems = { ...(postojeci.top_items || {}) };
        Object.entries(zbir.stavke).forEach(([naziv, kolicina]) => {
          topItems[naziv] = (topItems[naziv] || 0) + kolicina;
        });
        tx.set(doc(db, "izvestaji", datum), {
          total_orders: (postojeci.total_orders || 0) + zbir.porudzbina,
          total_revenue: (postojeci.total_revenue || 0) + zbir.prihod,
          top_items: topItems,
          poslednje_azuriranje: serverTimestamp(),
        });
        tx.set(doc(db, "izvestaji_status", datum), {
          zatvoren: true,
          zatvoren_u: serverTimestamp(),
        });
      });

      postojece.forEach((s) => {
        tx.delete(s.ref);
        const broj = s.data().broj;
        if (broj) tx.delete(doc(db, "status_porudzbine", broj));
      });
      return postojece.length;
    });
  }
  return arhivirano;
}

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

  // ---- Firebase Auth state + custom claim uloga - lenjo (dynamic import),
  // Auth SDK se učitava tek kad se OVA stranica (kuhinja/admin) montira, ne
  // globalno za sve stranice (vidi komentar u lib/firebase.js). ----
  useEffect(() => {
    let odjava = () => {};
    let otkazano = false;
    (async () => {
      const [{ onAuthStateChanged, signOut }, auth] = await Promise.all([
        import("firebase/auth"),
        getFirebaseAuth(),
      ]);
      if (otkazano) return;
      odjava = onAuthStateChanged(auth, async (korisnik) => {
        if (korisnik) {
          const tokenRezultat = await korisnik.getIdTokenResult();
          const dobijenaUloga = tokenRezultat.claims.role || null;
          if (!dobijenaUloga) {
            // Nalog postoji u Firebase Auth, ali mu nikad nije dodeljena
            // uloga (scripts/postavi-uloge.js nije pokrenut za njega).
            // RANIJE se ovaj slučaj tiho preskakao - korisnik bi se uspešno
            // ulogovao, pa bi ga odmah vratilo na login ekran BEZ ikakve
            // poruke, što izgleda kao da dugme "Prijavi se" ne radi.
            setGreskaPristupa(
              "Ovom nalogu nije dodeljena uloga. Kontaktiraj administratora.",
            );
            await signOut(auth);
            setUloga(null);
          } else if (!dozvoljeneUloge.includes(dobijenaUloga)) {
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
    })();
    return () => {
      otkazano = true;
      odjava();
    };
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
    // Namerno BEZ filtera po datumu: porudžbina koja je stigla u 23:55 i još
    // se sprema posle ponoći mora i dalje da se vidi na tabli. (Ranije je
    // ovde stajalo datum == danas, pa je porudžbina sa pogrešnim datumom -
    // npr. kupcu loše podešen sat - bila nevidljiva za kuhinju.)
    const q = query(
      collection(db, "porudzbine"),
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
      const [{ signInWithEmailAndPassword }, auth] = await Promise.all([
        import("firebase/auth"),
        getFirebaseAuth(),
      ]);
      await signInWithEmailAndPassword(auth, email.trim(), pin);
    } catch (greska) {
      setGreskaPristupa("Netačan email ili PIN / lozinka!");
    }
    setPin("");
    setPrijavaUToku(false);
  };

  const hendlajOdjavu = async () => {
    const [{ signOut }, auth] = await Promise.all([
      import("firebase/auth"),
      getFirebaseAuth(),
    ]);
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
      // Isto tako, kad porudžbina uđe u "spremno_za_dostavu" (predata
      // vozaču/kuriru), beležimo vreme - ovo je "sigurnosna mreža" u
      // slučaju da osoblje zaboravi da klikne finalno "Označi završeno":
      // kupac ionako prestaje da vidi/pretražuje porudžbinu ~15min posle
      // ovog trenutka (vidi pages/index.js osveziStatusPorudzbine).
      if (sledeci === "spremno_za_dostavu") {
        azuriranjePorudzbine.vreme_spremno_za_dostavu = serverTimestamp();
        azuriranjeStatusa.vreme_spremno_za_dostavu = serverTimestamp();
      }
      batch.update(doc(db, "porudzbine", porudzbina.id), azuriranjePorudzbine);
      batch.update(
        doc(db, "status_porudzbine", porudzbina.broj),
        azuriranjeStatusa,
      );
      await batch.commit();
    } catch (greska) {
      console.error("Greška pri promeni statusa:", greska);
      prikaziPoruku("Nije uspelo ažuriranje statusa, pokušaj ponovo.", {
        tip: "greska",
      });
    }
  };

  // ---- Ručna izmena procenjenog vremena pripreme (npr. konobar zna da je
  // gužva u restoranu pa produžava vreme) - oba dokumenta u istom batch-u,
  // kupac vidi novo vreme sledeći put kad proveri "Prati" ----
  const azurirajVreme = async (porudzbina, novoVremeMin) => {
    const broj = Number(novoVremeMin);
    if (!broj || broj <= 0) {
      prikaziPoruku("Unesi ispravan broj minuta.", { tip: "greska" });
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
      prikaziPoruku("Nije uspelo ažuriranje vremena, pokušaj ponovo.", {
        tip: "greska",
      });
    }
  };

  // ---- Ručno zatvaranje poslovnog dana (kuhinja ili admin): arhivira SVE
  // porudžbine u bazi, bez obzira na status i datum. Sme se pozvati više
  // puta istog dana - izveštaj se sabira, ne prepisuje. ----
  const zatvoriPoslovniDan = async () => {
    if (zatvaranjeUToku) return false;
    const potvrdjeno = await potvrdi({
      naslov: "Zatvori poslovni dan?",
      tekst:
        "Sve trenutne porudžbine (i one koje se još spremaju) biće arhivirane u izveštaj i obrisane sa table.",
      potvrdiTekst: "Zatvori dan",
      opasno: true,
    });
    if (!potvrdjeno) return false;
    setZatvaranjeUToku(true);
    try {
      const snap = await getDocs(collection(db, "porudzbine"));
      if (snap.empty) {
        prikaziPoruku(
          "Dan je već zatvoren i od tada nije stigla nijedna porudžbina.",
          { naslov: "Nema porudžbina za arhiviranje" },
        );
        return false;
      }
      const broj = await arhivirajPorudzbine(snap.docs);
      prikaziPoruku(`Arhivirano porudžbina: ${broj}.`, {
        tip: "uspeh",
        naslov: "Dan je zatvoren",
      });
      return true;
    } catch (greska) {
      console.error("Greška pri zatvaranju poslovnog dana:", greska);
      prikaziPoruku("Zatvaranje dana nije uspelo. Pokušaj ponovo.", {
        tip: "greska",
      });
      return false;
    } finally {
      setZatvaranjeUToku(false);
    }
  };

  // ---- Automatsko zatvaranje dana u ponoć. Nema servera koji bi to radio
  // sam (Spark plan, bez Cloud Functions), pa ga radi otvorena kuhinjska ili
  // admin stranica: u 00:00, i odmah po prijavi ako je tablet bio ugašen
  // preko noći. Arhivira samo porudžbine od PRETHODNIH dana koje su već
  // predate kuriru - one koje se još spremaju ostaju na tabli dok se ne
  // završe, pa ih pokupi sledeće zatvaranje. ----
  const poslednjiAutoDatumRef = useRef(null);
  useEffect(() => {
    if (!imaPristup) return;
    const danas = danasnjiDatum();
    if (poslednjiAutoDatumRef.current === danas) return;
    poslednjiAutoDatumRef.current = danas;
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "porudzbine"),
            where("vreme_kreiranja", "<", Timestamp.fromDate(pocetakDana())),
          ),
        );
        const zaArhivu = snap.docs.filter((d) =>
          ZAVRSENI_STATUSI.includes(d.data().status),
        );
        if (zaArhivu.length === 0) return;
        const broj = await arhivirajPorudzbine(zaArhivu);
        if (broj > 0) {
          prikaziPoruku(
            `Automatski arhivirano porudžbina od prethodnog dana: ${broj}.`,
            { tip: "uspeh", naslov: "Dan je zatvoren" },
          );
        }
      } catch (greska) {
        // Sledeći pokušaj tek sutra ili ručno - ne smemo da vrtimo grešku
        // svakih 30s, ali ni da tiho progutamo problem.
        console.error("Greška pri automatskom zatvaranju dana:", greska);
      }
    })();
  }, [imaPristup, sadaTick]);

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
