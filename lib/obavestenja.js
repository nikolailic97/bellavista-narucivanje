// ---- Poruke i potvrde u dizajnu sajta, umesto browserovih alert() i
// confirm(). Mali globalni "store" bez React context-a, da bi mogao da se
// pozove i iz običnih funkcija (npr. iz hooks/useInternoOsoblje.js), ne samo
// iz komponenti. Prikazuje ih components/Obavestenja.js, montiran u _app.js. ----

let stanje = { poruke: [], potvrda: null };
const slusaoci = new Set();
let sledeciId = 1;

function postavi(novo) {
  stanje = { ...stanje, ...novo };
  slusaoci.forEach((fn) => fn(stanje));
}

export function pretplatiSe(fn) {
  slusaoci.add(fn);
  fn(stanje);
  return () => slusaoci.delete(fn);
}

export function ukloniPoruku(id) {
  postavi({ poruke: stanje.poruke.filter((p) => p.id !== id) });
}

// tip: "info" | "uspeh" | "greska"
export function prikaziPoruku(tekst, { tip = "info", naslov, trajanjeMs } = {}) {
  const id = sledeciId++;
  const trajanje = trajanjeMs ?? (tip === "greska" ? 6000 : 4000);
  // Najviše 3 odjednom - starije se sklanjaju
  postavi({ poruke: [...stanje.poruke.slice(-2), { id, tekst, tip, naslov }] });
  if (trajanje > 0) setTimeout(() => ukloniPoruku(id), trajanje);
  return id;
}

// Vraća Promise<boolean> - true ako je korisnik potvrdio
export function potvrdi({
  naslov,
  tekst,
  potvrdiTekst = "Potvrdi",
  otkaziTekst = "Otkaži",
  opasno = false,
}) {
  return new Promise((resolve) => {
    // Ako je neka potvrda već otvorena, stara se tretira kao otkazana
    if (stanje.potvrda) stanje.potvrda.odgovor(false);
    postavi({
      potvrda: {
        naslov,
        tekst,
        potvrdiTekst,
        otkaziTekst,
        opasno,
        odgovor: (rezultat) => {
          postavi({ potvrda: null });
          resolve(rezultat);
        },
      },
    });
  });
}
