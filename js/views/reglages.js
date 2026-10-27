// Réglages du gérant : établissement, carte, tables, équipe, appareil.

import { esc, icon, field } from '../ui.js';
import { ROLES, formatFCFA, validateItem, validatePin, openOrderForTable, uuid } from '../domain.js';
import * as sync from '../sync.js';

let tab = 'carte';

const TABS = [
  ['carte', 'Carte'],
  ['tables', 'Tables'],
  ['equipe', 'Équipe'],
  ['etablissement', 'Établissement'],
  ['appareil', 'Cet appareil'],
];

const sortBy = (k) => (a, b) => (a[k] || 0) - (b[k] || 0);

export function render(app) {
  let h = `<section class="view" aria-labelledby="v-title">
  <header class="vhead"><div><h1 id="v-title">Réglages</h1><p class="muted">Votre carte, votre salle et votre équipe</p></div></header>
  <div class="segmented wrap" role="tablist" aria-label="Rubriques">${TABS.map(
    ([k, l]) => `<button role="tab" data-act="rtab" data-k="${k}" aria-selected="${tab === k}" aria-pressed="${tab === k}">${l}</button>`
  ).join('')}</div>`;
  h += ({ carte, tables, equipe, etablissement, appareil }[tab] || carte)(app);
  return h + '</section>';
}

function confirmBtn(app, key, label, confirmLabel, act, id) {
  const on = app.ui.confirm === key;
  return `<button class="btn small ${on ? 'danger' : ''}" data-act="${act}" data-id="${id}">${on ? confirmLabel : label}</button>`;
}

// ---------- Carte ----------

function carte(app) {
  const cats = app.store.list('categories').sort(sortBy('order'));
  const items = app.store.list('items');
  let h = `<div class="settings-head"><h2>Catégories</h2><button class="btn small gold" data-act="editCat">${icon('plus', 16)} Ajouter une catégorie</button></div>
  <div class="chips">${
    cats.length
      ? cats
          .map((c) => {
            const n = items.filter((i) => i.categoryId === c.id).length;
            return `<button class="chip" data-act="editCat" data-id="${c.id}">${esc(c.name)} <span class="muted num">· ${n}</span></button>`;
          })
          .join('')
      : '<p class="muted">Créez d’abord une catégorie (Entrées, Plats, Boissons…).</p>'
  }</div>
  <div class="settings-head"><h2>Articles <span class="muted small num">${items.length}</span></h2>${
    cats.length ? `<button class="btn small gold" data-act="editItem">${icon('plus', 16)} Ajouter un article</button>` : ''
  }</div>`;
  if (!items.length) return h + '<p class="muted">Aucun article pour l’instant.</p>';
  h += '<div class="tablewrap"><table class="data"><thead><tr><th>Article</th><th>Catégorie</th><th class="r">Prix</th><th>Poste</th><th>Allergènes</th><th>Disponible</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>';
  const catName = Object.fromEntries(cats.map((c) => [c.id, c.name]));
  const catOrder = Object.fromEntries(cats.map((c) => [c.id, c.order || 0]));
  for (const m of items.sort((a, b) => (catOrder[a.categoryId] || 0) - (catOrder[b.categoryId] || 0) || a.name.localeCompare(b.name, 'fr'))) {
    h += `<tr><td class="strong">${esc(m.name)}${m.signature ? ' <span class="tag gold-tag">Signature</span>' : ''}</td>
      <td>${esc(catName[m.categoryId] || '—')}</td>
      <td class="r num nowrap">${formatFCFA(m.price)}</td>
      <td>${m.station === 'bar' ? 'Bar' : 'Cuisine'}</td>
      <td>${esc((m.allergens || []).join(', ')) || '<span class="muted">—</span>'}</td>
      <td><button class="switch" role="switch" aria-checked="${m.available !== false}" data-act="toggleAvail" data-id="${m.id}" aria-label="${esc(m.name)} disponible"><span></span></button></td>
      <td class="r nowrap"><button class="btn small" data-act="editItem" data-id="${m.id}">Modifier</button> ${confirmBtn(app, `del-item-${m.id}`, 'Supprimer', 'Confirmer', 'delItem', m.id)}</td></tr>`;
  }
  return h + '</tbody></table></div>';
}

// ---------- Tables ----------

function tables(app) {
  const zones = app.store.list('zones').sort(sortBy('order'));
  const ts = app.store.list('tables').sort(sortBy('order'));
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  let h = `<div class="settings-head"><h2>Zones</h2><button class="btn small gold" data-act="editZone">${icon('plus', 16)} Ajouter une zone</button></div>
  <div class="chips">${zones
    .map((z) => `<button class="chip" data-act="editZone" data-id="${z.id}">${esc(z.name)} <span class="muted num">· ${ts.filter((t) => t.zoneId === z.id).length}</span></button>`)
    .join('') || '<p class="muted">Créez au moins une zone (Salle, Terrasse…).</p>'}</div>
  <div class="settings-head"><h2>Tables <span class="muted small num">${ts.length}</span></h2>${
    zones.length ? `<button class="btn small gold" data-act="editTable">${icon('plus', 16)} Ajouter une table</button>` : ''
  }</div>`;
  if (!ts.length) return h + '<p class="muted">Aucune table pour l’instant.</p>';
  h += '<div class="tablewrap"><table class="data"><thead><tr><th>Table</th><th class="r">Places</th><th>Forme</th><th>Zone</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>';
  for (const t of ts) {
    h += `<tr><td class="strong">${esc(t.label)}</td><td class="r num">${t.seats}</td><td>${t.shape === 'ronde' ? 'Ronde' : 'Rectangulaire'}</td><td>${esc(zoneName[t.zoneId] || '—')}</td>
    <td class="r nowrap"><button class="btn small" data-act="editTable" data-id="${t.id}">Modifier</button> ${confirmBtn(app, `del-table-${t.id}`, 'Supprimer', 'Confirmer', 'delTable', t.id)}</td></tr>`;
  }
  return h + '</tbody></table></div>';
}

// ---------- Équipe ----------

function equipe(app) {
  const staff = app.store.list('staff').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  let h = `<div class="settings-head"><h2>Équipe <span class="muted small num">${staff.length}</span></h2><button class="btn small gold" data-act="editStaff">${icon('plus', 16)} Ajouter une personne</button></div>
  <p class="muted">Chaque personne se connecte avec son propre code à 4 chiffres. Le rôle décide de ce qu’elle peut faire.</p>
  <div class="tablewrap"><table class="data"><thead><tr><th>Nom</th><th>Rôle</th><th>Statut</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>`;
  for (const s of staff) {
    h += `<tr><td class="strong">${esc(s.name)}${s.id === app.staff().id ? ' <span class="muted small">(vous)</span>' : ''}</td><td>${ROLES[s.role] || s.role}</td>
    <td>${s.active === false ? '<span class="pill muted-pill">Désactivé</span>' : '<span class="pill ok-pill">Actif</span>'}</td>
    <td class="r"><button class="btn small" data-act="editStaff" data-id="${s.id}">Modifier</button></td></tr>`;
  }
  return (
    h +
    `</tbody></table></div>
  <div class="card stack-sm"><p class="label">Ce que chaque rôle peut faire</p>
  <ul class="plain-list">
    <li><b>Gérant</b> : tout, dont la carte, les tables, l’équipe et l’annulation d’un plat déjà servi.</li>
    <li><b>Serveur</b> : plan de salle, commandes, écran cuisine, annulation d’un plat pas encore servi.</li>
    <li><b>Cuisine</b> et <b>Bar</b> : uniquement les bons de leur poste.</li>
  </ul></div>`
  );
}

// ---------- Établissement ----------

function etablissement(app) {
  const r = app.store.restaurant();
  return `<form data-form="restaurant" class="card stack form-narrow">
    ${field('r-name', 'Nom de l’établissement', `<input class="input" id="r-name" name="name" value="${esc(r.name)}" required maxlength="60">`)}
    ${field('r-alert', 'Alerte en cuisine après (minutes d’attente)', `<input class="input num" id="r-alert" name="kitchenAlertMin" type="number" inputmode="numeric" min="5" max="120" value="${Number(r.kitchenAlertMin) || 20}">`)}
    <label class="check"><input type="checkbox" id="r-demo" name="demo"${r.demo ? ' checked' : ''}> Afficher les codes de démonstration sur l’écran de connexion</label>
    <div class="row"><button class="btn gold" type="submit">Enregistrer</button></div>
  </form>`;
}

// ---------- Appareil ----------

function appareil(app) {
  const s = sync.status();
  const l = sync.label(s);
  const confirming = app.ui.confirm === 'reset';
  return `<div class="card stack-sm">
    <p class="label">État</p>
    <ul class="plain-list">
      <li>Connexion : <b>${s.online ? 'en ligne' : 'hors ligne'}</b></li>
      <li>Synchronisation : <b>${esc(l.text)}</b> — ${esc(l.detail)}</li>
      <li>Version de l’application : <b>${esc(app.version)}</b></li>
    </ul>
  </div>
  <div class="card stack-sm">
    <p class="label">Installer sur la tablette</p>
    <p>Dans Chrome, ouvrez le menu (les trois points), puis touchez <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>. TchoProVip s’ouvrira ensuite comme une application, même sans internet.</p>
  </div>
  <div class="card stack-sm">
    <p class="label">Réinitialiser la démonstration</p>
    <p class="muted">Efface toutes les données de cet appareil (commandes, carte, tables, équipe) et recharge le restaurant de démonstration. À ne pas utiliser une fois le restaurant en service.</p>
    <div><button class="btn ${confirming ? 'danger' : 'warn'}" data-act="resetDemo">${confirming ? 'Confirmer : tout effacer' : 'Réinitialiser'}</button></div>
  </div>`;
}

// ---------- Actions ----------

function twoStep(app, key) {
  if (app.ui.prevConfirm !== key) {
    app.ui.confirm = key;
    return false;
  }
  return true;
}

export const actions = {
  rtab: (el) => {
    tab = el.dataset.k;
  },
  editCat: (el, ev, app) => {
    app.openModal('cat', { id: el.dataset.id || null });
    return false;
  },
  editItem: (el, ev, app) => {
    app.openModal('item', { id: el.dataset.id || null });
    return false;
  },
  toggleAvail: (el, ev, app) => {
    const m = app.store.get('items', el.dataset.id);
    return app.run(app.store.patch('items', m.id, { available: m.available === false }), m.available === false ? `${m.name} : disponible` : `${m.name} : épuisé`);
  },
  delItem: (el, ev, app) => {
    if (!twoStep(app, `del-item-${el.dataset.id}`)) return;
    return app.run(app.store.remove('items', el.dataset.id), 'Article supprimé');
  },
  editZone: (el, ev, app) => {
    app.openModal('zone', { id: el.dataset.id || null });
    return false;
  },
  editTable: (el, ev, app) => {
    app.openModal('table', { id: el.dataset.id || null });
    return false;
  },
  delTable: (el, ev, app) => {
    const id = el.dataset.id;
    if (openOrderForTable(app.store.list('orders'), id)) {
      app.toast('Libérez la table avant de la supprimer.');
      return;
    }
    if (!twoStep(app, `del-table-${id}`)) return;
    if (app.ui.tableId === id) app.ui.tableId = null;
    return app.run(app.store.remove('tables', id), 'Table supprimée');
  },
  editStaff: (el, ev, app) => {
    app.openModal('staff', { id: el.dataset.id || null });
    return false;
  },
  delCat: async (el, ev, app) => {
    const id = app.ui.modal.ctx.id;
    if (app.store.list('items').some((i) => i.categoryId === id)) {
      app.refreshModal({ error: 'Déplacez ou supprimez d’abord les articles de cette catégorie.' });
      return false;
    }
    const ok = await app.run(app.store.remove('categories', id), 'Catégorie supprimée');
    if (ok) app.closeModal();
  },
  delZone: async (el, ev, app) => {
    const id = app.ui.modal.ctx.id;
    if (app.store.list('tables').some((t) => t.zoneId === id)) {
      app.refreshModal({ error: 'Déplacez ou supprimez d’abord les tables de cette zone.' });
      return false;
    }
    const ok = await app.run(app.store.remove('zones', id), 'Zone supprimée');
    if (ok) app.closeModal();
  },
  resetDemo: async (el, ev, app) => {
    if (!twoStep(app, 'reset')) return;
    await app.run(app.store.resetDemo(), 'Démonstration réinitialisée');
    app.signOut();
    return false;
  },
};

// ---------- Formulaires ----------

const nextOrder = (rows) => rows.reduce((m, r) => Math.max(m, r.order || 0), 0) + 1;

export const forms = {
  restaurant: async (fd, app) => {
    const name = String(fd.get('name') || '').trim();
    if (!name) return app.toast('Indiquez le nom de l’établissement.');
    const alert = Math.min(120, Math.max(5, Number(fd.get('kitchenAlertMin')) || 20));
    const r = app.store.restaurant();
    await app.run(app.store.put('restaurant', { ...r, id: 'main', name, kitchenAlertMin: alert, demo: fd.get('demo') !== null }), 'Établissement enregistré');
  },
  cat: async (fd, app) => {
    const { id } = app.ui.modal.ctx;
    const name = String(fd.get('name') || '').trim();
    if (!name) return app.refreshModal({ error: 'Indiquez un nom.' });
    const prev = id ? app.store.get('categories', id) : null;
    const value = prev ? { ...prev, name } : { id: uuid(), name, order: nextOrder(app.store.list('categories')) };
    if (await app.run(app.store.put('categories', value), 'Catégorie enregistrée')) app.closeModal();
  },
  item: async (fd, app) => {
    const { id } = app.ui.modal.ctx;
    const res = validateItem({
      name: fd.get('name'),
      categoryId: fd.get('categoryId'),
      price: fd.get('price'),
      station: fd.get('station'),
      allergens: fd.get('allergens'),
      available: fd.get('available') !== '0',
      signature: fd.get('signature') !== null,
    });
    if (!res.ok) return app.refreshModal({ errors: res.errors, draft: Object.fromEntries(fd.entries()) });
    const prev = id ? app.store.get('items', id) : null;
    if (await app.run(app.store.put('items', { ...(prev || { id: uuid() }), ...res.value }), 'Article enregistré')) app.closeModal();
  },
  zone: async (fd, app) => {
    const { id } = app.ui.modal.ctx;
    const name = String(fd.get('name') || '').trim();
    if (!name) return app.refreshModal({ error: 'Indiquez un nom.' });
    const prev = id ? app.store.get('zones', id) : null;
    const value = prev ? { ...prev, name } : { id: uuid(), name, order: nextOrder(app.store.list('zones')) };
    if (await app.run(app.store.put('zones', value), 'Zone enregistrée')) app.closeModal();
  },
  table: async (fd, app) => {
    const { id } = app.ui.modal.ctx;
    const label = String(fd.get('label') || '').trim();
    const zoneId = String(fd.get('zoneId') || '');
    const seats = Math.min(40, Math.max(1, Number(fd.get('seats')) || 0));
    const errors = {};
    if (!label) errors.label = 'Indiquez le nom de la table.';
    else if (app.store.list('tables').some((t) => t.id !== id && t.label.toLowerCase() === label.toLowerCase())) errors.label = 'Une autre table porte déjà ce nom.';
    if (!zoneId) errors.zoneId = 'Choisissez une zone.';
    if (Object.keys(errors).length) return app.refreshModal({ errors, draft: Object.fromEntries(fd.entries()) });
    const prev = id ? app.store.get('tables', id) : null;
    const value = {
      ...(prev || { id: uuid(), reserved: false, order: nextOrder(app.store.list('tables')) }),
      label,
      seats,
      zoneId,
      shape: fd.get('shape') === 'ronde' ? 'ronde' : 'rect',
    };
    if (await app.run(app.store.put('tables', value), 'Table enregistrée')) app.closeModal();
  },
  staff: async (fd, app) => {
    const { id } = app.ui.modal.ctx;
    const prev = id ? app.store.get('staff', id) : null;
    const name = String(fd.get('name') || '').trim();
    const role = String(fd.get('role') || '');
    const pin = String(fd.get('pin') || '').trim();
    const active = fd.get('active') !== null;
    const errors = {};
    if (!name) errors.name = 'Indiquez un nom.';
    if (!ROLES[role]) errors.role = 'Choisissez un rôle.';
    if (!prev || pin) {
      const e = validatePin(pin);
      if (e) errors.pin = e;
      else if (await app.store.pinInUse(pin, id)) errors.pin = 'Ce code est déjà utilisé par une autre personne.';
    }
    const others = app.store.list('staff').filter((s) => s.id !== id && s.role === 'gerant' && s.active !== false);
    if (prev && prev.role === 'gerant' && (role !== 'gerant' || !active) && !others.length) {
      errors.role = 'Il faut garder au moins un gérant actif.';
    }
    if (prev && prev.id === app.staff().id && !active) errors.role = 'Vous ne pouvez pas désactiver votre propre accès.';
    if (Object.keys(errors).length) return app.refreshModal({ errors, draft: { name, role, active: active ? 'on' : '' } });
    const value = { ...(prev || { id: uuid() }), name, role, active };
    if (pin) value.pinHash = await app.store.hashPin(pin);
    const changes = [{ store: 'staff', value }];
    const r = app.store.restaurant();
    if (pin && r.demo) changes.push({ store: 'restaurant', value: { ...r, demo: false } });
    if (await app.run(app.store.save(changes), 'Équipe mise à jour')) app.closeModal();
  },
};

// ---------- Fenêtres ----------

const actionsRow = (submitLabel = 'Enregistrer', extra = '') =>
  `<div class="row">${extra}<span class="grow"></span><button class="btn" type="button" data-act="closeModal">Annuler</button><button class="btn gold" type="submit">${submitLabel}</button></div>`;

export const modals = {
  cat: ({ id, error }, app) => {
    const c = id ? app.store.get('categories', id) : { name: '' };
    return `<h2 id="mtitle">${id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
    <form data-form="cat" class="stack">
      ${field('c-name', 'Nom', `<input class="input" id="c-name" name="name" value="${esc(c.name)}" required maxlength="40" placeholder="Ex. : Plats">`, error)}
      ${actionsRow('Enregistrer', id ? '<button class="btn danger" type="button" data-act="delCat">Supprimer</button>' : '')}
    </form>`;
  },
  item: ({ id, errors = {}, draft }, app) => {
    const m = draft || (id ? app.store.get('items', id) : { station: 'cuisine', available: true });
    const allergens = Array.isArray(m.allergens) ? m.allergens.join(', ') : m.allergens || '';
    const cats = app.store.list('categories').sort(sortBy('order'));
    const available = draft ? draft.available !== '0' : m.available !== false;
    const signature = draft ? draft.signature !== undefined : !!m.signature;
    return `<h2 id="mtitle">${id ? 'Modifier l’article' : 'Nouvel article'}</h2>
    <form data-form="item" class="stack" novalidate>
      ${field('i-name', 'Nom', `<input class="input" id="i-name" name="name" value="${esc(m.name || '')}" maxlength="80" placeholder="Ex. : Poisson braisé, bâton de manioc">`, errors.name)}
      <div class="grid2">
        ${field('i-cat', 'Catégorie', `<select class="input" id="i-cat" name="categoryId"><option value="">Choisir…</option>${cats.map((c) => `<option value="${c.id}"${c.id === m.categoryId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`, errors.categoryId)}
        ${field('i-price', 'Prix en FCFA', `<input class="input num" id="i-price" name="price" inputmode="numeric" value="${esc(m.price ?? '')}" placeholder="Ex. : 12500">`, errors.price)}
      </div>
      <div class="grid2">
        ${field('i-station', 'Préparé au', `<select class="input" id="i-station" name="station"><option value="cuisine"${m.station !== 'bar' ? ' selected' : ''}>Cuisine</option><option value="bar"${m.station === 'bar' ? ' selected' : ''}>Bar</option></select>`)}
        ${field('i-av', 'Disponibilité', `<select class="input" id="i-av" name="available"><option value="1"${available ? ' selected' : ''}>Disponible</option><option value="0"${!available ? ' selected' : ''}>Épuisé</option></select>`)}
      </div>
      ${field('i-all', 'Allergènes (séparés par des virgules)', `<input class="input" id="i-all" name="allergens" value="${esc(allergens)}" placeholder="Ex. : arachide, gluten, crustacés">`)}
      <label class="check"><input type="checkbox" name="signature"${signature ? ' checked' : ''}> Plat signature (affiché en premier)</label>
      ${actionsRow()}
    </form>`;
  },
  zone: ({ id, error }, app) => {
    const z = id ? app.store.get('zones', id) : { name: '' };
    return `<h2 id="mtitle">${id ? 'Modifier la zone' : 'Nouvelle zone'}</h2>
    <form data-form="zone" class="stack">
      ${field('z-name', 'Nom', `<input class="input" id="z-name" name="name" value="${esc(z.name)}" required maxlength="30" placeholder="Ex. : Terrasse">`, error)}
      ${actionsRow('Enregistrer', id ? '<button class="btn danger" type="button" data-act="delZone">Supprimer</button>' : '')}
    </form>`;
  },
  table: ({ id, errors = {}, draft }, app) => {
    const t = draft || (id ? app.store.get('tables', id) : { seats: 4, shape: 'rect' });
    const zones = app.store.list('zones').sort(sortBy('order'));
    const zoneId = t.zoneId || (zones[0] && zones[0].id);
    return `<h2 id="mtitle">${id ? 'Modifier la table' : 'Nouvelle table'}</h2>
    <form data-form="table" class="stack" novalidate>
      <div class="grid2">
        ${field('t-label', 'Nom', `<input class="input" id="t-label" name="label" value="${esc(t.label || '')}" maxlength="20" placeholder="Ex. : T12 ou Salon">`, errors.label)}
        ${field('t-seats', 'Places', `<input class="input num" id="t-seats" name="seats" type="number" inputmode="numeric" min="1" max="40" value="${esc(t.seats || 4)}">`)}
      </div>
      <div class="grid2">
        ${field('t-shape', 'Forme', `<select class="input" id="t-shape" name="shape"><option value="rect"${t.shape !== 'ronde' ? ' selected' : ''}>Rectangulaire</option><option value="ronde"${t.shape === 'ronde' ? ' selected' : ''}>Ronde</option></select>`)}
        ${field('t-zone', 'Zone', `<select class="input" id="t-zone" name="zoneId">${zones.map((z) => `<option value="${z.id}"${z.id === zoneId ? ' selected' : ''}>${esc(z.name)}</option>`).join('')}</select>`, errors.zoneId)}
      </div>
      ${actionsRow()}
    </form>`;
  },
  staff: ({ id, errors = {}, draft }, app) => {
    const s = draft || (id ? app.store.get('staff', id) : { role: 'serveur', active: true });
    const active = draft ? draft.active === 'on' : s.active !== false;
    return `<h2 id="mtitle">${id ? 'Modifier la personne' : 'Ajouter une personne'}</h2>
    <form data-form="staff" class="stack" novalidate>
      ${field('st-name', 'Nom', `<input class="input" id="st-name" name="name" value="${esc(s.name || '')}" maxlength="40" placeholder="Ex. : Sandrine">`, errors.name)}
      ${field('st-role', 'Rôle', `<select class="input" id="st-role" name="role">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}"${k === s.role ? ' selected' : ''}>${l}</option>`).join('')}</select>`, errors.role)}
      ${field('st-pin', id ? 'Nouveau code à 4 chiffres (laisser vide pour garder l’actuel)' : 'Code à 4 chiffres', '<input class="input num" id="st-pin" name="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••">', errors.pin)}
      <label class="check"><input type="checkbox" name="active"${active ? ' checked' : ''}> Accès actif</label>
      ${actionsRow()}
    </form>`;
  },
};
