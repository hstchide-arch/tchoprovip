// État de la connexion et de la synchronisation.
// Étape 1 : pas encore de serveur. Les modifications restent dans la file locale
// (outbox) et seront envoyées dès que le serveur sera branché à l'étape 2.
// L'adaptateur serveur devra exposer : push(entries) et pull(since).

import * as store from './store.js';

let adapter = null; // branché à l'étape 2 (Supabase)
const listeners = new Set();

export function setAdapter(a) {
  adapter = a;
  notify();
}

export function status() {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  return {
    online,
    serverConnected: !!adapter,
    pending: store.pendingCount(),
  };
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(status());
}

export function start() {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', notify);
    window.addEventListener('offline', notify);
  }
  store.subscribe(notify);
}

export function label(s = status()) {
  if (!s.online) {
    return {
      tone: 'offline',
      text: 'Hors ligne',
      detail: 'Le service continue. Tout est enregistré sur cet appareil.',
    };
  }
  if (!s.serverConnected) {
    return {
      tone: 'local',
      text: 'Mode local',
      detail: s.pending
        ? `${s.pending} modification(s) enregistrée(s) sur cet appareil, prêtes à être synchronisées.`
        : 'Les données sont enregistrées sur cet appareil.',
    };
  }
  return {
    tone: s.pending ? 'syncing' : 'ok',
    text: s.pending ? 'Synchronisation…' : 'Synchronisé',
    detail: s.pending ? `${s.pending} modification(s) en attente.` : 'Toutes les modifications sont envoyées.',
  };
}
