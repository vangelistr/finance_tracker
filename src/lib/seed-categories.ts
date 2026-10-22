// Default categories seeded per user (editable). Names in Greek and English; the user's locale picks one at seed
// time. `essential` feeds the Smart Plan's essentials. Colours index the 8-colour chart palette.

export interface SeedCategory {
  key: string;
  el: string;
  en: string;
  icon: string;
  color: number;
  essential: boolean;
  children?: Array<{ key: string; el: string; en: string; essential?: boolean }>;
}

export const EXPENSE_SEEDS: SeedCategory[] = [
  {
    key: 'home', el: 'Σπίτι', en: 'Home', icon: 'house', color: 1, essential: true,
    children: [
      { key: 'rent', el: 'Ενοίκιο ή δόση', en: 'Rent or mortgage' },
      { key: 'electricity', el: 'Ρεύμα', en: 'Electricity' },
      { key: 'water', el: 'Νερό', en: 'Water' },
      { key: 'internet', el: 'Ίντερνετ και τηλέφωνο', en: 'Internet and phone' },
      { key: 'common', el: 'Κοινόχρηστα', en: 'Building fees' },
    ],
  },
  { key: 'groceries', el: 'Σούπερ μάρκετ', en: 'Groceries', icon: 'shopping-basket', color: 3, essential: true },
  {
    key: 'transport', el: 'Μετακινήσεις', en: 'Transport', icon: 'bus', color: 6, essential: true,
    children: [
      { key: 'fuel', el: 'Καύσιμα', en: 'Fuel' },
      { key: 'public', el: 'Συγκοινωνίες', en: 'Public transport' },
      { key: 'taxi', el: 'Ταξί', en: 'Taxi', essential: false },
      { key: 'car', el: 'Αυτοκίνητο', en: 'Car upkeep' },
    ],
  },
  {
    key: 'eating-out', el: 'Φαγητό έξω', en: 'Eating out', icon: 'utensils', color: 2, essential: false,
    children: [
      { key: 'coffee', el: 'Καφές', en: 'Coffee' },
      { key: 'restaurants', el: 'Εστιατόρια', en: 'Restaurants' },
      { key: 'delivery', el: 'Delivery', en: 'Delivery' },
    ],
  },
  {
    key: 'health', el: 'Υγεία', en: 'Health', icon: 'heart-pulse', color: 7, essential: true,
    children: [
      { key: 'pharmacy', el: 'Φαρμακείο', en: 'Pharmacy' },
      { key: 'doctors', el: 'Γιατροί', en: 'Doctors' },
    ],
  },
  { key: 'clothing', el: 'Ρούχα και παπούτσια', en: 'Clothes and shoes', icon: 'shirt', color: 4, essential: false },
  { key: 'entertainment', el: 'Διασκέδαση', en: 'Entertainment', icon: 'ticket', color: 4, essential: false },
  { key: 'subscriptions', el: 'Συνδρομές', en: 'Subscriptions', icon: 'repeat', color: 6, essential: false },
  { key: 'education', el: 'Εκπαίδευση', en: 'Education', icon: 'graduation-cap', color: 5, essential: false },
  { key: 'gifts', el: 'Δώρα', en: 'Gifts', icon: 'gift', color: 2, essential: false },
  { key: 'travel', el: 'Ταξίδια', en: 'Travel', icon: 'plane', color: 3, essential: false },
  { key: 'personal-care', el: 'Προσωπική φροντίδα', en: 'Personal care', icon: 'sparkles', color: 5, essential: false },
  { key: 'pets', el: 'Κατοικίδια', en: 'Pets', icon: 'paw-print', color: 3, essential: false },
  { key: 'taxes', el: 'Φόροι και τέλη', en: 'Taxes and fees', icon: 'landmark', color: 8, essential: true },
  { key: 'insurance', el: 'Ασφάλειες', en: 'Insurance', icon: 'shield', color: 8, essential: true },
  { key: 'other-expense', el: 'Λοιπά', en: 'Other', icon: 'circle', color: 8, essential: false },
];

export const INCOME_SEEDS: SeedCategory[] = [
  { key: 'salary', el: 'Μισθός', en: 'Salary', icon: 'briefcase', color: 1, essential: false },
  { key: 'ergosimo', el: 'Εργόσημο', en: 'Ergosimo (per-job pay)', icon: 'hand-coins', color: 3, essential: false },
  { key: 'freelance', el: 'Ελεύθερο επάγγελμα', en: 'Freelance', icon: 'receipt', color: 5, essential: false },
  { key: 'interest', el: 'Τόκοι και μερίσματα', en: 'Interest and dividends', icon: 'percent', color: 6, essential: false },
  { key: 'other-income', el: 'Λοιπά έσοδα', en: 'Other income', icon: 'circle', color: 8, essential: false },
];
