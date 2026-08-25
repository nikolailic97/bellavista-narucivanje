import { useState, useEffect } from "react";
import Head from "next/head";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  documentId,
} from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { klaseFontova } from "../lib/fontovi";
import { db } from "../lib/firebase";
import { danasnjiDatum, vremeUMilisekundama } from "../lib/pomocne";
import { NAZIV_STATUSA } from "../lib/constants";
import { NAZIV_JELA_SR } from "../lib/jelovnik";
import { useInternoOsoblje } from "../hooks/useInternoOsoblje";
import KuhinjskaTabla from "../components/KuhinjskaTabla";
import PinPrijava from "../components/PinPrijava";

// Boje grafikona usklađene sa tamnom temom (vidi styles/globals.css)
const ZLATO = "#C9A227";
const ZLATO_TIHO = "#8B7420";
const MREZA = "#28333A";
const OSA_TEKST = "#9AA3A8";

const NAZIVI_PERIODA = {
  danas: "Danas",
  nedelja: "7 dana",
  mesec: "Mesec",
  godina: "Godina",
};

const NAZIVI_PREGLEDA = {
  analitika: "Analitika",
  kuhinja: "Kuhinja",
  pretraga: "Pretraga",
  recenzije: "Recenzije",
};

// Stil tooltipa za sve recharts grafikone - inače ostane beo na tamnoj temi
const STIL_TOOLTIPA = {
  fontSize: 12,
  borderRadius: 10,
  background: "#1E262B",
  border: "1px solid #28333A",
  color: "#EDE7DA",
};

export default function AdminStranica() {
  const {
    ucitavanjeUloge,
    imaPristup,
    pin,
    setPin,
    email,
    setEmail,
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
  } = useInternoOsoblje(
    ["admin"],
    "Ovaj nalog nema pristup Admin panelu — probaj /kuhinja.",
  );

  const [pregled, setPregled] = useState("analitika"); // 'analitika' | 'kuhinja' | 'pretraga' | 'recenzije'
  const [analitikaVreme, setAnalitikaVreme] = useState("danas");
  const [analitikaPodaci, setAnalitikaPodaci] = useState([]);
  const [analitikaUcitavanje, setAnalitikaUcitavanje] = useState(false);
  // Sirove današnje (još nearhivirane) porudžbine - iz njih računamo promet po
  // satu i prosečno vreme dostave. Već ih dovlačimo za zbirne brojeve, pa ovo
  // ne košta nijedno dodatno Firestore čitanje.
  const [zivePorudzbineDanas, setZivePorudzbineDanas] = useState([]);
  // Jučerašnji izveštaj - samo za poređenje na "Danas" (1 dodatno čitanje).
  const [juceIzvestaj, setJuceIzvestaj] = useState(null);

  const [pretragaKod, setPretragaKod] = useState("");
  const [pretragaRezultat, setPretragaRezultat] = useState(null);
  const [pretragaNijeNadjena, setPretragaNijeNadjena] = useState(false);
  const [pretragaUToku, setPretragaUToku] = useState(false);

  const [recenzije, setRecenzije] = useState([]);
  const [recenzijeUcitavanje, setRecenzijeUcitavanje] = useState(false);
  const [filterZvezdice, setFilterZvezdice] = useState(0); // 0 = sve
  const [otvorenaRecenzija, setOtvorenaRecenzija] = useState(null);
  // Paginacija - ranije se učitavalo do 500 recenzija na SVAKO otvaranje
  // admin panela (do 500 Firestore čitanja svaki put, bez potrebe).
  const [poslednjiRecenzijaDoc, setPoslednjiRecenzijaDoc] = useState(null);
  const [imaJosRecenzija, setImaJosRecenzija] = useState(false);

  // ---- Admin analitika: čita samo izveštaje, ručno + na promenu perioda ----
  // Agregira niz porudzbine dokumenata u {total_orders, total_revenue, top_items}
  // - isti obrazac kao pri "Zatvori poslovni dan", za PRIKAZ pre arhiviranja.
  const agregirajPorudzbine = (dokumenti) => {
    let total_orders = 0;
    let total_revenue = 0;
    const top_items = {};
    dokumenti.forEach((podaci) => {
      total_orders += 1;
      total_revenue += podaci.cena_ukupno || 0;
      (podaci.stavke || []).forEach((stavka) => {
        const naziv = NAZIV_JELA_SR[stavka.id_jela] || stavka.naziv;
        top_items[naziv] = (top_items[naziv] || 0) + stavka.kolicina;
      });
    });
    return { total_orders, total_revenue, top_items };
  };

  const spojiIzvestaje = (a, b) => {
    const top_items = { ...(a.top_items || {}) };
    Object.entries(b.top_items || {}).forEach(([naziv, kolicina]) => {
      top_items[naziv] = (top_items[naziv] || 0) + kolicina;
    });
    return {
      total_orders: (a.total_orders || 0) + (b.total_orders || 0),
      total_revenue: (a.total_revenue || 0) + (b.total_revenue || 0),
      top_items,
    };
  };

  // Žive (još nearhivirane) porudžbine za danas - da se vide odmah, bez
  // čekanja na "Zatvori poslovni dan". Usput čuvamo i sirove dokumente.
  const ucitajZivePodatkeZaDanas = async () => {
    const q = query(
      collection(db, "porudzbine"),
      where("datum", "==", danasnjiDatum()),
    );
    const snap = await getDocs(q);
    const dokumenti = snap.docs.map((d) => d.data());
    setZivePorudzbineDanas(dokumenti);
    return agregirajPorudzbine(dokumenti);
  };

  const ucitajAnalitiku = async (period) => {
    setAnalitikaUcitavanje(true);
    try {
      const danasStr = danasnjiDatum();

      if (period === "danas") {
        const snap = await getDoc(doc(db, "izvestaji", danasStr));
        const arhivirano = snap.exists()
          ? snap.data()
          : { total_orders: 0, total_revenue: 0, top_items: {} };
        const zivo = await ucitajZivePodatkeZaDanas();

        // Juče - samo za strelice poređenja. Jedno dodatno čitanje.
        const juce = new Date();
        juce.setDate(juce.getDate() - 1);
        const juceStr = juce.toISOString().slice(0, 10);
        const juceSnap = await getDoc(doc(db, "izvestaji", juceStr));
        setJuceIzvestaj(juceSnap.exists() ? juceSnap.data() : null);

        setAnalitikaPodaci([
          { datum: danasStr, ...spojiIzvestaje(arhivirano, zivo) },
        ]);
        return;
      }

      setJuceIzvestaj(null);

      if (period === "nedelja" || period === "mesec") {
        const brojDana = period === "nedelja" ? 7 : 30;
        const datumi = [];
        for (let i = 0; i < brojDana; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          datumi.push(d.toISOString().slice(0, 10));
        }
        datumi.reverse(); // hronološki, najstariji prvo

        const q = query(
          collection(db, "izvestaji"),
          where(documentId(), "in", datumi),
        );
        const snap = await getDocs(q);
        const mapaIzvestaja = {};
        snap.docs.forEach((d) => {
          mapaIzvestaja[d.id] = d.data();
        });

        const zivoDanas = await ucitajZivePodatkeZaDanas();

        const podaci = datumi.map((datum) => {
          const bazni = mapaIzvestaja[datum] || {
            total_orders: 0,
            total_revenue: 0,
            top_items: {},
          };
          if (datum === danasStr) {
            return { datum, ...spojiIzvestaje(bazni, zivoDanas) };
          }
          return { datum, ...bazni };
        });
        setAnalitikaPodaci(podaci);
        return;
      }

      // godina
      const godina = new Date().getFullYear();
      const q = query(
        collection(db, "izvestaji"),
        where(documentId(), ">=", `${godina}-01-01`),
        where(documentId(), "<=", `${godina}-12-31`),
        orderBy(documentId(), "asc"),
      );
      const snap = await getDocs(q);
      const podaci = snap.docs.map((d) => ({ datum: d.id, ...d.data() }));

      if (danasStr.startsWith(`${godina}-`)) {
        const zivoDanas = await ucitajZivePodatkeZaDanas();
        const indeks = podaci.findIndex((p) => p.datum === danasStr);
        if (indeks >= 0) {
          podaci[indeks] = {
            datum: danasStr,
            ...spojiIzvestaje(podaci[indeks], zivoDanas),
          };
        } else {
          podaci.push({ datum: danasStr, ...zivoDanas });
        }
      }
      podaci.sort((a, b) => a.datum.localeCompare(b.datum));
      setAnalitikaPodaci(podaci);
    } catch (greska) {
      console.error("Greška pri učitavanju analitike:", greska);
      setAnalitikaPodaci([]);
    } finally {
      setAnalitikaUcitavanje(false);
    }
  };

  useEffect(() => {
    if (imaPristup && pregled === "analitika") {
      ucitajAnalitiku(analitikaVreme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imaPristup, pregled, analitikaVreme]);

  // ---- Pretraga porudžbine po broju - vidi sve podatke (ime/telefon/adresa/cena) ----
  const pretraziPorudzbinu = async (e) => {
    e.preventDefault();
    if (!pretragaKod || pretragaUToku) return;
    setPretragaUToku(true);
    setPretragaRezultat(null);
    setPretragaNijeNadjena(false);
    try {
      const q = query(
        collection(db, "porudzbine"),
        where("broj", "==", pretragaKod),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setPretragaNijeNadjena(true);
      } else {
        setPretragaRezultat({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (greska) {
      console.error("Greška pri pretrazi porudžbine:", greska);
      setPretragaNijeNadjena(true);
    } finally {
      setPretragaUToku(false);
    }
  };

  // ---- Recenzije - učitavaju se u stranicama po 50, najnovije prvo.
  // Filter po zvezdicama je client-side (radi nad već učitanim recenzijama). ----
  const RECENZIJA_PO_STRANI = 50;

  const ucitajRecenzije = async (nastavi = false) => {
    setRecenzijeUcitavanje(true);
    try {
      const uslovi = [
        collection(db, "recenzije"),
        orderBy("vreme_kreiranja", "desc"),
      ];
      if (nastavi && poslednjiRecenzijaDoc) {
        uslovi.push(startAfter(poslednjiRecenzijaDoc));
      }
      uslovi.push(limit(RECENZIJA_PO_STRANI));
      const snap = await getDocs(query(...uslovi));
      const nove = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRecenzije((prethodne) => (nastavi ? [...prethodne, ...nove] : nove));
      setPoslednjiRecenzijaDoc(snap.docs[snap.docs.length - 1] || null);
      // Ako je stiglo tačno koliko smo tražili, verovatno ima još.
      setImaJosRecenzija(snap.docs.length === RECENZIJA_PO_STRANI);
    } catch (greska) {
      console.error("Greška pri učitavanju recenzija:", greska);
      if (!nastavi) setRecenzije([]);
    } finally {
      setRecenzijeUcitavanje(false);
    }
  };

  useEffect(() => {
    if (imaPristup && recenzije.length === 0) {
      ucitajRecenzije();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imaPristup]);

  // ---- Izračunavanja za prikaz ----
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

  const prosekKorpe =
    zbirAnalitike.ukupnoPorudzbina > 0
      ? Math.round(zbirAnalitike.ukupanPrihod / zbirAnalitike.ukupnoPorudzbina)
      : 0;

  // Procentualna razlika u odnosu na juče. Vraća null kad poređenje nema
  // smisla (nije "Danas", nema jučerašnjeg izveštaja, ili je juče bilo 0).
  const razlikaProcenat = (danasVrednost, juceVrednost) => {
    if (analitikaVreme !== "danas" || juceIzvestaj === null) return null;
    if (!juceVrednost) return null;
    return Math.round(((danasVrednost - juceVrednost) / juceVrednost) * 100);
  };

  const razlikaPrihod = razlikaProcenat(
    zbirAnalitike.ukupanPrihod,
    juceIzvestaj?.total_revenue,
  );
  const razlikaPorudzbina = razlikaProcenat(
    zbirAnalitike.ukupnoPorudzbina,
    juceIzvestaj?.total_orders,
  );

  // ---- Prosečno vreme od porudžbine do predaje kuriru.
  // VAŽNO: računa se samo iz današnjih ŽIVIH porudžbina - arhivirane se brišu
  // pri "Zatvori poslovni dan" i u izvestaji ostaju samo zbirni brojevi, pa
  // istorijski prosek nije moguć bez izmene tog upisa. ----
  const prosecnoVremeDostave = (() => {
    const trajanja = zivePorudzbineDanas
      .map((p) => {
        const pocetak = vremeUMilisekundama(p.vreme_kreiranja);
        const kraj = vremeUMilisekundama(p.vreme_zavrseno);
        if (!pocetak || !kraj || kraj <= pocetak) return null;
        return (kraj - pocetak) / 60000;
      })
      .filter((v) => v !== null);
    if (trajanja.length === 0) return null;
    return Math.round(trajanja.reduce((a, b) => a + b, 0) / trajanja.length);
  })();

  // ---- Promet po satu (samo "Danas") - pokazuje kad je špic, na osnovu čega
  // se raspoređuju ljudi. Računa se iz istih živih porudžbina, bez dodatnih
  // čitanja. Prikazuju se samo sati u kojima je bilo prometa. ----
  const podaciPoSatu = (() => {
    if (analitikaVreme !== "danas") return [];
    const kofe = {};
    zivePorudzbineDanas.forEach((p) => {
      const ms = vremeUMilisekundama(p.vreme_kreiranja);
      if (!ms) return;
      const sat = new Date(ms).getHours();
      kofe[sat] = (kofe[sat] || 0) + (p.cena_ukupno || 0);
    });
    const satovi = Object.keys(kofe).map(Number);
    if (satovi.length === 0) return [];
    const min = Math.min(...satovi);
    const maks = Math.max(...satovi);
    const rezultat = [];
    for (let s = min; s <= maks; s++) {
      rezultat.push({ sat: String(s).padStart(2, "0"), prihod: kofe[s] || 0 });
    }
    return rezultat;
  })();

  const topPetStavki = Object.entries(zbirAnalitike.topStavke)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const najviseProdato = topPetStavki.length > 0 ? topPetStavki[0][1] : 0;

  const sveStavkePoProdaji = Object.entries(zbirAnalitike.topStavke)
    .sort((a, b) => b[1] - a[1])
    .map(([naziv, kolicina]) => ({ naziv, kolicina }));

  const podaciZaGrafikPrihoda = analitikaPodaci.map((izvestaj) => ({
    datum: izvestaj.datum.slice(5), // MM-DD, kraće za osu
    prihod: izvestaj.total_revenue || 0,
  }));

  const brojRecenzija = recenzije.length;
  const prosecnaOcena =
    brojRecenzija > 0
      ? recenzije.reduce((zbir, r) => zbir + r.zvezdice, 0) / brojRecenzija
      : 0;
  const histogramOcena = [5, 4, 3, 2, 1].map((zvezde) => ({
    zvezde,
    broj: recenzije.filter((r) => r.zvezdice === zvezde).length,
  }));
  const prikazaneRecenzije =
    filterZvezdice === 0
      ? recenzije
      : recenzije.filter((r) => r.zvezdice === filterZvezdice);

  return (
    <div
      className={`${klaseFontova} min-h-screen bg-noc text-krem font-body antialiased`}
    >
      <Head>
        <title>Admin — Interni panel</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#14191C" />
      </Head>

      <div className="max-w-[1200px] mx-auto p-4 sm:p-5">
        {ucitavanjeUloge ? (
          <p className="text-center text-krem-tih text-sm py-12">
            Učitavanje...
          </p>
        ) : !imaPristup ? (
          <PinPrijava
            naslov="Admin kontrolna tabla"
            email={email}
            setEmail={setEmail}
            pin={pin}
            setPin={setPin}
            prijavaUToku={prijavaUToku}
            greska={greskaPristupa}
            onSubmit={hendlajLogin}
          />
        ) : (
          <>
            <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
              <h1 className="font-display text-[26px] text-krem">
                {NAZIVI_PREGLEDA[pregled]}
              </h1>
              <button
                onClick={hendlajOdjavu}
                className="bg-ugalj border border-ugalj-vis text-krem font-bold text-xs px-4 py-2.5 rounded-[10px] hover:border-krem-tih transition-colors"
              >
                Odjavi se
              </button>
            </div>

            {/* Prekidač pregleda */}
            <div className="flex gap-1 bg-ugalj p-1 rounded-xl mb-5 overflow-x-auto bez-scrollbara">
              {Object.entries(NAZIVI_PREGLEDA).map(([kljuc, naziv]) => (
                <button
                  key={kljuc}
                  onClick={() => setPregled(kljuc)}
                  aria-pressed={pregled === kljuc}
                  className={`flex-1 whitespace-nowrap text-xs font-bold px-4 py-2.5 rounded-lg transition-colors ${
                    pregled === kljuc
                      ? "bg-zlato text-noc"
                      : "text-krem-tih hover:text-krem"
                  }`}
                >
                  {naziv}
                </button>
              ))}
            </div>

            {/* ============ KUHINJA ============ */}
            {pregled === "kuhinja" && (
              <KuhinjskaTabla
                porudzbine={porudzbine}
                sadaTick={sadaTick}
                naNapredujStatus={napredujStatus}
                naAzurirajVreme={azurirajVreme}
                naZatvoriDan={zatvoriPoslovniDan}
                zatvaranjeUToku={zatvaranjeUToku}
                mozeMenjatiVreme
              />
            )}

            {/* ============ PRETRAGA ============ */}
            {pregled === "pretraga" && (
              <div className="max-w-2xl">
                <div className="bg-ugalj border border-ugalj-vis rounded-2xl p-[18px] mb-4">
                  <div className="flex justify-between items-baseline mb-4">
                    <h3 className="font-num text-[11px] font-bold tracking-[.14em] uppercase text-zlato">
                      Pretraga porudžbine
                    </h3>
                    <span className="text-[11px] text-krem-tih">po kodu</span>
                  </div>
                  <form onSubmit={pretraziPorudzbinu} className="flex gap-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pretragaKod}
                      onChange={(e) =>
                        setPretragaKod(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="npr. 48213"
                      className="flex-1 bg-noc border border-ugalj-vis rounded-[11px] px-3.5 py-3 font-num text-[15px] font-bold tracking-[.08em] text-krem placeholder:font-body placeholder:font-medium placeholder:tracking-normal placeholder:text-krem-tih/60 focus:outline-none focus:border-zlato transition-colors"
                      aria-label="Broj porudžbine"
                    />
                    <button
                      type="submit"
                      disabled={pretragaUToku}
                      className="bg-krem text-noc font-bold text-[13px] px-6 rounded-[11px] disabled:opacity-60 hover:bg-white transition-colors"
                    >
                      {pretragaUToku ? "..." : "Pretraži"}
                    </button>
                  </form>
                </div>

                {pretragaNijeNadjena && (
                  <div className="bg-ugalj border border-ugalj-vis rounded-2xl p-4 text-sm text-krem-tih">
                    Porudžbina{" "}
                    <span className="font-num font-bold text-krem">
                      {pretragaKod}
                    </span>{" "}
                    ne postoji.
                  </div>
                )}

                {pretragaRezultat && (
                  <div className="bg-ugalj border border-ugalj-vis rounded-2xl p-[18px]">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-num text-2xl font-extrabold text-krem">
                        {pretragaRezultat.broj}
                      </span>
                      <span className="font-num text-[10px] font-bold tracking-[.1em] uppercase px-2.5 py-1.5 rounded-md bg-ugalj-vis text-krem">
                        {NAZIV_STATUSA[pretragaRezultat.status] ||
                          pretragaRezultat.status}
                      </span>
                    </div>

                    <div className="text-[13px] leading-relaxed border-b border-ugalj-vis pb-3.5 mb-3.5">
                      <p className="font-semibold text-krem">
                        {pretragaRezultat.ime}
                      </p>
                      <p className="text-krem-tih">
                        {pretragaRezultat.telefon}
                      </p>
                      <p className="text-krem-tih">{pretragaRezultat.adresa}</p>
                      {pretragaRezultat.napomena && (
                        <p className="text-[#F0B267] mt-1.5">
                          {pretragaRezultat.napomena}
                        </p>
                      )}
                    </div>

                    <ul className="text-[13px] border-b border-ugalj-vis pb-3.5 mb-3.5">
                      {(pretragaRezultat.stavke || []).map((stavka, i) => (
                        <li key={i} className="flex justify-between gap-3 py-1">
                          <span className="text-krem">
                            <span className="font-num font-bold text-zlato">
                              {stavka.kolicina}&times;
                            </span>{" "}
                            {NAZIV_JELA_SR[stavka.id_jela] || stavka.naziv}
                            {stavka.dodaci && stavka.dodaci.length > 0 && (
                              <span className="text-krem-tih">
                                {" "}
                                (+
                                {stavka.dodaci.map((d) => d.naziv).join(", ")})
                              </span>
                            )}
                          </span>
                          <span className="font-num font-bold text-krem whitespace-nowrap">
                            {(
                              stavka.cena_po_komadu * stavka.kolicina
                            ).toLocaleString("sr-RS")}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex justify-between items-baseline">
                      <span className="text-[13px] text-krem-tih">
                        Ukupno ({pretragaRezultat.nacin_placanja})
                      </span>
                      <span className="font-num text-lg font-bold text-zlato">
                        {(pretragaRezultat.cena_ukupno || 0).toLocaleString(
                          "sr-RS",
                        )}{" "}
                        RSD
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] leading-relaxed text-krem-tih/70 mt-4">
                  Pretraga radi samo za porudžbine iz dana koji još nije
                  zatvoren — arhivirane porudžbine se brišu prilikom „Zatvori
                  poslovni dan", ostaju samo zbirni brojevi u Analitici.
                </p>
              </div>
            )}

            {/* ============ RECENZIJE ============ */}
            {pregled === "recenzije" && (
              <div className="max-w-3xl">
                {recenzijeUcitavanje && recenzije.length === 0 ? (
                  <p className="text-center text-krem-tih text-sm py-8">
                    Učitavanje...
                  </p>
                ) : (
                  <>
                    <div className="bg-ugalj border border-ugalj-vis rounded-2xl p-[18px] mb-4">
                      <div className="flex justify-between items-baseline mb-4">
                        <h3 className="font-num text-[11px] font-bold tracking-[.14em] uppercase text-zlato">
                          Ocene
                        </h3>
                        <span className="text-[11px] text-krem-tih">
                          {imaJosRecenzija
                            ? `poslednjih ${brojRecenzija}`
                            : `${brojRecenzija} ukupno`}
                        </span>
                      </div>

                      <div className="flex items-center gap-6 flex-wrap">
                        <div>
                          <div className="font-num text-[38px] font-bold text-zlato leading-none">
                            {brojRecenzija > 0 ? prosecnaOcena.toFixed(1) : "—"}
                          </div>
                          <div
                            className="text-zlato text-[15px] tracking-[2px] mt-1.5"
                            aria-label={`Prosečna ocena ${prosecnaOcena.toFixed(1)} od 5`}
                          >
                            {"★".repeat(Math.round(prosecnaOcena))}
                            <span className="text-ugalj-vis">
                              {"★".repeat(5 - Math.round(prosecnaOcena))}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-[170px]">
                          {histogramOcena.map(({ zvezde, broj }) => (
                            <div
                              key={zvezde}
                              className="flex items-center gap-2 mb-1"
                            >
                              <span className="font-num text-[10px] text-krem-tih w-3">
                                {zvezde}
                              </span>
                              <div className="flex-1 h-[5px] bg-ugalj-vis rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-zlato rounded-full"
                                  style={{
                                    width:
                                      brojRecenzija > 0
                                        ? `${(broj / brojRecenzija) * 100}%`
                                        : "0%",
                                  }}
                                />
                              </div>
                              <span className="font-num text-[10px] text-krem-tih w-5 text-right">
                                {broj}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap mb-4">
                      <button
                        onClick={() => setFilterZvezdice(0)}
                        aria-pressed={filterZvezdice === 0}
                        className={`text-xs font-bold px-3.5 py-2 rounded-full transition-colors ${
                          filterZvezdice === 0
                            ? "bg-zlato text-noc"
                            : "bg-ugalj border border-ugalj-vis text-krem-tih hover:text-krem"
                        }`}
                      >
                        Sve
                      </button>
                      {[5, 4, 3, 2, 1].map((z) => (
                        <button
                          key={z}
                          onClick={() => setFilterZvezdice(z)}
                          aria-pressed={filterZvezdice === z}
                          className={`text-xs font-bold px-3.5 py-2 rounded-full transition-colors ${
                            filterZvezdice === z
                              ? "bg-zlato text-noc"
                              : "bg-ugalj border border-ugalj-vis text-krem-tih hover:text-krem"
                          }`}
                        >
                          {z}★
                        </button>
                      ))}
                    </div>

                    {prikazaneRecenzije.length === 0 ? (
                      <p className="text-center text-krem-tih text-sm py-8">
                        Nema recenzija za prikaz.
                      </p>
                    ) : (
                      prikazaneRecenzije.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setOtvorenaRecenzija(r)}
                          className="w-full text-left bg-ugalj border border-ugalj-vis rounded-xl px-3.5 py-3 mb-2.5 hover:border-krem-tih/40 transition-colors"
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-zlato text-xs tracking-[1px]">
                              {"★".repeat(r.zvezdice)}
                              <span className="text-ugalj-vis">
                                {"★".repeat(5 - r.zvezdice)}
                              </span>
                            </span>
                            <time className="font-num text-[10px] text-krem-tih">
                              {r.datum}
                            </time>
                          </div>
                          {r.tekst && (
                            <p className="text-[13px] text-krem-tih truncate">
                              {r.tekst}
                            </p>
                          )}
                        </button>
                      ))
                    )}

                    {imaJosRecenzija && (
                      <button
                        onClick={() => ucitajRecenzije(true)}
                        disabled={recenzijeUcitavanje}
                        className="w-full bg-transparent border border-ugalj-vis text-krem-tih font-bold text-xs py-3 rounded-xl hover:text-krem hover:border-krem-tih/50 transition-colors disabled:opacity-50"
                      >
                        {recenzijeUcitavanje ? "Učitavanje..." : "Učitaj još"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ============ ANALITIKA ============ */}
            {pregled === "analitika" && (
              <>
                <div className="flex gap-1 bg-ugalj p-[3px] rounded-[10px] mb-5 w-fit">
                  {Object.entries(NAZIVI_PERIODA).map(([kljuc, naziv]) => (
                    <button
                      key={kljuc}
                      onClick={() => setAnalitikaVreme(kljuc)}
                      aria-pressed={analitikaVreme === kljuc}
                      className={`text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors ${
                        analitikaVreme === kljuc
                          ? "bg-zlato text-noc"
                          : "text-krem-tih hover:text-krem"
                      }`}
                    >
                      {naziv}
                    </button>
                  ))}
                </div>

                {analitikaUcitavanje ? (
                  <p className="text-center text-krem-tih text-sm py-8">
                    Učitavanje...
                  </p>
                ) : (
                  <>
                    {/* KPI kartice */}
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 mb-5">
                      <KpiKartica
                        naslov="Promet"
                        vrednost={zbirAnalitike.ukupanPrihod.toLocaleString(
                          "sr-RS",
                        )}
                        istaknut
                        razlika={razlikaPrihod}
                      />
                      <KpiKartica
                        naslov="Porudžbine"
                        vrednost={zbirAnalitike.ukupnoPorudzbina}
                        razlika={razlikaPorudzbina}
                      />
                      <KpiKartica
                        naslov="Prosek korpe"
                        vrednost={prosekKorpe.toLocaleString("sr-RS")}
                        napomena="RSD po porudžbini"
                      />
                      <KpiKartica
                        naslov="Prosečno vreme"
                        vrednost={
                          prosecnoVremeDostave !== null
                            ? `${prosecnoVremeDostave}`
                            : "—"
                        }
                        jedinica={prosecnoVremeDostave !== null ? "min" : ""}
                        napomena="od porudžbine do kurira, danas"
                      />
                    </div>

                    {/* Grafikon: po satu za "Danas", po danu za ostale periode */}
                    {analitikaVreme === "danas" && podaciPoSatu.length > 0 && (
                      <Panel naslov="Promet po satu" desno="RSD">
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={podaciPoSatu}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={MREZA}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="sat"
                              tick={{ fontSize: 11, fill: OSA_TEKST }}
                              stroke={MREZA}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: OSA_TEKST }}
                              stroke={MREZA}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(201,162,39,.08)" }}
                              formatter={(value) => [
                                `${value.toLocaleString("sr-RS")} RSD`,
                                "Promet",
                              ]}
                              labelFormatter={(l) => `${l}:00`}
                              contentStyle={STIL_TOOLTIPA}
                            />
                            <Bar
                              dataKey="prihod"
                              fill={ZLATO}
                              radius={[5, 5, 2, 2]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Panel>
                    )}

                    {podaciZaGrafikPrihoda.length > 1 && (
                      <Panel naslov="Promet po danu" desno="RSD">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={podaciZaGrafikPrihoda}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={MREZA}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="datum"
                              tick={{ fontSize: 11, fill: OSA_TEKST }}
                              stroke={MREZA}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: OSA_TEKST }}
                              stroke={MREZA}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(201,162,39,.08)" }}
                              formatter={(value) => [
                                `${value.toLocaleString("sr-RS")} RSD`,
                                "Promet",
                              ]}
                              contentStyle={STIL_TOOLTIPA}
                            />
                            <Bar
                              dataKey="prihod"
                              fill={ZLATO}
                              radius={[5, 5, 2, 2]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Panel>
                    )}

                    {topPetStavki.length > 0 && (
                      <Panel naslov="Najprodavanije" desno="komada">
                        {topPetStavki.map(([naziv, kolicina], i) => (
                          <div
                            key={naziv}
                            className="flex items-center gap-3 py-2.5 border-b border-ugalj-vis last:border-b-0"
                          >
                            <span className="font-num text-xs font-bold text-krem-tih w-5 flex-none">
                              {i + 1}
                            </span>
                            <span className="flex-1 text-sm truncate text-krem">
                              {naziv}
                            </span>
                            <span className="w-[90px] h-[5px] bg-ugalj-vis rounded-full overflow-hidden flex-none">
                              <span
                                className="block h-full bg-zlato rounded-full"
                                style={{
                                  width: najviseProdato
                                    ? `${(kolicina / najviseProdato) * 100}%`
                                    : "0%",
                                }}
                              />
                            </span>
                            <span className="font-num text-[13px] font-bold text-krem w-8 text-right flex-none">
                              {kolicina}
                            </span>
                          </div>
                        ))}
                      </Panel>
                    )}

                    {sveStavkePoProdaji.length > 5 && (
                      <Panel naslov="Prodato po stavci" desno="komada">
                        <ResponsiveContainer
                          width="100%"
                          height={Math.max(160, sveStavkePoProdaji.length * 32)}
                        >
                          <BarChart
                            data={sveStavkePoProdaji}
                            layout="vertical"
                            margin={{ left: 8 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={MREZA}
                              horizontal={false}
                            />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 11, fill: OSA_TEKST }}
                              stroke={MREZA}
                              allowDecimals={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="naziv"
                              tick={{ fontSize: 11, fill: OSA_TEKST }}
                              stroke={MREZA}
                              width={140}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(201,162,39,.08)" }}
                              formatter={(value) => [`${value}×`, "Prodato"]}
                              contentStyle={STIL_TOOLTIPA}
                            />
                            <Bar
                              dataKey="kolicina"
                              fill={ZLATO_TIHO}
                              radius={[0, 5, 5, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Panel>
                    )}

                    <button
                      onClick={() => ucitajAnalitiku(analitikaVreme)}
                      className="text-xs font-bold text-krem-tih hover:text-krem py-2 transition-colors"
                    >
                      Osveži
                    </button>
                  </>
                )}
              </>
            )}

            {/* ============ MODAL: recenzija ============ */}
            {otvorenaRecenzija && (
              <div
                className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                onClick={() => setOtvorenaRecenzija(null)}
                role="dialog"
                aria-modal="true"
              >
                <div
                  className="bg-ugalj border border-ugalj-vis w-full max-w-md rounded-[20px] p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-zlato text-lg tracking-[2px]">
                      {"★".repeat(otvorenaRecenzija.zvezdice)}
                      <span className="text-ugalj-vis">
                        {"★".repeat(5 - otvorenaRecenzija.zvezdice)}
                      </span>
                    </span>
                    <button
                      onClick={() => setOtvorenaRecenzija(null)}
                      className="text-krem-tih hover:text-krem text-xl leading-none p-1"
                      aria-label="Zatvori"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="font-num text-[11px] text-krem-tih mb-3">
                    {otvorenaRecenzija.datum}
                  </p>
                  <p className="text-sm text-krem leading-relaxed">
                    {otvorenaRecenzija.tekst || "(bez teksta)"}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- KPI kartica sa opcionim poređenjem u odnosu na prethodni period ----
function KpiKartica({
  naslov,
  vrednost,
  jedinica,
  napomena,
  razlika,
  istaknut,
}) {
  return (
    <div className="bg-ugalj border border-ugalj-vis rounded-[15px] px-[17px] py-4">
      <span className="block font-num text-[10px] font-bold tracking-[.14em] uppercase text-krem-tih mb-2.5">
        {naslov}
      </span>
      <strong
        className={`block font-num text-[27px] font-bold tracking-[-.02em] leading-none ${
          istaknut ? "text-zlato" : "text-krem"
        }`}
      >
        {vrednost}
        {jedinica && (
          <span className="text-sm font-medium text-krem-tih ml-1">
            {jedinica}
          </span>
        )}
      </strong>
      {(razlika !== null && razlika !== undefined) || napomena ? (
        <small className="block text-[11px] text-krem-tih mt-1.5">
          {razlika !== null && razlika !== undefined ? (
            <>
              <span
                className={`font-semibold ${
                  razlika >= 0 ? "text-spremno" : "text-kasni"
                }`}
              >
                {razlika >= 0 ? "▲" : "▼"} {Math.abs(razlika)}%
              </span>{" "}
              u odnosu na juče
            </>
          ) : (
            napomena
          )}
        </small>
      ) : null}
    </div>
  );
}

// ---- Panel: jedinstveni okvir za grafikone i liste ----
function Panel({ naslov, desno, children }) {
  return (
    <div className="bg-ugalj border border-ugalj-vis rounded-2xl p-[18px] mb-4">
      <div className="flex justify-between items-baseline mb-4">
        <h3 className="font-num text-[11px] font-bold tracking-[.14em] uppercase text-zlato">
          {naslov}
        </h3>
        {desno && <span className="text-[11px] text-krem-tih">{desno}</span>}
      </div>
      {children}
    </div>
  );
}
