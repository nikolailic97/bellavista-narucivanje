// Fiksni identifikatori internih naloga (NISU tajna - lozinka/PIN jeste)
export const KUHINJA_EMAIL = "kuhinja@internal.gradskizalogaj.rs";
export const ADMIN_EMAIL = "admin@internal.gradskizalogaj.rs";

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

// Buffer (minuti) pre nego što se porudžbina označi kao "KASNI" u kuhinji
export const BUFFER_KASNJENJA_MIN = 10;
