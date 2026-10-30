/* Projector mode: Miracast always sends a landscape frame, so a portrait
 * scoreboard arrives small and pillarboxed. With the tablet locked in
 * landscape and the projector on its side, this draws the app turned 90° so
 * it fills the frame and reads upright.
 *
 * The page itself becomes a thin host holding one rotated iframe of the app.
 * An iframe is its own viewport, so inside it the app genuinely is portrait:
 * media queries, vh units and the measured --app-h all see 600x1024 rather
 * than the landscape screen, with no projector-only copy of the stylesheet.
 * The host owns what only the top-level page can do: fullscreen and the
 * orientation lock. Off, none of this runs and the page is the plain app. */
(function (global) {
  'use strict';

  var KEY = 'beerdarts.v1';
  var frame = null;

  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement; }

  var Projector = {
    /* The app running inside the host's frame, rather than as the page. */
    inFrame: (function () {
      try { return !!(global.frameElement && global.frameElement.id === 'pj-frame'); }
      catch (e) { return false; }
    })(),

    /* Straight from storage: the host decides before the app has loaded. */
    read: function () {
      try {
        var c = (JSON.parse(localStorage.getItem(KEY)) || {}).cfg || {};
        return { on: !!c.projector, dir: c.projectorDir === 'ccw' ? 'ccw' : 'cw' };
      } catch (e) { return { on: false, dir: 'cw' }; }
    },

    /* The page the app is in: the host's window from inside the frame. */
    host: function () { return Projector.inFrame ? global.parent : global; },

    /* After the setting changes (already saved). From the plain app this
     * turns the page into the host; from inside, it re-lays or leaves. */
    sync: function () {
      var s = Projector.read();
      if (Projector.inFrame) {
        var P = global.parent.Projector;
        return s.on ? P.layout() : P.leave();
      }
      if (s.on) Projector.enter();
    },

    /* From a tap in the plain app: fullscreen while the tap still counts as
     * a user gesture, then swap the page for the frame. */
    enter: function () {
      Projector.full();
      Projector.mount();
    },

    mount: function () {
      var root = document.documentElement;
      root.classList.add('pj-host');
      document.body.innerHTML = '<iframe id="pj-frame" title="Beer Darts" src="index.html' +
        location.search + '" allow="fullscreen; screen-wake-lock"></iframe>';
      frame = document.getElementById('pj-frame');
      Projector.layout();
      global.addEventListener('resize', Projector.layout);
      /* Rotating reports the old size if measured straight away. */
      global.addEventListener('orientationchange', function () { setTimeout(Projector.layout, 120); });
      if (global.visualViewport) global.visualViewport.addEventListener('resize', Projector.layout);
    },

    /* Portrait-sized frame turned into the landscape screen, edge to edge.
     * If the screen is portrait anyway (no orientation lock, tablet held
     * upright), the system has already turned it, so the frame just fills it. */
    layout: function () {
      if (!frame) return;
      var w = global.innerWidth, h = global.innerHeight, turn = w > h;
      var deg = Projector.read().dir === 'ccw' ? -90 : 90;
      frame.style.width = (turn ? h : w) + 'px';
      frame.style.height = (turn ? w : h) + 'px';
      frame.style.transform = 'translate(-50%, -50%)' + (turn ? ' rotate(' + deg + 'deg)' : '');
      document.documentElement.classList.toggle('pj-turned', turn);
    },

    /* Fullscreen hides the system bars, which do not rotate with the app and
     * would sit as a strip down one side of the projected picture; it is also
     * what screen.orientation.lock needs. Either may be missing: carry on. */
    full: function () {
      var el = document.documentElement;
      function lock() {
        try {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
        } catch (e) {}
      }
      if (fsElement()) return lock();
      try {
        var p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' })
          : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
        if (p && p.then) p.then(lock, function () {}); else lock();
      } catch (e) {}
    },

    /* Fullscreen needs a gesture, so it cannot come back by itself after a
     * restart or a swipe out of it. The app calls this on every tap. */
    ensureFull: function () {
      try {
        var P = Projector.host().Projector;
        if (!P.isFull()) P.full();
      } catch (e) {}
    },

    isFull: function () { return !!fsElement(); },

    leave: function () {
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
      try {
        if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } catch (e) {}
      location.reload();
    }
  };

  global.Projector = Projector;
})(window);
