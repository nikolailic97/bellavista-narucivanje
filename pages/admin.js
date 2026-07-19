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
import { db } from "../lib/firebase";
import { danasnjiDatum } from "../lib/pomocne";
import { NAZIV_STATUSA } from "../lib/constants";
import { useInternoOsoblje } from "../hooks/useInternoOsoblje";
import KuhinjskaTabla from "../components/KuhinjskaTabla";
import PinPrijava from "../components/PinPrijava";

const BOJE_GRAFIKONA = ["#C9A227", "#1A2328", "#8B9DA6", "#D9C48C", "#5B6B72"];

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

  const [pregled, setPregled] = useState("analitika"); // 'analitika' | 'kuhinja' | 'pretraga'
  const [analitikaVreme, setAnalitikaVreme] = useState("danas");
  const [analitikaPodaci, setAnalitikaPodaci] = useState([]);
  const [analitikaUcitavanje, setAnalitikaUcitavanje] = useState(false);

  const [pretragaKod, setPretragaKod] = useState("");
  const [pretragaRezultat, setPretragaRezultat] = useState(null);
  const [pretragaNijeNadjena, setPretragaNijeNadjena] = useState(false);
  const [pretragaUToku, setPretragaUToku] = useState(false);

  const [recenzije, setRecenzije] = useState([]);
  const [recenzijeUcitavanje, setRecenzijeUcitavanje] = useState(false);
  const [filterZvezdice, setFilterZvezdice] = useState(0); // 0 = sve
  const [otvorenaRecenzija, setOtvorenaRecenzija] = useState(null);

  // ---- Admin analitika: čita samo izveštaje, ručno + na promenu perioda ----
  const ucitajAnalitiku = async (period) => {
    setAnalitikaUcitavanje(true);
    try {
      if (period === "danas") {
        const danas = danasnjiDatum();
        const snap = await getDoc(doc(db, "izvestaji", danas));
        setAnalitikaPodaci(
          snap.exists() ? [{ datum: danas, ...snap.data() }] : [],
        );
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
      const podaci = snap.docs.map((d) => ({ datum: d.id, ...d.data() }));
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

  // ---- Recenzije - sve učitane odjednom (mala/srednja količina za lokalni
  // restoran), sortirane najnovije prvo, filter po zvezdicama je client-side ----
  const ucitajRecenzije = async () => {
    setRecenzijeUcitavanje(true);
    try {
      const q = query(
        collection(db, "recenzije"),
        orderBy("vreme_kreiranja", "desc"),
        limit(500),
      );
      const snap = await getDocs(q);
      setRecenzije(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (greska) {
      console.error("Greška pri učitavanju recenzija:", greska);
      setRecenzije([]);
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
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800">
      <Head>
        <title>Admin — Interni panel</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {ucitavanjeUloge ? (
          <p className="text-center text-slate-500 text-sm py-12">
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
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-black text-brand-dark">
                Admin kontrolna tabla
              </h1>
              <button
                onClick={hendlajOdjavu}
                className="text-xs text-red-500 font-bold hover:text-red-600 transition-all"
              >
                Odjavi se
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl max-w-lg">
              <button
                onClick={() => setPregled("analitika")}
                className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${pregled === "analitika" ? "bg-white text-brand-dark shadow-sm" : "text-slate-500"}`}
              >
                Analitika
              </button>
              <button
                onClick={() => setPregled("kuhinja")}
                className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${pregled === "kuhinja" ? "bg-white text-brand-dark shadow-sm" : "text-slate-500"}`}
              >
                Kuhinja
              </button>
              <button
                onClick={() => setPregled("pretraga")}
                className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${pregled === "pretraga" ? "bg-white text-brand-dark shadow-sm" : "text-slate-500"}`}
              >
                Pretraga
              </button>
              <button
                onClick={() => setPregled("recenzije")}
                className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${pregled === "recenzije" ? "bg-white text-brand-dark shadow-sm" : "text-slate-500"}`}
              >
                Recenzije
              </button>
            </div>

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

            {pregled === "pretraga" && (
              <div className="max-w-lg space-y-4">
                <form onSubmit={pretraziPorudzbinu} className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pretragaKod}
                    onChange={(e) =>
                      setPretragaKod(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Broj porudžbine, npr. 48213"
                    className="flex-1 border border-slate-200 rounded-lg p-2.5 text-base focus:outline-none focus:border-brand-dark"
                    aria-label="Broj porudžbine"
                  />
                  <button
                    type="submit"
                    className="bg-brand-dark text-white font-bold text-sm px-5 rounded-lg hover:bg-brand-dark-hover transition-all"
                  >
                    {pretragaUToku ? "..." : "Pretraži"}
                  </button>
                </form>

                {pretragaNijeNadjena && (
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-sm text-slate-500">
                    Porudžbina sa brojem{" "}
                    <span className="font-bold text-brand-dark">
                      #{pretragaKod}
                    </span>{" "}
                    ne postoji.
                  </div>
                )}

                {pretragaRezultat && (
                  <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-black text-brand-dark">
                        #{pretragaRezultat.broj}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                        {NAZIV_STATUSA[pretragaRezultat.status] ||
                          pretragaRezultat.status}
                      </span>
                    </div>
                    <div className="text-sm space-y-0.5 border-b border-slate-100 pb-3">
                      <p className="font-bold text-slate-800">
                        {pretragaRezultat.ime}
                      </p>
                      <p className="text-slate-600">
                        {pretragaRezultat.telefon}
                      </p>
                      <p className="text-slate-600">
                        {pretragaRezultat.adresa}
                      </p>
                    </div>
                    <ul className="text-sm text-slate-700 space-y-1 border-b border-slate-100 pb-3">
                      {(pretragaRezultat.stavke || []).map((stavka, i) => (
                        <li key={i} className="flex justify-between">
                          <span>
                            {stavka.kolicina}x {stavka.naziv}
                            {stavka.dodaci && stavka.dodaci.length > 0 && (
                              <span className="text-slate-500">
                                {" "}
                                (+
                                {stavka.dodaci.map((d) => d.naziv).join(", ")})
                              </span>
                            )}
                          </span>
                          <span className="font-bold">
                            {stavka.cena_po_komadu * stavka.kolicina} RSD
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between text-sm font-black text-brand-dark">
                      <span>Ukupno ({pretragaRezultat.nacin_placanja}):</span>
                      <span>{pretragaRezultat.cena_ukupno} RSD</span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  Napomena: pretraga radi samo za porudžbine iz dana koji još
                  nije zatvoren (arhivirane porudžbine se brišu prilikom
                  "Zatvori poslovni dan", ostaju samo zbirni brojevi u
                  Analitici).
                </p>
              </div>
            )}

            {pregled === "recenzije" && (
              <div className="max-w-2xl space-y-4">
                {recenzijeUcitavanje ? (
                  <p className="text-center text-slate-500 text-sm py-6">
                    Učitavanje...
                  </p>
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-6">
                      <div className="text-center">
                        <span className="text-3xl font-black text-brand-gold block">
                          {prosecnaOcena.toFixed(1)}
                        </span>
                        <span className="text-amber-400 text-sm">★★★★★</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {brojRecenzija}{" "}
                          {brojRecenzija === 1 ? "ocena" : "ocena ukupno"}
                        </span>
                      </div>
                      <div className="flex-1 space-y-1">
                        {histogramOcena.map(({ zvezde, broj }) => (
                          <div
                            key={zvezde}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="w-8 text-slate-500">
                              {zvezde}★
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-brand-gold h-2 rounded-full"
                                style={{
                                  width:
                                    brojRecenzija > 0
                                      ? `${(broj / brojRecenzija) * 100}%`
                                      : "0%",
                                }}
                              />
                            </div>
                            <span className="w-6 text-right font-bold text-slate-700">
                              {broj}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setFilterZvezdice(0)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${filterZvezdice === 0 ? "bg-brand-dark text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        Sve
                      </button>
                      {[5, 4, 3, 2, 1].map((z) => (
                        <button
                          key={z}
                          onClick={() => setFilterZvezdice(z)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${filterZvezdice === z ? "bg-brand-dark text-white" : "bg-slate-100 text-slate-600"}`}
                        >
                          {z}★
                        </button>
                      ))}
                    </div>

                    {prikazaneRecenzije.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-8">
                        Nema recenzija za prikaz.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {prikazaneRecenzije.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setOtvorenaRecenzija(r)}
                            className="w-full text-left bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-amber-400 text-sm">
                                {"★".repeat(r.zvezdice)}
                                <span className="text-slate-200">
                                  {"★".repeat(5 - r.zvezdice)}
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {r.datum}
                              </span>
                            </div>
                            {r.tekst && (
                              <p className="text-sm text-slate-600 truncate">
                                {r.tekst}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {otvorenaRecenzija && (
              <div
                className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                onClick={() => setOtvorenaRecenzija(null)}
              >
                <div
                  className="bg-white w-full max-w-md rounded-2xl p-6 space-y-3 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-amber-400 text-lg">
                      {"★".repeat(otvorenaRecenzija.zvezdice)}
                      <span className="text-slate-200">
                        {"★".repeat(5 - otvorenaRecenzija.zvezdice)}
                      </span>
                    </span>
                    <button
                      onClick={() => setOtvorenaRecenzija(null)}
                      className="text-slate-500 hover:text-slate-600 font-bold text-xl p-1"
                      aria-label="Zatvori"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    {otvorenaRecenzija.datum}
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {otvorenaRecenzija.tekst || "(bez teksta)"}
                  </p>
                </div>
              </div>
            )}

            {pregled === "analitika" && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl max-w-sm">
                  {["danas", "nedelja", "mesec", "godina"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAnalitikaVreme(v)}
                      className={`text-[11px] uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${analitikaVreme === v ? "bg-white text-brand-dark shadow-sm" : "text-slate-500"}`}
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          Porudžbine
                        </span>
                        <span className="text-2xl font-black text-brand-dark">
                          {zbirAnalitike.ukupnoPorudzbina}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          Prihod
                        </span>
                        <span className="text-2xl font-black text-brand-gold">
                          {zbirAnalitike.ukupanPrihod.toLocaleString("sr-RS")}{" "}
                          RSD
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          Prosečna ocena
                        </span>
                        <span className="text-2xl font-black text-brand-dark">
                          {brojRecenzija > 0 ? prosecnaOcena.toFixed(1) : "—"}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {brojRecenzija}{" "}
                          {brojRecenzija === 1 ? "ocena" : "ocena ukupno"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
                      {podaciZaGrafikPrihoda.length > 1 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-3">
                            Prihod po danu
                          </span>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={podaciZaGrafikPrihoda}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f1f5f9"
                              />
                              <XAxis dataKey="datum" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip
                                formatter={(value) => [
                                  `${value} RSD`,
                                  "Prihod",
                                ]}
                                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                              />
                              <Bar
                                dataKey="prihod"
                                fill="#C9A227"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {topPetStavki.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-3">
                            Top 5 najprodavanijih
                          </span>
                          <ul className="space-y-2">
                            {topPetStavki.map(([naziv, kolicina], i) => (
                              <li
                                key={naziv}
                                className="flex items-center gap-3"
                              >
                                <span
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                                    i === 0
                                      ? "bg-amber-400 text-white"
                                      : i === 1
                                        ? "bg-slate-300 text-white"
                                        : i === 2
                                          ? "bg-orange-300 text-white"
                                          : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {i + 1}
                                </span>
                                <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                                  {naziv}
                                </span>
                                <span className="text-sm font-black text-brand-dark">
                                  {kolicina}x
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sveStavkePoProdaji.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm lg:col-span-2">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-3">
                            Prodato po stavci
                          </span>
                          <ResponsiveContainer
                            width="100%"
                            height={Math.max(
                              160,
                              sveStavkePoProdaji.length * 32,
                            )}
                          >
                            <BarChart
                              data={sveStavkePoProdaji}
                              layout="vertical"
                              margin={{ left: 8 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f1f5f9"
                              />
                              <XAxis
                                type="number"
                                tick={{ fontSize: 11 }}
                                allowDecimals={false}
                              />
                              <YAxis
                                type="category"
                                dataKey="naziv"
                                tick={{ fontSize: 11 }}
                                width={140}
                              />
                              <Tooltip
                                formatter={(value) => [`${value}x`, "Prodato"]}
                                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                              />
                              <Bar
                                dataKey="kolicina"
                                fill="#1A2328"
                                radius={[0, 4, 4, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => ucitajAnalitiku(analitikaVreme)}
                      className="text-xs font-bold text-slate-500 py-2 hover:text-slate-700 transition-all"
                    >
                      Osveži
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
