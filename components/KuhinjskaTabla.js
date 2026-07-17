import { useState } from "react";
import { NAZIV_STATUSA, NAZIV_SLEDECE_AKCIJE } from "../lib/constants";
import { jeliKasni } from "../lib/pomocne";

function PorudzbinaKartica({ p, kasni, naNapredujStatus, naAzurirajVreme }) {
  const [vreme, setVreme] = useState(String(p.trajanje_procena_min || ""));
  const [cuvanjeUToku, setCuvanjeUToku] = useState(false);

  const bojaTema = kasni
    ? { okvir: "border-red-500 border-dashed", banner: "bg-red-500" }
    : p.status === "novo"
      ? { okvir: "border-orange-400", banner: "bg-orange-400" }
      : p.status === "u_pripremi"
        ? { okvir: "border-blue-400", banner: "bg-blue-400" }
        : { okvir: "border-emerald-400", banner: "bg-emerald-400" };

  const sacuvajVreme = async () => {
    if (cuvanjeUToku) return;
    setCuvanjeUToku(true);
    await naAzurirajVreme(p, vreme);
    setCuvanjeUToku(false);
  };

  return (
    <div
      className={`rounded-xl overflow-hidden shadow-sm border-2 ${bojaTema.okvir}`}
    >
      <div
        className={`${bojaTema.banner} text-white text-center text-[10px] uppercase font-bold py-1.5 tracking-wide`}
      >
        {kasni ? "Kasni" : NAZIV_STATUSA[p.status]}
      </div>
      <div className="bg-white p-4">
        <span className="font-black text-lg text-slate-900 block mb-2">
          #{p.broj}
        </span>
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
        <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 mb-3 space-y-0.5">
          <p className="font-bold text-slate-800">{p.ime}</p>
          <p>{p.telefon}</p>
          <p>{p.adresa}</p>
        </div>

        {/* Ručna izmena procenjenog vremena - npr. gužva u restoranu utiče
            na dostavu, pa se vreme koje vidi kupac može ručno prilagoditi */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="number"
            min="1"
            value={vreme}
            onChange={(e) => setVreme(e.target.value)}
            className="w-16 border border-slate-200 rounded-lg p-1.5 text-center text-sm font-bold"
            aria-label={`Procenjeno vreme za porudžbinu ${p.broj} (minuti)`}
          />
          <span className="text-xs text-slate-500">min</span>
          <button
            onClick={sacuvajVreme}
            disabled={cuvanjeUToku}
            className="ml-auto text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all"
          >
            {cuvanjeUToku ? "..." : "Sačuvaj vreme"}
          </button>
        </div>

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
    </div>
  );
}

export default function KuhinjskaTabla({
  porudzbine,
  sadaTick,
  naNapredujStatus,
  naAzurirajVreme,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {porudzbine.map((p) => (
            <PorudzbinaKartica
              key={p.id}
              p={p}
              kasni={jeliKasni(p, sadaTick)}
              naNapredujStatus={naNapredujStatus}
              naAzurirajVreme={naAzurirajVreme}
            />
          ))}
        </div>
      )}
    </div>
  );
}
