// Petits outils d'interface partagés par les écrans.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const PATHS = {
  salle: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  cuisine: '<path d="M6 13.9A4 4 0 0 1 7 6a5 5 0 0 1 10 0 4 4 0 0 1 1 7.9V20H6z"/><path d="M6 17h12"/>',
  reglages: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  warn: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  wifiOff: '<path d="M2 8.5a15 15 0 0 1 5-3M22 8.5a15 15 0 0 0-9.5-4.4M5 12a10 10 0 0 1 3.5-2.2M19 12a10 10 0 0 0-2.4-1.7M8.5 15.5a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18"/>',
  device: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
};

export function icon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
}

/** Libellé masqué visuellement, lu par les lecteurs d'écran. */
export function srOnly(text) {
  return `<span class="sr-only">${esc(text)}</span>`;
}

export function field(id, label, input, error) {
  return `<div class="field${error ? ' has-error' : ''}"><label for="${id}">${esc(label)}</label>${input}${error ? `<p class="field-error" id="${id}-err">${esc(error)}</p>` : ''}</div>`;
}

let toastTimer = null;
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

export function errorMessage(err) {
  const msg = err && err.message ? err.message : '';
  if (/quota/i.test(msg)) return 'La mémoire de l’appareil est pleine. Libérez de l’espace, puis réessayez.';
  return msg || 'L’enregistrement n’a pas abouti. Réessayez.';
}
