/* X01: 301/501/701/901, dart-by-dart or 3-dart-total entry. */
(function (global) {
  'use strict';

  var MODE_NAME = { double: 'Double out', master: 'Master out', straight: 'Straight out' };

  /* U+1F953 bacon + U+1F373 cooking, and U+1F4AF hundred points for a ton.
   * This file is UTF-8 and is served as such; the page declares it too. */
  var BACON_EGGS = '🥓🍳';
  var FISH_CHIPS = '🐟🍟';
  var NUTS = '🥜';
  var TON = '💯';
  var FIRE = '🔥';

  function newPlayer(name, start, doubleIn) {
    return {
      name: name, score: start, legs: 0,
      opened: !doubleIn,
      darts: 0, scored: 0, best: 0, last: null
    };
  }

  var X01 = {
    create: function (cfg) {
      return {
        type: 'x01',
        start: cfg.start, outMode: cfg.outMode, doubleIn: cfg.doubleIn,
        legsToWin: cfg.legs, entry: cfg.entry,
        players: cfg.players.map(function (n) { return newPlayer(n, cfg.start, cfg.doubleIn); }),
        cur: 0, legStarter: 0, leg: 1,
        turn: { darts: [], start: cfg.start },
        mult: 1, pending: '', flash: null,
        over: false, winner: null, announce: null,
        history: []
      };
    },

    /* history -------------------------------------------------- */
    snapshot: function (g) {
      var h = g.history;
      g.history = [];
      var s = JSON.stringify(g);
      g.history = h;
      h.push(s);
      if (h.length > 300) h.shift();
    },

    undo: function (g) {
      if (!g.history.length) return g;
      var h = g.history;
      var ng = JSON.parse(h.pop());
      ng.history = h;
      return ng;
    },

    /* play ----------------------------------------------------- */
    dartsLeft: function (g) { return 3 - g.turn.darts.length; },

    checkout: function (g) {
      var p = g.players[g.cur];
      if (!p.opened) return [];
      var left = g.entry === 'total' ? 3 : X01.dartsLeft(g);
      return Checkout.find(p.score, left, g.outMode);
    },

    throwDart: function (g, base, mult, label) {
      if (g.over || X01.dartsLeft(g) < 1) return;
      X01.snapshot(g);
      g.flash = null;

      var p = g.players[g.cur];
      var scored = base * mult;

      /* Double in: everything before the opening double is dead. */
      if (!p.opened) {
        if (mult === 2) p.opened = true;
        else scored = 0;
      }

      var nr = p.score - scored;
      var bust = nr < 0 ||
        (nr === 0 && !Checkout.isValidFinish(mult, g.outMode)) ||
        (nr === 1 && g.outMode !== 'straight');

      g.turn.darts.push({ label: label, value: base * mult, scored: bust ? 0 : scored });
      g.mult = 1;

      if (bust) { X01.endTurn(g, true); return; }

      p.score = nr;
      if (nr === 0) { X01.winLeg(g); return; }
      if (X01.dartsLeft(g) === 0) X01.endTurn(g, false);
    },

    /* 3-dart total entry. `darts` is how many were really thrown on a checkout. */
    enterTotal: function (g, total, darts) {
      if (g.over) return null;
      var p = g.players[g.cur];
      if (Checkout.impossibleTotal(total)) return 'No three darts make ' + total + '.';

      var nr = p.score - total;
      var bust = nr < 0 || (nr === 1 && g.outMode !== 'straight');

      X01.snapshot(g);
      g.flash = null;
      if (total > 0) p.opened = true;   /* assume the opening double was hit */
      g.turn.darts = [{ label: String(total), value: total, scored: bust ? 0 : total }];
      g.pending = '';

      if (bust) { X01.endTurn(g, true, 3); return null; }

      p.score = nr;
      if (nr === 0) X01.winLeg(g, darts || 3);
      else X01.endTurn(g, false, 3);
      return null;
    },

    endTurn: function (g, bust, dartCount) {
      var p = g.players[g.cur];
      if (bust) p.score = g.turn.start;

      var scored = g.turn.start - p.score;
      var thrown = dartCount != null ? dartCount : g.turn.darts.length;

      p.darts += thrown;
      p.scored += scored;
      p.last = bust ? 'BUST' : scored;
      if (!bust && scored > p.best) p.best = scored;

      g.flash = { name: p.name, bust: !!bust, scored: scored };

      g.cur = (g.cur + 1) % g.players.length;
      g.turn = { darts: [], start: g.players[g.cur].score };
      g.mult = 1;
      g.pending = '';
    },

    winLeg: function (g, dartCount) {
      var p = g.players[g.cur];
      var thrown = dartCount != null ? dartCount : g.turn.darts.length;

      p.darts += thrown;
      p.scored += g.turn.start;
      p.last = g.turn.start;
      if (g.turn.start > p.best) p.best = g.turn.start;
      p.legs++;

      if (p.legs >= g.legsToWin) { g.over = true; g.winner = g.cur; }
      g.announce = { player: g.cur, over: g.over };
    },

    nextLeg: function (g) {
      g.leg++;
      g.legStarter = (g.legStarter + 1) % g.players.length;
      g.cur = g.legStarter;
      g.players.forEach(function (p) {
        p.score = g.start;
        p.opened = !g.doubleIn;
        p.last = null;
      });
      g.turn = { darts: [], start: g.start };
      g.mult = 1;
      g.pending = '';
      g.flash = null;
      g.announce = null;
      g.history = [];
    },

    avg: function (p) { return p.darts ? (p.scored / p.darts * 3) : 0; },

    /* render --------------------------------------------------- */
    render: function (g) {
      var e = UI.esc;
      var p = g.players[g.cur];
      var left = X01.dartsLeft(g);

      var header =
        '<header class="topbar">' +
          '<button class="btn ghost" data-act="menu" aria-label="Menu">&#9776;</button>' +
          '<div class="topinfo">' + g.start + ' &middot; ' + MODE_NAME[g.outMode] +
            (g.doubleIn ? ' &middot; Double in' : '') +
            (g.legsToWin > 1 ? ' &middot; Leg ' + g.leg : '') + '</div>' +
          '<button class="btn ghost" data-act="undo"' + (g.history.length ? '' : ' disabled') +
            ' aria-label="Undo">&#8630;</button>' +
        '</header>';

      var cards = g.players.map(function (pl, i) {
        var a = X01.avg(pl);
        return '<div class="pcard' + (i === g.cur ? ' on' : '') + '">' +
          '<div class="pc-top"><span class="pc-name">' + e(pl.name) + '</span>' +
            (g.legsToWin > 1 ? '<span class="pc-legs">' + pl.legs + '</span>' : '') + '</div>' +
          '<div class="pc-score">' + pl.score + '</div>' +
          '<div class="pc-meta"><span>avg ' + (a ? a.toFixed(1) : '&ndash;') + '</span>' +
            '<span>' + (pl.last === null ? '' : pl.last) + '</span></div>' +
          (g.doubleIn && !pl.opened ? '<div class="pc-tag">needs double in</div>' : '') +
        '</div>';
      }).join('');

      var slots = '', i;
      if (g.entry === 'darts') {
        for (i = 0; i < 3; i++) {
          var d = g.turn.darts[i];
          slots += '<span class="dslot' + (d ? ' filled' : '') + '">' +
            (d ? e(d.label) : '&middot;') + '</span>';
        }
      } else {
        slots = '<span class="dslot wide' + (g.pending ? ' filled' : '') + '">' +
          (g.pending || '<span class="ph">3-dart total</span>') + '</span>';
      }

      var turnScored = g.turn.darts.reduce(function (a, d) { return a + d.scored; }, 0);

      var routes = X01.checkout(g), co = '';
      if (!p.opened) {
        co = '<div class="checkout warn"><b>Double in</b> &mdash; hit any double to start scoring</div>';
      } else if (routes.length) {
        co = '<div class="checkout on">' +
          '<div class="co-label">Checkout &middot; ' + routes[0].n +
            ' dart' + (routes[0].n > 1 ? 's' : '') + '</div>' +
          '<div class="co-main">' + routes[0].labels.map(function (l) {
            return '<span class="co-dart">' + e(l) + '</span>';
          }).join('') + '</div>' +
          (routes.length > 1
            ? '<div class="co-alt">' + routes.slice(1).map(function (r) {
                return e(r.labels.join(' '));
              }).join('<span class="sep">or</span>') + '</div>'
            : '') +
        '</div>';
      }   /* no out yet: show nothing rather than an empty box */

      var flash = g.flash
        ? '<div class="flash' + (g.flash.bust ? ' bust' : '') + '">' +
            e(g.flash.name) + ': ' + (g.flash.bust ? 'BUST' : g.flash.scored) + '</div>'
        : '';

      /* The out belongs under the score where the eye is; what you are
       * entering belongs down by the keypad where the thumb is. */
      var focus =
        '<div class="focus">' + flash +
          '<div class="focus-name">' + e(p.name) + '</div>' +
          '<div class="focus-score">' + p.score + '</div>' +
          co +
        '</div>';

      var turnzone =
        '<div class="turnzone"><div class="turnrow">' + slots +
          /* Nothing to total in 3-dart entry, so the span is not rendered. */
          (g.entry === 'darts'
            ? '<span class="turntotal">' + (g.turn.darts.length ? turnScored : '') + '</span>'
            : '') +
        '</div></div>';

      return header + '<div class="players">' + cards + '</div>' +
        focus + turnzone + X01.pad(g);
    },

    pad: function (g) {
      if (g.entry === 'total') return X01.padTotal(g);
      var m = g.mult, nums = '', n;
      /* Four explicit rows rather than one grid: Safari 12's Grid does not
       * size fr tracks the way modern engines do, which left the bottom rows
       * overflowing. Nested flex rows behave identically everywhere. */
      for (n = 1; n <= 20; n++) {
        if (n % 5 === 1) nums += '<div class="numrow">';
        nums += '<button class="key num" data-act="num" data-v="' + n + '">' +
          (m === 1 ? n : (m === 2 ? 'D' : 'T') + n) + '</button>';
        if (n % 5 === 0) nums += '</div>';
      }
      return '<div class="pad">' +
        '<div class="multrow">' +
          '<button class="key mult' + (m === 1 ? ' on' : '') + '" data-act="mult" data-v="1">SINGLE</button>' +
          '<button class="key mult' + (m === 2 ? ' on' : '') + '" data-act="mult" data-v="2">DOUBLE</button>' +
          '<button class="key mult' + (m === 3 ? ' on' : '') + '" data-act="mult" data-v="3">TREBLE</button>' +
        '</div>' +
        '<div class="numgrid">' + nums + '</div>' +
        '<div class="slangrow">' +
          X01.slangKey('breakfast', 'Breakfast', BACON_EGGS, 26, X01.dartsLeft(g) < 3) +
          X01.slangKey('fishchips', 'Fish and chips', FISH_CHIPS, 41, X01.dartsLeft(g) < 3) +
          X01.slangKey('fuckall', 'Fuck All', '', 0, X01.dartsLeft(g) < 1) +
        '</div>' +
        '<div class="botrow">' +
          '<button class="key alt" data-act="miss">MISS</button>' +
          '<button class="key alt" data-act="bull" data-v="25">25</button>' +
          '<button class="key alt" data-act="bull" data-v="50">BULL</button>' +
          '<button class="key alt go" data-act="endturn"' +
            (g.turn.darts.length && g.turn.darts.length < 3 ? '' : ' disabled') + '>END</button>' +
        '</div>' +
      '</div>';
    },

    /* An emoji chip keeps its name in aria-label so it is still announced. */
    chipLabel: function (name, emoji) {
      return emoji
        ? '<span class="q-emoji" aria-hidden="true">' + emoji + '</span>'
        : '<span class="q-name">' + UI.esc(name) + '</span>';
    },

    /* Breakfast is 20-5-1, the classic 26. Fuck all is a scoreless visit.
     * The value lives in aria-label only; the face of the key is the label. */
    slangKey: function (act, name, emoji, val, disabled) {
      return '<button class="key slang" data-act="' + act + '"' +
        (disabled ? ' disabled' : '') +
        ' aria-label="' + UI.esc(name) + ', ' + val + '">' +
        X01.chipLabel(name, emoji) + '</button>';
    },

    padTotal: function (g) {
      /* Every chip earns its place with a name. 60, 120 and 180 are one, two
       * and three treble twenties, so they burn one, two and three times. */
      var quick = [
        { v: 0, name: 'Fuck All' },
        { v: 26, name: 'Breakfast', emoji: BACON_EGGS },
        { v: 41, name: 'Fish and chips', emoji: FISH_CHIPS },
        { v: 45, name: "Bag o' nuts", emoji: NUTS },
        { v: 60, name: 'Sixty', emoji: FIRE },
        { v: 100, name: 'Ton', emoji: TON },
        { v: 120, name: 'One twenty', emoji: FIRE + FIRE },
        { v: 180, name: 'Maximum', emoji: FIRE + FIRE + FIRE }
      ];
      var pad = '<div class="pad total">' +
        '<div class="quickrow">' + quick.map(function (q) {
          /* A named chip shows only its label; the rest show their number. */
          return '<button class="key quick" data-act="quick" data-v="' + q.v + '"' +
            (q.name ? ' aria-label="' + UI.esc(q.name) + ', ' + q.v + '"' : '') + '>' +
            (q.name ? X01.chipLabel(q.name, q.emoji)
                    : '<span class="q-val">' + q.v + '</span>') + '</button>';
        }).join('') + '</div><div class="numpad">';
      [7, 8, 9, 4, 5, 6, 1, 2, 3].forEach(function (d, i) {
        if (i % 3 === 0) pad += '<div class="numrow">';
        pad += '<button class="key num" data-act="dig" data-v="' + d + '">' + d + '</button>';
        if (i % 3 === 2) pad += '</div>';
      });
      pad += '<div class="numrow">' +
             '<button class="key alt" data-act="back">&#9003;</button>' +
             '<button class="key num" data-act="dig" data-v="0">0</button>' +
             '<button class="key alt go" data-act="enter"' +
               (g.pending === '' ? ' disabled' : '') + '>ENTER</button>' +
             '</div></div></div>';
      return pad;
    }
  };

  global.X01 = X01;
})(window);
