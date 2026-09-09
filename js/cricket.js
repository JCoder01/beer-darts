/* Cricket: standard, cutthroat and no-score. */
(function (global) {
  'use strict';

  var RANGES = {
    std: [20, 19, 18, 17, 16, 15, 25],
    wide: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 25]
  };
  var VARIANT_NAME = { standard: 'Standard', cutthroat: 'Cutthroat', noscore: 'No score' };

  function label(t) { return t === 25 ? 'BULL' : String(t); }

  var Cricket = {
    RANGES: RANGES,

    create: function (cfg) {
      var targets = RANGES[cfg.range] || RANGES.std;
      return {
        type: 'cricket',
        variant: cfg.variant, targets: targets, legsToWin: cfg.legs,
        players: cfg.players.map(function (n) {
          var marks = {};
          targets.forEach(function (t) { marks[t] = 0; });
          return { name: n, marks: marks, score: 0, legs: 0 };
        }),
        cur: 0, legStarter: 0, leg: 1,
        turn: { darts: [] },
        mult: 1, flash: null,
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

    /* rules ---------------------------------------------------- */
    dartsLeft: function (g) { return 3 - g.turn.darts.length; },

    isDead: function (g, t) {
      return g.players.every(function (p) { return p.marks[t] >= 3; });
    },

    closedAll: function (g, p) {
      return g.targets.every(function (t) { return p.marks[t] >= 3; });
    },

    throwMark: function (g, target, mult) {
      if (g.over || Cricket.dartsLeft(g) < 1) return;
      Cricket.snapshot(g);
      g.flash = null;

      var p = g.players[g.cur];

      if (target === null) {                       /* a miss still burns a dart */
        g.turn.darts.push({ label: 'MISS', marks: 0, pts: 0 });
      } else {
        if (target === 25 && mult === 3) mult = 2; /* no treble bull exists */

        var had = p.marks[target];
        var total = had + mult;
        var overflow = Math.max(0, total - 3);
        p.marks[target] = Math.min(3, total);

        var pts = 0;
        if (overflow > 0 && g.variant !== 'noscore') {
          var open = g.players.some(function (o, i) {
            return i !== g.cur && o.marks[target] < 3;
          });
          if (open) {
            pts = overflow * target;
            if (g.variant === 'cutthroat') {
              g.players.forEach(function (o, i) {
                if (i !== g.cur && o.marks[target] < 3) o.score += pts;
              });
            } else {
              p.score += pts;
            }
          }
        }
        g.turn.darts.push({ label: (mult > 1 ? mult + 'x' : '') + label(target), marks: mult, pts: pts });
      }

      g.mult = 1;
      if (Cricket.checkWin(g)) return;
      if (Cricket.dartsLeft(g) === 0) Cricket.endTurn(g);
    },

    /* Cutthroat can hand the win to somebody else, so check everyone. */
    checkWin: function (g) {
      var order = [g.cur].concat(g.players.map(function (_, i) { return i; }));
      for (var k = 0; k < order.length; k++) {
        var i = order[k], p = g.players[i];
        if (!Cricket.closedAll(g, p)) continue;

        var ok = true;
        if (g.variant === 'standard') {
          ok = g.players.every(function (o, j) { return j === i || p.score >= o.score; });
        } else if (g.variant === 'cutthroat') {
          ok = g.players.every(function (o, j) { return j === i || p.score <= o.score; });
        }
        if (!ok) continue;

        p.legs++;
        if (p.legs >= g.legsToWin) { g.over = true; g.winner = i; }
        g.announce = { player: i, over: g.over };
        return true;
      }
      return false;
    },

    endTurn: function (g) {
      var p = g.players[g.cur];
      var marks = g.turn.darts.reduce(function (a, d) { return a + d.marks; }, 0);
      var pts = g.turn.darts.reduce(function (a, d) { return a + d.pts; }, 0);
      g.flash = { name: p.name, marks: marks, pts: pts };

      g.cur = (g.cur + 1) % g.players.length;
      g.turn = { darts: [] };
      g.mult = 1;
    },

    nextLeg: function (g) {
      g.leg++;
      g.legStarter = (g.legStarter + 1) % g.players.length;
      g.cur = g.legStarter;
      g.players.forEach(function (p) {
        g.targets.forEach(function (t) { p.marks[t] = 0; });
        p.score = 0;
      });
      g.turn = { darts: [] };
      g.mult = 1;
      g.flash = null;
      g.announce = null;
      g.history = [];
    },

    /* render --------------------------------------------------- */
    render: function (g) {
      var e = UI.esc;
      var n = g.players.length;

      var header =
        '<header class="topbar">' +
          '<button class="btn ghost" data-act="menu" aria-label="Menu">&#9776;</button>' +
          '<div class="topinfo">Cricket &middot; ' + VARIANT_NAME[g.variant] +
            (g.legsToWin > 1 ? ' &middot; Leg ' + g.leg : '') + '</div>' +
          '<button class="btn ghost" data-act="undo"' + (g.history.length ? '' : ' disabled') +
            ' aria-label="Undo">&#8630;</button>' +
        '</header>';

      var grid = '<div class="cgrid" style="--cols:' + n + '">';

      grid += '<div class="ch corner"></div>';
      g.players.forEach(function (p, i) {
        grid += '<div class="ch' + (i === g.cur ? ' on' : '') + '">' +
          '<div class="ch-name">' + e(p.name) + '</div>' +
          (g.variant === 'noscore'
            ? ''
            : '<div class="ch-score">' + p.score + '</div>') +
          (g.legsToWin > 1 ? '<div class="ch-legs">legs ' + p.legs + '</div>' : '') +
        '</div>';
      });

      g.targets.forEach(function (t) {
        var dead = Cricket.isDead(g, t);
        grid += '<div class="ct' + (dead ? ' dead' : '') + '">' + label(t) + '</div>';
        g.players.forEach(function (p, i) {
          var m = p.marks[t];
          var active = i === g.cur && !g.over;
          grid += '<button class="cc' + (i === g.cur ? ' on' : '') + (dead ? ' dead' : '') +
            (m >= 3 ? ' closed' : '') + '"' +
            (active ? ' data-act="mark" data-t="' + t + '"' : ' disabled') +
            ' aria-label="' + e(p.name) + ' ' + label(t) + ', ' + m + ' marks">' +
            '<span class="mk" data-m="' + m + '"></span></button>';
        });
      });
      grid += '</div>';

      var slots = '';
      for (var i = 0; i < 3; i++) {
        var d = g.turn.darts[i];
        slots += '<span class="dslot sm' + (d ? ' filled' : '') + '">' +
          (d ? e(d.label) : '&middot;') + '</span>';
      }

      var flash = g.flash
        ? '<span class="cflash">' + e(g.flash.name) + ': ' + g.flash.marks + ' mark' +
          (g.flash.marks === 1 ? '' : 's') + (g.flash.pts ? ' &middot; ' + g.flash.pts : '') + '</span>'
        : '';

      var m = g.mult;
      var pad = '<div class="pad cricket">' +
        '<div class="turnbar">' + slots + flash + '</div>' +
        '<div class="multrow">' +
          '<button class="key mult' + (m === 1 ? ' on' : '') + '" data-act="mult" data-v="1">SINGLE</button>' +
          '<button class="key mult' + (m === 2 ? ' on' : '') + '" data-act="mult" data-v="2">DOUBLE</button>' +
          '<button class="key mult' + (m === 3 ? ' on' : '') + '" data-act="mult" data-v="3">TREBLE</button>' +
          '<button class="key alt" data-act="miss">MISS</button>' +
          '<button class="key alt go" data-act="endturn"' +
            (g.turn.darts.length && g.turn.darts.length < 3 ? '' : ' disabled') + '>END</button>' +
        '</div>' +
      '</div>';

      return header + grid + pad;
    }
  };

  global.Cricket = Cricket;
})(window);
