import { useState } from "react";
import {
  NAZIV_STATUSA,
  NAZIV_SLEDECE_AKCIJE,
  BUFFER_KASNJENJA_MIN,
} from "../lib/constants";
import { jeliKasni, vremeUMilisekundama } from "../lib/pomocne";
import { NAZIV_JELA_SR, NAZIV_DODATKA_SR } from "../lib/jelovnik";

// Kolone table. "zavrseno" se namerno NE prikazuje - te porudžbine su predate
// kuriru i sklanjaju se sa table da ne prave šum; ostaju u bazi do "Zatvori
// poslovni dan" i vidljive su kroz admin pretragu po kodu.
const KOLONE = [
  { status: "novo", boja: "bg-novo", ivica: "border-l-novo" },
  { status: "u_pripremi", boja: "bg-pripr", ivica: "border-l-pripr" },
  {
    status: "spremno_za_dostavu",
    boja: "bg-spremno",
    ivica: "border-l-spremno",
  },
];

// Koliko minuta porudžbina kasni u odnosu na procenu. Vraća 0 ako ne kasni
// ili ako vreme nije uneto (kuhinja ga unosi ručno).
function minutaKasnjenja(p, sadaMs) {
  const kreiranoMs = vremeUMilisekundama(p.vreme_kreiranja);
  if (!kreiranoMs || !p.trajanje_procena_min) return 0;
  const pragMs =
    kreiranoMs + (p.trajanje_procena_min + BUFFER_KASNJENJA_MIN) * 60000;
  return Math.max(0, Math.floor((sadaMs - pragMs) / 60000));
}

function satUnosa(p) {
  const ms = vremeUMilisekundama(p.vreme_kreiranja);
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PorudzbinaKartica({
  p,
  kasni,
  kasniMin,
  naNapredujStatus,
  naAzurirajVreme,
  mozeMenjatiVreme,
  ivica,
}) {
  const [vreme, setVreme] = useState(String(p.trajanje_procena_min || ""));
  const [cuvanjeUToku, setCuvanjeUToku] = useState(false);

  const sacuvajVreme = async () => {
    if (cuvanjeUToku) return;
    setCuvanjeUToku(true);
    await naAzurirajVreme(p, vreme);
    setCuvanjeUToku(false);
  };

  return (
    <article
      className={`bg-ugalj border border-ugalj-vis rounded-2xl p-3.5 mb-3 border-l-4 ${
        kasni ? "border-l-kasni border-kasni/40 bg-kasni/[0.07]" : ivica
      }`}
    >
      <div className="flex justify-between items-baseline mb-3">
        <span className="font-num text-[26px] font-extrabold tracking-[-.02em] text-krem">
          {p.broj}
          {kasni && (
            <span className="inline-block align-middle font-num text-[9px] font-bold tracking-[.1em] bg-kasni text-white px-2 py-[3px] rounded-[5px] ml-2">
              {kasniMin > 0 ? `KASNI ${kasniMin} MIN` : "KASNI"}
            </span>
          )}
        </span>
        <span className="font-num text-[11px] font-medium text-krem-tih">
          {satUnosa(p)}
        </span>
      </div>

      {/* JELA - najveći element na kartici. Kuvar treba da vidi šta da peče;
          ime/telefon/adresa su sklopljeni ispod jer trebaju tek kuriru.
          Uvek srpski naziv (preko id_jela / id dodatka), bez obzira na kom
          jeziku je kupac naručio. */}
      <ul className="mb-3 list-none">
        {(p.stavke || []).map((stavka, i) => (
          <li key={i} className="flex gap-2.5 py-[5px] leading-snug">
            <span className="font-num text-[15px] font-bold text-zlato flex-none min-w-[26px]">
              {stavka.kolicina}&times;
            </span>
            <div className="text-base font-semibold text-krem">
              {NAZIV_JELA_SR[stavka.id_jela] || stavka.naziv}
              {stavka.dodaci && stavka.dodaci.length > 0 && (
                <small className="block text-xs font-medium text-krem-tih mt-px">
                  +{" "}
                  {stavka.dodaci
                    .map((d) => NAZIV_DODATKA_SR[d.id] || d.naziv)
                    .join(", ")}
                </small>
              )}
              {stavka.napomena && (
                <small className="block text-xs font-medium text-[#F0B267] mt-px">
                  {stavka.napomena}
                </small>
              )}
            </div>
          </li>
        ))}
      </ul>

      {p.napomena && (
        <div className="bg-novo/10 border border-novo/30 rounded-[9px] px-3 py-2 text-[12.5px] leading-snug text-[#F0B267] mb-3">
          <b className="font-bold">Napomena:</b> {p.napomena}
        </div>
      )}

      {/* Podaci kupca - sklopljeno. Kuvaru ne trebaju, kuriru trebaju. */}
      <details className="mb-3 group">
        <summary className="list-none cursor-pointer font-num text-[11px] font-semibold tracking-[.1em] uppercase text-krem-tih py-2 border-t border-ugalj-vis flex justify-between items-center">
          Podaci za dostavu
          <span aria-hidden="true" className="group-open:hidden">
            &#9662;
          </span>
          <span aria-hidden="true" className="hidden group-open:inline">
            &#9652;
          </span>
        </summary>
        <div className="text-[13px] leading-relaxed text-krem-tih pt-1 pb-1.5">
          <span className="text-krem font-semibold">{p.ime}</span>
          <br />
          <a
            href={`tel:${String(p.telefon || "").replace(/\s/g, "")}`}
            className="text-krem font-semibold hover:text-zlato transition-colors"
          >
            {p.telefon}
          </a>
          <br />
          <span className="text-krem font-semibold">{p.adresa}</span>
        </div>
      </details>

      {/* Procenjeno vreme - kuhinja/admin ga unose ručno (gužva u restoranu
          utiče na dostavu, automatski račun je bio netačan) */}
      {mozeMenjatiVreme ? (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="number"
            min="1"
            value={vreme}
            onChange={(e) => setVreme(e.target.value)}
            placeholder="—"
            className="w-[58px] bg-noc border border-ugalj-vis rounded-[9px] p-2 text-center font-num text-[15px] font-bold text-krem placeholder:text-krem-tih/60 focus:outline-none focus:border-zlato transition-colors"
            aria-label={`Procenjeno vreme za porudžbinu ${p.broj} (minuti)`}
          />
          <span className="text-xs text-krem-tih">min</span>
          <button
            onClick={sacuvajVreme}
            disabled={cuvanjeUToku}
            className="ml-auto bg-ugalj-vis text-krem font-bold text-xs px-3.5 py-2 rounded-[9px] disabled:opacity-50 hover:brightness-125 transition-all"
          >
            {cuvanjeUToku ? "..." : "Sačuvaj"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-3 text-[13px] text-krem-tih">
          <span>Procenjeno:</span>
          <span className="font-num font-bold text-krem">
            {p.trajanje_procena_min ? `${p.trajanje_procena_min} min` : "—"}
          </span>
        </div>
      )}

      {NAZIV_SLEDECE_AKCIJE[p.status] && (
        <button
          onClick={() => naNapredujStatus(p)}
          className={`w-full font-bold text-[15px] py-3.5 rounded-[11px] transition-all ${
            kasni
              ? "bg-kasni text-white hover:brightness-110"
              : "bg-zlato text-noc hover:bg-zlato-svetlo"
          }`}
          aria-label={`Promeni status porudžbine ${p.broj}`}
        >
          {NAZIV_SLEDECE_AKCIJE[p.status]}
        </button>
      )}
    </article>
  );
}

export default function KuhinjskaTabla({
  porudzbine,
  sadaTick,
  naNapredujStatus,
  naAzurirajVreme,
  naZatvoriDan,
  zatvaranjeUToku,
  mozeMenjatiVreme = false,
}) {
  const ukupnoAktivnih = porudzbine.filter((p) =>
    KOLONE.some((k) => k.status === p.status),
  ).length;

  return (
    <div>
      {ukupnoAktivnih === 0 ? (
        <p className="text-krem-tih text-sm text-center py-14">
          Trenutno nema aktivnih porudžbina.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-start">
          {KOLONE.map((kolona) => {
            const uKoloni = porudzbine.filter(
              (p) => p.status === kolona.status,
            );
            return (
              <section
                key={kolona.status}
                className="bg-ugalj/50 border border-ugalj-vis rounded-2xl p-3 min-h-[180px]"
              >
                <header className="flex items-center gap-2.5 px-1 pb-3">
                  <span
                    aria-hidden="true"
                    className={`w-2.5 h-2.5 rounded-full flex-none ${kolona.boja}`}
                  />
                  <h2 className="flex-1 font-num text-[11px] font-bold tracking-[.14em] uppercase text-krem">
                    {NAZIV_STATUSA[kolona.status]}
                  </h2>
                  <span className="font-num text-xs font-bold bg-ugalj-vis text-krem min-w-6 text-center px-2 py-1 rounded-[7px]">
                    {uKoloni.length}
                  </span>
                </header>

                {uKoloni.length === 0 ? (
                  <p className="text-center text-krem-tih/50 text-[12.5px] py-7">
                    —
                  </p>
                ) : (
                  uKoloni.map((p) => {
                    const kasni = jeliKasni(p, sadaTick);
                    return (
                      <PorudzbinaKartica
                        key={p.id}
                        p={p}
                        kasni={kasni}
                        kasniMin={kasni ? minutaKasnjenja(p, sadaTick) : 0}
                        naNapredujStatus={naNapredujStatus}
                        naAzurirajVreme={naAzurirajVreme}
                        mozeMenjatiVreme={mozeMenjatiVreme}
                        ivica={kolona.ivica}
                      />
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-5 text-center">
        <button
          onClick={naZatvoriDan}
          disabled={zatvaranjeUToku}
          className="bg-transparent border border-novo/40 text-novo font-bold text-xs px-4 py-2.5 rounded-[10px] disabled:opacity-50 hover:bg-novo/10 transition-colors"
          aria-label="Zatvori poslovni dan i arhiviraj porudžbine"
        >
          {zatvaranjeUToku
            ? "Zatvaranje u toku..."
            : "Zatvori poslovni dan (Arhiviraj)"}
        </button>
      </div>
    </div>
  );
}
