/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Statički export — nema Node servera na GitHub Pages, a ne treba nam:
  // sav Firebase pristup ide direktno iz browsera, nema API routes/SSR.
  output: "export",
  images: {
    // next/image optimizacija (WebP/resize) radi preko servera koji GH Pages
    // nema. I dalje dobijamo lazy-load + sprečavanje CLS-a (width/height),
    // samo slike treba ručno optimizovati (WebP, razumna rezolucija) pre
    // stavljanja u /public/images/.
    unoptimized: true,
  },
};

module.exports = nextConfig;
