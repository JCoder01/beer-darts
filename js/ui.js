/* Small DOM + interaction helpers shared by both game modes. */
(function (global) {
  'use strict';

  var modalRoot = null;

  var UI = {
    esc: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    clone: function (o) { return JSON.parse(JSON.stringify(o)); },

    buzz: function (ms) {
      if (navigator.vibrate) { try { navigator.vibrate(ms || 12); } catch (e) {} }
    },

    /* Modal returning a promise of the chosen action value (null if dismissed). */
    modal: function (opts) {
      modalRoot = modalRoot || document.getElementById('modal-root');
      return new Promise(function (resolve) {
        var wrap = document.createElement('div');
        wrap.className = 'backdrop';
        var actions = (opts.actions || [{ label: 'OK', value: true, kind: 'primary' }]);
        wrap.innerHTML =
          '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
            (opts.title ? '<h2>' + UI.esc(opts.title) + '</h2>' : '') +
            '<div class="modal-body">' + (opts.html || '') + '</div>' +
            '<div class="modal-actions">' +
              actions.map(function (a, i) {
                return '<button class="btn ' + (a.kind || '') + '" data-i="' + i + '">' +
                  UI.esc(a.label) + '</button>';
              }).join('') +
            '</div>' +
          '</div>';

        function close(v) {
          wrap.removeEventListener('click', onClick);
          wrap.remove();
          resolve(v);
        }
        function onClick(e) {
          if (e.target === wrap && opts.dismissible !== false) return close(null);
          var b = e.target.closest('button[data-i]');
          if (!b) return;
          UI.buzz(10);
          var a = actions[+b.dataset.i];
          if (a.onPick && a.onPick(wrap) === false) return;
          close(a.value);
        }
        wrap.addEventListener('click', onClick);
        modalRoot.appendChild(wrap);
        if (opts.onOpen) opts.onOpen(wrap);
        var f = wrap.querySelector('input');
        if (f) { f.focus(); f.select(); }
      });
    },

    /* Single-line prompt. Resolves to the trimmed string, or null.
     * Pass {numeric:true, min, max} for a number pad on touch keyboards. */
    prompt: function (title, value, placeholder, opts) {
      opts = opts || {};
      var input;
      var attrs = opts.numeric
        ? 'type="number" inputmode="numeric" pattern="[0-9]*" min="' + opts.min + '" max="' + opts.max + '"'
        : 'type="text"';
      return UI.modal({
        title: title,
        html: '<input class="text-input" ' + attrs + ' value="' + UI.esc(value || '') +
              '" placeholder="' + UI.esc(placeholder || '') + '" autocomplete="off">',
        actions: [
          { label: 'Cancel', value: null },
          { label: 'Save', value: '\u0000', kind: 'primary' }
        ],
        onOpen: function (w) {
          input = w.querySelector('input');
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') w.querySelector('button[data-i="1"]').click();
          });
        }
      }).then(function (v) {
        if (v === null) return null;
        var t = (input.value || '').trim();
        return t || null;
      });
    },

    /* Brief confirmation for actions with no visible control, like a swipe.
     * Lives in #modal-root so a screen re-render cannot wipe it. */
    toast: function (msg) {
      var root = document.getElementById('modal-root');
      var el = document.createElement('div');
      el.className = 'toast';
      el.textContent = msg;
      root.appendChild(el);
      setTimeout(function () { el.classList.add('out'); }, 850);
      setTimeout(function () { el.remove(); }, 1250);
    },

    /* Keep the screen awake during a game. */
    wakeLock: (function () {
      var lock = null;
      function acquire() {
        if (!navigator.wakeLock) return;
        navigator.wakeLock.request('screen').then(function (l) {
          lock = l;
          l.addEventListener('release', function () { lock = null; });
        }).catch(function () {});
      }
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && UI.wakeLock.wanted && !lock) acquire();
      });
      return {
        wanted: false,
        on: function () { this.wanted = true; acquire(); },
        off: function () {
          this.wanted = false;
          if (lock) { lock.release().catch(function () {}); lock = null; }
        }
      };
    })()
  };

  global.UI = UI;
})(window);
