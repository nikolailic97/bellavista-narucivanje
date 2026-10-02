import { useEffect, useRef, useState } from "react";
import { pretplatiSe, ukloniPoruku } from "../lib/obavestenja";

const STIL_PORUKE = {
  info: { ivica: "border-ugalj-vis", tacka: "bg-zlato" },
  uspeh: { ivica: "border-zelena/40", tacka: "bg-zelena" },
  greska: { ivica: "border-kasni/50", tacka: "bg-kasni" },
};

export default function Obavestenja() {
  const [stanje, setStanje] = useState({ poruke: [], potvrda: null });
  const dugmePotvrdeRef = useRef(null);

  useEffect(() => pretplatiSe(setStanje), []);

  const { poruke, potvrda } = stanje;

  // Esc zatvara potvrdu (kao "Otkaži"), fokus ide na dugme za potvrdu
  useEffect(() => {
    if (!potvrda) return;
    dugmePotvrdeRef.current?.focus();
    const naTaster = (e) => {
      if (e.key === "Escape") potvrda.odgovor(false);
    };
    document.addEventListener("keydown", naTaster);
    return () => document.removeEventListener("keydown", naTaster);
  }, [potvrda]);

  return (
    <>
      {/* Poruke - gore na sredini, iznad sticky header-a i modala */}
      <div
        className="fixed top-3 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
        aria-live="polite"
      >
        {poruke.map((p) => {
          const stil = STIL_PORUKE[p.tip] || STIL_PORUKE.info;
          return (
            <div
              key={p.id}
              role={p.tip === "greska" ? "alert" : "status"}
              className={`pointer-events-auto w-full max-w-[420px] flex items-start gap-3 bg-ugalj/95 backdrop-blur-md border ${stil.ivica} rounded-2xl px-4 py-3 shadow-2xl shadow-black/50 font-body text-krem animate-[iskoci_.18s_ease-out]`}
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full flex-none mt-[7px] ${stil.tacka}`}
              />
              <div className="flex-1 min-w-0">
                {p.naslov && (
                  <p className="text-sm font-bold mb-0.5">{p.naslov}</p>
                )}
                <p className="text-[13px] leading-snug text-krem/90">
                  {p.tekst}
                </p>
              </div>
              <button
                onClick={() => ukloniPoruku(p.id)}
                aria-label="Zatvori"
                className="text-krem-tih hover:text-krem text-sm leading-none mt-1"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Potvrda - modal u stilu ostatka sajta */}
      {potvrda && (
        <div
          className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-4 font-body"
          onClick={(e) => {
            if (e.target === e.currentTarget) potvrda.odgovor(false);
          }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="potvrda-naslov"
        >
          <div className="w-full max-w-[380px] bg-ugalj rounded-[20px] border border-ugalj-vis p-6 text-krem animate-[iskoci_.18s_ease-out]">
            <h3
              id="potvrda-naslov"
              className="font-display text-[19px] leading-tight mb-2"
            >
              {potvrda.naslov}
            </h3>
            {potvrda.tekst && (
              <p className="text-[13px] leading-relaxed text-krem-tih mb-5">
                {potvrda.tekst}
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => potvrda.odgovor(false)}
                className="flex-1 border border-ugalj-vis text-krem font-bold text-sm py-3 rounded-xl hover:border-krem-tih transition-colors"
              >
                {potvrda.otkaziTekst}
              </button>
              <button
                ref={dugmePotvrdeRef}
                onClick={() => potvrda.odgovor(true)}
                className={`flex-1 font-bold text-sm py-3 rounded-xl transition-all ${
                  potvrda.opasno
                    ? "bg-kasni text-white hover:brightness-110"
                    : "bg-zlato text-noc hover:bg-zlato-svetlo"
                }`}
              >
                {potvrda.potvrdiTekst}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
