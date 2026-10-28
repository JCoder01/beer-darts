/* MBC Darts: a league night at the brewery. Two teams, eight legs -- two
 * team 501, two team cricket, four singles 401 -- one point per leg. Each
 * leg is an ordinary one-leg X01 or Cricket game; this only keeps the plan,
 * the order, and who won what. */
(function (global) {
  'use strict';

  var KINDS = {
    t501: { name: 'Team 501', type: 'x01', start: 501 },
    tcr:  { name: 'Team Cricket', type: 'cricket' },
    s401: { name: 'Singles 401', type: 'x01', start: 401 }
  };
  var ORDER = ['t501', 't501', 'tcr', 'tcr', 's401', 's401', 's401', 's401'];

  var MBC = {
    KINDS: KINDS,
    ORDER: ORDER,

    /* Any rearrangement of the league's eight legs, and nothing else. */
    validOrder: function (order) {
      return Array.isArray(order) && order.length === ORDER.length &&
        order.slice().sort().join() === ORDER.slice().sort().join();
    },

    /* "Singles 401 · 3": the nth of its kind, counted in this order. */
    label: function (order, i) {
      var k = order[i], nth = 0, of = 0;
      order.forEach(function (o, j) {
        if (o !== k) return;
        of++;
        if (j <= i) nth++;
      });
      return KINDS[k].name + (of > 1 ? ' · ' + nth : '');
    },

    create: function (teams, order) {
      if (!MBC.validOrder(order)) order = ORDER;
      return {
        teams: teams.slice(0, 2),
        legs: order.map(function (k, i) {
          return { kind: k, name: MBC.label(order, i), winner: null };
        }),
        cur: null
      };
    },

    score: function (m) {
      var s = [0, 0];
      m.legs.forEach(function (l) { if (l.winner != null) s[l.winner]++; });
      return s;
    },

    played: function (m) {
      return m.legs.filter(function (l) { return l.winner != null; }).length;
    },

    /* The first leg in the planned order that is neither won nor in play. */
    next: function (m) {
      for (var i = 0; i < m.legs.length; i++) {
        if (m.legs[i].winner == null && i !== m.cur) return i;
      }
      return null;
    },

    over: function (m) { return MBC.played(m) === m.legs.length; },

    /* Eight legs can split 4-4, so a match can be drawn. */
    result: function (m) {
      var s = MBC.score(m);
      if (s[0] === s[1]) return 'Match drawn ' + s[0] + '–' + s[1];
      var w = s[0] > s[1] ? 0 : 1;
      return m.teams[w] + ' wins ' + s[w] + '–' + s[1 - w];
    }
  };

  global.MBC = MBC;
})(window);
