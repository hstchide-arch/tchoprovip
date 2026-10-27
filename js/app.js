// Point d'entrée de TchoProVip : session, navigation, rendu et gestion des actions.

import * as store from './store.js';
import * as sync from './sync.js';
import { can, homeViewFor, ROLES } from './domain.js';
import { esc, icon, toast, errorMessage } from './ui.js';
import * as login from './views/login.js';
import * as salle from './views/salle.js';
import * as commande from './views/commande.js';
import * as cuisine from './views/cuisine.js';
import * as reglages from './views/reglages.js';

export const VERSION = '0.1.0';

const VIEWS = { login, salle, commande, cuisine, reglages };
const SESSION_KEY = 'tchoprovip.session';

const ui = {
  view: 'login',
  staffId: null,
  modal: null,
  confirm: null, // clé d'une action en attente de confirmation (2e appui)
};

const app = {
  ui,
  store,
  sync,
  toast,
  version: VERSION,
  staff() {
    const s = ui.staffId ? store.get('staff', ui.staffId) : null;
    return s && s.active !== false ? s : null;
  },
  role() {
    const s = app.staff();
    return s ? s.role : null;
  },
  can(action) {
    return can(app.role(), action);
  },
  go(view) {
    if (view !== 'login' && !app.staff()) view = 'login';
    if (view !== 'login' && !can(app.role(), view === 'commande' ? 'commande' : view)) view = homeViewFor(app.role());
    ui.view = view;
    ui.confirm = null;
    render();
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;
  },
  // La session est gardée par onglet (sessionStorage) et par appareil (localStorage) :
  // on peut ouvrir la salle et la cuisine dans deux onglets, et l'app installée
  // reste connectée quand on la rouvre.
  signIn(staff) {
    ui.staffId = staff.id;
    try {
      sessionStorage.setItem(SESSION_KEY, staff.id);
      localStorage.setItem(SESSION_KEY, staff.id);
    } catch (e) {
      /* stockage indisponible : la session dure le temps de la page */
    }
    app.go(homeViewFor(staff.role));
  },
  signOut() {
    ui.staffId = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      /* rien */
    }
    closeModal();
    app.go('login');
  },
  render: () => render(),
  openModal,
  closeModal,
  /** Exécute une action qui enregistre des données et affiche une erreur claire si besoin. */
  async run(promise, okMessage) {
    try {
      await promise;
      if (okMessage) toast(okMessage);
      return true;
    } catch (err) {
      toast(errorMessage(err));
      return false;
    }
  },
};

// ---------- Rendu ----------

const NAV = [
  ['salle', 'Salle'],
  ['cuisine', 'Cuisine'],
  ['reglages', 'Réglages'],
];

function railHtml() {
  const role = app.role();
  const items = NAV.filter(([v]) => can(role, v));
  const s = sync.status();
  const lbl = sync.label(s);
  const staff = app.staff();
  return `
    <div class="logo" aria-hidden="true">T</div>
    ${items
      .map(([v, label]) => {
        const current = ui.view === v || (v === 'salle' && ui.view === 'commande');
        return `<button class="navbtn" data-act="nav" data-v="${v}"${current ? ' aria-current="page"' : ''}>${icon(v)}<span>${label}</span></button>`;
      })
      .join('')}
    <div class="rail-spacer"></div>
    <button class="sync-dot tone-${lbl.tone}" data-act="syncInfo" aria-label="${esc(lbl.text)} : ${esc(lbl.detail)}" title="${esc(lbl.detail)}">
      ${s.online ? icon('device', 20) : icon('wifiOff', 20)}<span>${esc(lbl.text)}</span>
    </button>
    <button class="navbtn lockbtn" data-act="lock" aria-label="Verrouiller (${esc(staff ? staff.name : '')})">${icon('lock')}<span>Verrouiller</span></button>`;
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;
  if (ui.view !== 'login' && !app.staff()) ui.view = 'login';

  const active = document.activeElement;
  const fid = active && active.id && root.contains(active) ? active.id : null;
  let s1 = null;
  let s2 = null;
  try {
    if (fid && typeof active.selectionStart === 'number') {
      s1 = active.selectionStart;
      s2 = active.selectionEnd;
    }
  } catch (e) {
    /* champ sans sélection */
  }

  const view = VIEWS[ui.view] || VIEWS.salle;
  if (ui.view === 'login') {
    root.className = 'app is-login';
    root.innerHTML = `<main class="login-wrap" id="main">${view.render(app)}</main>`;
  } else {
    root.className = 'app';
    root.innerHTML = `<nav class="rail" aria-label="Navigation principale">${railHtml()}</nav><main class="main" id="main">${view.render(app)}</main>`;
  }

  if (fid && !ui.modal) {
    const el = document.getElementById(fid);
    if (el) {
      el.focus({ preventScroll: true });
      try {
        if (s1 !== null) el.setSelectionRange(s1, s2);
      } catch (e) {
        /* rien */
      }
    }
  }
}

// ---------- Fenêtres (modales) ----------

function findModal(kind) {
  for (const v of Object.values(VIEWS)) if (v.modals && v.modals[kind]) return v.modals[kind];
  return null;
}

function openModal(kind, ctx = {}) {
  const builder = findModal(kind);
  if (!builder) return;
  ui.modal = { kind, ctx };
  const el = document.getElementById('modal');
  el.innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">${builder(ctx, app)}</div></div>`;
  const first = el.querySelector('[autofocus], input:not([type=hidden]), select, textarea, button');
  if (first) first.focus();
}

function closeModal() {
  ui.modal = null;
  const el = document.getElementById('modal');
  if (el) el.innerHTML = '';
}

/** Réaffiche la fenêtre ouverte (après une erreur de saisie, par exemple). */
app.refreshModal = (ctx) => {
  if (!ui.modal) return;
  openModal(ui.modal.kind, { ...ui.modal.ctx, ...ctx });
};

// ---------- Actions ----------

const CORE_ACTIONS = {
  nav: (el) => app.go(el.dataset.v),
  lock: () => app.signOut(),
  syncInfo: () => openModal('syncInfo'),
  closeModal: () => closeModal(),
  modalBack: (el, ev) => {
    if (ev.target === el) closeModal();
  },
};

const CORE_MODALS = {
  syncInfo: () => {
    const s = sync.status();
    const l = sync.label(s);
    return `<h2 id="mtitle">${esc(l.text)}</h2>
      <p class="muted">${esc(l.detail)}</p>
      <ul class="plain-list">
        <li>Connexion internet : <b>${s.online ? 'disponible' : 'coupée'}</b></li>
        <li>Serveur central : <b>${s.serverConnected ? 'connecté' : 'pas encore branché (prévu à l’étape 2)'}</b></li>
        <li>Modifications en attente : <b class="num">${s.pending}</b></li>
        <li>Version : <b>${esc(VERSION)}</b></li>
      </ul>
      <div class="row"><button class="btn gold" data-act="closeModal">Fermer</button></div>`;
  },
};

function findAction(name) {
  if (CORE_ACTIONS[name]) return CORE_ACTIONS[name];
  for (const v of Object.values(VIEWS)) if (v.actions && v.actions[name]) return v.actions[name];
  return null;
}

function findForm(name) {
  for (const v of Object.values(VIEWS)) if (v.forms && v.forms[name]) return v.forms[name];
  return null;
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = findAction(el.dataset.act);
  if (!fn) return;
  if (el.dataset.act !== 'modalBack') ev.preventDefault();
  // Une confirmation en deux appuis n'est valable que pour l'appui suivant.
  ui.prevConfirm = ui.confirm;
  ui.confirm = null;
  const result = await fn(el, ev, app);
  if (result !== false) render();
});

document.addEventListener('input', (ev) => {
  const t = ev.target;
  for (const v of Object.values(VIEWS)) {
    if (v.onInput && v.onInput(t, app)) return;
  }
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target;
  const fn = findForm(form.dataset.form);
  if (!fn) return;
  ev.preventDefault();
  const submit = form.querySelector('[type=submit]');
  if (submit) submit.disabled = true;
  try {
    await fn(new FormData(form), app, form);
  } finally {
    if (submit && document.body.contains(submit)) submit.disabled = false;
  }
  render();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && ui.modal) closeModal();
});

// ---------- Démarrage ----------

export async function boot() {
  VIEWS.core = { modals: CORE_MODALS };
  globalThis.__tchoprovip = app;
  try {
    await store.init();
  } catch (err) {
    document.getElementById('app').innerHTML = `<main class="fatal"><h1>TchoProVip ne peut pas démarrer</h1><p>${esc(errorMessage(err))}</p><p>Essayez avec Google Chrome à jour, hors navigation privée.</p></main>`;
    return;
  }
  sync.start();
  try {
    const saved = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (saved && store.get('staff', saved) && store.get('staff', saved).active !== false) {
      ui.staffId = saved;
      ui.view = homeViewFor(store.get('staff', saved).role);
    }
  } catch (e) {
    /* stockage indisponible */
  }
  store.subscribe(() => render());
  sync.onChange(() => render());
  setInterval(() => {
    if (!ui.modal) render();
  }, 30000);
  render();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* Le mode hors ligne complet nécessite un hébergement HTTPS ; l'app fonctionne quand même. */
  });
}

export { ROLES };
