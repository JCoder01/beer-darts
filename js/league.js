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
    LOGOS: { 'bad news beers': 'img/bad-news-beers.png' }
  };
})(window);
