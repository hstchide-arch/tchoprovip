// Prise de commande : carte, brouillon d'envoi, alerte allergie, envoi en cuisine et au bar.

import { esc, icon, srOnly } from '../ui.js';
import {
  formatFCFA,
  normalize,
  openOrderForTable,
  allergenConflicts,
  buildLinesFromDraft,
  uuid,
} from '../domain.js';

let catId = null;
let search = '';
const drafts = {}; // brouillon par table : [{ itemId, qty, note }]

function draftFor(tableId) {
  if (!drafts[tableId]) drafts[tableId] = [];
  return drafts[tableId];
}

function sortedCategories(app) {
  return app.store.list('categories').sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, 'fr'));
}

function context(app) {
  const t = app.ui.tableId && app.store.get('tables', app.ui.tableId);
  const o = t && openOrderForTable(app.store.list('orders'), t.id);
  return { t, o };
}

export function render(app) {
  const { t, o } = context(app);
  if (!t || !o) {
    // La table a été fermée ou déplacée (éventuellement depuis un autre écran).
    setTimeout(() => app.go('salle'), 0);
    return '<p class="muted">Retour au plan de salle…</p>';
  }
  const draft = draftFor(t.id);
  const allergies = o.allergies || [];
  const cats = sortedCategories(app);
  const items = app.store.list('items');
  const usedCats = cats.filter((c) => items.some((i) => i.categoryId === c.id));
  if (!catId || !usedCats.some((c) => c.id === catId)) catId = usedCats[0] ? usedCats[0].id : null;
  const q = normalize(search);
  const shown = items
    .filter((i) => (q ? normalize(i.name).includes(q) : i.categoryId === catId))
    .sort((a, b) => (b.available !== false) - (a.available !== false) || (b.signature ? 1 : 0) - (a.signature ? 1 : 0) || a.name.localeCompare(b.name, 'fr'));

  let h = `<div class="work"><section class="view" aria-labelledby="v-title">
  <header class="vhead">
    <div class="row nowrap center">
      <button class="btn icon" data-act="backSalle" aria-label="Retour au plan de salle">${icon('back', 20)}</button>
      <div><h1 id="v-title">La carte</h1><p class="muted">${esc(t.label)} · ${o.covers || 1} couverts</p></div>
    </div>
    <div class="searchbox">${icon('search', 18)}<label for="dish-search" class="sr-only">Rechercher un article</label>
      <input class="input" id="dish-search" type="search" placeholder="Rechercher un plat ou une boisson" value="${esc(search)}" autocomplete="off" data-input="dishSearch"></div>
  </header>`;

  if (!items.length) {
    h += `<div class="empty"><h2>La carte est vide</h2><p>Le gérant peut ajouter les plats et boissons dans Réglages.</p></div></section></div>`;
    return h;
  }

  h += `<div class="order-grid"><div class="minw0">`;
  if (!q) {
    h += `<div class="chips" role="group" aria-label="Catégories">${usedCats
      .map((c) => `<button class="chip" data-act="cat" data-id="${c.id}" aria-pressed="${c.id === catId}">${esc(c.name)}</button>`)
      .join('')}</div>`;
  }
  h += `<div class="dishes">${
    shown.length
      ? shown
          .map((m) => {
            const cf = allergenConflicts(m.allergens, allergies);
            const off = m.available === false;
            const sub = cf.length
              ? `<span class="dc warn-text">${icon('warn', 14)} Contient : ${esc(cf.join(', '))}</span>`
              : `<span class="dc">${m.station === 'bar' ? 'Bar' : 'Cuisine'}${(m.allergens || []).length ? ` · ${esc(m.allergens.join(', '))}` : ''}</span>`;
            return `<button class="dish${cf.length ? ' conflict' : ''}" data-act="addDish" data-id="${m.id}"${off ? ' disabled' : ''}>
              ${sub}
              ${m.signature ? '<span class="tag gold-tag">Signature</span>' : ''}
              <span class="dn">${esc(m.name)}</span>
              <span class="dp"><span class="num">${off ? 'Épuisé' : formatFCFA(m.price)}</span>${off ? '' : `<span class="plus" aria-hidden="true">${icon('plus', 18)}</span>`}</span>
            </button>`;
          })
          .join('')
      : '<p class="muted">Aucun résultat.</p>'
  }</div></div>`;

  // Brouillon d'envoi
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]));
  const subtotal = draft.reduce((s, d) => s + (itemsById[d.itemId] ? itemsById[d.itemId].price * d.qty : 0), 0);
  h += `<aside class="ticket card" aria-label="Nouvel envoi">
    <div class="row between baseline"><h2>Nouvel envoi</h2><span class="muted">${esc(t.label)}</span></div>
    ${
      allergies.length
        ? `<div class="alertbox" role="note">${icon('warn', 18)}<span>Allergie signalée : <b>${esc(allergies.join(', '))}</b>. Vérifiez chaque plat avant l’envoi.</span></div>`
        : ''
    }
    <div class="lines">${
      draft.length
        ? draft
            .map((d, i) => {
              const m = itemsById[d.itemId];
              if (!m) return '';
              const cf = allergenConflicts(m.allergens, allergies);
              return `<div class="line col">
              <div class="row between center nowrap">
                <span class="draft-name"><span class="strong">${esc(m.name)}</span>${cf.length ? `<span class="tag alert">${icon('warn', 13)} ${esc(cf.join(', '))}</span>` : ''}</span>
                <span class="stepper tight">
                  <button class="btn icon small" data-act="dq" data-i="${i}" data-d="-1" aria-label="Retirer un ${esc(m.name)}">${icon('minus', 16)}</button>
                  <b class="num">${d.qty}</b>
                  <button class="btn icon small" data-act="dq" data-i="${i}" data-d="1" aria-label="Ajouter un ${esc(m.name)}">${icon('plus', 16)}</button>
                </span>
              </div>
              <label for="note-${i}" class="sr-only">Note pour ${esc(m.name)}</label>
              <input class="input mini" id="note-${i}" placeholder="Note : cuisson, sans piment…" value="${esc(d.note)}" data-note="${i}" autocomplete="off">
            </div>`;
            })
            .join('')
        : '<p class="muted">Touchez un plat pour l’ajouter.</p>'
    }</div>
    <div class="total"><span class="label">Sous-total</span><b class="num">${formatFCFA(subtotal)}</b></div>
    <button class="btn gold block" data-act="sendOrder"${draft.length ? '' : ' disabled'}>Envoyer en cuisine et au bar${srOnly(` (${draft.length} article(s))`)}</button>
  </aside></div></section></div>`;
  return h;
}

async function send(app, allergyConfirmed) {
  const { t, o } = context(app);
  if (!t || !o) return;
  const draft = draftFor(t.id);
  const itemsById = Object.fromEntries(app.store.list('items').map((i) => [i.id, i]));
  const now = Date.now();
  const lines = buildLinesFromDraft(draft, itemsById, { orderId: o.id, now, staffId: app.staff().id, newId: uuid });
  if (!lines.length) return;
  if (allergyConfirmed) {
    for (const l of lines) {
      if (allergenConflicts(itemsById[l.itemId].allergens, o.allergies || []).length) l.allergyConfirmedBy = app.staff().id;
    }
  }
  const changes = lines.map((l) => ({ store: 'lines', value: l }));
  if (o.status !== 'ouverte') changes.push({ store: 'orders', value: { ...o, status: 'ouverte' } });
  const n = lines.reduce((s, l) => s + l.qty, 0);
  const ok = await app.run(app.store.save(changes), `${n} article(s) envoyé(s) pour ${t.label}`);
  if (ok) {
    drafts[t.id] = [];
    search = '';
    app.closeModal();
    app.go('salle');
  }
}

export const actions = {
  backSalle: (el, ev, app) => {
    app.go('salle');
    return false;
  },
  cat: (el) => {
    catId = el.dataset.id;
  },
  addDish: (el, ev, app) => {
    const draft = draftFor(app.ui.tableId);
    const id = el.dataset.id;
    const existing = draft.find((d) => d.itemId === id && !d.note);
    if (existing) existing.qty += 1;
    else draft.push({ itemId: id, qty: 1, note: '' });
  },
  dq: (el, ev, app) => {
    const draft = draftFor(app.ui.tableId);
    const d = draft[Number(el.dataset.i)];
    if (!d) return false;
    d.qty += Number(el.dataset.d);
    if (d.qty <= 0) draft.splice(Number(el.dataset.i), 1);
  },
  sendOrder: async (el, ev, app) => {
    const { t, o } = context(app);
    if (!t || !o) return;
    const itemsById = Object.fromEntries(app.store.list('items').map((i) => [i.id, i]));
    const risky = draftFor(t.id)
      .map((d) => itemsById[d.itemId])
      .filter((m) => m && allergenConflicts(m.allergens, o.allergies || []).length);
    if (risky.length) {
      app.openModal('allergyConfirm', { names: risky.map((m) => m.name), allergies: o.allergies });
      return false;
    }
    await send(app, false);
    return false;
  },
  sendAnyway: async (el, ev, app) => {
    await send(app, true);
    return false;
  },
};

export function onInput(target, app) {
  if (target.dataset.input === 'dishSearch') {
    search = target.value;
    app.render();
    return true;
  }
  if (target.dataset.note !== undefined && app.ui.tableId) {
    const d = draftFor(app.ui.tableId)[Number(target.dataset.note)];
    if (d) d.note = target.value;
    return true;
  }
  return false;
}

export const modals = {
  allergyConfirm: ({ names, allergies }) => `
    <h2 id="mtitle" class="warn-text">${icon('warn', 22)} Attention allergie</h2>
    <p>La table a signalé : <b>${esc((allergies || []).join(', '))}</b>.</p>
    <p>Ces articles contiennent un de ces allergènes :</p>
    <ul class="plain-list">${names.map((n) => `<li><b>${esc(n)}</b></li>`).join('')}</ul>
    <p class="muted">Vérifiez avec le client et avec la cuisine. Si vous confirmez, votre nom sera enregistré avec l’envoi.</p>
    <div class="row"><button class="btn gold" data-act="closeModal">Revenir à la commande</button><button class="btn danger" data-act="sendAnyway">Le client confirme, envoyer</button></div>`,
};
