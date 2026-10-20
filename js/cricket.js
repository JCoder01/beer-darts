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
        /* cur/legStarter are bookkeeping only now, not a turn gate: cur is
         * whoever was last marked (used to break a simultaneous-win tie in
         * their favour), legStarter just rotates so nextLeg has something
         * to advance. Nothing in play disables a column based on either. */
        cur: 0, legStarter: 0, leg: 1,
        flash: null,
        /* One entry per mark ever placed: { p, t, pts, to }. Powers the
         * per-cell take-back -- reversing one mark needs to know exactly what
         * points it awarded and to whom, which a state snapshot can't isolate. */
        log: [],
        /* The ledger: every mark and take-back, kept across legs. Unlike
         * `log` it is append-only -- a take-back is a row of its own. */
        rounds: [],
        editing: null,   /* null, or the index of the column being corrected */
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
    isDead: function (g, t) {
      return g.players.every(function (p) { return p.marks[t] >= 3; });
    },

    closedAll: function (g, p) {
      return g.targets.every(function (t) { return p.marks[t] >= 3; });
    },

    /* There are no turns to manage: either player's column is tappable at
     * any time, so `i` says who was just marked. One tap is one mark,
     * always — a treble is three taps on the same cell, landing on the
     * exact same marks/points a multiplier-selected tap once did, since the
     * overflow math below only cares about the running total. */
    throwMark: function (g, i, target) {
      if (g.over) return;
      Cricket.snapshot(g);

      var p = g.players[i];
      var had = p.marks[target];
      var total = had + 1;
      var overflow = Math.max(0, total - 3);
      p.marks[target] = Math.min(3, total);

      var pts = 0, to = [];
      if (overflow > 0 && g.variant !== 'noscore') {
        var open = g.players.some(function (o, j) {
          return j !== i && o.marks[target] < 3;
        });
        if (open) {
          pts = overflow * target;
          if (g.variant === 'cutthroat') {
            g.players.forEach(function (o, j) {
              if (j !== i && o.marks[target] < 3) { o.score += pts; to.push(j); }
            });
          } else {
            p.score += pts;
            to.push(i);
          }
        }
      }

      g.log.push({ p: i, t: target, pts: pts, to: to });
      (g.rounds = g.rounds || []).push({ p: i, t: target, pts: pts, to: to, leg: g.leg });
      g.cur = i;
      g.flash = { name: p.name, label: label(target), pts: pts };
      Cricket.checkWin(g, i);
    },

    cellLog: function (g, i, t) {
      return g.log.filter(function (e) { return e.p === i && e.t === t; });
    },

    /* Take back one player's single most recent mark on one number --
     * decrement their marks by one and reverse exactly the points that mark
     * awarded. Nothing else moves. */
    undoMark: function (g, i, t) {
      var idx = -1;
      for (var k = g.log.length - 1; k >= 0; k--) {
        if (g.log[k].p === i && g.log[k].t === t) { idx = k; break; }
      }
      if (idx === -1) return false;

      Cricket.snapshot(g);   /* so the top-bar undo can reverse this correction */
      var entry = g.log.splice(idx, 1)[0];
      entry.to.forEach(function (j) { g.players[j].score -= entry.pts; });
      (g.rounds = g.rounds || []).push({ p: i, t: t, pts: entry.pts, to: entry.to, leg: g.leg, undo: true });

      var left = 0;
      for (var m = 0; m < g.log.length; m++) {
        if (g.log[m].p === i && g.log[m].t === t) left++;
      }
      g.players[i].marks[t] = Math.min(3, left);

      /* Undoing the mark that closed someone out can un-finish the game. */
      if (g.over && (g.winner == null || !Cricket.closedAll(g, g.players[g.winner]))) {
        g.over = false; g.winner = null; g.announce = null;
      }
      g.flash = { name: g.players[i].name, label: '−' + label(t), pts: 0 };
      return true;
    },

    /* Cutthroat can hand the win to somebody else, so check everyone --
     * `actingIndex` (whoever was just marked) gets priority on a tie. */
    checkWin: function (g, actingIndex) {
      var order = [actingIndex].concat(g.players.map(function (_, i) { return i; }));
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

    nextLeg: function (g) {
      g.leg++;
      g.legStarter = (g.legStarter + 1) % g.players.length;
      g.cur = g.legStarter;
      g.players.forEach(function (p) {
        g.targets.forEach(function (t) { p.marks[t] = 0; });
        p.score = 0;
      });
      g.flash = null;
      g.log = [];
      g.editing = null;
      g.announce = null;
      g.history = [];
    },

    /* ledger ---------------------------------------------------- */
    /* There are no turns, so a row is a run of marks on one team with no
     * other team marked in between -- which is what a visit looks like at
     * the board. Take-backs get rows of their own. */
    ledgerHtml: function (g) {
      var e = UI.esc, rows = g.rounds || [], html = '', leg;
      var scoring = g.variant !== 'noscore';
      if (!rows.length) return '<p>No marks yet.</p>';

      for (leg = 1; leg <= g.leg; leg++) {
        var runs = [];
        rows.forEach(function (r) {
          if (r.leg !== leg) return;
          var last = runs[runs.length - 1];
          if (last && last.p === r.p && last.undo === !!r.undo) last.marks.push(r);
          else runs.push({ p: r.p, undo: !!r.undo, marks: [r] });
        });
        if (!runs.length) continue;

        if (g.legsToWin > 1 || g.leg > 1) html += '<h3>Leg ' + leg + '</h3>';
        html += '<div class="ledger-wrap"><table class="ledger cledger"><thead><tr>' +
          '<th></th><th>Team</th><th>Marks</th>' + (scoring ? '<th>Pts</th>' : '') +
          '</tr></thead><tbody>';

        var count = g.players.map(function () { return 0; });
        runs.forEach(function (run, k) {
          /* Same number back to back reads as one hit: 20×3 for a treble. */
          var groups = [];
          run.marks.forEach(function (m) {
            var gl = groups[groups.length - 1];
            if (gl && gl.t === m.t) gl.n++;
            else groups.push({ t: m.t, n: 1 });
          });
          /* In the leg in play, each number is a take-back button while that
           * team still has a mark on it -- the same correction a long-press
           * offers, so the points come off exactly as they went on. */
          var marks = groups.map(function (gp) {
            var txt = (run.undo ? '&minus;' : '') + label(gp.t) + (gp.n > 1 ? '&times;' + gp.n : '');
            var live = leg === g.leg && !run.undo && Cricket.cellLog(g, run.p, gp.t).length > 0;
            return live
              ? '<button class="lg-mk" data-cp="' + run.p + '" data-ct="' + gp.t + '">' + txt + '</button>'
              : txt;
          }).join(' &middot; ');

          /* Cutthroat hands points to the others, so say whose they are. */
          var pts = {};
          run.marks.forEach(function (m) {
            m.to.forEach(function (j) { pts[j] = (pts[j] || 0) + m.pts; });
          });
          var ptsHtml = Object.keys(pts).map(function (j) {
            return (run.undo ? '&minus;' : '+') + pts[j] +
              (g.variant === 'cutthroat' ? ' <span class="lg-to">' + e(g.players[j].name) + '</span>' : '');
          }).join('<br>');

          count[run.p] += run.undo ? -run.marks.length : run.marks.length;
          html += '<tr' + (run.undo ? ' class="edit"' : '') + '><th>' + (k + 1) + '</th>' +
            '<td class="lg-team">' + (run.undo ? '&#9998; ' : '') + e(g.players[run.p].name) + '</td>' +
            '<td class="lg-marks">' + marks + '</td>' +
            (scoring ? '<td class="lg-pts">' + ptsHtml + '</td>' : '') + '</tr>';
        });

        html += '</tbody></table></div>' +
          '<p class="lg-sum">Marks: ' + g.players.map(function (p, i) {
            return e(p.name) + ' <b>' + count[i] + '</b>';
          }).join(' &middot; ') + '</p>';
      }
      return html;
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
          '<button class="btn ledger-btn" data-act="ledger">Ledger</button>' +
          '<button class="btn ghost" data-act="undo"' + (g.history.length ? '' : ' disabled') +
            ' aria-label="Undo">&#8630;</button>' +
        '</header>';

      /* One flex row per target, plus the header row, rather than a CSS Grid:
       * Grid's fr-track row sizing is unreliable on pre-2020 Safari and let
       * rows overflow their box there. Flex rows shrink identically on every
       * engine. Every row repeats the same column widths so they line up
       * without Grid's shared column tracks to lean on. */
      var edit = g.editing;   /* null, or the index of the column being corrected */
      var editN = (edit != null && g.players[edit]) ? edit : null;

      var grid = '<div class="cgrid' + (editN != null ? ' editing' : '') + '">';

      if (editN != null) {
        /* Long-press on a team put that column into correction mode. A
         * floating bar, not a layout row -- same trick as the flash, which
         * it replaces while it shows. */
        grid += '<div class="editbar">Editing ' + e(g.players[editN].name) +
          ' &mdash; tap a mark to take it back' +
          '<button class="btn" data-act="editdone">Done</button></div>';
      } else {
        /* No turn to announce, so feedback is a single tap's result, shown as
         * a floating badge over the grid rather than a permanent status row --
         * same pattern as X01's flash, which costs no layout space either. */
        grid += g.flash
          ? '<div class="flash">' + e(g.flash.name) + ': ' + g.flash.label +
            (g.flash.pts ? ' &middot; +' + g.flash.pts : '') + '</div>'
          : '';
      }

      /* The number column sits between two groups of players rather than
       * off to one side, so every player's marks are right next to it. For
       * two players that's a clean one-a-side split; odd counts put the
       * extra player on the left. */
      var leftN = Math.ceil(n / 2);

      function playerCell(i) {
        var p = g.players[i];
        /* Tapping a team opens the ledger; holding it still starts a correction. */
        return '<div class="ch' + (editN === i ? ' editing' : '') + '" data-i="' + i + '" data-act="ledger">' +
          '<div class="ch-name">' + e(p.name) + '</div>' +
          (g.variant === 'noscore'
            ? ''
            : '<div class="ch-score">' + p.score + '</div>') +
          (g.legsToWin > 1 ? '<div class="ch-legs">legs ' + p.legs + '</div>' : '') +
        '</div>';
      }

      grid += '<div class="crow">';
      for (var h = 0; h < leftN; h++) grid += playerCell(h);
      grid += '<div class="ch corner"></div>';
      for (var h2 = leftN; h2 < n; h2++) grid += playerCell(h2);
      grid += '</div>';

      /* Every player's cell is live at once -- there is no "whose turn" to
       * gate on. In the edited column each cell instead becomes a take-back
       * button for that player's last mark on that number; the other column
       * stays normal. */
      function markCell(t, i, dead) {
        var p = g.players[i];
        var m = p.marks[t];
        var editingThis = editN === i;
        var canUndo = editingThis && Cricket.cellLog(g, i, t).length > 0;
        var cls = 'cc' + (dead ? ' dead' : '') + (m >= 3 ? ' closed' : '') +
          (editingThis ? ' editing' : '');
        var attrs = ' data-t="' + t + '" data-p="' + i + '"';
        if (editingThis) {
          attrs += canUndo ? ' data-act="undocell"' : ' disabled';
        } else if (!g.over) {
          attrs += ' data-act="mark"';
        } else {
          attrs += ' disabled';
        }
        return '<button class="' + cls + '"' + attrs +
          ' aria-label="' + e(p.name) + ' ' + label(t) + ', ' + m + ' marks' +
          (editingThis ? ' — tap to take one back' : '') + '">' +
          '<span class="mk" data-m="' + m + '"></span>' +
          (editingThis ? '<span class="cc-minus">&minus;</span>' : '') +
        '</button>';
      }

      g.targets.forEach(function (t) {
        var dead = Cricket.isDead(g, t);
        grid += '<div class="crow">';
        for (var i = 0; i < leftN; i++) grid += markCell(t, i, dead);
        grid += '<div class="ct' + (dead ? ' dead' : '') + '">' + label(t) + '</div>';
        for (var j = leftN; j < n; j++) grid += markCell(t, j, dead);
        grid += '</div>';
      });
      grid += '</div>';

      return header + grid;
    }
  };

  global.Cricket = Cricket;
})(window);
