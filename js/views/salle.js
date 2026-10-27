// Plan de salle et détail d'une table.

import { esc, icon, field, srOnly } from '../ui.js';
import {
  TABLE_STATUS,
  LINE_STATUS,
  CANCEL_REASONS,
  elapsedLabel,
  formatFCFA,
  orderTotal,
  linesOfOrder,
  activeLines,
  openOrderForTable,
  tableStatus,
  canCancelLine,
  splitList,
  uuid,
} from '../domain.js';

let zoneId = null;

function sortedTables(app) {
  return app.store.list('tables').sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.label).localeCompare(String(b.label), 'fr', { numeric: true }));
}

function sortedZones(app) {
  return app.store.list('zones').sort((a, b) => (a.order || 0) - (b.order || 0));
}

function dateLine() {
  const d = new Date();
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const service = d.getHours() < 16 ? 'Service du midi' : 'Service du soir';
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${service} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function render(app) {
  const orders = app.store.list('orders');
  const lines = app.store.list('lines');
  const tables = sortedTables(app);
  const zones = sortedZones(app);
  if (zoneId && !zones.some((z) => z.id === zoneId)) zoneId = null;
  const zone = zoneId || (zones[0] && zones[0].id) || null;
  const shown = zone ? tables.filter((t) => t.zoneId === zone) : tables;

  const counts = { libre: 0, occupee: 0, addition: 0, reservee: 0 };
  for (const t of tables) counts[tableStatus(t, openOrderForTable(orders, t.id))]++;

  let h = `<div class="work"><section class="view" aria-labelledby="v-title">
    <header class="vhead">
      <div><h1 id="v-title">${esc(app.store.restaurant().name)}</h1><p class="muted">${esc(dateLine())}</p></div>
      ${
        zones.length > 1
          ? `<div class="segmented" role="group" aria-label="Zones">${zones
              .map((z) => `<button data-act="zone" data-id="${z.id}" aria-pressed="${z.id === zone}">${esc(z.name)}</button>`)
              .join('')}</div>`
          : ''
      }
    </header>`;

  if (!tables.length) {
    h += `<div class="empty"><h2>Aucune table pour l’instant</h2><p>Ajoutez vos tables dans Réglages pour voir le plan de salle.</p>${
      app.can('reglages') ? '<button class="btn gold" data-act="nav" data-v="reglages">Ouvrir les réglages</button>' : ''
    }</div></section></div>`;
    return h;
  }

  h += `<div class="legend">${Object.keys(counts)
    .map((s) => `<span class="st-${s}"><i></i>${TABLE_STATUS[s]} · <b class="num">${counts[s]}</b></span>`)
    .join('')}</div>`;

  h += `<div class="tables">${shown
    .map((t) => {
      const o = openOrderForTable(orders, t.id);
      const st = tableStatus(t, o);
      const ls = o ? activeLines(linesOfOrder(lines, o.id)) : [];
      const ready = ls.some((l) => l.status === 'pret');
      const allergic = o && (o.allergies || []).length > 0;
      const meta = o ? `${o.covers || t.seats} pers. · ${elapsedLabel(o.openedAt)}` : t.reserved ? `Réservée · ${t.seats} pl.` : `${t.seats} places`;
      return `<button class="tcard st-${st}${t.shape === 'ronde' ? ' round' : ''}" data-act="selTable" data-id="${t.id}" aria-pressed="${app.ui.tableId === t.id}">
        ${ready ? '<span class="badge ok">Plats prêts</span>' : ''}
        ${allergic ? `<span class="badge alert" title="Allergie signalée">${icon('warn', 14)}${srOnly('Allergie signalée')}</span>` : ''}
        <span class="tl">${esc(t.label)}</span>
        <span class="tm num">${esc(meta)}</span>
        <span class="ts">${TABLE_STATUS[st]}</span>
      </button>`;
    })
    .join('')}</div>`;
  if (!shown.length) h += '<p class="muted">Aucune table dans cette zone.</p>';
  h += '</section>';

  const t = app.ui.tableId && app.store.get('tables', app.ui.tableId);
  if (t) h += `<aside class="panel" aria-label="Détail de la table ${esc(t.label)}">${panel(app, t)}</aside>`;
  else app.ui.tableId = null;
  return h + '</div>';
}

function panel(app, t) {
  const orders = app.store.list('orders');
  const o = openOrderForTable(orders, t.id);
  const st = tableStatus(t, o);
  const zone = app.store.get('zones', t.zoneId);
  let h = `<div class="phead">
    <div><h2>${esc(t.label)}</h2><p class="muted">${t.seats} places${zone ? ` · ${esc(zone.name)}` : ''}${o ? ` · ouverte depuis ${elapsedLabel(o.openedAt)}` : ''}</p></div>
    <div class="row nowrap"><span class="pill st-${st}">${TABLE_STATUS[st]}</span>
    <button class="btn icon panel-close" data-act="closePanel" aria-label="Fermer le détail">${icon('close', 18)}</button></div>
  </div>`;

  if (!o) {
    return (
      h +
      `<p class="muted">Table libre. Ouvrez-la à l’arrivée des clients pour prendre la commande.</p>
      <button class="btn gold block" data-act="openTable" data-id="${t.id}">Ouvrir la table</button>
      <button class="btn block" data-act="toggleResa" data-id="${t.id}">${t.reserved ? 'Annuler la réservation' : 'Marquer comme réservée'}</button>`
    );
  }

  const all = linesOfOrder(app.store.list('lines'), o.id);
  const ls = activeLines(all);
  const role = app.role();
  const allergies = o.allergies || [];

  h += `<div class="stack-sm">
    <div class="row between"><span class="label">Allergies de la table</span><button class="btn small" data-act="editAllergies" data-id="${o.id}">Modifier</button></div>
    <div class="chips">${
      allergies.length ? allergies.map((a) => `<span class="tag alert">${icon('warn', 14)} ${esc(a)}</span>`).join('') : '<span class="muted small">Aucune allergie signalée.</span>'
    }</div>
  </div>`;

  h += `<div class="stepper"><span class="label grow">Couverts</span>
    <button class="btn icon" data-act="covers" data-id="${o.id}" data-d="-1" aria-label="Un couvert de moins">${icon('minus', 18)}</button>
    <b class="num" aria-live="polite">${o.covers || 1}</b>
    <button class="btn icon" data-act="covers" data-id="${o.id}" data-d="1" aria-label="Un couvert de plus">${icon('plus', 18)}</button></div>`;

  h += `<div><p class="label">Commande</p><div class="lines">${
    ls.length
      ? ls
          .map(
            (l) => `<div class="line">
          <span class="n"><span class="num">${l.qty} ×</span> ${esc(l.name)}${l.note ? `<span class="note">${esc(l.note)}</span>` : ''}</span>
          ${
            l.status === 'pret'
              ? `<button class="btn small gold" data-act="serveLine" data-id="${l.id}">Servi</button>`
              : `<span class="ls ls-${l.status}">${LINE_STATUS[l.status]}</span>`
          }
          ${canCancelLine(role, l) ? `<button class="xbtn" data-act="cancelLine" data-id="${l.id}" aria-label="Annuler ${esc(l.name)}">${icon('close', 16)}</button>` : ''}
        </div>`
          )
          .join('')
      : '<p class="muted">Aucun plat envoyé pour l’instant.</p>'
  }</div></div>`;

  const cancelled = all.length - ls.length;
  if (cancelled) h += `<p class="muted small">${cancelled} ligne(s) annulée(s), non comptée(s).</p>`;

  h += `<div class="total"><span class="label">Total</span><b class="num">${formatFCFA(orderTotal(all))}</b></div>`;
  if (o.status === 'addition' && (o.covers || 1) > 1) {
    h += `<p class="muted small">Soit ${formatFCFA(Math.ceil(orderTotal(all) / o.covers))} par personne pour ${o.covers} personnes (arrondi au franc supérieur).</p>`;
  }

  h += `<button class="btn gold block" data-act="goOrder" data-id="${t.id}">Ajouter des plats</button>
    <div class="row">
      ${
        o.status === 'ouverte'
          ? `<button class="btn warn" data-act="askBill" data-id="${o.id}"${ls.length ? '' : ' disabled'}>Addition demandée</button>`
          : `<button class="btn" data-act="reopen" data-id="${o.id}">Reprendre la commande</button>`
      }
      <button class="btn" data-act="transfer" data-id="${o.id}">Changer de table</button>
    </div>`;

  const confirming = app.ui.confirm === `close-${o.id}`;
  const notServed = ls.filter((l) => l.status !== 'servi').length;
  h += `<button class="btn ${confirming ? 'danger' : ''} block" data-act="closeTable" data-id="${o.id}">${
    confirming ? (ls.length ? 'Confirmer : clients partis, table libérée' : 'Confirmer la fermeture') : ls.length ? 'Libérer la table' : 'Fermer sans commande'
  }</button>`;
  if (confirming && notServed) h += `<p class="field-error">${notServed} plat(s) pas encore servi(s).</p>`;
  h += '<p class="muted small">L’encaissement (espèces, Mobile Money, carte) arrive à l’étape suivante.</p>';
  return h;
}

// ---------- Actions ----------

export const actions = {
  zone: (el) => {
    zoneId = el.dataset.id;
  },
  selTable: (el, ev, app) => {
    app.ui.tableId = app.ui.tableId === el.dataset.id ? null : el.dataset.id;
  },
  closePanel: (el, ev, app) => {
    app.ui.tableId = null;
  },
  openTable: (el, ev, app) => {
    app.openModal('openTable', { tableId: el.dataset.id });
    return false;
  },
  toggleResa: (el, ev, app) => {
    const t = app.store.get('tables', el.dataset.id);
    return app.run(app.store.patch('tables', t.id, { reserved: !t.reserved }));
  },
  editAllergies: (el, ev, app) => {
    app.openModal('allergies', { orderId: el.dataset.id });
    return false;
  },
  covers: (el, ev, app) => {
    const o = app.store.get('orders', el.dataset.id);
    const n = Math.min(60, Math.max(1, (o.covers || 1) + Number(el.dataset.d)));
    if (n === o.covers) return false;
    return app.run(app.store.patch('orders', o.id, { covers: n }));
  },
  serveLine: (el, ev, app) => app.run(app.store.patch('lines', el.dataset.id, { status: 'servi', servedAt: Date.now() })),
  cancelLine: (el, ev, app) => {
    app.openModal('cancelLine', { lineId: el.dataset.id });
    return false;
  },
  goOrder: (el, ev, app) => {
    app.ui.tableId = el.dataset.id;
    app.go('commande');
    return false;
  },
  askBill: (el, ev, app) => app.run(app.store.patch('orders', el.dataset.id, { status: 'addition', billAt: Date.now() })),
  reopen: (el, ev, app) => app.run(app.store.patch('orders', el.dataset.id, { status: 'ouverte' })),
  transfer: (el, ev, app) => {
    app.openModal('transfer', { orderId: el.dataset.id });
    return false;
  },
  closeTable: async (el, ev, app) => {
    const id = el.dataset.id;
    if (app.ui.prevConfirm !== `close-${id}`) {
      app.ui.confirm = `close-${id}`;
      return;
    }
    const o = app.store.get('orders', id);
    const total = orderTotal(linesOfOrder(app.store.list('lines'), id));
    const ok = await app.run(
      app.store.patch('orders', id, { status: 'fermee', closedAt: Date.now(), closedBy: app.staff().id, total }),
      'Table libérée'
    );
    if (ok) app.ui.tableId = o.tableId;
  },
  pickTransfer: async (el, ev, app) => {
    const { orderId } = app.ui.modal.ctx;
    const target = app.store.get('tables', el.dataset.id);
    const ok = await app.run(app.store.patch('orders', orderId, { tableId: target.id }), `Commande déplacée vers ${target.label}`);
    if (ok) {
      app.ui.tableId = target.id;
      app.closeModal();
    }
  },
  confirmCancelLine: async (el, ev, app) => {
    const sel = document.getElementById('cancel-reason');
    const reason = sel ? sel.value : '';
    if (!reason) {
      app.refreshModal({ error: 'Choisissez un motif.' });
      return false;
    }
    const { lineId } = app.ui.modal.ctx;
    const ok = await app.run(
      app.store.patch('lines', lineId, { status: 'annule', cancelledAt: Date.now(), cancelledBy: app.staff().id, cancelReason: reason }),
      'Ligne annulée'
    );
    if (ok) app.closeModal();
  },
};

// ---------- Formulaires ----------

export const forms = {
  openTable: async (fd, app) => {
    const { tableId } = app.ui.modal.ctx;
    const t = app.store.get('tables', tableId);
    if (openOrderForTable(app.store.list('orders'), tableId)) {
      app.closeModal();
      app.toast('Cette table vient d’être ouverte sur un autre écran.');
      return;
    }
    const covers = Math.min(60, Math.max(1, Number(fd.get('covers')) || t.seats || 2));
    const order = {
      id: uuid(),
      tableId,
      status: 'ouverte',
      covers,
      allergies: splitList(fd.get('allergies')),
      openedAt: Date.now(),
      openedBy: app.staff().id,
    };
    const changes = [{ store: 'orders', value: order }];
    if (t.reserved) changes.push({ store: 'tables', value: { ...t, reserved: false } });
    const ok = await app.run(app.store.save(changes), `${t.label} ouverte`);
    if (ok) {
      app.closeModal();
      app.ui.tableId = tableId;
      app.go('commande');
    }
  },
  allergies: async (fd, app) => {
    const { orderId } = app.ui.modal.ctx;
    const ok = await app.run(app.store.patch('orders', orderId, { allergies: splitList(fd.get('allergies')) }), 'Allergies mises à jour');
    if (ok) app.closeModal();
  },
};

// ---------- Fenêtres ----------

export const modals = {
  openTable: ({ tableId }, app) => {
    const t = app.store.get('tables', tableId);
    return `<h2 id="mtitle">Ouvrir ${esc(t.label)}</h2>
    <form data-form="openTable" class="stack">
      ${field('ot-covers', 'Nombre de couverts', `<input class="input num" id="ot-covers" name="covers" type="number" inputmode="numeric" min="1" max="60" value="${t.seats || 2}" required>`)}
      ${field('ot-all', 'Allergies signalées (facultatif, séparées par des virgules)', '<input class="input" id="ot-all" name="allergies" placeholder="Ex. : arachide, crustacés" autocomplete="off">')}
      <div class="row"><button class="btn" type="button" data-act="closeModal">Annuler</button><button class="btn gold" type="submit">Ouvrir et commander</button></div>
    </form>`;
  },
  allergies: ({ orderId }, app) => {
    const o = app.store.get('orders', orderId);
    return `<h2 id="mtitle">Allergies de la table</h2>
    <p class="muted">Le serveur sera alerté avant d’envoyer un plat qui contient l’un de ces allergènes, et la cuisine les verra sur le bon.</p>
    <form data-form="allergies" class="stack">
      ${field('al-input', 'Allergies (séparées par des virgules)', `<input class="input" id="al-input" name="allergies" value="${esc((o.allergies || []).join(', '))}" placeholder="Ex. : arachide, gluten" autocomplete="off">`)}
      <div class="row"><button class="btn" type="button" data-act="closeModal">Annuler</button><button class="btn gold" type="submit">Enregistrer</button></div>
    </form>`;
  },
  transfer: ({ orderId }, app) => {
    const o = app.store.get('orders', orderId);
    const from = app.store.get('tables', o.tableId);
    const orders = app.store.list('orders');
    const free = sortedTables(app).filter((t) => t.id !== o.tableId && !openOrderForTable(orders, t.id));
    return `<h2 id="mtitle">Déplacer la commande de ${esc(from ? from.label : '')}</h2>
    <p class="muted">Choisissez une table libre. Les plats déjà envoyés suivent la commande.</p>
    <div class="pick-grid">${
      free.length
        ? free.map((t) => `<button class="btn" data-act="pickTransfer" data-id="${t.id}">${esc(t.label)} <span class="muted small">${t.seats} pl.</span></button>`).join('')
        : '<p class="muted">Aucune table libre pour le moment.</p>'
    }</div>
    <div class="row"><button class="btn" data-act="closeModal">Annuler</button></div>`;
  },
  cancelLine: ({ lineId, error }, app) => {
    const l = app.store.get('lines', lineId);
    return `<h2 id="mtitle">Annuler « ${esc(l.name)} »</h2>
    <p class="muted">${l.qty} × ${formatFCFA(l.unitPrice)}${l.status === 'servi' ? ' · plat déjà servi' : ''}. L’annulation est enregistrée avec votre nom et le motif.</p>
    ${field(
      'cancel-reason',
      'Motif',
      `<select class="input" id="cancel-reason"><option value="">Choisir un motif…</option>${CANCEL_REASONS.map((r) => `<option>${esc(r)}</option>`).join('')}</select>`,
      error
    )}
    <div class="row"><button class="btn" data-act="closeModal">Garder la ligne</button><button class="btn danger" data-act="confirmCancelLine">Annuler la ligne</button></div>`;
  },
};
