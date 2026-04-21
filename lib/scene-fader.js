/**
 * lib/scene-fader.js — Auto-crossfade scene containers in a GSAP timeline.
 *
 * Usage:
 *   <script src="lib/scene-fader.js"></script>
 *   <script>
 *     var tl = gsap.timeline({ paused: true });
 *     window.HFScenes.fade(tl, [
 *       { id: 'scene-1', start: 0.1, end: 1.4 },
 *       { id: 'scene-2', start: 1.4, end: 2.7 },
 *       { id: 'scene-3', start: 2.7, end: 4.0 },
 *       { id: 'scene-4', start: 4.0 },                       // no end → stays visible
 *     ]);
 *     window.__timelines["main"] = tl;
 *   </script>
 *
 * Scene containers should have `position:absolute; inset:0;` and the rule
 * `opacity:0` in CSS — this helper provides the fade-in via fromTo.
 *
 * Defaults: 0.4s ease-out fade-in, 0.3s ease-in fade-out.
 */
(function () {
  window.HFScenes = window.HFScenes || {};
  window.HFScenes.fade = function (tl, scenes, opts) {
    opts = opts || {};
    var fadeIn = opts.fadeIn != null ? opts.fadeIn : 0.4;
    var fadeOut = opts.fadeOut != null ? opts.fadeOut : 0.3;
    var easeIn = opts.easeIn || 'power2.out';
    var easeOut = opts.easeOut || 'power2.in';

    scenes.forEach(function (s) {
      var sel = '#' + s.id;
      tl.fromTo(
        sel,
        { opacity: 0 },
        { opacity: 1, duration: fadeIn, ease: easeIn },
        s.start
      );
      if (s.end != null) {
        tl.fromTo(
          sel,
          { opacity: 1 },
          { opacity: 0, duration: fadeOut, ease: easeOut },
          s.end - fadeOut
        );
      }
    });
  };
})();
