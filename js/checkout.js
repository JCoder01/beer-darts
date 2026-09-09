/* Checkout finder.
 *
 * Routes are enumerated for real rather than read from a hard-coded table, then
 * ranked the way a player picks one: fewest darts, then how good each throw is,
 * then what each throw leaves behind, then which double you end on. Memoised.
 */
(function (global) {
  'use strict';

  function mk(base, mult, label) {
    return { base: base, mult: mult, value: base * mult, label: label };
  }

  var DARTS = [];
  for (var n = 1; n <= 20; n++) {
    DARTS.push(mk(n, 1, 'S' + n));
    DARTS.push(mk(n, 2, 'D' + n));
    DARTS.push(mk(n, 3, 'T' + n));
  }
  DARTS.push(mk(25, 1, '25'));
  DARTS.push(mk(25, 2, 'BULL'));

  /* How willingly a player throws this dart as a *setup*. Trebles are what you
   * aim at, singles are safe, doubles are thin, and burning the bull to set up
   * is close to unthinkable. */
  function dartQuality(d) {
    if (d.base === 25) return d.mult === 1 ? 2 : -25;
    if (d.mult === 3) return d.base * 0.8;   // nobody aims at T7 by choice
    if (d.mult === 1) return 8 + d.base * 0.1;
    return -4 + d.base * 0.05;
  }

  /* What a setup dart leaves. Only meaningful once you are close enough for the
   * double to matter, which is why 99 comes out T19-10-D16 (leaves 42) and not
   * T20-7-D16 (leaves an odd 39). */
  function leaveQuality(rem, mode) {
    if (mode !== 'double' || rem > 60) return 0;
    var q = (rem % 2 === 0) ? 5 : -5;
    if (rem <= 40 && rem % 2 === 0) q += 4;
    if (rem === 50) q += 2;
    return q;
  }

  /* Classic order of preference for the double you finish on. */
  var DOUBLE_ORDER = [32, 40, 16, 20, 8, 24, 36, 4, 12, 28, 2, 10, 18, 14, 6, 22, 26, 30, 34, 38, 50];
  var dblRank = {};
  DOUBLE_ORDER.forEach(function (v, i) { dblRank[v] = DOUBLE_ORDER.length - i; });

  var MODES = {
    double: {
      valid: function (d) { return d.mult === 2; },
      fin: function (d) { return dblRank[d.value] * 5; }
    },
    master: {
      valid: function (d) { return d.mult === 2 || d.mult === 3; },
      fin: function (d) { return d.mult === 2 ? dblRank[d.value] * 5 : 60 + d.base * 0.5; }
    },
    straight: {
      valid: function (d) { return d.value > 0; },
      fin: function (d) {
        if (d.mult === 1) return 90 + d.base * 0.5;   // a plain single is easiest
        if (d.mult === 2) return dblRank[d.value] * 3;
        return 30 + d.base * 0.5;
      }
    }
  };

  /* Best setup dart for a value. Safe to be greedy: what a setup dart leaves
   * never depends on which *later* dart covers the rest. */
  var bestByValue = {};
  DARTS.forEach(function (d) {
    var cur = bestByValue[d.value];
    if (!cur || dartQuality(d) > dartQuality(cur)) bestByValue[d.value] = d;
  });

  function rate(setup, finisher, score, mode) {
    var s = MODES[mode].fin(finisher);
    var rem = score;
    for (var i = 0; i < setup.length; i++) {
      s += dartQuality(setup[i]);
      rem -= setup[i].value;
      s += leaveQuality(rem, mode);
    }
    return s;
  }

  function search(score, dartsLeft, mode) {
    var m = MODES[mode];
    var routes = [];
    var i, j;

    for (i = 0; i < DARTS.length; i++) {
      var f = DARTS[i];
      if (!m.valid(f)) continue;
      var rem = score - f.value;
      if (rem < 0) continue;

      if (rem === 0) {                                   // one dart
        routes.push({ darts: [f], n: 1, s: rate([], f, score, mode) });
        continue;
      }
      if (dartsLeft < 2) continue;

      var a = bestByValue[rem];                          // two darts
      if (a) routes.push({ darts: [a, f], n: 2, s: rate([a], f, score, mode) });
      if (dartsLeft < 3) continue;

      for (j = 0; j < DARTS.length; j++) {               // three darts
        var d1 = DARTS[j];
        var r2 = rem - d1.value;
        if (r2 <= 0) continue;
        var d2 = bestByValue[r2];
        if (!d2) continue;
        routes.push({ darts: [d1, d2, f], n: 3, s: rate([d1, d2], f, score, mode) });
      }
    }

    routes.sort(function (x, y) {
      if (x.n !== y.n) return x.n - y.n;              // always finish in fewer darts
      if (Math.abs(x.s - y.s) > 1e-9) return y.s - x.s;
      for (var k = 0; k < x.darts.length - 1; k++) {  // tie: biggest dart first
        var qx = dartQuality(x.darts[k]), qy = dartQuality(y.darts[k]);
        if (Math.abs(qx - qy) > 1e-9) return qy - qx;
      }
      return 0;
    });

    /* Keep the best ordering of each combination, not both orderings of one. */
    var seen = {}, out = [];
    for (i = 0; i < routes.length && out.length < 3; i++) {
      var labels = routes[i].darts.map(function (d) { return d.label; });
      var key = labels.slice().sort().join('|');
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({ labels: labels, n: routes[i].n });
    }
    return out;
  }

  var cache = {};

  var Checkout = {
    /* Up to three routes for `score` in at most `dartsLeft` darts, best first.
     * Empty when there is no finish this turn. */
    find: function (score, dartsLeft, mode) {
      mode = MODES[mode] ? mode : 'double';
      if (!(score > 1) || score > 180 || dartsLeft < 1) return [];
      var key = mode + '|' + score + '|' + dartsLeft;
      if (!cache[key]) cache[key] = search(score, dartsLeft, mode);
      return cache[key];
    },

    possible: function (score, dartsLeft, mode) {
      return Checkout.find(score, dartsLeft, mode).length > 0;
    },

    /* Is a dart with this multiplier a legal finishing dart? */
    isValidFinish: function (mult, mode) {
      if (mode === 'straight') return mult > 0;
      if (mode === 'master') return mult === 2 || mult === 3;
      return mult === 2;
    },

    /* Totals no three darts can make — rejected in 3-dart-total entry. */
    impossibleTotal: function (t) {
      return t < 0 || t > 180 ||
        t === 179 || t === 178 || t === 176 || t === 175 ||
        t === 173 || t === 172 || t === 169 || t === 166 || t === 163;
    }
  };

  global.Checkout = Checkout;
})(window);
