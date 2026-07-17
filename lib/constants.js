// Fiksni identifikatori internih naloga (NISU tajna - lozinka/PIN jeste)
export const KUHINJA_EMAIL = "kuhinja@bellavista.rs";
export const ADMIN_EMAIL = "admin@bellavista.rs";

// next/image ne dodaje automatski basePath na ručno unete src putanje kad je
// output:"export" + images.unoptimized:true (samo _next/next/link to rade
// automatski) - zato ovo ručno dodajemo svuda gde referenciramo sliku iz
// /public foldera. Kad se doda custom domen, NEXT_PUBLIC_BASE_PATH se briše
// iz workflow-a i ovo automatski postaje prazan string.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

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
