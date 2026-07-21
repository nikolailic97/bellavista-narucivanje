import Head from "next/head";
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800">
      <Head>
        <title>Kuhinja — Interni panel</title>
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
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-black text-brand-dark">
                Kuhinjska tabla
              </h1>
              <button
                onClick={hendlajOdjavu}
                className="text-xs text-red-500 font-bold hover:text-red-600 transition-all"
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
          </div>
        )}
      </div>
    </div>
  );
}
