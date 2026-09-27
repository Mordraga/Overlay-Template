/* ── EFFECTS: familiar manifestation, technical distortion, containment breach ──
 * Triggered from layout.html: the chat script calls CryptFx.* on raids and god mentions,
 * the stats script calls CryptFx.manifest on new followers.
 */
(function () {
  var DISTORT_MS = 1400;             // matches the .distort animations
  var DISTORT_COOLDOWN_MS = 20000;   // chat spamming god names won't strobe the overlay
  var BREACH_MS = 20000;             // how long a raid takes over the rotator box
  var RANDOM_MANIFEST_MIN = 20;      // random familiar sightings, in minutes
  var RANDOM_MANIFEST_MAX = 45;

  /* ── TECHNICAL DISTORTION ──
   * "Effect is stronger when she is discussing the Egyptian gods." */
  var GODS = /\b(Sutekh|Seth|Thoth|Djehuty|Anubis|Anpu|Horus|Osiris|Isis|Astarte|Hathor|Sekhmet|Bastet|Apep|Apophis|Nephthys|Ptah|Amun|Ma'?at)\b/i;
  // "Set" only counts capitalised and mid-sentence, so "set up the game" doesn't trigger it
  var SET = /\S\s+Set\b/;

  function mentionsGod(text) {
    return GODS.test(text) || SET.test(text);
  }

  var lastDistort = 0;

  // force skips the cooldown (used by the panel's Test page)
  function distort(chatRow, force) {
    if (chatRow) chatRow.classList.add('glitched');
    var now = Date.now();
    if (!force && now - lastDistort < DISTORT_COOLDOWN_MS) return;
    lastDistort = now;
    document.body.classList.remove('distort');
    void document.body.offsetWidth; // restart the animation
    document.body.classList.add('distort');
    setTimeout(function () { document.body.classList.remove('distort'); }, DISTORT_MS);
  }

  /* ── FAMILIAR MANIFESTATION ──
   * "Genetic analysis of all physical instances returns Ambystoma mexicanum DNA." */
  var AXOLOTL =
    '<svg viewBox="0 0 72 44" width="96" height="59" aria-hidden="true">' +
      // tail
      '<path d="M50 22 Q64 14 71 21 Q64 30 50 30 Z" fill="#e98fb0"/>' +
      // back legs
      '<rect class="leg leg-b" x="40" y="29" width="5" height="9" rx="2.5" fill="#e98fb0"/>' +
      '<rect class="leg leg-a" x="46" y="29" width="5" height="9" rx="2.5" fill="#f2a7c3"/>' +
      // body
      '<ellipse cx="38" cy="26" rx="16" ry="8.5" fill="#f2a7c3"/>' +
      // front legs
      '<rect class="leg leg-a" x="24" y="29" width="5" height="9" rx="2.5" fill="#e98fb0"/>' +
      '<rect class="leg leg-b" x="30" y="29" width="5" height="9" rx="2.5" fill="#f2a7c3"/>' +
      // gills
      '<g stroke="#d9577f" stroke-width="2.6" stroke-linecap="round" fill="none">' +
        '<path d="M22 13 Q25 7 30 5"/><path d="M24 16 Q29 11 34 11"/><path d="M24 20 Q30 18 34 19"/>' +
        '<path d="M22 27 Q27 31 31 34"/>' +
      '</g>' +
      // head
      '<ellipse cx="16" cy="21" rx="12" ry="9.5" fill="#f5b4cc"/>' +
      '<circle cx="11" cy="18.5" r="1.8" fill="#2a1f2a"/>' +
      '<path d="M7 24 Q10 26.5 13 24" stroke="#b8466c" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  var walking = false;

  function manifest(forName) {
    if (walking) return;
    walking = true;

    var familiar = document.createElement('div');
    familiar.className = 'familiar';
    familiar.innerHTML = '<div class="familiar-body">' + AXOLOTL + '</div>';

    if (forName) {
      var tag = document.createElement('div');
      tag.className = 'familiar-tag';
      tag.textContent = 'manifested for ' + forName;
      familiar.appendChild(tag);
    }

    familiar.addEventListener('animationend', function (e) {
      if (e.target !== familiar) return;
      familiar.remove();
      walking = false;
    });

    document.body.appendChild(familiar);
  }

  function scheduleRandomManifest() {
    var minutes = RANDOM_MANIFEST_MIN + Math.random() * (RANDOM_MANIFEST_MAX - RANDOM_MANIFEST_MIN);
    setTimeout(function () {
      manifest();
      scheduleRandomManifest();
    }, minutes * 60000);
  }

  /* ── CONTAINMENT BREACH (raids) ── */
  function breach(raider, viewers) {
    var count = Number(viewers) || 0;
    if (window.CryptRotator) {
      window.CryptRotator.interrupt({
        kind: 'breach',
        main: count + (count === 1 ? ' soul' : ' souls') + ' inbound',
        sub: 'entering Site-0312 · led by ' + raider
      }, BREACH_MS);
    }
    distort();
  }

  scheduleRandomManifest();

  window.CryptFx = {
    mentionsGod: mentionsGod,
    distort: distort,
    manifest: manifest,
    breach: breach
  };
})();
