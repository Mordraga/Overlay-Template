/* ── HOLES: transparent windows in the overlay's background ──
 * The page background is transparent; the dark backdrop lives on .bg. This cuts a window in
 * .bg over every element marked data-hole, so OBS sources (captures, camera, model) show through
 * while the overlay sits on top of them with its frames and corners intact.
 * Windows are measured from the real elements, so they follow any layout change.
 */
(function () {
  var bg = document.querySelector('.bg');
  if (!bg) return;

  function px(n) { return Math.round(n) + 'px'; }

  function cut() {
    var holes = Array.prototype.slice.call(document.querySelectorAll('[data-hole]'));
    var b = bg.getBoundingClientRect();
    // outer rectangle first, then each hole as its own loop; evenodd turns the loops into windows
    var pts = ['0 0', px(b.width) + ' 0', px(b.width) + ' ' + px(b.height), '0 ' + px(b.height), '0 0'];
    holes.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var x1 = px(r.left - b.left), y1 = px(r.top - b.top);
      var x2 = px(r.right - b.left), y2 = px(r.bottom - b.top);
      pts.push(x1 + ' ' + y1, x1 + ' ' + y2, x2 + ' ' + y2, x2 + ' ' + y1, x1 + ' ' + y1, '0 0');
    });
    bg.style.clipPath = 'polygon(evenodd, ' + pts.join(', ') + ')';
  }

  cut();
  window.addEventListener('load', cut);   // again once fonts have settled the layout
  window.addEventListener('resize', cut);
})();
