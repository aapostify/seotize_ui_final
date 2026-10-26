/* SEOTIZE — reliable Cloudflare Turnstile loader for the auth/contact forms.
   Usage: <script defer src="/assets/turnstile.js"></script> plus the usual
   <div class="cf-turnstile" data-sitekey data-callback [data-error-callback] [data-expired-callback]>.
   Renders explicitly once the DOM is ready (no race with the async api.js), retries the
   script if it fails or stalls, and re-renders a widget whose challenge never shows up. */
(function () {
  'use strict';
  const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=seotizeTurnstileReady';
  const fn = name => (name && typeof window[name] === 'function') ? window[name] : null;
  let attempts = 0, watchdog;

  function loadScript() {
    attempts++;
    document.querySelectorAll('script[data-ts-loader]').forEach(s => s.remove());
    const s = document.createElement('script');
    s.src = SRC + (attempts > 1 ? '&_=' + Date.now() : '');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.setAttribute('data-ts-loader', '');
    s.onerror = retryScript;
    document.head.appendChild(s);
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { if (!window.turnstile) retryScript(); }, 8000);
  }
  function retryScript() {
    clearTimeout(watchdog);
    if (window.turnstile || attempts >= 4) return;
    setTimeout(loadScript, 1000 * attempts);
  }

  function renderAll() {
    document.querySelectorAll('.cf-turnstile').forEach(el => {
      if (el.dataset.tsId) return;
      const d = el.dataset, ok = fn(d.callback), onError = fn(d.errorCallback);
      const clear = fn(d.expiredCallback) || onError || (ok ? () => ok('') : null);
      el.dataset.tsId = window.turnstile.render(el, {
        sitekey: d.sitekey,
        theme: d.theme || 'auto',
        size: d.size || 'normal',
        retry: 'auto',
        'refresh-expired': 'auto',
        callback: t => ok && ok(t),
        'expired-callback': () => clear && clear(),
        'timeout-callback': () => clear && clear(),
        'error-callback': e => {
          if (onError) onError(e); else if (clear) clear();
          setTimeout(() => window.turnstile.reset(el.dataset.tsId), 2500);
          return true; // handled: keep the console clean, we retry ourselves
        }
      }) || 'pending';
      // The widget should put something into its box within a few seconds; if not, start it over.
      setTimeout(() => {
        if (el.childElementCount || el.shadowRoot) return;
        try { window.turnstile.remove(el.dataset.tsId); } catch (e) {}
        delete el.dataset.tsId;
        el.innerHTML = '';
        renderAll();
      }, 10000);
    });
  }

  window.seotizeTurnstileReady = function () {
    clearTimeout(watchdog);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderAll);
    else renderAll();
  };

  if (window.turnstile) window.seotizeTurnstileReady(); else loadScript();
})();
