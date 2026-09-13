// Fiksni identifikatori internih naloga (NISU tajna - lozinka/PIN jeste)
export const KUHINJA_EMAIL = "kuhinja@bellavista.rs";
export const ADMIN_EMAIL = "admin@bellavista.rs";

// next/image ne dodaje automatski basePath na ručno unete src putanje kad je
// output:"export" + images.unoptimized:true (samo _next/next/link to rade
// automatski) - zato ovo ručno dodajemo svuda gde referenciramo sliku iz
// /public foldera. Kad se doda custom domen, NEXT_PUBLIC_BASE_PATH se briše
// iz workflow-a i ovo automatski postaje prazan string.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Tok ima TRI koraka. Ranije je postojao i međukorak "spremno_za_dostavu"
// (hrana gotova, čeka kurira), ali se u praksi pokazalo da kuhinja klikne
// "spremno" pa odmah zatim "završeno" kad kurir dođe - dva klika za isti
// trenutak. Sad kuhinja klikne "Dostava u toku" kad kurir preuzme, i to je
// finalni korak.
// "spremno_za_dostavu" NAMERNO ostaje u mapama ispod: porudžbine koje su
// zatečene u tom statusu iz ranijih verzija moraju i dalje da se prikažu
// ispravno dok se dan ne zatvori.
export const REDOSLED_STATUSA = ["novo", "u_pripremi", "zavrseno"];

// Kuhinja/admin panel ostaje UVEK na srpskom, ne prati jezik kupca
export const NAZIV_STATUSA = {
  novo: "Primljeno",
  u_pripremi: "U pripremi",
  spremno_za_dostavu: "Spremno za dostavu", // zastarelo, vidi komentar gore
  zavrseno: "Dostava u toku",
};
export const NAZIV_SLEDECE_AKCIJE = {
  novo: "Započni pripremu",
  u_pripremi: "Dostava u toku",
  spremno_za_dostavu: "Dostava u toku", // zastarelo, vidi komentar gore
};

// Posle koliko minuta se porudžbina BEZ unetog vremena pripreme računa kao
// zanemarena - koristi se u admin panelu da se vidi ako osoblje nije
// ispratilo tablet. Porudžbina sa unetim vremenom se prati preko
// jeliKasni() u lib/pomocne.js.
export const MINUTA_BEZ_VREMENA_PRE_ALARMA = 15;

// Dodatni "grace" period (minuti) NAKON procenjenog vremena pripreme, pre
// nego što se porudžbina označi kao "KASNI" u kuhinji. 0 = kasni tačno kad
// prođe puno procenjeno vreme (npr. burger 15min -> kasni tek posle 15min).
export const BUFFER_KASNJENJA_MIN = 0;
