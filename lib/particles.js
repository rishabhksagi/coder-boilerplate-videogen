/**
 * lib/particles.js — Floating dots drifting upward at random speeds.
 *
 * Usage:
 *   <div id="particle-field" style="position:absolute;inset:0;pointer-events:none"></div>
 *   <script src="lib/particles.js"></script>
 *   <script>
 *     window.HFParticles('#particle-field');                       // 25 default
 *     window.HFParticles('#particle-field', { count: 50, color: 'rgba(122,107,255,0.4)' });
 *   </script>
 *
 * Options: { count = 25, color = 'rgba(255,255,255,0.3)',
 *            minSize = 2, maxSize = 5, driftMin = 4, driftMax = 7 }
 *
 * Renders deterministically — but if your composition is captured for an MP4,
 * randomness will produce different particle positions per run. For perfectly
 * deterministic renders, seed the positions yourself with mulberry32.
 */
(function () {
  window.HFParticles = function (container, opts) {
    opts = opts || {};
    var count = opts.count != null ? opts.count : 25;
    var color = opts.color || 'rgba(255,255,255,0.3)';
    var minSize = opts.minSize != null ? opts.minSize : 2;
    var maxSize = opts.maxSize != null ? opts.maxSize : 5;
    var driftMin = opts.driftMin != null ? opts.driftMin : 4;
    var driftMax = opts.driftMax != null ? opts.driftMax : 7;

    var c = typeof container === 'string' ? document.querySelector(container) : container;
    if (!c) return;

    for (var i = 0; i < count; i++) {
      var d = document.createElement('div');
      var size = minSize + Math.random() * (maxSize - minSize);
      d.style.cssText =
        'position:absolute;width:' + size + 'px;height:' + size + 'px;' +
        'border-radius:50%;background:' + color + ';' +
        'left:' + Math.random() * 100 + '%;top:' + Math.random() * 100 + '%;' +
        'pointer-events:none;will-change:transform,opacity';
      c.appendChild(d);
      gsap.to(d, {
        y: -200 - Math.random() * 200,
        opacity: 0,
        duration: driftMin + Math.random() * (driftMax - driftMin),
        delay: Math.random() * 2,
        repeat: -1,
        ease: 'none',
      });
    }
  };
})();
