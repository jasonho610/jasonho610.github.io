/* Every date on the calendar lives here. Add an entry, reload — nothing else to touch.
 *
 *   date     "YYYY-MM-DD", or "YYYY-MM" / "YYYY" when it is not pinned down yet
 *   kind     gig | conference | release        (sets the colour and the grouping)
 *   title    what it is
 *   venue    where it is
 *   note     optional one line — guests, subs, programme
 *   video    optional YouTube id, for a set that was recorded
 *   links    optional [{ label, url }]
 *   tbc      true if the date is not confirmed
 */

window.EVENTS = [
  {
    date: '2027', kind: 'conference', tbc: true,
    title: 'ICASSP 2027',
    note: 'If MixJudge is accepted — dates and city to confirm.'
  },
  {
    date: '2026-11-29', kind: 'gig',
    title: 'Tenor Showdown! — JHQ ft. Iming Lin',
    venue: 'Blue Note Taipei',
    note: 'Two tenors on one bandstand, through soul jazz, bebop and hard bop. With Iming Lin, Yu Chen Wu, Chiala Lee and Chi-lung Hsieh.',
    links: [
      { label: 'Blue Note Taipei', url: 'https://www.bluenotetaipei.com/events/tai-bei-lan-diao-zhou-ri-te-yan-h' },
      { label: 'The announcement', url: 'https://www.instagram.com/p/DfryUjmgV6E/' }
    ]
  },

  { date: '2026-10-16', kind: 'gig', title: 'Jazz Meta Band',     venue: 'Blue Note Taipei', video: '7jYHTUNpsXY' },
  { date: '2026-09-18', kind: 'gig', title: 'Jazz Meta Band',     venue: 'Blue Note Taipei', video: 'xUiDcbsulNI' },
  { date: '2026-08-29', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', video: 'UnoP6s00KWs' },
  { date: '2026-08-22', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', video: 'lC15ZTNRM3s' },
  { date: '2026-08-15', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', video: 'Swaf4S_65Fg', note: 'With Daniel.' },
  { date: '2026-08-08', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', video: 'oG3jlJ7vpT4', note: 'With Tom.' },
  { date: '2026-07-24', kind: 'gig', title: 'Jazz Meta Band',     venue: 'Blue Note Taipei', video: 'wh53Z2HcksU' },
  { date: '2026-07-18', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', video: 'tyORJn0aoZE' },
  { date: '2026-06-27', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', video: 'qveZjnN5fxM' },
  { date: '2026-06-12', kind: 'gig', title: 'Jazz Meta Band',     venue: 'Blue Note Taipei', video: 'pVWl5lOuzFQ' },
  {
    date: '2026-06-10', kind: 'gig', title: 'Jason Ho Quintet',
    venue: 'Blue Note Taipei', video: 'WqYekGSZDcw',
    note: 'Guitar, piano, bass and drums — Joshua Redman, Herbie Hancock, and a few other corners of jazz, fusion and pop.',
    links: [{ label: 'The announcement', url: 'https://www.instagram.com/p/DY9JhUQASs3/' }]
  },
  {
    date: '2025-07-27', kind: 'gig', title: 'Khalil Fong — “Paris” solo',
    venue: 'RevNow, Taipei', video: 'CZSFgW2ZZ3w', note: 'A solo chorus, with 子彰.'
  }
];
