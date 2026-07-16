import { BUFFER_KASNJENJA_MIN } from "./constants";

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
