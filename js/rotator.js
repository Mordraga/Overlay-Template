/* ── ROTATOR: cycles quotes, links, lore, and reminders ──
 * Cards come from the control server (data/crypt-state.json → rotator.items), edited in panel.html.
 * Needs #rot-card, #rot-kicker, #rot-main, #rot-sub on the page.
 * Pick a deck with data-deck: <script src="js/rotator.js" data-deck="rotatorFansly"> (default: rotator).
 *
 * kind: 'quote' (main = the quote, sub = who said it)
 *       'file'  (lore excerpt from the F.E.T.B. dossier; say: true wraps it in quotes)
 *       'card'  (kicker = small gold label, main = headline, sub = small line)
 *       'breach' (raid takeover, shown via CryptRotator.interrupt — not stored in the list)
 * exact: true shows main in a font with lowercase — use for case-sensitive links
 */
(function () {
  var DECK = (document.currentScript && document.currentScript.dataset.deck) || 'rotator';
  var FADE_MS = 800;       // matches .rot-card transition
  var POLL_MS = 10000;     // how often to pick up edits from the panel

  var card = document.getElementById('rot-card');
  var kicker = document.getElementById('rot-kicker');
  var main = document.getElementById('rot-main');
  var sub = document.getElementById('rot-sub');

  var items = [];
  var showMs = 12000;
  var index = -1;
  var timer = null;

  // only one pending step at a time, so an interrupt can cancel the normal cycle
  function schedule(fn, ms) {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  }

  function render(item) {
    var isQuote = item.kind === 'quote';
    var isFile = item.kind === 'file';
    var isBreach = item.kind === 'breach';
    var text = item.main || '';
    card.classList.toggle('quote', isQuote);
    card.classList.toggle('file', isFile);
    card.classList.toggle('breach', isBreach);
    card.classList.toggle('long', (isQuote || isFile) && text.length > 90);
    card.classList.toggle('exact', !!item.exact);
    if (isQuote) kicker.innerHTML = '<span class="sig">⸸ ✦ ⸸</span>';
    else if (isFile) kicker.textContent = '⸸ F.E.T.B. · File GK-0312 ⸸';
    else if (isBreach) kicker.textContent = '⸸ Containment Breach ⸸';
    else {
      kicker.innerHTML = '<span class="sig">⸸</span> ';
      kicker.appendChild(document.createTextNode(item.kicker || ''));
    }
    main.textContent = (isQuote || item.say) ? '“' + text + '”' : text;
    sub.textContent = item.sub || '';
  }

  function renderEmpty() {
    card.classList.remove('quote', 'file', 'breach', 'long', 'exact');
    kicker.innerHTML = '<span class="sig">⸸ ✦ ⸸</span>';
    main.textContent = '';
    sub.textContent = '';
  }

  function next() {
    card.classList.add('hidden');
    schedule(function () {
      if (items.length) {
        index = (index + 1) % items.length;
        render(items[index]);
      } else {
        renderEmpty();
      }
      card.classList.remove('hidden');
      schedule(next, showMs);
    }, FADE_MS);
  }

  // show one card right now for ms, then carry on with the normal cycle
  function interrupt(item, ms) {
    var box = card.parentElement;
    card.classList.add('hidden');
    schedule(function () {
      render(item);
      box.classList.add('alarm');
      card.classList.remove('hidden');
      schedule(function () {
        box.classList.remove('alarm');
        next();
      }, ms);
    }, FADE_MS);
  }

  window.CryptRotator = { interrupt: interrupt };

  function applyState(state) {
    var rot = (state && state[DECK]) || {};
    items = Array.isArray(rot.items) ? rot.items : [];
    showMs = Math.max(3, Number(rot.showSeconds) || 12) * 1000;
  }

  function loadState() {
    return fetch('/api/state').then(function (res) { return res.json(); }).then(applyState);
  }

  // first load starts at a random card
  loadState().catch(function () {}).then(function () {
    index = items.length ? Math.floor(Math.random() * items.length) - 1 : -1;
    next();
  });

  setInterval(function () { loadState().catch(function () {}); }, POLL_MS);
})();
