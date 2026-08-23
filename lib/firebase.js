import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// ---- App Check (reCAPTCHA v3) - štiti CEO Firestore (i gostinske i interne
// pozive) od skripti/botova koji bi mimo naše aplikacije direktno gađali
// Firebase API (npr. spamovanje "status_porudzbine" čitanja na "Prati").
// Radi i za goste bez logina, zato je ovde na nivou modula, ne u
// useInternoOsoblje.js. NAPOMENA (obavezno pre uključivanja "Enforce" u
// konzoli): treba env promenljiva NEXT_PUBLIC_RECAPTCHA_SITE_KEY (registruješ
// sajt za reCAPTCHA v3, pa dodaš i tajni ključ u Firebase konzoli > App Check).
// Dok se ne doda, ovaj blok se samo preskače (ne ruši ništa). ----
if (typeof window !== "undefined") {
  if (process.env.NODE_ENV !== "production") {
    // Debug token za lokalni razvoj (next dev) - bez ovoga App Check odbija
    // sve pozive sa localhost-a čim se "Enforce" uključi u konzoli. Token se
    // ispisuje u browser konzoli pri prvom pokretanju - kopiraš ga u
    // Firebase Console > App Check > Debug Tokens (jednom, traje trajno).
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
      ),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

let _authPromise = null;
export function getFirebaseAuth() {
  if (!_authPromise) {
    _authPromise = import("firebase/auth").then(
      ({ getAuth, setPersistence, browserLocalPersistence }) => {
        const auth = getAuth(firebaseApp);
        setPersistence(auth, browserLocalPersistence).catch((greska) => {
          console.error("Greška pri podešavanju trajanja sesije:", greska);
        });
        return auth;
      },
    );
  }
  return _authPromise;
}
