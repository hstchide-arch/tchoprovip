// Données de démonstration, chargées au premier lancement sur un appareil.
// Elles se remplacent depuis Réglages (ou avec « Réinitialiser la démonstration »).

export const DEMO_PINS = {
  gerant: '1234',
  serveur: '1111',
  cuisine: '2222',
  bar: '3333',
};

export function demoData() {
  const zones = [
    { id: 'z-salle', name: 'Salle', order: 1 },
    { id: 'z-terrasse', name: 'Terrasse', order: 2 },
    { id: 'z-lounge', name: 'Lounge', order: 3 },
  ];
  const t = (id, label, seats, shape, zoneId, order) => ({ id, label, seats, shape, zoneId, order, reserved: false });
  const tables = [
    t('t1', 'T1', 2, 'ronde', 'z-salle', 1),
    t('t2', 'T2', 2, 'ronde', 'z-salle', 2),
    t('t3', 'T3', 4, 'rect', 'z-salle', 3),
    t('t4', 'T4', 4, 'rect', 'z-salle', 4),
    t('t5', 'T5', 6, 'rect', 'z-salle', 5),
    t('t6', 'T6', 4, 'ronde', 'z-salle', 6),
    t('t7', 'T7', 4, 'ronde', 'z-terrasse', 7),
    t('t8', 'T8', 2, 'ronde', 'z-terrasse', 8),
    t('salon', 'Salon', 8, 'rect', 'z-lounge', 9),
  ];
  const categories = [
    { id: 'c-entrees', name: 'Entrées', order: 1 },
    { id: 'c-plats', name: 'Plats', order: 2 },
    { id: 'c-grillades', name: 'Grillades', order: 3 },
    { id: 'c-desserts', name: 'Desserts', order: 4 },
    { id: 'c-boissons', name: 'Boissons', order: 5 },
    { id: 'c-cocktails', name: 'Cocktails', order: 6 },
    { id: 'c-vins', name: 'Vins et champagnes', order: 7 },
  ];
  const i = (id, name, categoryId, price, station, allergens = [], signature = false) => ({
    id, name, categoryId, price, station, allergens, signature, available: true,
  });
  const items = [
    i('m1', 'Salade d’avocat et crevettes', 'c-entrees', 6500, 'cuisine', ['crustacés']),
    i('m2', 'Accras de morue', 'c-entrees', 5000, 'cuisine', ['poisson', 'gluten']),
    i('m3', 'Ndolé revisité aux crevettes', 'c-plats', 14000, 'cuisine', ['arachide', 'crustacés'], true),
    i('m4', 'Filet de bœuf, poivre de Penja', 'c-plats', 18000, 'cuisine', ['lait'], true),
    i('m5', 'Poulet DG, plantain doré', 'c-plats', 12000, 'cuisine'),
    i('m6', 'Bar en croûte de sel', 'c-plats', 16000, 'cuisine', ['poisson']),
    i('m7', 'Capitaine braisé, miondo', 'c-grillades', 15000, 'cuisine', ['poisson']),
    i('m8', 'Brochettes de bœuf soya', 'c-grillades', 9000, 'cuisine', ['arachide']),
    i('m9', 'Fondant au chocolat', 'c-desserts', 5500, 'cuisine', ['gluten', 'lait', 'œuf']),
    i('m10', 'Salade de fruits frais', 'c-desserts', 4000, 'cuisine'),
    i('m11', 'Jus de foléré maison', 'c-boissons', 2500, 'bar'),
    i('m12', 'Eau minérale 1 L', 'c-boissons', 2000, 'bar'),
    i('m13', 'Cocktail gingembre-ananas', 'c-cocktails', 6000, 'bar', [], true),
    i('m14', 'Verre de vin rouge', 'c-vins', 5000, 'bar', ['sulfites']),
    i('m15', 'Champagne brut (75 cl)', 'c-vins', 65000, 'bar', ['sulfites']),
  ];
  const staff = [
    { id: 's-gerant', name: 'Gérant (démo)', role: 'gerant', pin: DEMO_PINS.gerant, active: true },
    { id: 's-serveur', name: 'Serveur (démo)', role: 'serveur', pin: DEMO_PINS.serveur, active: true },
    { id: 's-cuisine', name: 'Cuisine (démo)', role: 'cuisine', pin: DEMO_PINS.cuisine, active: true },
    { id: 's-bar', name: 'Bar (démo)', role: 'bar', pin: DEMO_PINS.bar, active: true },
  ];
  const restaurant = [{ id: 'main', name: 'Restaurant démo', kitchenAlertMin: 20, demo: true }];
  return { restaurant, zones, tables, categories, items, staff, orders: [], lines: [] };
}
