// Écran de connexion par code PIN à 4 chiffres.

import { esc, icon } from '../ui.js';
import { ROLES } from '../domain.js';
import { DEMO_PINS } from '../seed.js';

let pin = '';
let error = '';
let busy = false;

export function render(app) {
  const r = app.store.restaurant();
  const dots = [0, 1, 2, 3].map((i) => `<span class="pin-dot${i < pin.length ? ' on' : ''}"></span>`).join('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return `
  <section class="login" aria-labelledby="login-title">
    <div class="login-brand">
      <div class="logo big" aria-hidden="true">T</div>
      <p class="eyebrow">TchoProVip</p>
      <h1 id="login-title">${esc(r.name)}</h1>
      <p class="muted">Saisissez votre code à 4 chiffres</p>
    </div>
    <div class="pin-dots" aria-live="polite" aria-label="${pin.length} chiffre(s) saisi(s) sur 4">${dots}</div>
    <p class="pin-error" role="alert">${esc(error)}</p>
    <div class="pinpad" role="group" aria-label="Clavier du code">
      ${keys
        .map((k) => {
          if (k === 'del') return `<button class="pinkey ghost" data-act="pinDel" aria-label="Effacer le dernier chiffre">${icon('back', 26)}</button>`;
          if (k === 'ok') return `<button class="pinkey ghost" data-act="pinClear" aria-label="Tout effacer">${icon('close', 24)}</button>`;
          return `<button class="pinkey" data-act="pinKey" data-k="${k}">${k}</button>`;
        })
        .join('')}
    </div>
    ${
      r.demo
        ? `<div class="demo-hint"><p class="label">Codes de démonstration</p>
           <div class="demo-codes">${Object.entries(DEMO_PINS)
             .map(([role, code]) => `<button class="chip" data-act="pinFill" data-k="${code}">${ROLES[role]} · <b class="num">${code}</b></button>`)
             .join('')}</div></div>`
        : ''
    }
  </section>`;
}

async function tryLogin(app) {
  if (pin.length < 4 || busy) return;
  busy = true;
  const staff = await app.store.findStaffByPin(pin);
  busy = false;
  if (staff) {
    pin = '';
    error = '';
    app.signIn(staff);
  } else {
    pin = '';
    error = 'Code inconnu. Réessayez ou demandez votre code au gérant.';
    app.render();
  }
}

export const actions = {
  pinKey: async (el, ev, app) => {
    if (pin.length >= 4) return false;
    pin += el.dataset.k;
    error = '';
    if (pin.length === 4) {
      app.render();
      await tryLogin(app);
      return false;
    }
  },
  pinDel: () => {
    pin = pin.slice(0, -1);
  },
  pinClear: () => {
    pin = '';
    error = '';
  },
  pinFill: async (el, ev, app) => {
    pin = el.dataset.k;
    error = '';
    await tryLogin(app);
    return false;
  },
};

// Saisie au clavier physique (ordinateur ou clavier Bluetooth).
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (ev) => {
    const app = globalThis.__tchoprovip;
    if (!app || app.ui.view !== 'login' || app.ui.modal) return;
    if (/^\d$/.test(ev.key) && pin.length < 4) {
      pin += ev.key;
      error = '';
      app.render();
      if (pin.length === 4) tryLogin(app);
    } else if (ev.key === 'Backspace') {
      pin = pin.slice(0, -1);
      app.render();
    }
  });
}
