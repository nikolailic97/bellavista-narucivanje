import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

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
export const auth = getAuth(firebaseApp);

// Sesija traje što duže (preživljava zatvaranje browsera), dok se korisnik
// ručno ne izloguje ili token ne bude opozvan - nema automatskog isteka.
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch((greska) => {
    console.error("Greška pri podešavanju trajanja sesije:", greska);
  });
}
