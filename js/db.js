// Base de données locale de la tablette (IndexedDB).
// Tout est écrit ici d'abord : l'application fonctionne sans internet.
// Chaque modification est aussi ajoutée à la file « outbox », que la
// synchronisation enverra au serveur quand il sera branché (étape 2).

export const DB_NAME = 'tchoprovip';
export const DB_VERSION = 1;

export const COLLECTIONS = ['restaurant', 'zones', 'tables', 'categories', 'items', 'staff', 'orders', 'lines'];
const LOCAL_STORES = ['meta', 'outbox'];

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('Ce navigateur ne permet pas d’enregistrer des données hors ligne.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [...COLLECTIONS, ...LOCAL_STORES]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id' });
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Fermez les autres onglets de TchoProVip, puis rechargez la page.'));
  });
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Enregistrement annulé.'));
  });
}

function reqValue(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await openDb();
  return reqValue(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function count(store) {
  const db = await openDb();
  return reqValue(db.transaction(store, 'readonly').objectStore(store).count());
}

export async function getMeta(key) {
  const db = await openDb();
  const row = await reqValue(db.transaction('meta', 'readonly').objectStore('meta').get(key));
  return row ? row.value : undefined;
}

export async function setMeta(key, value) {
  const db = await openDb();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ key, value });
  return done(tx);
}

/**
 * Applique un lot de modifications en une seule transaction :
 * soit tout est enregistré (avec les entrées de la file de synchronisation), soit rien.
 * @param {Array<{store:string, op:'put'|'delete', value?:object, id?:string}>} changes
 * @param {Array<object>} outboxEntries
 */
export async function commit(changes, outboxEntries) {
  const db = await openDb();
  const stores = [...new Set([...changes.map((c) => c.store), 'outbox'])];
  const tx = db.transaction(stores, 'readwrite');
  for (const c of changes) {
    const os = tx.objectStore(c.store);
    if (c.op === 'delete') os.delete(c.id);
    else os.put(c.value);
  }
  const ob = tx.objectStore('outbox');
  for (const e of outboxEntries) ob.put(e);
  return done(tx);
}

/** Efface toutes les données de la tablette (utilisé par « Réinitialiser la démonstration »). */
export async function wipe() {
  const db = await openDb();
  const names = [...COLLECTIONS, ...LOCAL_STORES];
  const tx = db.transaction(names, 'readwrite');
  for (const n of names) tx.objectStore(n).clear();
  return done(tx);
}
