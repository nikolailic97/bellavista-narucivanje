import Head from "next/head";
import { klaseFontova } from "../lib/fontovi";
import { useInternoOsoblje } from "../hooks/useInternoOsoblje";
import KuhinjskaTabla from "../components/KuhinjskaTabla";
import PinPrijava from "../components/PinPrijava";

export default function KuhinjaStranica() {
  const {
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
  } = useInternoOsoblje(["kuhinja", "admin"]);

  // Kad kuhinja zatvori radni dan, to znači da je smena gotova - automatski
  // izlogujemo (samo ako je zatvaranje stvarno uspelo, ne i na otkazivanje
  // potvrde ili "nema šta da se arhivira").
  const zatvoriDanIIzloguj = async () => {
    const uspesno = await zatvoriPoslovniDan();
    if (uspesno) hendlajOdjavu();
  };

  // Sat u zaglavlju - koristi sadaTick koji hook ionako već otkucava svake
  // sekunde radi računanja kašnjenja, pa nema dodatnog tajmera.
  const sada = new Date(sadaTick || Date.now());
  const datumTekst = sada.toLocaleDateString("sr-RS", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const satTekst = sada.toLocaleTimeString("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`${klaseFontova} min-h-screen bg-noc text-krem font-body antialiased`}
    >
      <Head>
        <title>Kuhinja — Interni panel</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#14191C" />
      </Head>

      <div className="max-w-[1400px] mx-auto p-4 sm:p-5">
        {ucitavanjeUloge ? (
          <p className="text-center text-krem-tih text-sm py-12">
            Učitavanje...
          </p>
        ) : !imaPristup ? (
          <PinPrijava
            naslov="Kuhinjska tabla"
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
              <div>
                <h1 className="font-display text-2xl text-krem">Kuhinja</h1>
                <p className="font-num text-[13px] font-bold text-krem-tih mt-0.5 first-letter:uppercase">
                  {datumTekst} · {satTekst}
                </p>
              </div>
              <button
                onClick={hendlajOdjavu}
                className="bg-ugalj border border-ugalj-vis text-krem font-bold text-xs px-4 py-2.5 rounded-[10px] hover:border-krem-tih transition-colors"
              >
                Odjavi se
              </button>
            </div>

            <KuhinjskaTabla
              porudzbine={porudzbine}
              sadaTick={sadaTick}
              naNapredujStatus={napredujStatus}
              naAzurirajVreme={azurirajVreme}
              naZatvoriDan={zatvoriDanIIzloguj}
              zatvaranjeUToku={zatvaranjeUToku}
              mozeMenjatiVreme
            />
          </>
        )}
      </div>
    </div>
  );
}
