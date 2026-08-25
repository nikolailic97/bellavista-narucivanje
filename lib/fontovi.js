import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

// ---- Fontovi se skidaju u BUILD-u i serviraju sa našeg domena, pa nema
// poziva ka fonts.googleapis.com u runtime-u (bez toga bi font bio
// render-blocking resurs i obarao Lighthouse).
// "latin-ext" subset je OBAVEZAN - bez njega nema č, ć, š, ž, đ.
//
// Definisano na jednom mestu jer next/font mora da se poziva na nivou
// modula (ne unutar komponente), a isti fontovi trebaju i kupčevoj strani
// i internom panelu. next/font sam deduplikuje, pa nema dvostrukog
// preuzimanja. ----
export const fraunces = Fraunces({
  subsets: ["latin-ext"],
  weight: ["600"],
  display: "swap",
  variable: "--font-fraunces",
});

export const inter = Inter({
  subsets: ["latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const jetbrains = JetBrains_Mono({
  subsets: ["latin-ext"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--font-jetbrains",
});

// Spremna kombinacija za root <div> svake stranice.
export const klaseFontova = `${fraunces.variable} ${inter.variable} ${jetbrains.variable}`;
