/* Setup screen, persistence, menus and event wiring for both game modes. */
(function (global) {
  'use strict';

  var KEY = 'beerdarts.v1';
  var MAX_NAME = 24;

  var SEED_ROSTER = [
    'Bad News Beers',
    'Minute Man Militia',
    'Boston Brits',
    'MENACE',
    'Projectile Dysfunction',
    'Dart Siders',
    "At least We're Cute",
    'Jammy Dodgers',
    'Mrs Turner',
    'BullsHitters',
    'The Sharts',
    "Boys who Don't read good",
    'Good Grouping!',
    'Duck'
  ];

  /* What each named shortcut actually throws. A breakfast is definitionally
   * 20-5-1; 41 has no canonical throw, so it uses the common 20-20-1. */
  var SLANG_DARTS = {
    breakfast: [[20, 1, 'S20'], [5, 1, 'S5'], [1, 1, 'S1']],
    fishchips: [[20, 1, 'S20'], [20, 1, 'S20'], [1, 1, 'S1']],
    fuckall:   [[0, 1, 'MISS'], [0, 1, 'MISS'], [0, 1, 'MISS']]
  };

  var VARIANT_HINT = {
    standard: 'Close a number with three marks. Extra marks on a number you have closed score points while at least one opponent still has it open. Highest score of the players who close everything wins.',
    cutthroat: 'Extra marks give points to every opponent who has not closed that number. Close everything with the lowest score to win.',
    noscore: 'No points at all — first player to close every number wins.'
  };

  var App = {
    cfg: {
      type: 'x01',
      start: 501, entry: 'darts', outMode: 'double', doubleIn: 0, legs: 1,
      variant: 'standard', range: 'std', clegs: 1,
      players: ['Bad News Beers', 'Player 2']
    },
    game: null,
    roster: SEED_ROSTER.slice(),

    /* Load index.html?debug to get a readout of the real geometry, so a device
     * I cannot reproduce can report exactly what overflows and by how much. */
    debugOverlay: function () {
      if (location.search.indexOf('debug') === -1) return;
      var box = document.createElement('div');
      box.id = 'debug-readout';
      document.body.appendChild(box);
      function num(n) { return Math.round(n); }
      function update() {
        var app = document.getElementById('app');
        var scr = document.querySelector('.screen.active');
        var pad = document.querySelector('.pad');
        var last = document.querySelector('.botrow') || document.querySelector('.numpad');
        var focus = document.querySelector('.focus');
        var L = [];
        L.push('innerHeight ' + window.innerHeight + '  innerWidth ' + window.innerWidth);
        L.push('--app-h ' + (getComputedStyle(document.documentElement)
          .getPropertyValue('--app-h').trim() || 'UNSET') +
          '   js-vh ' + document.documentElement.classList.contains('js-vh'));
        L.push('no-flexgap ' + document.documentElement.classList.contains('no-flexgap'));
        if (app) L.push('#app h=' + num(app.getBoundingClientRect().height));
        if (scr) {
          L.push('screen h=' + num(scr.getBoundingClientRect().height) +
                 ' scroll=' + scr.scrollHeight + ' over=' + (scr.scrollHeight - scr.clientHeight));
          L.push('screen display=' + getComputedStyle(scr).display);
        }
        if (focus) L.push('focus h=' + num(focus.getBoundingClientRect().height) +
                          ' needs=' + focus.scrollHeight);
        if (pad) L.push('pad top=' + num(pad.getBoundingClientRect().top) +
                        ' h=' + num(pad.getBoundingClientRect().height) +
                        ' needs=' + pad.scrollHeight);
        var ng = document.querySelector('.numgrid') || document.querySelector('.numpad');
        if (ng) {
          L.push('numgrid h=' + num(ng.getBoundingClientRect().height) +
                 ' needs=' + ng.scrollHeight + ' display=' + getComputedStyle(ng).display);
          var rows = ng.querySelectorAll('.numrow');
          L.push('rows=' + rows.length + ' heights=' +
            Array.prototype.map.call(rows, function (r) {
              return num(r.getBoundingClientRect().height);
            }).join(','));
        }
        if (last) {
          var r = last.getBoundingClientRect();
          var off = num(r.bottom) - window.innerHeight;
          L.push('LAST ROW bottom=' + num(r.bottom) + ' vs ' + window.innerHeight +
                 (off > 0 ? '  CUT OFF BY ' + off : '  visible (' + (-off) + ' spare)'));
        }
        box.innerHTML = L.join('<br>');
      }
      update();
      setInterval(update, 500);
    },

    /* Flexbox gap needs Safari 14.1. It cannot be feature-detected in CSS --
     * @supports (gap:1px) is true on older Safari because *grid* gap exists --
     * so probe it and let the stylesheet fall back to margins. */
    detectFlexGap: function () {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;visibility:hidden;display:flex;gap:20px;';
      d.innerHTML = '<i style="width:10px"></i><i style="width:10px"></i>';
      document.body.appendChild(d);
      var ok = d.getBoundingClientRect().width >= 39;
      document.body.removeChild(d);
      if (!ok) document.documentElement.classList.add('no-flexgap');
    },

    /* Measured rather than trusting 100vh/100dvh: see the #app rule. */
    trackHeight: function () {
      function set() {
        document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px');
      }
      set();
      document.documentElement.classList.add('js-vh');
      window.addEventListener('resize', set);
      /* iOS reports the old size if you measure too early after a rotate. */
      window.addEventListener('orientationchange', function () { setTimeout(set, 120); });
      if (window.visualViewport) window.visualViewport.addEventListener('resize', set);

      /* Safari's chrome changes height when tabs open or close, and it may not
       * fire resize on a backgrounded tab -- it also restores tabs from the
       * back-forward cache rather than reloading. Re-measure on the way back in. */
      window.addEventListener('pageshow', function () { setTimeout(set, 60); });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) setTimeout(set, 60);
      });
    },

    /* boot ----------------------------------------------------- */
    init: function () {
      App.trackHeight();
      App.detectFlexGap();
      App.debugOverlay();
      App.load();
      App.syncSetup();
      App.renderPlayers();

      document.getElementById('screen-setup').addEventListener('click', App.onSetupClick);
      var x01 = document.getElementById('screen-x01');
      x01.addEventListener('click', App.onX01Click);
      x01.addEventListener('touchstart', App.onTouchStart, { passive: true });
      x01.addEventListener('touchend', App.onTouchEnd, { passive: false });
      var cricket = document.getElementById('screen-cricket');
      cricket.addEventListener('click', App.onCricketClick);
      document.addEventListener('keydown', App.onKey);

      /* Press-and-hold: edit a score in X01, toggle the row-undo buttons in
       * Cricket. Bound on both screens; touch and mouse, mouse guarded
       * against the synthetic events iOS fires after a real touch. */
      [x01, cricket].forEach(function (el) {
        el.addEventListener('touchstart', App.lpStart, { passive: true });
        el.addEventListener('touchmove', App.lpMove, { passive: true });
        el.addEventListener('touchend', App.lpCancel);
        el.addEventListener('mousedown', App.lpStart);
        el.addEventListener('mousemove', App.lpMove);
        el.addEventListener('mouseup', App.lpCancel);
      });

      /* iOS Safari's overflow:hidden does not reliably stop the page
       * rubber-banding under a drag, even with overscroll-behavior set (its
       * support there has been inconsistent). If anything ever overflows,
       * a stray drag can shift the whole layout by a few dozen pixels, so
       * the next tap lands on the wrong element. Block scrolling everywhere
       * except the few places that are meant to scroll. */
      document.addEventListener('touchmove', function (e) {
        if (e.target.closest && e.target.closest('.scroll, .roster, .modal')) return;
        e.preventDefault();
      }, { passive: false });

      if (App.game) { App.show(App.game.type); App.render(); }

      if (location.protocol.indexOf('http') === 0 && navigator.serviceWorker) {
        navigator.serviceWorker.register('sw.js').catch(function () {});
        /* A new worker activates in the background (it calls skipWaiting()),
         * but this tab stays on the one that loaded it until told otherwise.
         * Without this, an open tab can sit on a stale worker indefinitely
         * even though a newer one is ready — reload once to pick it up. */
        /* Only an *update* should reload. On a first visit the page starts
         * with no controller, and the newly installed worker claiming it also
         * fires controllerchange — reloading there is pointless churn. */
        var hadController = !!navigator.serviceWorker.controller;
        var reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (!hadController || reloading) return;
          reloading = true;
          location.reload();
        });
      }
    },

    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return;
        var d = JSON.parse(raw);
        if (d.cfg) Object.keys(d.cfg).forEach(function (k) { App.cfg[k] = d.cfg[k]; });
        if (d.game && d.game.players && d.game.players.length) App.game = d.game;
        if (d.roster && d.roster.length) {
          /* Older builds stored objects with records; keep just the names. */
          App.roster = d.roster
            .map(function (r) { return typeof r === 'string' ? r : (r && r.name); })
            .filter(Boolean);
        }
      } catch (e) { /* corrupt or unavailable storage: start fresh */ }
    },

    save: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          cfg: App.cfg, game: App.game, roster: App.roster
        }));
      } catch (e) { /* private mode / quota: play on without persistence */ }
    },

    show: function (which) {
      ['setup', 'x01', 'cricket'].forEach(function (s) {
        document.getElementById('screen-' + s).classList.toggle('active', s === which);
      });
      if (which === 'setup') UI.wakeLock.off(); else UI.wakeLock.on();
    },

    /* setup screen --------------------------------------------- */
    START_MIN: 101,
    START_MAX: 1001,

    customStart: function () {
      UI.prompt('Starting score', String(App.cfg.start), App.START_MIN + '–' + App.START_MAX,
        { numeric: true, min: App.START_MIN, max: App.START_MAX }
      ).then(function (val) {
        if (val === null) return;
        var n = parseInt(val, 10);
        if (!/^\d+$/.test(val) || isNaN(n) || n < App.START_MIN || n > App.START_MAX) {
          return UI.modal({
            title: 'Out of range',
            html: '<p>Pick a whole number from ' + App.START_MIN + ' to ' + App.START_MAX + '.</p>'
          }).then(App.customStart);
        }
        App.cfg.start = n;
        App.syncSetup();
        App.save();
      });
    },

    syncSetup: function () {
      document.querySelectorAll('.seg[data-opt]').forEach(function (seg) {
        var opt = seg.dataset.opt;
        seg.querySelectorAll('.seg-btn').forEach(function (b) {
          b.classList.toggle('active', String(App.cfg[opt]) === b.dataset.v);
        });
      });

      /* The custom button carries no fixed value, so it owns any start score
       * that is not one of the presets and shows it as its label. */
      var custom = document.querySelector('.seg[data-opt="start"] .seg-btn[data-v="custom"]');
      if (custom) {
        var preset = document.querySelector('.seg[data-opt="start"] .seg-btn.active');
        custom.classList.toggle('active', !preset);
        custom.textContent = preset ? 'Custom' : String(App.cfg.start);
      }
      document.getElementById('opts-x01').hidden = App.cfg.type !== 'x01';
      document.getElementById('opts-cricket').hidden = App.cfg.type !== 'cricket';
      document.getElementById('variant-hint').textContent = VARIANT_HINT[App.cfg.variant];
    },

    renderPlayers: function () {
      var last = App.cfg.players.length - 1;
      document.getElementById('player-list').innerHTML = App.cfg.players.map(function (n, i) {
        return '<li class="prow">' +
          '<span class="prow-n">' + (i + 1) + '</span>' +
          '<button class="prow-name" data-act="rename" data-i="' + i + '">' + UI.esc(n) + '</button>' +
          '<button class="prow-btn" data-act="move-up" data-i="' + i + '"' +
            (i === 0 ? ' disabled' : '') + ' aria-label="Move ' + UI.esc(n) + ' up">&uarr;</button>' +
          '<button class="prow-btn" data-act="move-down" data-i="' + i + '"' +
            (i === last ? ' disabled' : '') + ' aria-label="Move ' + UI.esc(n) + ' down">&darr;</button>' +
          '<button class="prow-btn del" data-act="rm-player" data-i="' + i + '"' +
            (last === 0 ? ' disabled' : '') + ' aria-label="Remove ' + UI.esc(n) + '">&times;</button>' +
        '</li>';
      }).join('');
    },

    movePlayer: function (i, delta) {
      var a = App.cfg.players, j = i + delta;
      if (j < 0 || j >= a.length) return;
      var t = a[i]; a[i] = a[j]; a[j] = t;
      UI.buzz(10);
      App.renderPlayers();
      App.save();
    },

    addName: function (name) {
      name = (name || '').trim().slice(0, MAX_NAME);
      if (!name) return;
      if (App.cfg.players.indexOf(name) === -1) App.cfg.players.push(name);
      /* Anything typed once is worth keeping in the store. */
      if (App.roster.indexOf(name) === -1) App.roster.push(name);
      App.renderPlayers();
      App.save();
    },

    /* Pick from the stored roster. Rows toggle, so several go in at once. */
    rosterPicker: function () {
      function rows() {
        if (!App.roster.length) return '<p class="empty">The store is empty. Add a name below.</p>';
        return App.roster.map(function (name) {
          var on = App.cfg.players.indexOf(name) !== -1;
          return '<div class="rrow-wrap">' +
            '<button class="rrow' + (on ? ' on' : '') + '" data-pick="' + UI.esc(name) + '"' +
              ' aria-pressed="' + on + '">' +
              '<span class="rr-check">' + (on ? '&#10003;' : '') + '</span>' +
              '<span class="rr-name">' + UI.esc(name) + '</span>' +
            '</button>' +
            '<button class="rr-del" data-del="' + UI.esc(name) + '"' +
              ' aria-label="Remove ' + UI.esc(name) + ' from the store">&times;</button>' +
          '</div>';
        }).join('');
      }

      UI.modal({
        title: 'Players',
        wide: true,
        html: '<div class="roster">' + rows() + '</div>',
        actions: [
          { label: 'New name', value: 'new' },
          { label: 'Done', value: null, kind: 'primary' }
        ],
        onOpen: function (w) {
          var list = w.querySelector('.roster');
          list.addEventListener('click', function (ev) {
            var del = ev.target.closest('[data-del]');
            var pick = ev.target.closest('[data-pick]');
            if (del) {
              var gone = del.dataset.del;
              App.roster = App.roster.filter(function (n) { return n !== gone; });
            } else if (pick) {
              var n = pick.dataset.pick;
              var at = App.cfg.players.indexOf(n);
              if (at === -1) App.cfg.players.push(n); else App.cfg.players.splice(at, 1);
              UI.buzz(8);
            } else return;
            list.innerHTML = rows();
            App.renderPlayers();
            App.save();
          });
        }
      }).then(function (v) {
        if (v !== 'new') return;
        UI.prompt('New player', '', 'Name').then(function (name) {
          App.addName(name);
          App.rosterPicker();
        });
      });
    },

    onSetupClick: function (ev) {
      var seg = ev.target.closest('.seg[data-opt] .seg-btn');
      if (seg) {
        var opt = seg.parentElement.dataset.opt;
        var v = seg.dataset.v;
        UI.buzz(8);
        if (opt === 'start' && v === 'custom') return App.customStart();
        App.cfg[opt] = /^-?\d+$/.test(v) ? +v : v;
        App.syncSetup();
        App.save();
        return;
      }

      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act;
      var i = +b.dataset.i;

      if (act === 'add-player') {
        App.rosterPicker();
      } else if (act === 'move-up') {
        App.movePlayer(i, -1);
      } else if (act === 'move-down') {
        App.movePlayer(i, 1);
      } else if (act === 'rename') {
        UI.prompt('Player name', App.cfg.players[i], 'Name').then(function (name) {
          if (!name) return;
          App.cfg.players[i] = name.trim().slice(0, MAX_NAME);
          App.renderPlayers();
          App.save();
        });
      } else if (act === 'rm-player') {
        App.cfg.players.splice(i, 1);
        App.renderPlayers();
        App.save();
      } else if (act === 'start') {
        App.start();
      } else if (act === 'help') {
        App.help();
      }
    },

    start: function () {
      var c = App.cfg;
      if (!c.players.length) {
        UI.modal({ title: 'Add a player', html: '<p>Pick at least one player to start.</p>' });
        return;
      }
      if (c.type === 'cricket' && c.players.length < 2) {
        UI.modal({ title: 'Add a player', html: '<p>Cricket needs at least two players.</p>' });
        return;
      }
      App.game = c.type === 'x01'
        ? X01.create({
            start: c.start, outMode: c.outMode, doubleIn: !!c.doubleIn,
            legs: c.legs, entry: c.entry, players: c.players.slice()
          })
        : Cricket.create({
            variant: c.variant, range: c.range, legs: c.clegs, players: c.players.slice()
          });
      App.show(c.type);
      App.render();
      App.save();
    },

    /* game loop ------------------------------------------------ */
    mod: function () { return App.game.type === 'x01' ? X01 : Cricket; },

    render: function () {
      var g = App.game;
      var host = document.getElementById('screen-' + g.type);

      /* The screen is re-rendered wholesale after every dart, which would
       * otherwise throw the player strip back to the left on each throw. */
      var old = host.querySelector('.players');
      var left = old ? old.scrollLeft : 0;

      host.innerHTML = App.mod().render(g);

      var strip = host.querySelector('.players');
      if (strip) {
        strip.scrollLeft = left;
        var on = strip.querySelector('.pcard.on');       /* keep whoever is throwing visible */
        if (on) {
          var l = on.offsetLeft, r = l + on.offsetWidth;
          if (l < strip.scrollLeft) strip.scrollLeft = l - 8;
          else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth + 8;
        }
      }

      App.save();
      if (g.announce) App.announce();
    },

    undo: function () {
      App.game = App.mod().undo(App.game);
      App.game.pending = '';   /* never restore a half-typed total */
      UI.buzz(10);
      App.render();
    },

    announce: function () {
      var g = App.game;
      var a = g.announce;
      g.announce = null;
      var p = g.players[a.player];

      var stats;
      if (g.type === 'x01') {
        stats = '<p class="win-stat">3-dart average <b>' + X01.avg(p).toFixed(1) +
          '</b> &middot; best turn <b>' + p.best + '</b> &middot; darts <b>' + p.darts + '</b></p>';
      } else {
        stats = g.variant === 'noscore' ? '' :
          '<p class="win-stat">Score <b>' + p.score + '</b></p>';
      }

      var actions = [{ label: 'Undo', value: 'undo' }];
      if (a.over) {
        actions.push({ label: 'Rematch', value: 'rematch' });
        actions.push({ label: 'New game', value: 'new', kind: 'primary' });
      } else {
        actions.push({ label: 'Next leg', value: 'next', kind: 'primary' });
      }

      UI.modal({
        title: a.over ? p.name + ' wins!' : p.name + ' takes the leg',
        html: '<p class="win-legs">' + g.players.map(function (pl) {
            return UI.esc(pl.name) + ' ' + pl.legs;
          }).join(' &middot; ') + '</p>' + stats,
        actions: actions,
        dismissible: false
      }).then(function (v) {
        if (v === 'undo') return App.undo();
        if (v === 'next') { App.mod().nextLeg(App.game); return App.render(); }
        if (v === 'rematch') { App.start(); return; }
        App.game = null;
        App.save();
        App.show('setup');
      });
    },

    /* X01 input ------------------------------------------------ */
    onX01Click: function (ev) {
      if (App.suppressClick) { App.suppressClick = false; return; }
      var b = ev.target.closest('[data-act]');
      if (!b || b.disabled) return;
      var g = App.game, act = b.dataset.act, v = +b.dataset.v;
      UI.buzz(act === 'menu' || act === 'undo' ? 10 : 14);

      if (act === 'menu') return App.menu();
      if (act === 'undo') return App.undo();
      if (g.over) return;

      if (act === 'mult') { g.mult = v; return App.render(); }
      if (act === 'num') { X01.throwDart(g, v, g.mult, (g.mult === 1 ? 'S' : g.mult === 2 ? 'D' : 'T') + v); return App.render(); }
      if (act === 'bull') { X01.throwDart(g, 25, v === 50 ? 2 : 1, v === 50 ? 'BULL' : '25'); return App.render(); }
      if (act === 'miss') { X01.throwDart(g, 0, 1, 'MISS'); return App.render(); }

      /* Both expand into real darts, so busts and checkouts still apply. Stop
       * the moment the turn ends, or the rest would land on the next player. */
      if (SLANG_DARTS[act]) {
        var who = g.cur;
        var darts = SLANG_DARTS[act];
        for (var d = 0; d < darts.length; d++) {
          if (g.over || g.cur !== who || X01.dartsLeft(g) < 1) break;
          X01.throwDart(g, darts[d][0], darts[d][1], darts[d][2]);
        }
        return App.render();
      }
      if (act === 'endturn') { X01.snapshot(g); X01.endTurn(g, false); return App.render(); }

      if (act === 'dig') {
        if (g.pending.length < 3) {
          var next = (g.pending + v).replace(/^0+(?=\d)/, '');
          if (+next <= 180) g.pending = next;
        }
        return App.render();
      }
      if (act === 'back') { g.pending = g.pending.slice(0, -1); return App.render(); }
      if (act === 'quick') { g.pending = String(v); return App.submitTotal(); }
      if (act === 'enter') return App.submitTotal();
    },

    submitTotal: function () {
      var g = App.game;
      var total = +g.pending;
      if (g.pending === '' || isNaN(total)) return;

      if (Checkout.impossibleTotal(total)) {
        g.pending = '';
        App.render();
        return UI.modal({ title: 'Not possible', html: '<p>No three darts make ' + total + '.</p>' });
      }

      /* A checkout needs the real dart count for the average to mean anything. */
      if (g.players[g.cur].score - total === 0) {
        return UI.modal({
          title: 'Checkout!',
          html: '<p>How many darts did that take?</p>',
          actions: [{ label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3, kind: 'primary' }],
          dismissible: false
        }).then(function (n) {
          X01.enterTotal(g, total, n || 3);
          App.render();
        });
      }

      X01.enterTotal(g, total);
      App.render();
    },

    /* Cricket input -------------------------------------------- */
    onCricketClick: function (ev) {
      if (App.suppressClick) { App.suppressClick = false; return; }
      var b = ev.target.closest('[data-act]');
      if (!b || b.disabled) return;
      var g = App.game, act = b.dataset.act;
      UI.buzz(act === 'menu' || act === 'undo' ? 10 : 14);

      if (act === 'menu') return App.menu();
      if (act === 'undo') return App.undo();
      /* Corrections stay reachable after the game ends -- undoing the
       * closing mark is exactly when you'd want them. */
      if (act === 'editdone') { g.editing = false; return App.render(); }
      if (act === 'undorow') { Cricket.undoRow(g, +b.dataset.t); return App.render(); }
      if (g.over) return;

      if (act === 'mark') { Cricket.throwMark(g, +b.dataset.p, +b.dataset.t); return App.render(); }
    },

    /* press-and-hold ------------------------------------------- */
    LP_MS: 500,
    LP_MOVE: 12,

    lpStart: function (e) {
      var pt;
      if (e.type === 'mousedown') {
        if (e.button !== 0 || Date.now() - (App.lastTouch || 0) < 700) return;
        pt = e;
      } else {
        App.lastTouch = Date.now();
        if (e.touches.length !== 1) return;
        pt = e.touches[0];
      }
      if (!App.game || document.querySelector('.backdrop')) return;
      clearTimeout(App.lpTimer);
      App.lp = { x: pt.clientX, y: pt.clientY, target: e.target, fired: false };
      App.lpTimer = setTimeout(function () {
        if (!App.lp) return;
        App.lp.fired = true;
        UI.buzz(18);
        App.onLongPress(App.lp.target);
      }, App.LP_MS);
    },

    lpMove: function (e) {
      if (!App.lp) return;
      var pt = e.touches ? e.touches[0] : e;
      if (Math.abs(pt.clientX - App.lp.x) > App.LP_MOVE ||
          Math.abs(pt.clientY - App.lp.y) > App.LP_MOVE) {
        clearTimeout(App.lpTimer);
        App.lp = null;
      }
    },

    lpCancel: function () {
      clearTimeout(App.lpTimer);
      if (App.lp && App.lp.fired) App.suppressClick = true;   /* not also a tap */
      App.lp = null;
    },

    onLongPress: function (target) {
      var g = App.game;
      if (!g || !target || !target.closest) return;

      if (g.type === 'x01') {
        var card = target.closest('.pcard');
        if (card) return App.editScore(+card.dataset.i);
        if (target.closest('.focus-score')) return App.editScore(g.cur);
        return;
      }
      if (g.type === 'cricket' && target.closest('.cgrid')) {
        g.editing = !g.editing;
        App.render();
      }
    },

    editScore: function (i) {
      var g = App.game;
      if (!g || g.type !== 'x01') return;
      var p = g.players[i];
      UI.prompt('Score for ' + p.name, String(p.score), '0–' + g.start,
        { numeric: true, min: 0, max: g.start }
      ).then(function (val) {
        if (val === null) return;
        var n = parseInt(val, 10);
        if (!/^\d+$/.test(val) || isNaN(n) || n < 0 || n > g.start) {
          return UI.modal({
            title: 'Out of range',
            html: '<p>Pick a whole number from 0 to ' + g.start + '.</p>'
          }).then(function () { App.editScore(i); });
        }
        X01.snapshot(g);
        p.score = n;
        if (n < g.start) p.opened = true;   /* they've clearly scored, so double-in is done */
        if (i === g.cur) g.turn = { darts: [], start: n };   /* the in-progress turn's baseline moved */
        g.flash = null;
        App.render();
      });
    },

    ENTRY_NAME: { darts: 'Dart by dart', total: '3-dart total' },

    setEntry: function (mode) {
      var g = App.game;
      if (!g || g.type !== 'x01' || g.entry === mode) return;
      g.entry = mode;
      App.cfg.entry = mode;
      /* A part-thrown turn cannot be carried across entry modes. */
      if (g.turn.darts.length) {
        g.players[g.cur].score = g.turn.start;
        g.turn = { darts: [], start: g.turn.start };
      }
      g.pending = '';
      g.mult = 1;
      UI.buzz(16);
      App.render();
      UI.toast(App.ENTRY_NAME[mode]);
    },

    /* swipe the keypad left or right to change entry mode ------- */
    onTouchStart: function (e) {
      App.swipe = null;
      if (e.touches.length !== 1 || !e.target.closest || !e.target.closest('.pad')) return;
      App.swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    },

    onTouchEnd: function (e) {
      var s = App.swipe;
      App.swipe = null;
      var g = App.game;
      if (!s || !g || g.type !== 'x01' || g.over) return;

      var t = e.changedTouches[0];
      var dx = t.clientX - s.x, dy = t.clientY - s.y;
      /* Clearly horizontal, far enough to be deliberate, and quick enough
       * that resting a finger on a key never counts. */
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - s.t > 600) return;

      if (e.cancelable) e.preventDefault();
      App.suppressClick = true;                       /* the tap under the swipe is not a throw */
      App.setEntry(g.entry === 'darts' ? 'total' : 'darts');
    },

    /* keyboard (handy when scoring from a laptop) --------------- */
    onKey: function (e) {
      if (!App.game || document.querySelector('.backdrop')) return;
      var g = App.game;
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); return App.undo(); }
      if (g.type !== 'x01' || g.entry !== 'total' || g.over) return;

      if (/^\d$/.test(e.key)) {
        if (g.pending.length < 3) {
          var next = (g.pending + e.key).replace(/^0+(?=\d)/, '');
          if (+next <= 180) g.pending = next;
        }
        App.render();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        g.pending = g.pending.slice(0, -1);
        App.render();
      } else if (e.key === 'Enter' && g.pending !== '') {
        App.submitTotal();
      }
    },

    /* menus ---------------------------------------------------- */
    menu: function () {
      var g = App.game;
      var actions = [{ label: 'Resume', value: null, kind: 'primary' }];
      if (g.history.length) actions.push({ label: 'Undo last dart', value: 'undo' });
      if (g.type === 'x01') {
        actions.push({
          label: g.entry === 'darts' ? 'Switch to 3-dart total' : 'Switch to dart by dart',
          value: 'entry'
        });
      }
      actions.push({ label: 'Restart leg', value: 'restart' });
      actions.push({ label: 'Help', value: 'help' });
      actions.push({ label: 'End game', value: 'end' });

      UI.modal({ title: 'Menu', actions: actions }).then(function (v) {
        if (v === 'undo') return App.undo();
        if (v === 'entry') return App.setEntry(g.entry === 'darts' ? 'total' : 'darts');
        if (v === 'restart') {
          return UI.modal({
            title: 'Restart leg?',
            html: '<p>Scores for this leg are cleared. Legs already won are kept.</p>',
            actions: [{ label: 'Cancel', value: false }, { label: 'Restart', value: true, kind: 'danger' }]
          }).then(function (ok) {
            if (!ok) return;
            var mod = App.mod();
            mod.nextLeg(g);
            g.leg--;                                   /* a restart is not a new leg */
            g.legStarter = (g.legStarter - 1 + g.players.length) % g.players.length;
            g.cur = g.legStarter;
            App.render();
          });
        }
        if (v === 'help') return App.help();
        if (v === 'end') {
          return UI.modal({
            title: 'End game?',
            html: '<p>This game will be discarded.</p>',
            actions: [{ label: 'Cancel', value: false }, { label: 'End game', value: true, kind: 'danger' }]
          }).then(function (ok) {
            if (!ok) return;
            App.game = null;
            App.save();
            App.show('setup');
          });
        }
      });
    },

    help: function () {
      UI.modal({
        title: 'How to use',
        wide: true,
        html:
          '<h3>X01</h3>' +
          '<p><b>Dart by dart</b> — pick SINGLE, DOUBLE or TREBLE, then the number. The multiplier ' +
          'resets to SINGLE after every dart. The score counts down as you throw and the checkout ' +
          'appears the moment one exists for the darts you have left. The turn ends after three ' +
          'darts, or tap END to finish early.</p>' +
          '<p><b>3-dart total</b> — type the whole visit and press ENTER, or tap a common score. ' +
          'Checkouts are shown for a full three darts.</p>' +
          '<p><b>Swipe the keypad left or right</b> to flip between the two entry modes ' +
          'without opening this menu.</p>' +
          '<p><b>Bacon and eggs</b> is a breakfast (26), <b>fish and chips</b> is 41, ' +
          '<b>100</b> is a ton, and <b>Fuck All</b> is a scoreless visit. Dart by dart they ' +
          'fill in the actual darts — 20, 5, 1 for a breakfast and three misses for fuck all — ' +
          'so busts and checkouts still work normally.</p>' +
          '<p>Busts revert the whole turn. With double out, leaving 1 is a bust, and only a double ' +
          'finishes. Switch entry mode any time from the menu.</p>' +
          '<p><b>Press and hold a score</b> — the big one or a player card — to type in a ' +
          'correction directly, instead of undoing dart by dart.</p>' +
          '<h3>Cricket</h3>' +
          '<p>There are no turns — either player\'s column is live at all times, so mark ' +
          'whoever\'s dart just landed. One tap is one mark. Hit a treble by tapping three ' +
          'times; a treble plus two singles on the same number is five taps. Three marks ' +
          'close a number; extra marks score while an opponent still has it open. Bull is ' +
          'one mark for the outer ring, two for the bullseye.</p>' +
          '<p><b>Press and hold the grid</b> to show a row-undo button on each number; tap ' +
          'one to take back that row\'s last mark and its points. Long-press again, or tap ' +
          'Done, to leave.</p>' +
          '<h3>Anywhere</h3>' +
          '<p>The arrow in the top right undoes a dart at a time. Add this page to your home ' +
          'screen to run it fullscreen and offline.</p>'
      });
    }
  };

  global.App = App;
  document.addEventListener('DOMContentLoaded', App.init);
})(window);
