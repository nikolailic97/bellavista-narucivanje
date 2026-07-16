// Fiksni identifikatori internih naloga (NISU tajna - lozinka/PIN jeste)
export const KUHINJA_EMAIL = "kuhinja@bellavista.rs";
export const ADMIN_EMAIL = "admin@bellavista.rs";

export const REDOSLED_STATUSA = [
  "novo",
  "u_pripremi",
  "spremno_za_dostavu",
  "zavrseno",
];

// Kuhinja/admin panel ostaje UVEK na srpskom, ne prati jezik kupca
export const NAZIV_STATUSA = {
  novo: "Novo",
  u_pripremi: "U pripremi",
  spremno_za_dostavu: "Spremno za dostavu",
  zavrseno: "Završeno",
};
export const NAZIV_SLEDECE_AKCIJE = {
  novo: "Započni pripremu",
  u_pripremi: "Spremno za dostavu",
  spremno_za_dostavu: "Označi završeno",
};

// Dodatni "grace" period (minuti) NAKON procenjenog vremena pripreme, pre
// nego što se porudžbina označi kao "KASNI" u kuhinji. 0 = kasni tačno kad
// prođe puno procenjeno vreme (npr. burger 15min -> kasni tek posle 15min).
export const BUFFER_KASNJENJA_MIN = 0;
