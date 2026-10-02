import {
  BUFFER_KASNJENJA_MIN,
  MINUTA_BEZ_VREMENA_PRE_ALARMA,
  RADNO_VREME,
} from "./constants";

// SVI datumi u aplikaciji su u LOKALNOM vremenu uređaja (restoran radi
// lokalno). Ne koristiti toISOString().slice(0, 10) - to je UTC datum, koji
// je u Srbiji između 00:00 i 01:00/02:00 još uvek "juče".
export function formatirajDatum(d) {
  const godina = d.getFullYear();
  const mesec = String(d.getMonth() + 1).padStart(2, "0");
  const dan = String(d.getDate()).padStart(2, "0");
  return `${godina}-${mesec}-${dan}`;
}

export function danasnjiDatum() {
  return formatirajDatum(new Date());
}

// Lokalna ponoć zadatog dana
export function pocetakDana(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Datum porudžbine za izveštaj. Računa se iz SERVERSKOG vremena kreiranja
// (pravila baze ga forsiraju), a ne iz polja "datum" koje šalje telefon
// kupca - ako kupcu sat nije dobro podešen, "datum" je pogrešan.
export function datumPorudzbine(porudzbina) {
  const ms = vremeUMilisekundama(porudzbina.vreme_kreiranja);
  if (ms) return formatirajDatum(new Date(ms));
  return porudzbina.datum || danasnjiDatum();
}

export function noviIdStavke() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---- Radno vreme (vidi RADNO_VREME u lib/constants.js) ----
function uMinute(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function jeOtvoreno(sada = new Date()) {
  const minuta = sada.getHours() * 60 + sada.getMinutes();
  const danas = RADNO_VREME[sada.getDay()];
  if (danas && minuta >= uMinute(danas[0]) && minuta < uMinute(danas[1])) {
    return true;
  }
  // Jučerašnja smena koja traje posle ponoći (npr. "25:30")
  const juce = RADNO_VREME[(sada.getDay() + 6) % 7];
  return Boolean(juce && minuta + 24 * 60 < uMinute(juce[1]));
}

function prikazSata(hhmm) {
  const ukupno = uMinute(hhmm) % (24 * 60);
  const h = String(Math.floor(ukupno / 60)).padStart(2, "0");
  const m = String(ukupno % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Opis za podnožje, nezavisan od trenutnog dana (stranica se pravi u
// build-u, pa ne sme da zavisi od toga koji je dan kad se gleda).
// "Svaki dan 10:00–23:00", ili po danima ako se razlikuju.
const NAZIVI_DANA = {
  sr: ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
export function opisRadnogVremena(jezik = "sr") {
  const opisDana = (d) =>
    RADNO_VREME[d]
      ? `${prikazSata(RADNO_VREME[d][0])}–${prikazSata(RADNO_VREME[d][1])}`
      : jezik === "sr"
        ? "zatvoreno"
        : "closed";
  const redosled = [1, 2, 3, 4, 5, 6, 0]; // od ponedeljka
  const opisi = redosled.map(opisDana);
  if (opisi.every((o) => o === opisi[0])) {
    return `${jezik === "sr" ? "Svaki dan" : "Every day"} ${opisi[0]}`;
  }
  return redosled
    .map((d, i) => `${NAZIVI_DANA[jezik][d]} ${opisi[i]}`)
    .join(" · ");
}

// "10:00–23:00" za današnji dan, ili null ako je danas zatvoreno
export function danasnjeRadnoVreme(sada = new Date()) {
  const danas = RADNO_VREME[sada.getDay()];
  if (!danas) return null;
  return `${prikazSata(danas[0])}–${prikazSata(danas[1])}`;
}

export function generisiRandomBroj() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function vremeUMilisekundama(vreme) {
  if (!vreme) return null;
  if (typeof vreme.toMillis === "function") return vreme.toMillis();
  if (vreme.seconds) return vreme.seconds * 1000;
  return null;
}

export function jeliKasni(porudzbina, sadaMs) {
  const kreiranoMs = vremeUMilisekundama(porudzbina.vreme_kreiranja);
  if (!kreiranoMs || !porudzbina.trajanje_procena_min) return false;
  const pragMs =
    kreiranoMs +
    (porudzbina.trajanje_procena_min + BUFFER_KASNJENJA_MIN) * 60000;
  return sadaMs > pragMs;
}

// Porudžbina kojoj osoblje NIJE unelo procenjeno vreme, a stoji duže od
// praga. To nije isto što i "kasni" - ovde ne znamo koliko je trebalo da
// traje, nego je sam izostanak unosa signal da je niko nije pogledao.
export function jeZanemarena(porudzbina, sadaMs) {
  if (porudzbina.trajanje_procena_min) return false;
  const kreiranoMs = vremeUMilisekundama(porudzbina.vreme_kreiranja);
  if (!kreiranoMs) return false;
  return sadaMs > kreiranoMs + MINUTA_BEZ_VREMENA_PRE_ALARMA * 60000;
}

// Koliko minuta porudžbina kasni u odnosu na uneto procenjeno vreme.
// Vraća 0 kad ne kasni ili kad vreme nije uneto.
export function minutaKasnjenja(porudzbina, sadaMs) {
  const kreiranoMs = vremeUMilisekundama(porudzbina.vreme_kreiranja);
  if (!kreiranoMs || !porudzbina.trajanje_procena_min) return 0;
  const pragMs =
    kreiranoMs +
    (porudzbina.trajanje_procena_min + BUFFER_KASNJENJA_MIN) * 60000;
  return Math.max(0, Math.floor((sadaMs - pragMs) / 60000));
}
