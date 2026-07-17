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
  increment,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { REDOSLED_STATUSA } from "../lib/constants";
import { danasnjiDatum } from "../lib/pomocne";
import { NAZIV_JELA_SR } from "../lib/jelovnik";

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
  // Korisnik sad unosi i email i PIN direktno - nema više nagađanja koji je
  // nalog u pitanju (jednostavnije i bez ikakve dvosmislenosti).
  const hendlajLogin = async (e) => {
    e.preventDefault();
    setGreskaPristupa("");
    if (!email || pin.length < 6 || prijavaUToku) return;
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
    if (zatvaranjeUToku) return;
    if (
      !window.confirm(
        "Da li si siguran? Sve trenutne porudžbine za danas će biti arhivirane i obrisane.",
      )
    )
      return;
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
        return;
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
