import "../styles/globals.css";
import { klaseFontova } from "../lib/fontovi";
import Obavestenja from "../components/Obavestenja";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      {/* Poruke/potvrde za sve stranice (vidi lib/obavestenja.js). Sopstveni
          omotač sa fontovima jer je van root <div>-a svake stranice. */}
      <div className={klaseFontova}>
        <Obavestenja />
      </div>
    </>
  );
}
