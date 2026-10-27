// Règles métier pures de TchoProVip : aucune dépendance au navigateur,
// testées avec `npm test` (tests/domain.test.js).

export const ROLES = {
  gerant: 'Gérant',
  serveur: 'Serveur',
  cuisine: 'Cuisine',
  bar: 'Bar',
};

export const STATIONS = { cuisine: 'Cuisine', bar: 'Bar' };

export const LINE_STATUS = {
  en_preparation: 'En préparation',
  pret: 'Prêt',
  servi: 'Servi',
  annule: 'Annulé',
};

export const TABLE_STATUS = {
  libre: 'Libre',
  occupee: 'Occupée',
  addition: 'Addition demandée',
  reservee: 'Réservée',
};

export const CANCEL_REASONS = [
  'Erreur de saisie',
  'Client a changé d’avis',
  'Plat indisponible',
  'Temps d’attente trop long',
  'Autre',
];

// ---------- Identifiants et dates ----------

export function uuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Durée écoulée lisible : « 8 min », « 1 h 05 ». */
export function elapsedLabel(fromMs, nowMs = Date.now()) {
  if (!fromMs) return '';
  const m = Math.max(0, Math.floor((nowMs - fromMs) / 60000));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export function minutesSince(fromMs, nowMs = Date.now()) {
  return fromMs ? Math.max(0, Math.floor((nowMs - fromMs) / 60000)) : 0;
}

// ---------- Argent (entiers en FCFA, jamais de décimales) ----------

/** Convertit une saisie (« 12 500 », « 12500 FCFA ») en entier positif, ou null. */
export function parseFCFA(input) {
  if (typeof input === 'number') return Number.isInteger(input) && input >= 0 ? input : null;
  const digits = String(input ?? '').replace(/[\s  .]/g, '').replace(/fcfa|xaf/gi, '');
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** 12500 → « 12 500 FCFA » (espaces insécables fines, comme en français). */
export function formatFCFA(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${v < 0 ? '−' : ''}${s} FCFA`;
}

// ---------- Texte ----------

export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function splitList(s) {
  return String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function initials(name) {
  return (
    String(name ?? '')
      .replace(/^(M\.|Mme|Mlle|Dr)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  );
}

// ---------- Commandes ----------

export function activeLines(lines) {
  return lines.filter((l) => l.status !== 'annule');
}

export function linesOfOrder(allLines, orderId) {
  return allLines
    .filter((l) => l.orderId === orderId)
    .sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0) || String(a.id).localeCompare(String(b.id)));
}

/** Total d'une commande en FCFA, lignes annulées exclues. */
export function orderTotal(lines) {
  return activeLines(lines).reduce((sum, l) => sum + (l.unitPrice || 0) * (l.qty || 0), 0);
}

export function isOpenOrder(order) {
  return !!order && (order.status === 'ouverte' || order.status === 'addition');
}

export function openOrderForTable(orders, tableId) {
  return orders.find((o) => o.tableId === tableId && isOpenOrder(o)) || null;
}

export function tableStatus(table, openOrder) {
  if (openOrder) return openOrder.status === 'addition' ? 'addition' : 'occupee';
  return table.reserved ? 'reservee' : 'libre';
}

export function nextLineStatus(status) {
  if (status === 'en_preparation') return 'pret';
  if (status === 'pret') return 'servi';
  return null;
}

/**
 * Allergènes d'un article qui correspondent aux allergies déclarées pour la table.
 * Insensible aux accents et à la casse ; « arachides » correspond à « arachide ».
 */
export function allergenConflicts(itemAllergens = [], tableAllergies = []) {
  const declared = tableAllergies.map(normalize).filter(Boolean);
  if (!declared.length) return [];
  return itemAllergens.filter((a) => {
    const na = normalize(a);
    return na && declared.some((d) => na.includes(d) || d.includes(na));
  });
}

/**
 * Transforme un brouillon de commande en lignes à enregistrer.
 * Le nom et le prix sont copiés au moment de l'envoi : un changement de carte
 * ultérieur ne modifie jamais une commande passée.
 */
export function buildLinesFromDraft(draft, itemsById, ctx) {
  const lines = [];
  for (const d of draft) {
    const item = itemsById[d.itemId];
    if (!item || !(d.qty > 0)) continue;
    lines.push({
      id: ctx.newId(),
      orderId: ctx.orderId,
      itemId: item.id,
      name: item.name,
      unitPrice: item.price,
      qty: d.qty,
      note: (d.note || '').trim(),
      station: item.station === 'bar' ? 'bar' : 'cuisine',
      status: 'en_preparation',
      sentAt: ctx.now,
      sentBy: ctx.staffId,
    });
  }
  return lines;
}

/**
 * Bons pour l'écran cuisine/bar : une carte par commande, les plus anciens en premier,
 * seulement les lignes à préparer ou prêtes à servir pour le poste demandé.
 */
export function kitchenTickets({ orders, lines, tables }, station = 'all') {
  const tablesById = Object.fromEntries(tables.map((t) => [t.id, t]));
  const tickets = [];
  for (const o of orders) {
    if (!isOpenOrder(o)) continue;
    const ls = lines.filter(
      (l) =>
        l.orderId === o.id &&
        (l.status === 'en_preparation' || l.status === 'pret') &&
        (station === 'all' || l.station === station)
    );
    if (!ls.length) continue;
    ls.sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0));
    const oldestPending = ls.filter((l) => l.status === 'en_preparation').reduce((m, l) => Math.min(m, l.sentAt || Infinity), Infinity);
    tickets.push({
      order: o,
      table: tablesById[o.tableId] || null,
      lines: ls,
      since: Number.isFinite(oldestPending) ? oldestPending : ls[0].sentAt,
      allReady: ls.every((l) => l.status === 'pret'),
    });
  }
  return tickets.sort((a, b) => a.since - b.since);
}

// ---------- Droits par rôle ----------

const PERMISSIONS = {
  gerant: ['salle', 'commande', 'cuisine', 'reglages', 'annuler_servi', 'annuler', 'tables', 'fermer_table'],
  serveur: ['salle', 'commande', 'cuisine', 'annuler', 'tables', 'fermer_table'],
  cuisine: ['cuisine'],
  bar: ['cuisine'],
};

export function can(role, action) {
  return (PERMISSIONS[role] || []).includes(action);
}

export function homeViewFor(role) {
  return role === 'cuisine' || role === 'bar' ? 'cuisine' : 'salle';
}

/** Poste que voit un membre du personnel sur l'écran cuisine. */
export function stationFor(role) {
  if (role === 'cuisine') return 'cuisine';
  if (role === 'bar') return 'bar';
  return 'all';
}

export function canCancelLine(role, line) {
  if (!line || line.status === 'annule') return false;
  if (line.status === 'servi') return can(role, 'annuler_servi');
  return can(role, 'annuler');
}

// ---------- Validation des réglages ----------

export function validateItem(input) {
  const errors = {};
  const name = String(input.name ?? '').trim();
  const categoryId = String(input.categoryId ?? '').trim();
  const price = parseFCFA(input.price);
  if (!name) errors.name = 'Indiquez le nom de l’article.';
  if (!categoryId) errors.categoryId = 'Choisissez une catégorie.';
  if (price === null) errors.price = 'Indiquez un prix en FCFA, sans virgule (ex. : 12500).';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      categoryId,
      price: price ?? 0,
      station: input.station === 'bar' ? 'bar' : 'cuisine',
      allergens: Array.isArray(input.allergens) ? input.allergens : splitList(input.allergens),
      available: input.available !== false && input.available !== '0',
      signature: !!input.signature,
    },
  };
}

/** Vérifie le format d'un code PIN. L'unicité est vérifiée par le magasin (codes chiffrés). */
export function validatePin(pin) {
  const p = String(pin ?? '').trim();
  if (!/^\d{4}$/.test(p)) return 'Le code doit comporter exactement 4 chiffres.';
  return null;
}
