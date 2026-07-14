/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Statički export — nema Node servera na GitHub Pages, a ne treba nam:
  // sav Firebase pristup ide direktno iz browsera, nema API routes/SSR.
  output: "export",
  // /kuhinja -> /kuhinja/index.html umesto /kuhinja.html — radi pouzdano na
  // svakom statičkom hostu (GitHub Pages, Netlify...) bez oslanjanja na
  // auto-append-.html ponašanje servera.
  trailingSlash: true,
  // FAZA 1 (sad, testiranje preko username.github.io/repo-name/): postavi
  // NEXT_PUBLIC_BASE_PATH=/bellavista-narucivanje u GitHub Actions workflow-u.
  // FAZA 2 (kad se doda custom domen): ukloni tu env varijablu (prazan
  // basePath), jer domen servira sa root-a, ne iz podfoldera.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: {
    // next/image optimizacija (WebP/resize) radi preko servera koji GH Pages
    // nema. I dalje dobijamo lazy-load + sprečavanje CLS-a (width/height),
    // samo slike treba ručno optimizovati (WebP, razumna rezolucija) pre
    // stavljanja u /public/images/.
    unoptimized: true,
  },
};

module.exports = nextConfig;
