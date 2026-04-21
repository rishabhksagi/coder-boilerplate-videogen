/**
 * lib/marquee.js — Infinite-scroll text or logo strip.
 *
 * Usage:
 *   <div class="marquee-row" style="white-space:nowrap;overflow:hidden">
 *     <span>ACME · GLOBEX · INITECH · STARK · WAYNE · </span>
 *     <span>ACME · GLOBEX · INITECH · STARK · WAYNE · </span>  <!-- duplicate for seamless loop -->
 *   </div>
 *   <script src="lib/marquee.js"></script>
 *   <script>
 *     window.HFMarquee('.marquee-row', { speed: 30, direction: 'left' });
 *   </script>
 *
 * IMPORTANT: duplicate the content twice (or more) so the loop is seamless.
 * The animation translates by -50% of the container's width.
 *
 * Options: { speed = 30 (seconds per loop), direction = 'left' | 'right' }
 */
(function () {
  window.HFMarquee = function (selector, opts) {
    opts = opts || {};
    var speed = opts.speed != null ? opts.speed : 30;
    var direction = opts.direction || 'left';

    var els = typeof selector === 'string' ? document.querySelectorAll(selector) : [selector];
    Array.prototype.forEach.call(els, function (el) {
      gsap.to(el, {
        x: direction === 'left' ? '-50%' : '50%',
        duration: speed,
        ease: 'none',
        repeat: -1,
      });
    });
  };
})();
