/* The league this build is set up for. Everything that changes from one
 * season to the next lives here, so a new season is an edit to this file
 * and nothing else. */
(function (global) {
  'use strict';

  global.League = {
    /* Bump when TEAMS changes: a device that already stored the old list
     * swaps it for this one on its next load, keeping any names added by hand. */
    SEASON: '2026-fall',

    SCHEDULE_URL: 'https://playpass.com/medford-brewing-darts-ODQQTxr/20-player-darts-schedule-RF1euZP',

    /* Spelled exactly as the schedule spells them. */
    TEAMS: [
      'Bad News Beers',
      'Boston Brits',
      "Boys who Don't read good",
      'BullsHitters',
      'Dart Siders',
      'Darts and Rec.',
      'Darty Dancin’',
      'Därtley Crüe',
      'Duck',
      'Flight Club.',
      'Good Grouping!',
      'Jammie Dodgers',
      'Medford Misfits',
      'Mrs Turner',
      'Projectile Dysfunction',
      'Somervillains',
      'Teenage Dartbags',
      'The Sharts',
      'Villain Cruisers',
      'Who Darted?'
    ],

    /* Every earlier season's built-in names, so they can be told apart from
     * names a player typed in, and renames that should follow a team across. */
    PAST_TEAMS: ['Minute Man Militia', 'MENACE', "At least We're Cute", 'Jammy Dodgers'],
    RENAMED: { 'Jammy Dodgers': 'Jammie Dodgers' },

    /* Teams drawn as a logo on the scoreboard, keyed by lower-cased name. */
    LOGOS: { 'bad news beers': 'img/bad-news-beers.png' },

    /* Whose tablet this is until someone says otherwise: the team loaded
     * first on the setup screen. Changed from the Players picker. */
    HOME_TEAM: 'Bad News Beers',

    /* Every game of the season as [date, team, team]. Filled in by
     * js/schedule.js, which tools/update-schedule.py generates. */
    GAMES: [],

    /* Who `team` plays on `date` ('YYYY-MM-DD'), or null if nobody. */
    opponent: function (team, date) {
      for (var i = 0; i < this.GAMES.length; i++) {
        var g = this.GAMES[i];
        if (g[0] !== date) continue;
        if (g[1] === team) return g[2];
        if (g[2] === team) return g[1];
      }
      return null;
    }
  };
})(window);
