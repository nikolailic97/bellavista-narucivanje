import { BASE_PATH } from "./constants";

export const KATEGORIJE = [
  { id: "burgeri", sr: "Burgeri", en: "Burgers" },
  { id: "pice", sr: "Pice", en: "Pizzas" },
  { id: "salate", sr: "Salate", en: "Salads" },
  { id: "deserti", sr: "Deserti", en: "Desserts" },
];

export const JELOVNIK = [
  {
    id: "1",
    naziv: { sr: "Gurmanska pljeskavica", en: "Gourmet Burger" },
    opis: {
      sr: "Kačkavalj, slaninica, tucana paprika, luk...",
      en: "Cheese, bacon, roasted peppers, onion...",
    },
    sastojci: {
      sr: "300g pljeskavica od junećeg mesa, pecivo sa susamom, kačkavalj, slaninica, tucana paprika, crni luk, zelena salata, domaći sos.",
      en: "300g beef patty, sesame bun, cheese, bacon, roasted peppers, red onion, lettuce, house sauce.",
    },
    tagovi: [],
    cena: 450,
    kategorija: "burgeri",
    vreme_pripreme: 15,
    slika_url: `${BASE_PATH}/images/pljeskavica.webp`,
  },
  {
    id: "2",
    naziv: { sr: "Margarita Pica", en: "Margherita Pizza" },
    opis: {
      sr: "Pelat, kačkavalj, masline, origano...",
      en: "Tomato sauce, cheese, olives, oregano...",
    },
    sastojci: {
      sr: "Domaće testo, pelat sos od paradajza, kačkavalj, masline, sveži bosiljak, origano, maslinovo ulje.",
      en: "House dough, tomato sauce, cheese, olives, fresh basil, oregano, olive oil.",
    },
    tagovi: ["vegetarijansko"],
    cena: 800,
    kategorija: "pice",
    vreme_pripreme: 25,
    slika_url: `${BASE_PATH}/images/margarita.webp`,
  },
  {
    id: "3",
    naziv: { sr: "Cezar salata", en: "Caesar Salad" },
    opis: {
      sr: "Piletina, krutoni, cezar dresing...",
      en: "Chicken, croutons, caesar dressing...",
    },
    sastojci: {
      sr: "Piletina na žaru, listovi rimske salate, krutoni, parmezan, cezar dresing.",
      en: "Grilled chicken, romaine lettuce, croutons, parmesan, caesar dressing.",
    },
    tagovi: [],
    cena: 650,
    kategorija: "salate",
    vreme_pripreme: 10,
    slika_url: `${BASE_PATH}/images/cezar-salata.webp`,
  },
  {
    id: "4",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    sastojci: {
      sr: "Tanka palačinka, čokoladni krem, mrvice plazma keksa, šlag, listić nane.",
      en: "Thin pancake, chocolate spread, crushed biscuits, whipped cream, mint leaf.",
    },
    tagovi: ["vegetarijansko"],
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "5",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "6",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "7",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "8",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "9",
    naziv: { sr: "Domaća palačinka", en: "Homemade Pancake" },
    opis: {
      sr: "Nutela, plazma, šlag...",
      en: "Nutella, biscuit crumbs, whipped cream...",
    },
    cena: 350,
    kategorija: "deserti",
    vreme_pripreme: 8,
    slika_url: `${BASE_PATH}/images/palacinka.webp`,
  },
  {
    id: "10",
    naziv: { sr: "Gurmanska pljeskavica", en: "Gourmet Burger" },
    opis: {
      sr: "Kačkavalj, slaninica, tucana paprika, luk...",
      en: "Cheese, bacon, roasted peppers, onion...",
    },
    cena: 450,
    kategorija: "burgeri",
    vreme_pripreme: 15,
    slika_url: `${BASE_PATH}/images/pljeskavica.webp`,
  },
  {
    id: "11",
    naziv: { sr: "Margarita Pica", en: "Margherita Pizza" },
    opis: {
      sr: "Pelat, kačkavalj, masline, origano...",
      en: "Tomato sauce, cheese, olives, oregano...",
    },
    cena: 800,
    kategorija: "pice",
    vreme_pripreme: 25,
    slika_url: `${BASE_PATH}/images/margarita.webp`,
  },
  {
    id: "12",
    naziv: { sr: "Cezar salata", en: "Caesar Salad" },
    opis: {
      sr: "Piletina, krutoni, cezar dresing...",
      en: "Chicken, croutons, caesar dressing...",
    },
    cena: 650,
    kategorija: "salate",
    vreme_pripreme: 10,
    slika_url: `${BASE_PATH}/images/cezar-salata.webp`,
  },
  {
    id: "13",
    naziv: { sr: "Gurmanska pljeskavica", en: "Gourmet Burger" },
    opis: {
      sr: "Kačkavalj, slaninica, tucana paprika, luk...",
      en: "Cheese, bacon, roasted peppers, onion...",
    },
    cena: 450,
    kategorija: "burgeri",
    vreme_pripreme: 15,
    slika_url: `${BASE_PATH}/images/pljeskavica.webp`,
  },
  {
    id: "14",
    naziv: { sr: "Margarita Pica", en: "Margherita Pizza" },
    opis: {
      sr: "Pelat, kačkavalj, masline, origano...",
      en: "Tomato sauce, cheese, olives, oregano...",
    },
    cena: 800,
    kategorija: "pice",
    vreme_pripreme: 25,
    slika_url: `${BASE_PATH}/images/margarita.webp`,
  },
  {
    id: "15",
    naziv: { sr: "Cezar salata", en: "Caesar Salad" },
    opis: {
      sr: "Piletina, krutoni, cezar dresing...",
      en: "Chicken, croutons, caesar dressing...",
    },
    cena: 650,
    kategorija: "salate",
    vreme_pripreme: 10,
    slika_url: `${BASE_PATH}/images/cezar-salata.webp`,
  },
  {
    id: "16",
    naziv: { sr: "Gurmanska pljeskavica", en: "Gourmet Burger" },
    opis: {
      sr: "Kačkavalj, slaninica, tucana paprika, luk...",
      en: "Cheese, bacon, roasted peppers, onion...",
    },
    cena: 450,
    kategorija: "burgeri",
    vreme_pripreme: 15,
    slika_url: `${BASE_PATH}/images/pljeskavica.webp`,
  },
  {
    id: "17",
    naziv: { sr: "Margarita Pica", en: "Margherita Pizza" },
    opis: {
      sr: "Pelat, kačkavalj, masline, origano...",
      en: "Tomato sauce, cheese, olives, oregano...",
    },
    cena: 800,
    kategorija: "pice",
    vreme_pripreme: 25,
    slika_url: `${BASE_PATH}/images/margarita.webp`,
  },
  {
    id: "18",
    naziv: { sr: "Cezar salata", en: "Caesar Salad" },
    opis: {
      sr: "Piletina, krutoni, cezar dresing...",
      en: "Chicken, croutons, caesar dressing...",
    },
    cena: 650,
    kategorija: "salate",
    vreme_pripreme: 10,
    slika_url: `${BASE_PATH}/images/cezar-salata.webp`,
  },
];

export const DODACI_PO_KATEGORIJI = {
  burgeri: [
    { id: "k1", naziv: { sr: "Kajmak", en: "Kaymak" }, cena: 80 },
    { id: "s1", naziv: { sr: "Slaninica", en: "Bacon" }, cena: 60 },
    {
      id: "d1",
      naziv: { sr: "Dupli kačkavalj", en: "Extra cheese" },
      cena: 100,
    },
  ],
  pice: [
    { id: "p1", naziv: { sr: "Ekstra sir", en: "Extra cheese" }, cena: 100 },
    { id: "p2", naziv: { sr: "Pečurke", en: "Mushrooms" }, cena: 80 },
    { id: "p3", naziv: { sr: "Šunka", en: "Ham" }, cena: 90 },
    {
      id: "p4",
      naziv: { sr: "Ljuta papričica", en: "Chili peppers" },
      cena: 50,
    },
  ],
  salate: [
    {
      id: "sl1",
      naziv: { sr: "Ekstra piletina", en: "Extra chicken" },
      cena: 120,
    },
    { id: "sl2", naziv: { sr: "Avokado", en: "Avocado" }, cena: 100 },
    { id: "sl3", naziv: { sr: "Feta sir", en: "Feta cheese" }, cena: 80 },
    { id: "sl4", naziv: { sr: "Susam", en: "Sesame seeds" }, cena: 40 },
  ],
  deserti: [
    { id: "de1", naziv: { sr: "Banana", en: "Banana" }, cena: 50 },
    { id: "de2", naziv: { sr: "Jagode", en: "Strawberries" }, cena: 70 },
    { id: "de3", naziv: { sr: "Lešnici", en: "Crushed hazelnuts" }, cena: 60 },
    {
      id: "de4",
      naziv: { sr: "Kugla sladoleda", en: "Scoop of ice cream" },
      cena: 90,
    },
  ],
};

// Tagovi na stavkama menija (npr. zeleni "VEGAN" plutajući preko slike).
// Dodaj "tagovi: ['vegan', 'sadrzi_orasaste']" (koliko god ključeva) na
// stavku u JELOVNIK-u.
export const TAGOVI_INFO = {
  // Ishrana - zelene nijanse
  vegan: { sr: "Vegan", en: "Vegan", boja: "bg-emerald-100 text-emerald-700" },
  vegetarijansko: {
    sr: "Vegetarijansko",
    en: "Vegetarian",
    boja: "bg-green-100 text-green-700",
  },
  bez_glutena: {
    sr: "Bez glutena",
    en: "Gluten-free",
    boja: "bg-sky-100 text-sky-700",
  },
  // Ukus - toplo/crveno
  ljuto: { sr: "Ljuto", en: "Spicy", boja: "bg-red-100 text-red-600" },
  // Alergeni - upozorenje, žuto/narandžasto
  sadrzi_orasaste: {
    sr: "Sadrži orašaste plodove",
    en: "Contains nuts",
    boja: "bg-orange-100 text-orange-700",
  },
  sadrzi_laktozu: {
    sr: "Sadrži laktozu",
    en: "Contains lactose",
    boja: "bg-yellow-100 text-yellow-700",
  },
  // Marketing - amber/pink
  novo: { sr: "Novo", en: "New", boja: "bg-amber-100 text-amber-700" },
  popularno: {
    sr: "Popularno",
    en: "Popular",
    boja: "bg-pink-100 text-pink-700",
  },
};

// ---- Mape za KUHINJU: uvek srpski naziv, bez obzira na jezik na kom je
// kupac naručio (kupac čuva lokalizovan naziv u samoj porudžbini radi svog
// prikaza, ali kuhinja gleda ove mape preko id_jela/id dodatka) ----
export const NAZIV_JELA_SR = Object.fromEntries(
  JELOVNIK.map((j) => [j.id, j.naziv.sr]),
);

export const NAZIV_DODATKA_SR = Object.fromEntries(
  Object.values(DODACI_PO_KATEGORIJI)
    .flat()
    .map((d) => [d.id, d.naziv.sr]),
);
