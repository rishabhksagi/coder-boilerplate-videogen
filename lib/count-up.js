/**
 * lib/count-up.js — Animate a number from 0 to a target with locale formatting.
 *
 * Usage:
 *   <span id="stat-revenue"></span>
 *   <script src="lib/count-up.js"></script>
 *   <script>
 *     var tl = gsap.timeline({ paused: true });
 *     window.HFCount(tl, '#stat-revenue', 32000, 0.5);  // startTime = 0.5s
 *     // → animates "0" → "32,000" over 1.2s starting at t=0.5s
 *
 *     // With a suffix:
 *     window.HFCount(tl, '#stat-users', 1000000, 0.5, { suffix: '+', duration: 1.6 });
 *     // → "1,000,000+"
 *   </script>
 *
 * Options: { duration = 1.2, ease = 'power2.out', prefix = '', suffix = '',
 *            format = (n) => n.toLocaleString() }
 */
(function () {
  window.HFCount = function (tl, selector, target, time, opts) {
    var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    opts = opts || {};
    var duration = opts.duration != null ? opts.duration : 1.2;
    var ease = opts.ease || 'power2.out';
    var prefix = opts.prefix || '';
    var suffix = opts.suffix || '';
    var format = opts.format || function (n) { return n.toLocaleString(); };

    var obj = { val: 0 };
    el.textContent = prefix + format(0) + suffix;
    tl.to(
      obj,
      {
        val: target,
        duration: duration,
        ease: ease,
        snap: { val: 1 },
        onUpdate: function () {
          el.textContent = prefix + format(Math.round(obj.val)) + suffix;
        },
      },
      time
    );
  };
})();
