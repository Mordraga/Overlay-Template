/* ── MAI: mood face, read from Mai's monitor via the control server (/api/mai) ──
 * Put <div id="mai-face"></div> where the live face should go.
 * Shows only the expression — never the mood name — so nothing spicy is written on stream.
 * Moods without a face fall back to neutral. Faces built in the panel's Face Workshop
 * (data/crypt-state.json → maiFaces) override the built-in face for that mood.
 *
 * Mai is a 4D entity; what shows on stream is only the slice of her that passes through our space
 * (see: the Sphere in Flatland). Behind her face, a tesseract rotates in four dimensions.
 * Her colour is indigo (her control panel's accent), framed in the host's gold-and-red seal.
 *
 * Also usable from other pages: MaiFace.create(el) → { setMood, snapshot }.
 */
(function () {
  var POLL_MS = 3000;
  var FACES_POLL_MS = 10000;
  var BUILT_IN = ['neutral', 'quiet', 'flirty', 'spicy', 'aroused', 'curious', 'chaotic', 'eldritch', 'somber', 'asleep'];

  // how fast the tesseract turns in each mood
  var SPIN = {
    neutral: 1, quiet: 0.4, flirty: 1.2, spicy: 2.2, aroused: 1.6,
    curious: 1.3, chaotic: 2.6, eldritch: 3.2, somber: 0.3, asleep: 0.08
  };

  // heart centred on 0,0, about 20 wide
  var HEART = 'M0 6 C-4 3 -10 -1 -10 -5 C-10 -9 -4 -11 0 -6 C4 -11 10 -9 10 -5 C10 -1 4 3 0 6 Z';

  // almond eye centred on cx, 16 wide
  function almond(cx) {
    return 'M' + (cx - 8) + ' 50 Q' + cx + ' 41.5 ' + (cx + 8) + ' 50 Q' + cx + ' 58.5 ' + (cx - 8) + ' 50 Z';
  }
  function slit(cx) {
    return '<ellipse class="pupil" cx="' + cx + '" cy="50" rx="1.5" ry="4.4"/>';
  }
  function diamond(x, y) {
    return '<path class="seal-mark" d="M' + x + ' ' + (y - 3) + ' L' + (x + 2) + ' ' + y + ' L' + x + ' ' + (y + 3) + ' L' + (x - 2) + ' ' + y + ' Z"/>';
  }

  function faceSvg(clipId) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<defs><clipPath id="' + clipId + '"><circle cx="50" cy="50" r="43"/></clipPath></defs>' +

      // the seal: the host's frame
      '<circle class="seal-bg" cx="50" cy="50" r="47"/>' +
      '<g class="tesseract" clip-path="url(#' + clipId + ')"></g>' +
      '<circle class="seal-ring" cx="50" cy="50" r="45.5"/>' +
      '<circle class="seal-ticks" cx="50" cy="50" r="42"/>' +
      diamond(50, 4.5) + diamond(95.5, 50) + diamond(4.5, 50) +
      '<path class="seal-dagger" d="M50 91 V99 M47.2 93.6 H52.8"/>' +

      // the cross-section of her that's in our space
      '<circle class="mai-disc" cx="50" cy="50" r="28"/>' +

      // third eye: opens now and then
      '<g class="third"><path d="M50 27 Q55 33 50 39 Q45 33 50 27 Z"/><ellipse class="pupil third-pupil" cx="50" cy="33" rx="0.9" ry="3.4"/></g>' +

      // .gaze moves all the eyes when she glances around; .blink squashes them shut
      '<g class="gaze">' +

        // neutral: almond eyes, slit pupils
        '<g class="eyes eyes-neutral"><g class="blink">' +
          '<path d="' + almond(38) + '"/>' + slit(38) + '<path d="' + almond(62) + '"/>' + slit(62) +
        '</g></g>' +

        // quiet: half-lidded
        '<g class="eyes eyes-quiet"><g class="blink">' +
          '<path d="M30 50 Q38 56.5 46 50 Z"/><path d="M54 50 Q62 56.5 70 50 Z"/>' +
          '<circle class="pupil" cx="38" cy="51.8" r="1.5"/><circle class="pupil" cx="62" cy="51.8" r="1.5"/>' +
          '<path class="lid" d="M29 50 H47 M53 50 H71"/>' +
        '</g></g>' +

        // flirty: wink + little heart
        '<g class="eyes eyes-flirty">' +
          '<g class="blink"><path d="' + almond(38) + '"/>' + slit(38) + '</g>' +
          '<path class="lid" d="M54 51 Q62 44 70 51"/>' +
          '<path class="heart" transform="translate(64 64) scale(0.42)" d="' + HEART + '"/>' +
        '</g>' +

        // spicy: sultry — heavy lids, sidelong look, lopsided smirk
        '<g class="eyes eyes-spicy">' +
          '<g class="blink">' +
            '<path d="M30 51 Q38 46 46 50 Q38 57 30 51 Z"/><path d="M54 50 Q62 46 70 51 Q62 57 54 50 Z"/>' +
            '<ellipse class="pupil" cx="41.5" cy="51.5" rx="1.4" ry="3.2"/><ellipse class="pupil" cx="65.5" cy="51.5" rx="1.4" ry="3.2"/>' +
            '<path class="lid" d="M29 48.5 Q38 44 47 48.5 M53 48.5 Q62 44 71 48.5"/>' +
          '</g>' +
          '<path class="lid thin" d="M42 65 Q50 68.5 58 63"/>' +
        '</g>' +

        // curious: wide eyes, big pupils, one eye a bit bigger
        '<g class="eyes eyes-curious"><g class="blink">' +
          '<ellipse cx="38" cy="50.5" rx="8" ry="9"/><ellipse cx="62" cy="49.5" rx="9.5" ry="10.5"/>' +
          '<circle class="pupil" cx="38.5" cy="51" r="3.6"/><circle class="pupil" cx="62.5" cy="50" r="4.2"/>' +
          '<circle cx="40" cy="49.3" r="1.1"/><circle cx="64.3" cy="48" r="1.3"/>' +
        '</g></g>' +

        // chaotic: gleeful ^ ^ eyes, grin with one fang
        '<g class="eyes eyes-chaotic">' +
          '<path class="lid" d="M30 53 Q38 42 46 53 M54 53 Q62 42 70 53"/>' +
          '<path class="mouth" d="M38 60 Q50 72 62 60 Z"/>' +
          '<path d="M44.5 60.8 L46.3 65.5 L48.1 61.4 Z"/>' +
        '</g>' +

        // eldritch: void eyes with pinprick pupils (third eye stays open)
        '<g class="eyes eyes-eldritch"><g class="blink">' +
          '<circle class="void" cx="38" cy="50" r="8"/><circle class="void" cx="62" cy="50" r="8"/>' +
          '<circle cx="38" cy="50" r="1.2"/><circle cx="62" cy="50" r="1.2"/>' +
        '</g></g>' +

        // somber: downcast eyes, a single tear
        '<g class="eyes eyes-somber">' +
          '<g class="blink">' +
            '<path d="M30 50 Q38 57.5 46 50 Z"/><path d="M54 50 Q62 57.5 70 50 Z"/>' +
            '<circle class="pupil" cx="38" cy="53.2" r="1.6"/><circle class="pupil" cx="62" cy="53.2" r="1.6"/>' +
            '<path class="lid" d="M29 47.5 Q38 46.5 46.5 50 M53.5 50 Q62 46.5 71 47.5"/>' +
          '</g>' +
          '<path class="tear" d="M44 57 Q46.2 61 44 63 Q41.8 61 44 57 Z"/>' +
        '</g>' +

        // aroused: heart eyes + blush
        '<g class="eyes eyes-aroused">' +
          '<ellipse class="blush" cx="32" cy="61" rx="6" ry="3"/><ellipse class="blush" cx="68" cy="61" rx="6" ry="3"/>' +
          '<g class="blink">' +
            '<path transform="translate(38 50) scale(0.8)" d="' + HEART + '"/>' +
            '<path transform="translate(62 50) scale(0.8)" d="' + HEART + '"/>' +
          '</g>' +
        '</g>' +

        // asleep: Mai isn't running
        '<g class="eyes eyes-asleep">' +
          '<path class="lid" d="M30 50 Q38 56 46 50 M54 50 Q62 56 70 50"/>' +
          '<text x="66" y="36">z</text>' +
        '</g>' +

        // custom: built in the Face Workshop (filled by buildCustom)
        '<g class="eyes eyes-custom"></g>' +
      '</g>' +
    '</svg>';
  }

  /* ── CUSTOM FACES (Face Workshop) ──
   * Everything is in the 100×100 face space; eyes sit either side of x = 50. */
  var DEFAULT_SPEC = {
    eyeStyle: 'fill',     // fill | line | void
    eyeWidth: 8,          // half-width of each eye
    eyeTop: 8.5,          // how far the top edge bulges up (negative curves down)
    eyeBottom: 8.5,       // how far the bottom edge bulges down (negative curves up)
    eyeGap: 12,           // distance of each eye from the centre
    eyeY: 50,
    eyeTilt: 0,           // + = inner corners down (fierce), − = inner corners up (sad)
    lid: false,           // heavy lid line over each eye
    pupil: 'slit',        // none | dot | round | slit | pinprick
    pupilSize: 1,
    pupilX: 0,
    pupilY: 0,
    mouth: 'none',        // none | line | open
    mouthWidth: 8,
    mouthCurve: 3,        // + = smile, − = frown
    mouthSkew: 0,         // raises/lowers the right corner for a smirk
    mouthOpen: 4,
    mouthY: 63,
    fang: false,
    blush: false,
    tear: false,
    heart: false,
    third: 'random',      // hidden | random | open
    blink: true,
    glance: true,
    ring: '#818cf8',
    disc: '#231f4d',
    spin: 1
  };

  function num(v, fallback) {
    v = Number(v);
    return isFinite(v) ? v : fallback;
  }

  function fullSpec(spec) {
    var out = {};
    Object.keys(DEFAULT_SPEC).forEach(function (k) {
      out[k] = spec && spec[k] !== undefined ? spec[k] : DEFAULT_SPEC[k];
    });
    return out;
  }

  function f(n) { return (Math.round(n * 100) / 100).toString(); }

  function customEye(s, side) {
    var cx = 50 + side * num(s.eyeGap, 12);
    var cy = num(s.eyeY, 50);
    var w = num(s.eyeWidth, 8);
    var top = num(s.eyeTop, 8.5);
    var bottom = num(s.eyeBottom, 8.5);
    // quadratic control points sit twice as far out as the curve's peak
    var topPath = 'M' + f(cx - w) + ' ' + f(cy) + ' Q' + f(cx) + ' ' + f(cy - top * 2) + ' ' + f(cx + w) + ' ' + f(cy);
    var tilt = num(s.eyeTilt, 0) * side;
    var out = '<g transform="rotate(' + f(tilt) + ' ' + f(cx) + ' ' + f(cy) + ')">';

    if (s.eyeStyle === 'line') {
      out += '<path class="lid" d="' + topPath + '"/>';
    } else {
      var shape = topPath + ' Q' + f(cx) + ' ' + f(cy + bottom * 2) + ' ' + f(cx - w) + ' ' + f(cy) + ' Z';
      out += '<path' + (s.eyeStyle === 'void' ? ' class="void"' : '') + ' d="' + shape + '"/>';

      var px = cx + num(s.pupilX, 0);
      var py = cy + num(s.pupilY, 0);
      var k = num(s.pupilSize, 1);
      var pupilClass = s.eyeStyle === 'void' ? '' : ' class="pupil"';
      if (s.pupil === 'dot') out += '<circle' + pupilClass + ' cx="' + f(px) + '" cy="' + f(py) + '" r="' + f(1.6 * k) + '"/>';
      if (s.pupil === 'round') out += '<circle' + pupilClass + ' cx="' + f(px) + '" cy="' + f(py) + '" r="' + f(3.6 * k) + '"/>';
      if (s.pupil === 'slit') out += '<ellipse' + pupilClass + ' cx="' + f(px) + '" cy="' + f(py) + '" rx="' + f(1.5 * k) + '" ry="' + f(4.4 * k) + '"/>';
      if (s.pupil === 'pinprick') out += '<circle cx="' + f(px) + '" cy="' + f(py) + '" r="' + f(1.2 * k) + '"/>';

      if (s.lid) {
        out += '<path class="lid" d="M' + f(cx - w - 1) + ' ' + f(cy - 1.5) + ' Q' + f(cx) + ' ' + f(cy - top * 2 - 1.5) + ' ' + f(cx + w + 1) + ' ' + f(cy - 1.5) + '"/>';
      }
    }
    return out + '</g>';
  }

  function customMouth(s) {
    if (s.mouth === 'none') return '';
    var w = num(s.mouthWidth, 8);
    var y = num(s.mouthY, 63);
    var curve = num(s.mouthCurve, 3);
    var skew = num(s.mouthSkew, 0);
    var left = f(50 - w) + ' ' + f(y);
    var right = f(50 + w) + ' ' + f(y - skew);
    if (s.mouth === 'line') {
      return '<path class="lid thin" d="M' + left + ' Q50 ' + f(y + curve * 2) + ' ' + right + '"/>';
    }
    var open = num(s.mouthOpen, 4);
    var out = '<path class="mouth" d="M' + left + ' Q50 ' + f(y + curve) + ' ' + right +
      ' Q50 ' + f(y + curve * 2 + open * 2) + ' ' + left + ' Z"/>';
    if (s.fang) {
      var fx = 50 - w * 0.4;
      out += '<path d="M' + f(fx - 1.8) + ' ' + f(y + 0.6) + ' L' + f(fx) + ' ' + f(y + 5.2) + ' L' + f(fx + 1.8) + ' ' + f(y + 1) + ' Z"/>';
    }
    return out;
  }

  function buildCustom(spec) {
    var s = fullSpec(spec);
    var eyes = customEye(s, -1) + customEye(s, 1);
    var out = '';
    if (s.blush) out += '<ellipse class="blush" cx="32" cy="61" rx="6" ry="3"/><ellipse class="blush" cx="68" cy="61" rx="6" ry="3"/>';
    out += s.blink && s.eyeStyle !== 'line' ? '<g class="blink">' + eyes + '</g>' : eyes;
    out += customMouth(s);
    if (s.heart) out += '<path class="heart" transform="translate(64 64) scale(0.42)" d="' + HEART + '"/>';
    if (s.tear) out += '<path class="tear" d="M44 57 Q46.2 61 44 63 Q41.8 61 44 57 Z"/>';
    return out;
  }

  var CSS =
    // the page sizes the container; the face fills it
    '.mai-face { --mai: #818cf8; --disc: #231f4d; }' +
    '.mai-face svg { width: 100%; height: 100%; display: block; overflow: visible; }' +

    // seal
    '.seal-bg { fill: #0b090d; }' +
    '.seal-ring { fill: none; stroke: #8a6e2e; stroke-width: 1.2; }' +
    '.seal-ticks { fill: none; stroke: #c9a84c; stroke-width: 1.4; stroke-dasharray: 0.8 5.8; opacity: 0.7;' +
    ' transform-origin: 50px 50px; animation: maiSeal 60s linear infinite; }' +
    '@keyframes maiSeal { to { transform: rotate(360deg); } }' +
    '.seal-mark { fill: #c9a84c; }' +
    '.seal-dagger { stroke: #8b1a1a; stroke-width: 1.6; stroke-linecap: round; fill: none; }' +
    '.tesseract line { stroke: var(--mai); stroke-width: 0.8; opacity: 0.4; transition: stroke 0.6s; }' +

    // the cross-section breathes, like the Sphere passing through Flatland
    '.mai-disc { fill: var(--disc); fill-opacity: 0.86; stroke: var(--mai); stroke-width: 1.6; transition: fill 0.6s, stroke 0.6s; animation: maiBreathe 6s ease-in-out infinite; }' +
    '@keyframes maiBreathe { 0%, 100% { r: 27; } 50% { r: 29.5; } }' +

    // eyes
    '.mai-face .eyes { display: none; fill: #f4ecf4; }' +
    '.mai-face .pupil { fill: #140f1c; }' +
    '.mai-face .pupil-line { stroke: #140f1c; stroke-width: 1.4; stroke-linecap: round; }' +
    '.mai-face .lid { fill: none; stroke: #f4ecf4; stroke-width: 2.6; stroke-linecap: round; }' +
    '.mai-face .heart { fill: #ff9fc0; }' +
    '.mai-face .lid.thin { stroke-width: 1.8; }' +
    '.mai-face .mouth { fill: #140f1c; stroke: #f4ecf4; stroke-width: 1.6; stroke-linejoin: round; }' +
    '.mai-face .void { fill: #05040a; stroke: var(--mai); stroke-width: 1.4; }' +
    '.mai-face .tear { fill: #a5b4fc; opacity: 0; animation: maiTear 5s ease-in infinite; }' +
    '@keyframes maiTear { 0%, 30% { opacity: 0; transform: translateY(0); } 45% { opacity: 0.85; }' +
    ' 90% { opacity: 0.6; transform: translateY(9px); } 100% { opacity: 0; transform: translateY(11px); } }' +
    '.mai-face .blush { fill: #ff7fa8; opacity: 0.5; }' +
    '.mai-face text { fill: #7a6d7a; font-family: Cinzel, serif; font-size: 12px; animation: maiZ 3s ease-in-out infinite; }' +
    '@keyframes maiZ { 0%, 100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 0.9; transform: translateY(-3px); } }' +

    '.blink { transform-box: fill-box; transform-origin: center; transition: transform 0.06s ease-in; }' +
    '.mai-face.blinking .blink { transform: scaleY(0.1); }' +
    '.gaze { transition: transform 0.35s ease-out; }' +
    '.mai-face.look-left .gaze { transform: translateX(-3.5px); }' +
    '.mai-face.look-right .gaze { transform: translateX(3.5px); }' +
    '.mai-face.look-down .gaze { transform: translateY(3px); }' +

    // third eye
    '.third { fill: #f4ecf4; transform-box: fill-box; transform-origin: center; transform: scaleY(0);' +
    ' transition: transform 0.35s ease-in-out; filter: drop-shadow(0 0 2px #8b1a1a); }' +
    '.third-pupil { fill: #8b1a1a; }' +
    '.mai-face.third-open .third, .mai-face[data-third=open] .third { transform: scaleY(1); }' +
    '.mai-face[data-third=hidden] .third { display: none; }' +

    // one face + colours per mood
    '.mai-face[data-mood=neutral] .eyes-neutral, .mai-face[data-mood=quiet] .eyes-quiet,' +
    '.mai-face[data-mood=flirty] .eyes-flirty, .mai-face[data-mood=spicy] .eyes-spicy,' +
    '.mai-face[data-mood=aroused] .eyes-aroused, .mai-face[data-mood=asleep] .eyes-asleep,' +
    '.mai-face[data-mood=curious] .eyes-curious, .mai-face[data-mood=chaotic] .eyes-chaotic,' +
    '.mai-face[data-mood=eldritch] .eyes-eldritch, .mai-face[data-mood=somber] .eyes-somber,' +
    '.mai-face[data-mood=custom] .eyes-custom { display: block; }' +
    '.mai-face[data-mood=neutral]  { --mai: #818cf8; --disc: #231f4d; }' +
    '.mai-face[data-mood=quiet]    { --mai: #5b5fa8; --disc: #1a1830; }' +
    '.mai-face[data-mood=flirty]   { --mai: #e28ab5; --disc: #4e1f3c; }' +
    '.mai-face[data-mood=spicy]    { --mai: #d24a3a; --disc: #4a0e0e; }' +
    '.mai-face[data-mood=aroused]  { --mai: #ff9fc0; --disc: #6a1a37; }' +
    '.mai-face[data-mood=curious]  { --mai: #7dd3fc; --disc: #14304a; }' +
    '.mai-face[data-mood=chaotic]  { --mai: #f59e0b; --disc: #3b2208; }' +
    '.mai-face[data-mood=eldritch] { --mai: #a78bfa; --disc: #0e0a1f; }' +
    '.mai-face[data-mood=somber]   { --mai: #94a3b8; --disc: #1a1f29; }' +
    '.mai-face[data-mood=eldritch] .third { transform: scaleY(1); }' +
    '.mai-face[data-mood=asleep]   { --mai: #3a2a3a; --disc: #120e14; }' +
    '.mai-face[data-mood=asleep] .mai-disc, .mai-face[data-mood=asleep] .seal-ticks { animation-play-state: paused; }' +

    // static flicker when the mood changes
    '.mai-face.switching svg { animation: maiStatic 0.5s steps(1); }' +
    '@keyframes maiStatic { 0% { opacity: 0.3; transform: translateX(-2px); } 25% { opacity: 1; transform: none; }' +
    ' 50% { opacity: 0.5; transform: translateX(2px); } 75%, 100% { opacity: 1; transform: none; } }' +

    // frozen copies (chat snapshots)
    '.mai-snap *, .mai-snap svg { animation: none !important; transition: none !important; }';

  var cssInjected = false;
  function injectCss() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ── TESSERACT: 4D hypercube, rotated in four dimensions and projected down to 2D ── */
  var VERTS = [];
  for (var i = 0; i < 16; i++) {
    VERTS.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  }
  // edges join vertices that differ in exactly one coordinate
  var EDGES = [];
  for (var a = 0; a < 16; a++) {
    for (var bit = 1; bit < 16; bit <<= 1) {
      if (!(a & bit)) EDGES.push([a, a | bit]);
    }
  }

  function project(v, angle) {
    var x = v[0], y = v[1], z = v[2], w = v[3];
    var t;
    // rotate in the XW and ZW planes (the ones we can't see) plus a slow YZ turn
    var c1 = Math.cos(angle), s1 = Math.sin(angle);
    t = x * c1 - w * s1; w = x * s1 + w * c1; x = t;
    var c2 = Math.cos(angle * 0.7), s2 = Math.sin(angle * 0.7);
    t = z * c2 - w * s2; w = z * s2 + w * c2; z = t;
    var c3 = Math.cos(angle * 0.3), s3 = Math.sin(angle * 0.3);
    t = y * c3 - z * s3; z = y * s3 + z * c3; y = t;
    // 4D -> 3D -> 2D perspective
    var k4 = 2.2 / (3 - w);
    x *= k4; y *= k4; z *= k4;
    var k3 = 2.2 / (3.4 - z);
    return [50 + x * k3 * 34, 50 + y * k3 * 34];
  }

  var faceCount = 0;

  /* create(el): turns el into a living Mai face. Returns { setMood(name, spec, instant), snapshot(), look(dir) }.
   * instant skips the static flicker (used by the panel preview while dragging sliders). */
  function create(root) {
    injectCss();
    faceCount += 1;
    root.classList.add('mai-face');
    root.innerHTML = faceSvg('mai-clip-' + faceCount);
    root.dataset.mood = 'asleep';

    var customGroup = root.querySelector('.eyes-custom');
    var currentKey = 'asleep';
    var spin = SPIN.asleep;
    var glance = true;

    function setMood(name, spec, instant) {
      var key = spec ? 'custom:' + JSON.stringify(spec) : name;
      if (key === currentKey) return;
      currentKey = key;

      if (spec) {
        var s = fullSpec(spec);
        customGroup.innerHTML = buildCustom(s);
        root.style.setProperty('--mai', s.ring);
        root.style.setProperty('--disc', s.disc);
        root.dataset.third = s.third;
        spin = num(s.spin, 1);
        glance = !!s.glance;
        root.dataset.mood = 'custom';
      } else {
        root.style.removeProperty('--mai');
        root.style.removeProperty('--disc');
        delete root.dataset.third;
        spin = SPIN[name] || 1;
        glance = true;
        root.dataset.mood = name;
      }

      if (instant) return;
      root.classList.remove('switching');
      void root.offsetWidth; // restart the animation
      root.classList.add('switching');
    }

    // a frozen copy of the face as it looks right now
    function snapshot() {
      var snap = document.createElement('div');
      snap.className = 'mai-face mai-snap';
      snap.dataset.mood = root.dataset.mood;
      if (root.dataset.third) snap.dataset.third = root.dataset.third;
      snap.style.cssText = root.style.cssText;
      snap.appendChild(root.querySelector('svg').cloneNode(true));
      return snap;
    }

    function awake() { return root.dataset.mood !== 'asleep'; }

    // tesseract
    var tess = root.querySelector('.tesseract');
    var lines = EDGES.map(function () {
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tess.appendChild(line);
      return line;
    });
    var angle = Math.random() * 10;
    var lastFrame = 0;

    function frame(now) {
      // ~30 fps is plenty for a slow wireframe
      if (now - lastFrame >= 33) {
        var dt = lastFrame ? Math.min(now - lastFrame, 100) : 33;
        lastFrame = now;
        angle += dt * 0.00035 * spin;
        var pts = VERTS.map(function (v) { return project(v, angle); });
        EDGES.forEach(function (e, n) {
          var p = pts[e[0]], q = pts[e[1]];
          lines[n].setAttribute('x1', p[0].toFixed(2));
          lines[n].setAttribute('y1', p[1].toFixed(2));
          lines[n].setAttribute('x2', q[0].toFixed(2));
          lines[n].setAttribute('y2', q[1].toFixed(2));
        });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // idle life: random blinks, glances, and the occasional third eye
    function blink() {
      if (!awake()) return;
      root.classList.add('blinking');
      setTimeout(function () { root.classList.remove('blinking'); }, 130);
    }

    (function scheduleBlink() {
      setTimeout(function () {
        blink();
        if (Math.random() < 0.2) setTimeout(blink, 280); // sometimes a double blink
        scheduleBlink();
      }, 2000 + Math.random() * 5000);
    })();

    (function scheduleGlance() {
      setTimeout(function () {
        if (awake() && glance) {
          var side = Math.random() < 0.5 ? 'look-left' : 'look-right';
          root.classList.add(side);
          setTimeout(function () { root.classList.remove(side); }, 900 + Math.random() * 1500);
        }
        scheduleGlance();
      }, 7000 + Math.random() * 9000);
    })();

    (function scheduleThirdEye() {
      setTimeout(function () {
        if (awake()) {
          root.classList.add('third-open');
          setTimeout(function () { root.classList.remove('third-open'); }, 1200 + Math.random() * 1200);
        }
        scheduleThirdEye();
      }, 60000 + Math.random() * 120000);
    })();

    // glance in a direction for a moment (e.g. down at chat when a message arrives)
    var lookTimer = null;
    function look(dir) {
      if (!awake() || !glance) return;
      root.classList.remove('look-left', 'look-right', 'look-down');
      root.classList.add('look-' + dir);
      clearTimeout(lookTimer);
      lookTimer = setTimeout(function () { root.classList.remove('look-' + dir); }, 1100);
    }

    return { setMood: setMood, snapshot: snapshot, look: look };
  }

  window.MaiFace = {
    create: create,
    defaults: fullSpec,
    builtIn: BUILT_IN.slice()
  };

  /* ── LIVE FACE on stream ── */
  var liveRoot = document.getElementById('mai-face');
  if (!liveRoot) return;

  var live = create(liveRoot);
  var customFaces = {};
  var lastMai = null;

  function showMood() {
    if (!lastMai || !lastMai.awake) {
      live.setMood('asleep');
      return;
    }
    var mood = lastMai.mood;
    if (customFaces[mood]) live.setMood(mood, customFaces[mood]);
    else live.setMood(BUILT_IN.indexOf(mood) !== -1 && mood !== 'asleep' ? mood : 'neutral');
  }

  function pollMood() {
    fetch('/api/mai').then(function (res) { return res.json(); }).then(function (mai) {
      lastMai = mai;
      window.MaiFace.botUsername = mai.botUsername || '';
      showMood();
    }).catch(function () { lastMai = null; showMood(); });
  }

  function pollFaces() {
    fetch('/api/state').then(function (res) { return res.json(); }).then(function (state) {
      customFaces = (state && state.maiFaces) || {};
      showMood();
    }).catch(function () {});
  }

  window.MaiFace.live = live;
  pollFaces();
  pollMood();
  setInterval(pollMood, POLL_MS);
  setInterval(pollFaces, FACES_POLL_MS);
})();
