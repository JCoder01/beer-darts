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
        /* Throw for the middle before the first leg; nothing to settle solo. */
        diddle: cfg.players.length > 1,
        rounds: [],
        history: []
      };
    },

    /* Whoever won the diddle starts; later legs rotate on from them. */
    setFirst: function (g, i) {
      g.cur = g.legStarter = i;
      g.turn = { darts: [], start: g.players[i].score };
      g.diddle = false;
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

    /* The ledger: one row per finished visit, kept across legs. It lives on
     * the game, so undo snapshots roll it back along with everything else. */
    log: function (g, row) {
      row.p = g.cur;
      row.leg = g.leg;
      (g.rounds = g.rounds || []).push(row);
    },

    dartLabels: function (g) {
      return g.entry === 'darts' ? g.turn.darts.map(function (d) { return d.label; }) : null;
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
      X01.log(g, { scored: scored, n: thrown, bust: !!bust, left: p.score, darts: X01.dartLabels(g) });

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
      X01.log(g, { scored: g.turn.start, n: thrown, out: true, left: 0, darts: X01.dartLabels(g) });

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
      if (g.diddle) return X01.renderDiddle(g);
      var e = UI.esc;
      var p = g.players[g.cur];
      var left = X01.dartsLeft(g);

      var header =
        '<header class="topbar">' +
          '<button class="btn ghost" data-act="menu" aria-label="Menu">&#9776;</button>' +
          '<div class="topinfo">' + g.start + ' &middot; ' + MODE_NAME[g.outMode] +
            (g.doubleIn ? ' &middot; Double in' : '') +
            (g.legsToWin > 1 ? ' &middot; Leg ' + g.leg : '') + '</div>' +
          '<button class="btn ledger-btn" data-act="ledger">Ledger</button>' +
          '<button class="btn ghost" data-act="undo"' + (g.history.length ? '' : ' disabled') +
            ' aria-label="Undo">&#8630;</button>' +
        '</header>';

      /* Tapping a card opens the ledger; holding it still edits the score. */
      var cards = g.players.map(function (pl, i) {
        var a = X01.avg(pl);
        return '<div class="pcard' + (i === g.cur ? ' on' : '') + '" data-i="' + i + '" data-act="ledger">' +
          '<div class="pc-top"><span class="pc-name">' + e(pl.name) + '</span>' +
            (g.legsToWin > 1 ? '<span class="pc-legs">' + pl.legs + '</span>' : '') + '</div>' +
          '<div class="pc-score">' + pl.score + '</div>' +
          '<div class="pc-meta">' + X01.lastPill(pl.last) +
            '<span class="pc-avg">avg ' + (a ? a.toFixed(1) : '&ndash;') + '</span></div>' +
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

    /* The previous visit, beside the score where it can be read from the oche. */
    lastPill: function (last) {
      if (last === null || last === undefined) return '';
      var cls = last === 'BUST' ? ' bust' : last >= 100 ? ' big' : '';
      return '<span class="pc-last' + cls + '">' + (last === 'BUST' ? 'BUST' : '&minus;' + last) + '</span>';
    },

    /* Every visit so far, a table per leg: a row per round, a column per
     * player in the scoreboard's order. */
    ledgerHtml: function (g) {
      var e = UI.esc, rows = g.rounds || [], n = g.players.length, html = '', leg;
      if (!rows.length) return '<p>No rounds yet.</p>';

      /* Each copy remembers its place in g.rounds, so a tapped cell can say
       * which visit to change even after a correction has been merged in. */
      var indexed = rows.map(function (r, ri) { return Object.assign({ ri: ri }, r); });

      for (leg = 1; leg <= g.leg; leg++) {
        var inLeg = indexed.filter(function (r) { return r.leg === leg; });
        if (!inLeg.length) continue;
        /* Only the leg in play can change; an earlier one may have decided a winner. */
        var editable = leg === g.leg && !g.over;

        /* Columns follow the scoreboard's order so a player stays in the same
         * place on both; whoever started the leg is tagged instead. A
         * correction is not a visit, so the first real one decides. */
        var opener = inLeg.filter(function (r) { return !r.edit; })[0];
        var first = opener ? opener.p : null;
        /* A correction rides on the visit before it rather than taking a
         * round's row and pushing later visits down. */
        var cols = g.players.map(function (_, pi) {
          var col = [];
          inLeg.forEach(function (r) {
            if (r.p !== pi) return;
            var prev = col[col.length - 1];
            if (r.edit && prev && !prev.edit) col[col.length - 1] = Object.assign({}, prev, { fixed: r.left });
            else col.push(r);
          });
          return col;
        });
        var depth = Math.max.apply(null, cols.map(function (c) { return c.length; }));

        if (g.legsToWin > 1 || g.leg > 1) html += '<h3>Leg ' + leg + '</h3>';
        html += '<div class="ledger-wrap"><table class="ledger"><thead><tr><th></th>' +
          g.players.map(function (pl, pi) {
            return '<th>' + e(pl.name) +
              (pi === first && n > 1 ? '<span class="lg-first">1st</span>' : '') + '</th>';
          }).join('') +
          '</tr></thead><tbody>';

        for (var r = 0; r < depth; r++) {
          html += '<tr><th>' + (r + 1) + '</th>' + cols.map(function (c) {
            var v = c[r];
            if (!v) return '<td></td>';
            var main = v.edit ? '&#9998;' : v.bust ? 'BUST' : v.scored;
            var cls = v.edit ? 'edit' : v.bust ? 'bust' : v.out ? 'out' : v.scored >= 100 ? 'big' : '';
            var tap = editable && !v.edit && !v.out;
            return '<td class="' + cls + (tap ? ' can-edit' : '') + '"' + (tap ? ' data-ri="' + v.ri + '"' : '') + '>' +
              '<span class="lg-sc">' + main + (v.changed ? '<sup class="lg-mark">&#9998;</sup>' : '') + '</span>' +
              '<span class="lg-left">' + (v.out ? 'out' : v.left) + '</span>' +
              (v.darts && v.darts.length ? '<span class="lg-darts">' + e(v.darts.join(' ')) + '</span>' : '') +
              (v.fixed != null ? '<span class="lg-fix">&#9998; ' + v.fixed + '</span>' : '') +
            '</td>';
          }).join('') + '</tr>';
        }

        /* A per-leg average, counting only real visits, not corrections. */
        html += '</tbody><tfoot><tr><th>avg</th>' + cols.map(function (c) {
          var pts = 0, darts = 0;
          c.forEach(function (v) { if (!v.edit) { pts += v.scored; darts += v.n; } });
          return '<td>' + (darts ? (pts / darts * 3).toFixed(1) : '&ndash;') + '</td>';
        }).join('') + '</tr></tfoot></table></div>';
      }
      return html;
    },

    /* Change one visit's total after the fact. Every later visit by that
     * player keeps what it scored, so their remaining scores all shift by
     * the difference; refuse the change if any of them would no longer be a
     * legal place to stand. Returns an error to show, or null once applied. */
    editRound: function (g, ri, total) {
      var row = g.rounds[ri];
      if (!row || row.leg !== g.leg || row.edit || row.out || g.over) return 'That round can no longer be changed.';
      if (Checkout.impossibleTotal(total)) return 'No three darts make ' + total + '.';
      var pi = row.p, p = g.players[pi];

      /* The walk below rebuilds the leg from the ledger alone, so first make
       * sure the ledger holds all of it: a game started before rounds were
       * logged, for one, would land somewhere the player is not. */
      var check = g.start;
      g.rounds.forEach(function (x) {
        if (x.p !== pi || x.leg !== g.leg) return;
        check = x.edit ? x.left : check - (x.bust ? 0 : x.scored);
      });
      if (check !== (g.cur === pi ? g.turn.start : p.score)) {
        return 'This leg started before the ledger did, so its rounds can\'t be changed. Hold the score to correct it instead.';
      }

      /* Walk the player's leg with the new value, checking each landing. */
      var s = g.start, lefts = [], k, r;
      for (k = 0; k < g.rounds.length; k++) {
        r = g.rounds[k];
        if (r.p !== pi || r.leg !== g.leg) continue;
        if (r.edit) { s = r.left; lefts.push([k, s]); continue; }
        var scored = k === ri ? total : r.scored;
        s -= scored;
        if (s < 0 || (s === 1 && g.outMode !== 'straight')) {
          return 'That would leave ' + p.name + ' on ' + s + (k === ri ? '' : ' by a later round') + '.';
        }
        if (s === 0) return 'That would be a checkout. Undo back to that round to finish the leg instead.';
        lefts.push([k, s]);
      }

      /* A turn in progress sits on top of the last landing, so it moves too. */
      var delta = (row.bust ? 0 : row.scored) - total;
      var inTurn = g.cur === pi ? g.turn.start - p.score : 0;
      var after = s - inTurn;
      if (after < 0 || (after === 1 && g.outMode !== 'straight')) {
        return 'That would leave the turn in progress on ' + after + '.';
      }

      X01.snapshot(g);
      lefts.forEach(function (kl) { g.rounds[kl[0]].left = kl[1]; });
      p.scored -= delta;
      row.scored = total;
      row.bust = false;
      row.changed = true;
      row.darts = null;   /* the darts no longer add up to it */
      if (g.cur === pi) g.turn.start = s;
      p.score = after;
      if (total > 0) p.opened = true;

      /* Best and last come from the ledger, which is now the truth. */
      var mine = g.rounds.filter(function (x) { return x.p === pi && !x.edit; });
      p.best = mine.reduce(function (b, x) { return x.bust ? b : Math.max(b, x.scored); }, 0);
      var last = mine[mine.length - 1];
      if (last) p.last = last.bust ? 'BUST' : last.scored;
      g.flash = null;
      return null;
    },

    /* Before the first leg: one dart each at the bull, closest throws first. */
    renderDiddle: function (g) {
      var e = UI.esc;
      return '<header class="topbar">' +
          '<button class="btn ghost" data-act="diddle-back" aria-label="Back to setup">&#8249;</button>' +
          '<div class="topinfo">' + g.start + ' &middot; ' + MODE_NAME[g.outMode] + '</div>' +
          '<span class="btn ghost" aria-hidden="true"></span>' +   /* balances the back arrow */
        '</header>' +
        '<div class="scroll">' +
          '<div class="diddle-hero">' +
            '<div class="dh-icon" aria-hidden="true">🎯</div>' +
            '<h1 class="dh-title">Diddle in the <span>Middle</span></h1>' +
            '<p class="dh-sub">One dart each at the bull. Tap whoever landed closest.</p>' +
          '</div>' +
          '<div class="panel">' +
            '<h2>Who throws first?</h2>' +
            '<div class="diddle-list">' + g.players.map(function (pl, i) {
              return '<button class="btn xl" data-act="first" data-i="' + i + '">' + e(pl.name) + '</button>';
            }).join('') + '</div>' +
          '</div>' +
        '</div>' +
        '<footer class="bottombar">' +
          '<button class="btn wide" data-act="skip-diddle">Skip &mdash; ' + e(g.players[0].name) + ' throws first</button>' +
        '</footer>';
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
