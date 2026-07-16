import { NAZIV_STATUSA, NAZIV_SLEDECE_AKCIJE } from "../lib/constants";
import { jeliKasni } from "../lib/pomocne";

export default function KuhinjskaTabla({
  porudzbine,
  sadaTick,
  naNapredujStatus,
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
          {porudzbine.map((p) => {
            const kasni = jeliKasni(p, sadaTick);
            return (
              <div
                key={p.id}
                className={`bg-white p-4 rounded-xl border shadow-sm ${kasni ? "border-red-500 border-dashed border-2" : "border-slate-100"}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-black text-lg text-slate-900">
                    #{p.broj}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                      kasni
                        ? "bg-red-100 text-red-600"
                        : p.status === "novo"
                          ? "bg-orange-100 text-orange-600"
                          : p.status === "u_pripremi"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {kasni ? "KASNI" : NAZIV_STATUSA[p.status]}
                  </span>
                </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
