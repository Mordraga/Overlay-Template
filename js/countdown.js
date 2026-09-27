/* ── COUNTDOWN: timer started from the control panel ──
 * <script src="js/countdown.js" data-key="startingSoon"></script>
 * data-key picks the section of data/crypt-state.json: startingSoon, intermission, ending,
 * fanslyStartingSoon or fanslyEnding.
 * Needs #countdown, #dots and #message on the page.
 */
(function () {
  var POLL_MS = 2000;
  var KEY = document.currentScript.dataset.key;
  var DEFAULT_DONE = { startingSoon: 'The Crypt is opening', intermission: 'Returning to the crypt', ending: 'Filed — Sigma-4', fanslyStartingSoon: 'The rite begins', fanslyEnding: 'The rite is complete' };

  var countdown = document.getElementById('countdown');
  var dots = document.getElementById('dots');
  var message = document.getElementById('message');
  var timer = {};

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function tick() {
    var endsAt = Number(timer.endsAt) || 0;
    countdown.classList.toggle('hide', !endsAt);
    dots.classList.toggle('hide', !!endsAt);
    if (!endsAt) return;

    var left = Math.ceil((endsAt - Date.now()) / 1000);
    if (left > 0) {
      countdown.classList.remove('done');
      var h = Math.floor(left / 3600);
      var m = Math.floor(left % 3600 / 60);
      var s = left % 60;
      countdown.textContent = (h ? h + ':' + pad(m) : m) + ':' + pad(s);
    } else {
      countdown.classList.add('done');
      countdown.textContent = timer.doneText || DEFAULT_DONE[KEY] || '';
    }
  }

  function loadState() {
    fetch('/api/state').then(function (res) { return res.json(); }).then(function (state) {
      timer = state[KEY] || {};
      message.textContent = timer.message || '';
      tick();
    }).catch(function () {});
  }

  loadState();
  setInterval(loadState, POLL_MS);
  setInterval(tick, 250);
})();
