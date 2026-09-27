/* ── PANEL COMMON: shared by every control panel page ──
 * Helpers (CryptPanel.$, setStatus, post, load, pad), the navigation bar,
 * click-to-fold sections (remembered in this browser only), and the Twitch token check
 * (banner a week before it expires; pages can listen for the 'crypt-token' event).
 * Pages put <nav id="panel-nav"></nav> under their header.
 */
(function () {
  var PAGES = [
    ['panel.html', 'Home'],
    ['panel-timers.html', 'Timers'],
    ['panel-counter.html', 'Counter'],
    ['panel-faces.html', 'Face Workshop'],
    ['panel-cards.html', 'Cards'],
    ['panel-collab.html', 'Collab'],
    ['panel-test.html', 'Test']
  ];

  var P = window.CryptPanel = { state: {} };

  P.$ = function (id) { return document.getElementById(id); };

  P.setStatus = function (el, text, cls) {
    if (typeof el === 'string') el = P.$(el);
    el.textContent = text;
    el.className = 'status' + (cls ? ' ' + cls : '');
  };

  // replace top-level sections of the saved state; resolves with the whole new state
  P.post = function (update) {
    return fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (newState) {
      P.state = newState;
      return newState;
    });
  };

  P.load = function () {
    return fetch('/api/state').then(function (res) { return res.json(); }).then(function (s) {
      P.state = s;
      return s;
    });
  };

  P.pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ── NAVIGATION ── */
  var nav = P.$('panel-nav');
  if (nav) {
    var here = location.pathname.split('/').pop() || 'panel.html';
    PAGES.forEach(function (page) {
      var a = document.createElement('a');
      a.href = page[0];
      a.textContent = page[1];
      if (page[0] === here) a.className = 'active';
      nav.appendChild(a);
    });
  }

  /* ── TWITCH TOKEN CHECK ── */
  var WARN_DAYS = 7;
  var CHECK_MS = 30 * 60000;

  function banner(text) {
    var el = P.$('token-banner');
    if (!text) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'token-banner';
      el.className = 'token-banner';
      var after = nav || document.querySelector('header');
      after.parentNode.insertBefore(el, after.nextSibling);
    }
    el.textContent = text;
  }

  function reportToken(t) {
    P.token = t;
    if (t.state === 'expired') {
      banner('⸸ Twitch token expired: the goal bars and follower stats are off until you get a new one (steps in config/twitch-config.example.js).');
    } else if (t.state === 'missing') {
      banner('⸸ No Twitch token set: add one to config/twitch-config.js for the goal bars and follower stats.');
    } else if (t.state === 'ok' && t.days <= WARN_DAYS) {
      banner('⸸ Twitch token expires in ' + t.days + (t.days === 1 ? ' day' : ' days') + ': renew it before it cuts out mid-stream (steps in config/twitch-config.example.js).');
    } else {
      banner(null);
    }
    document.dispatchEvent(new CustomEvent('crypt-token', { detail: t }));
  }

  function checkToken() {
    var cfg = window.TWITCH_CONFIG || {};
    if (!cfg.token) { reportToken({ state: 'missing' }); return; }
    // the token only ever goes to Twitch itself
    fetch('https://id.twitch.tv/oauth2/validate', { headers: { 'Authorization': 'OAuth ' + cfg.token } })
      .then(function (res) {
        if (res.status === 401) return { state: 'expired' };
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json().then(function (d) {
          return { state: 'ok', days: Math.floor(d.expires_in / 86400), login: d.login };
        });
      })
      .then(reportToken)
      .catch(function () { reportToken({ state: 'unknown' }); });
  }

  var cfgScript = document.createElement('script');
  cfgScript.src = 'config/twitch-config.js';
  cfgScript.onload = checkToken;
  cfgScript.onerror = function () { reportToken({ state: 'missing' }); };
  document.head.appendChild(cfgScript);
  setInterval(checkToken, CHECK_MS);

  /* ── FOLDING SECTIONS ── */
  var FOLD_KEY = 'crypt-panel-folded';
  var sections = Array.prototype.slice.call(document.querySelectorAll('section'));

  function sectionKey(sec) { return sec.id || sec.querySelector('h2').textContent.trim(); }

  function loadFolded() {
    try { return JSON.parse(localStorage.getItem(FOLD_KEY)) || []; } catch (e) { return []; }
  }

  function saveFolded() {
    // keep other pages' folded sections; only update this page's
    var mine = sections.map(sectionKey);
    var folded = loadFolded().filter(function (key) { return mine.indexOf(key) === -1; });
    sections.forEach(function (sec) {
      if (sec.classList.contains('collapsed')) folded.push(sectionKey(sec));
    });
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(folded)); } catch (e) {}
  }

  var folded = loadFolded();
  sections.forEach(function (sec) {
    var h2 = sec.querySelector('h2');
    if (!h2) return;
    if (folded.indexOf(sectionKey(sec)) !== -1) sec.classList.add('collapsed');
    h2.addEventListener('click', function () {
      sec.classList.toggle('collapsed');
      saveFolded();
    });
  });
})();
