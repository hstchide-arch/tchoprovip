import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFCFA,
  formatFCFA,
  orderTotal,
  tableStatus,
  openOrderForTable,
  allergenConflicts,
  buildLinesFromDraft,
  kitchenTickets,
  nextLineStatus,
  canCancelLine,
  can,
  homeViewFor,
  stationFor,
  validateItem,
  validatePin,
  elapsedLabel,
  uuid,
  initials,
} from '../js/domain.js';

test('parseFCFA accepte les saisies courantes et refuse les décimales', () => {
  assert.equal(parseFCFA('12500'), 12500);
  assert.equal(parseFCFA('12 500'), 12500);
  assert.equal(parseFCFA('12.500'), 12500);
  assert.equal(parseFCFA('12500 FCFA'), 12500);
  assert.equal(parseFCFA(0), 0);
  assert.equal(parseFCFA('12,5'), null);
  assert.equal(parseFCFA('-200'), null);
  assert.equal(parseFCFA(''), null);
  assert.equal(parseFCFA(12.5), null);
});

test('formatFCFA groupe les milliers sans décimales', () => {
  assert.equal(formatFCFA(12500), '12 500 FCFA');
  assert.equal(formatFCFA(65000), '65 000 FCFA');
  assert.equal(formatFCFA(0), '0 FCFA');
  assert.equal(formatFCFA(1250000), '1 250 000 FCFA');
});

test('orderTotal ignore les lignes annulées', () => {
  const lines = [
    { unitPrice: 14000, qty: 1, status: 'servi' },
    { unitPrice: 2000, qty: 3, status: 'en_preparation' },
    { unitPrice: 65000, qty: 1, status: 'annule' },
  ];
  assert.equal(orderTotal(lines), 20000);
  assert.equal(orderTotal([]), 0);
});

test('tableStatus et openOrderForTable', () => {
  const t = { id: 't1', reserved: false };
  const orders = [
    { id: 'o1', tableId: 't1', status: 'fermee' },
    { id: 'o2', tableId: 't1', status: 'ouverte' },
  ];
  const o = openOrderForTable(orders, 't1');
  assert.equal(o.id, 'o2');
  assert.equal(tableStatus(t, o), 'occupee');
  assert.equal(tableStatus(t, { ...o, status: 'addition' }), 'addition');
  assert.equal(tableStatus(t, null), 'libre');
  assert.equal(tableStatus({ ...t, reserved: true }, null), 'reservee');
  assert.equal(openOrderForTable([{ id: 'x', tableId: 't1', status: 'fermee' }], 't1'), null);
});

test('allergenConflicts ignore accents, casse et pluriel simple', () => {
  assert.deepEqual(allergenConflicts(['arachide', 'crustacés'], ['Arachides']), ['arachide']);
  assert.deepEqual(allergenConflicts(['Crustacés'], ['crustaces']), ['Crustacés']);
  assert.deepEqual(allergenConflicts(['gluten'], ['arachide']), []);
  assert.deepEqual(allergenConflicts(['gluten'], []), []);
  assert.deepEqual(allergenConflicts([], ['arachide']), []);
});

test('buildLinesFromDraft copie le nom et le prix au moment de l’envoi', () => {
  const items = {
    m1: { id: 'm1', name: 'Ndolé', price: 14000, station: 'cuisine' },
    m2: { id: 'm2', name: 'Eau', price: 2000, station: 'bar' },
  };
  let n = 0;
  const lines = buildLinesFromDraft(
    [
      { itemId: 'm1', qty: 2, note: ' sans piment ' },
      { itemId: 'm2', qty: 1, note: '' },
      { itemId: 'inconnu', qty: 1 },
      { itemId: 'm1', qty: 0 },
    ],
    items,
    { orderId: 'o1', now: 1000, staffId: 's1', newId: () => `l${++n}` }
  );
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], {
    id: 'l1', orderId: 'o1', itemId: 'm1', name: 'Ndolé', unitPrice: 14000, qty: 2, note: 'sans piment',
    station: 'cuisine', status: 'en_preparation', sentAt: 1000, sentBy: 's1',
  });
  assert.equal(lines[1].station, 'bar');
  items.m1.price = 99999; // un changement de carte ne touche pas la ligne déjà créée
  assert.equal(lines[0].unitPrice, 14000);
});

test('kitchenTickets trie par ancienneté et filtre par poste', () => {
  const orders = [
    { id: 'o1', tableId: 't1', status: 'ouverte' },
    { id: 'o2', tableId: 't2', status: 'ouverte' },
    { id: 'o3', tableId: 't3', status: 'fermee' },
  ];
  const tables = [{ id: 't1', label: 'T1' }, { id: 't2', label: 'T2' }, { id: 't3', label: 'T3' }];
  const lines = [
    { id: 'a', orderId: 'o1', station: 'cuisine', status: 'en_preparation', sentAt: 300 },
    { id: 'b', orderId: 'o1', station: 'bar', status: 'en_preparation', sentAt: 300 },
    { id: 'c', orderId: 'o2', station: 'cuisine', status: 'pret', sentAt: 100 },
    { id: 'd', orderId: 'o2', station: 'cuisine', status: 'en_preparation', sentAt: 200 },
    { id: 'e', orderId: 'o2', station: 'cuisine', status: 'servi', sentAt: 50 },
    { id: 'f', orderId: 'o3', station: 'cuisine', status: 'en_preparation', sentAt: 10 },
  ];
  const all = kitchenTickets({ orders, lines, tables }, 'all');
  assert.deepEqual(all.map((t) => t.table.label), ['T2', 'T1']);
  assert.deepEqual(all[0].lines.map((l) => l.id), ['c', 'd']);
  assert.equal(all[0].since, 200); // le plus ancien plat encore à préparer
  const bar = kitchenTickets({ orders, lines, tables }, 'bar');
  assert.equal(bar.length, 1);
  assert.deepEqual(bar[0].lines.map((l) => l.id), ['b']);
});

test('statuts de ligne et droits', () => {
  assert.equal(nextLineStatus('en_preparation'), 'pret');
  assert.equal(nextLineStatus('pret'), 'servi');
  assert.equal(nextLineStatus('servi'), null);
  assert.equal(canCancelLine('serveur', { status: 'en_preparation' }), true);
  assert.equal(canCancelLine('serveur', { status: 'servi' }), false);
  assert.equal(canCancelLine('gerant', { status: 'servi' }), true);
  assert.equal(canCancelLine('cuisine', { status: 'en_preparation' }), false);
  assert.equal(canCancelLine('gerant', { status: 'annule' }), false);
  assert.equal(can('serveur', 'reglages'), false);
  assert.equal(can('gerant', 'reglages'), true);
  assert.equal(can('bar', 'salle'), false);
  assert.equal(homeViewFor('cuisine'), 'cuisine');
  assert.equal(homeViewFor('serveur'), 'salle');
  assert.equal(stationFor('bar'), 'bar');
  assert.equal(stationFor('gerant'), 'all');
});

test('validateItem signale les champs manquants en français', () => {
  const bad = validateItem({ name: ' ', categoryId: '', price: '12,5' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.name && bad.errors.categoryId && bad.errors.price);
  const good = validateItem({ name: 'Poisson braisé', categoryId: 'c1', price: '15 000', station: 'cuisine', allergens: 'poisson, gluten', available: true });
  assert.equal(good.ok, true);
  assert.equal(good.value.price, 15000);
  assert.deepEqual(good.value.allergens, ['poisson', 'gluten']);
});

test('validatePin exige 4 chiffres', () => {
  assert.equal(validatePin('1234'), null);
  assert.ok(validatePin('123'));
  assert.ok(validatePin('12a4'));
  assert.ok(validatePin(''));
});

test('utilitaires divers', () => {
  assert.equal(elapsedLabel(0), '');
  assert.equal(elapsedLabel(0 + 1, 1 + 8 * 60000), '8 min');
  assert.equal(elapsedLabel(1, 1 + 65 * 60000), '1 h 05');
  assert.match(uuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(initials('Mme Aïcha Ebanda'), 'AE');
  assert.equal(initials(''), '?');
});
