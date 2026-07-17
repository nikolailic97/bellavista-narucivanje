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
import { db } from "../lib/firebase";
import { danasnjiDatum } from "../lib/pomocne";
import { NAZIV_STATUSA } from "../lib/constants";
import { useInternoOsoblje } from "../hooks/userinternoosoblje";
import KuhinjskaTabla from "../components/KuhinjskaTabla";
import PinPrijava from "../components/PinPrijava";

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

  // ---- Admin analitika: čita samo izveštaje, ručno + na promenu perioda ----
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
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800">
      <Head>
        <title>Admin — Interni panel</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
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
          <div className="space-y-5 max-w-2xl mx-auto lg:max-w-none">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-black text-slate-900">
                Admin kontrolna tabla
              </h1>
              <button
                onClick={hendlajOdjavu}
                className="text-xs text-red-500 font-bold hover:text-red-600 transition-all"
              >
                Odjavi se
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl max-w-md">
              <button
                onClick={() => setPregled("analitika")}
                className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${pregled === "analitika" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                Analitika
              </button>
              <button
                onClick={() => setPregled("kuhinja")}
                className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${pregled === "kuhinja" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                Kuhinja
              </button>
              <button
                onClick={() => setPregled("pretraga")}
                className={`text-xs uppercase tracking-wide font-bold p-2 rounded-lg transition-all ${pregled === "pretraga" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                Pretraga
              </button>
            </div>

            {pregled === "kuhinja" && (
              <KuhinjskaTabla
                porudzbine={porudzbine}
                sadaTick={sadaTick}
                naNapredujStatus={napredujStatus}
                naZatvoriDan={zatvoriPoslovniDan}
                zatvaranjeUToku={zatvaranjeUToku}
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
                    className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-slate-400"
                    aria-label="Broj porudžbine"
                  />
                  <button
                    type="submit"
                    className="bg-slate-900 text-white font-bold text-sm px-5 rounded-lg hover:bg-slate-800 transition-all"
                  >
                    {pretragaUToku ? "..." : "Pretraži"}
                  </button>
                </form>

                {pretragaNijeNadjena && (
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-sm text-slate-500">
                    Porudžbina sa brojem{" "}
                    <span className="font-bold text-slate-900">
                      #{pretragaKod}
                    </span>{" "}
                    ne postoji.
                  </div>
                )}

                {pretragaRezultat && (
                  <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-black text-slate-900">
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
                    <div className="flex justify-between text-sm font-black text-slate-900">
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

            {pregled === "analitika" && (
              <div className="max-w-sm space-y-4">
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
                          Top 5 najprodavanijih
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
                      className="w-full text-xs font-bold text-slate-500 py-2 hover:text-slate-700 transition-all"
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
