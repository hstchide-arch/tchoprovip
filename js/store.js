// Magasin de données de l'application : état en mémoire + base locale + file de synchronisation.
// Les autres onglets du même appareil sont prévenus en direct (BroadcastChannel),
// ce qui permet d'ouvrir la salle et la cuisine côte à côte sur un même appareil.

import * as db from './db.js';
import { uuid } from './domain.js';
import { demoData } from './seed.js';

const state = Object.fromEntries(db.COLLECTIONS.map((c) => [c, {}]));
const listeners = new Set();
let deviceId = null;
let pending = 0;
let channel = null;

export function list(coll) {
  return Object.values(state[coll]);
}

export function get(coll, id) {
  return state[coll][id];
}

export function restaurant() {
  return state.restaurant.main || { id: 'main', name: 'Mon restaurant', kitchenAlertMin: 20 };
}

export function pendingCount() {
  return pending;
}

export function getDeviceId() {
  return deviceId;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(source) {
  for (const fn of listeners) fn(source);
}

function applyToMemory(changes) {
  for (const c of changes) {
    if (c.op === 'delete') delete state[c.store][c.id];
    else state[c.store][c.value.id] = c.value;
  }
}

async function loadAll() {
  for (const coll of db.COLLECTIONS) {
    const rows = await db.getAll(coll);
    state[coll] = Object.fromEntries(rows.map((r) => [r.id, r]));
  }
  pending = await db.count('outbox');
}

export async function init() {
  await db.openDb();
  deviceId = await db.getMeta('deviceId');
  if (!deviceId) {
    deviceId = uuid();
    await db.setMeta('deviceId', deviceId);
  }
  await loadAll();
  if (!state.restaurant.main) await seedDemo();

  if ('BroadcastChannel' in globalThis) {
    channel = new BroadcastChannel('tchoprovip');
    channel.onmessage = async (ev) => {
      const msg = ev.data || {};
      if (msg.type === 'changes' && Array.isArray(msg.changes)) {
        applyToMemory(msg.changes);
        pending = await db.count('outbox');
        emit('remote');
      } else if (msg.type === 'reload') {
        await loadAll();
        emit('remote');
      }
    };
  }
}

/**
 * Enregistre un lot de modifications (tout ou rien).
 * @param {Array<{store:string, op?:'put'|'delete', value?:object, id?:string}>} changes
 */
export async function save(changes) {
  const now = Date.now();
  const norm = changes.map((c) => {
    if (c.op === 'delete') return { store: c.store, op: 'delete', id: c.id };
    const value = { ...c.value, updatedAt: now, updatedBy: deviceId };
    if (!value.createdAt) value.createdAt = now;
    return { store: c.store, op: 'put', value };
  });
  const outbox = norm.map((c) => ({
    id: uuid(),
    at: now,
    deviceId,
    store: c.store,
    op: c.op,
    recordId: c.op === 'delete' ? c.id : c.value.id,
    value: c.op === 'delete' ? null : c.value,
  }));
  await db.commit(norm, outbox);
  applyToMemory(norm);
  pending += outbox.length;
  emit('local');
  if (channel) channel.postMessage({ type: 'changes', changes: norm });
  return norm;
}

export function put(store, value) {
  return save([{ store, op: 'put', value }]);
}

export function patch(store, id, fields) {
  const current = state[store][id];
  if (!current) return Promise.reject(new Error('Élément introuvable. Rechargez la page.'));
  return put(store, { ...current, ...fields });
}

export function remove(store, id) {
  return save([{ store, op: 'delete', id }]);
}

// ---------- Codes PIN ----------

export async function hashPin(pin) {
  const text = `tchoprovip:${pin}`;
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Repli pour les contextes sans chiffrement (ex. fichier ouvert hors serveur).
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv-${h.toString(16)}`;
}

export async function findStaffByPin(pin) {
  const h = await hashPin(pin);
  return list('staff').find((s) => s.active !== false && s.pinHash === h) || null;
}

export async function pinInUse(pin, exceptId) {
  const h = await hashPin(pin);
  return list('staff').some((s) => s.id !== exceptId && s.pinHash === h);
}

// ---------- Démonstration ----------

async function seedDemo() {
  const data = demoData();
  const changes = [];
  for (const coll of Object.keys(data)) {
    for (const row of data[coll]) {
      const value = { ...row };
      if (coll === 'staff') {
        value.pinHash = await hashPin(row.pin);
        delete value.pin;
      }
      changes.push({ store: coll, op: 'put', value });
    }
  }
  // Les données de démonstration ne sont pas destinées au serveur : pas de file de synchronisation.
  const now = Date.now();
  const norm = changes.map((c) => ({ ...c, value: { ...c.value, createdAt: now, updatedAt: now, updatedBy: deviceId } }));
  await db.commit(norm, []);
  applyToMemory(norm);
}

export async function resetDemo() {
  await db.wipe();
  deviceId = uuid();
  await db.setMeta('deviceId', deviceId);
  for (const coll of db.COLLECTIONS) state[coll] = {};
  pending = 0;
  await seedDemo();
  emit('local');
  if (channel) channel.postMessage({ type: 'reload' });
}
