import Head from "next/head";
import { useInternoOsoblje } from "../lib/hooks/userinternoosoblje";
import KuhinjskaTabla from "../lib/components/KuhinjskaTabla";
import PinPrijava from "../lib/components/PinPrijava";

export default function KuhinjaStranica() {
  const {
    ucitavanjeUloge,
    imaPristup,
    pin,
    setPin,
    prijavaUToku,
    greskaPristupa,
    hendlajLogin,
    hendlajOdjavu,
    porudzbine,
    sadaTick,
    napredujStatus,
    zatvoriPoslovniDan,
    zatvaranjeUToku,
  } = useInternoOsoblje(["kuhinja", "admin"]);

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
            naslov="Kitchen Display"
            pin={pin}
            setPin={setPin}
            prijavaUToku={prijavaUToku}
            greska={greskaPristupa}
            onSubmit={hendlajLogin}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-lg font-bold text-slate-900">
                Kitchen Display
              </h1>
              <button
                onClick={hendlajOdjavu}
                className="text-xs text-red-500 font-bold"
              >
                Logout
              </button>
            </div>
            <KuhinjskaTabla
              porudzbine={porudzbine}
              sadaTick={sadaTick}
              naNapredujStatus={napredujStatus}
              naZatvoriDan={zatvoriPoslovniDan}
              zatvaranjeUToku={zatvaranjeUToku}
            />
          </div>
        )}
      </div>
    </div>
  );
}
