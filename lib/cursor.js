/**
 * lib/cursor.js — Animated cursor SVG that glides from offscreen to a target,
 * then click-pulses on the target.
 *
 * Usage:
 *   <button id="cta-button">Start building →</button>
 *   <script src="lib/cursor.js"></script>
 *   <script>
 *     var tl = gsap.timeline({ paused: true });
 *     window.HFCursor(tl, '#cta-button', 4.5, 4.7);  // arriveAt=4.5s, clickAt=4.7s
 *   </script>
 *
 * Options: { from = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' }
 *
 * Side effect: appends a `<svg id="hf-cursor">` element to <body>.
 */
(function () {
  function ensureCursor() {
    if (document.getElementById('hf-cursor')) return document.getElementById('hf-cursor');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'hf-cursor');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '28');
    svg.setAttribute('viewBox', '0 0 24 28');
    svg.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;z-index:60;' +
      'opacity:0;will-change:transform,opacity';
    svg.innerHTML =
      '<path d="M2 2 L2 22 L7 18 L11 26 L14 25 L10 17 L18 17 Z" ' +
      'fill="white" stroke="#1a1a1a" stroke-width="1.2" stroke-linejoin="round"/>';
    document.body.appendChild(svg);
    return svg;
  }

  window.HFCursor = function (tl, targetSelector, arriveAt, clickAt, opts) {
    opts = opts || {};
    var from = opts.from || 'bottom-right';
    var cursor = ensureCursor();
    var target = document.querySelector(targetSelector);
    if (!target) return;

    var targetRect = target.getBoundingClientRect();
    var targetX = targetRect.left + targetRect.width / 2 - 12;
    var targetY = targetRect.top + targetRect.height / 2 - 14;

    var startX, startY;
    switch (from) {
      case 'bottom-left':  startX = -50;  startY = window.innerHeight + 50; break;
      case 'top-right':    startX = window.innerWidth + 50; startY = -50;   break;
      case 'top-left':     startX = -50;  startY = -50;                     break;
      default:             startX = window.innerWidth + 50; startY = window.innerHeight + 50;
    }

    gsap.set(cursor, { x: startX, y: startY, opacity: 0 });
    var glideDuration = 0.6;
    tl.to(cursor, { opacity: 1, duration: 0.2, ease: 'power1.out' }, arriveAt - glideDuration);
    tl.to(cursor, { x: targetX, y: targetY, duration: glideDuration, ease: 'power3.out' }, arriveAt - glideDuration);
    if (clickAt != null) {
      tl.to(cursor, { scale: 0.85, duration: 0.08, ease: 'power2.in' }, clickAt);
      tl.to(cursor, { scale: 1, duration: 0.18, ease: 'elastic.out(1, 0.5)' }, clickAt + 0.08);
    }
  };
})();
