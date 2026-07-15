import { useState, useEffect } from "react";
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
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { KUHINJA_EMAIL, ADMIN_EMAIL, REDOSLED_STATUSA } from "../lib/constants";
import { danasnjiDatum } from "../lib/pomocne";

const EMAIL_PO_ULOZI = { kuhinja: KUHINJA_EMAIL, admin: ADMIN_EMAIL };

// dozvoljeneUloge: npr. ['kuhinja','admin'] za /kuhinja, ili ['admin'] za /admin
// porukaZabranjenogPristupa: tekst koji se prikaže ako se uloguje nalog koji nema pristup ovoj strani
export function useInternoOsoblje(dozvoljeneUloge, porukaZabranjenogPristupa) {
  const [uloga, setUloga] = useState(null);
  const [ucitavanjeUloge, setUcitavanjeUloge] = useState(true);
  const [pin, setPin] = useState("");
  const [prijavaUToku, setPrijavaUToku] = useState(false);
  const [greskaPristupa, setGreskaPristupa] = useState("");

  const [porudzbine, setPorudzbine] = useState([]);
  const [sadaTick, setSadaTick] = useState(Date.now());
  const [zatvaranjeUToku, setZatvaranjeUToku] = useState(false);

  const imaPristup = Boolean(uloga && dozvoljeneUloge.includes(uloga));

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
  useEffect(() => {
    if (!imaPristup) {
      setPorudzbine([]);
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
        setPorudzbine(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
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
  // Probavamo SAMO emailove uloga dozvoljenih na OVOJ stranici, tim redom
  // (npr. na /admin se nikad ne pokušava kuhinja nalog, bez obzira na PIN).
  const hendlajLogin = async (e) => {
    e.preventDefault();
    setGreskaPristupa("");
    if (pin.length < 6 || prijavaUToku) return;
    setPrijavaUToku(true);
    const emailoviZaPokusaj = dozvoljeneUloge
      .map((u) => EMAIL_PO_ULOZI[u])
      .filter(Boolean);
    let uspesnaPrijava = false;
    for (const email of emailoviZaPokusaj) {
      try {
        await signInWithEmailAndPassword(auth, email, pin);
        uspesnaPrijava = true;
        break;
      } catch (greska) {
        // probaj sledeći dozvoljeni email
      }
    }
    if (!uspesnaPrijava) setGreskaPristupa("Netačan PIN kod!");
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

  return {
    uloga,
    ucitavanjeUloge,
    imaPristup,
    pin,
    setPin,
    prijavaUToku,
    greskaPristupa,
    hendlajLogin,
    hendlajOdjavu,
    porudzbine,
    sadaTick,
    napredujStatus,
    zatvoriPoslovniDan,
    zatvaranjeUToku,
  };
}
