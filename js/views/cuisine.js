// Écran cuisine et bar : bons à préparer, du plus ancien au plus récent.

import { esc, icon } from '../ui.js';
import { kitchenTickets, elapsedLabel, minutesSince, stationFor } from '../domain.js';

let filter = null; // null = selon le rôle

export function render(app) {
  const role = app.role();
  const fixed = stationFor(role);
  const station = fixed !== 'all' ? fixed : filter || 'all';
  const alertMin = Number(app.store.restaurant().kitchenAlertMin) || 20;
  const tickets = kitchenTickets(
    { orders: app.store.list('orders'), lines: app.store.list('lines'), tables: app.store.list('tables') },
    station
  );
  const title = station === 'bar' ? 'Bar' : station === 'cuisine' ? 'Cuisine' : 'Cuisine et bar';

  let h = `<section class="view" aria-labelledby="v-title">
  <header class="vhead">
    <div><h1 id="v-title">${title}</h1><p class="muted">Les plus anciens en premier. Touchez un plat pour le passer à l’étape suivante.</p></div>
    ${
      fixed === 'all'
        ? `<div class="segmented" role="group" aria-label="Poste">${[
            ['all', 'Tout'],
            ['cuisine', 'Cuisine'],
            ['bar', 'Bar'],
          ]
            .map(([k, l]) => `<button data-act="kfilter" data-k="${k}" aria-pressed="${station === k}">${l}</button>`)
            .join('')}</div>`
        : ''
    }
  </header>`;

  if (!tickets.length) {
    return h + '<div class="empty"><h2>Rien en attente</h2><p>Les plats envoyés depuis la salle apparaissent ici aussitôt.</p></div></section>';
  }

  h += `<div class="kgrid">${tickets
    .map((tk) => {
      const late = minutesSince(tk.since) >= alertMin && !tk.allReady;
      const allergies = tk.order.allergies || [];
      return `<article class="kcard${late ? ' late' : ''}" aria-label="Bon ${esc(tk.table ? tk.table.label : '')}">
      <header class="khead"><b>${esc(tk.table ? tk.table.label : 'Table')}</b>
        <span class="num ${late ? 'late-text' : 'muted'}">${late ? `${icon('warn', 14)} ` : ''}${elapsedLabel(tk.since)}</span></header>
      ${allergies.length ? `<div class="alertbox flat">${icon('warn', 16)}<span>Allergie : <b>${esc(allergies.join(', '))}</b></span></div>` : ''}
      ${tk.lines
        .map(
          (l) => `<div class="kline${l.status === 'pret' ? ' is-ready' : ''}">
          <span class="q num">${l.qty}</span>
          <span class="grow minw0"><span class="strong">${esc(l.name)}</span>${l.note ? `<span class="knote">${esc(l.note)}</span>` : ''}${
            station === 'all' ? `<span class="muted small">${l.station === 'bar' ? 'Bar' : 'Cuisine'}</span>` : ''
          }</span>
          <button class="btn small ${l.status === 'pret' ? '' : 'gold'}" data-act="lineNext" data-id="${l.id}" aria-label="${esc(l.name)} : ${l.status === 'pret' ? 'marquer servi' : 'marquer prêt'}">${
            l.status === 'pret' ? 'Servi' : 'Prêt'
          }</button>
        </div>`
        )
        .join('')}
      ${
        tk.lines.some((l) => l.status === 'en_preparation')
          ? `<footer class="kfoot"><button class="btn small block" data-act="ticketReady" data-ids="${tk.lines
              .filter((l) => l.status === 'en_preparation')
              .map((l) => l.id)
              .join(',')}">${icon('check', 16)} Tout est prêt</button></footer>`
          : ''
      }
    </article>`;
    })
    .join('')}</div></section>`;
  return h;
}

export const actions = {
  kfilter: (el) => {
    filter = el.dataset.k;
  },
  lineNext: (el, ev, app) => {
    const l = app.store.get('lines', el.dataset.id);
    if (!l) return false;
    const now = Date.now();
    const fields = l.status === 'en_preparation' ? { status: 'pret', readyAt: now } : { status: 'servi', servedAt: now };
    return app.run(app.store.patch('lines', l.id, fields));
  },
  ticketReady: (el, ev, app) => {
    const now = Date.now();
    const changes = el.dataset.ids
      .split(',')
      .map((id) => app.store.get('lines', id))
      .filter((l) => l && l.status === 'en_preparation')
      .map((l) => ({ store: 'lines', value: { ...l, status: 'pret', readyAt: now } }));
    if (!changes.length) return false;
    return app.run(app.store.save(changes), `${changes.length} plat(s) prêt(s) à servir`);
  },
};
