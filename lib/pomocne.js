import {
  BUFFER_KASNJENJA_MIN,
  MINUTA_BEZ_VREMENA_PRE_ALARMA,
} from "./constants";

export function danasnjiDatum() {
  const d = new Date();
  const godina = d.getFullYear();
  const mesec = String(d.getMonth() + 1).padStart(2, "0");
  const dan = String(d.getDate()).padStart(2, "0");
  return `${godina}-${mesec}-${dan}`;
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
