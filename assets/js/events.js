/* Every date on the calendar lives here. Add an entry, reload — nothing else to touch.
 *
 *   date     "YYYY-MM-DD", or "YYYY-MM" / "YYYY" when it is not pinned down yet
 *   kind     gig | conference | release        (sets the colour and the grouping)
 *   title    what it is
 *   venue    where it is
 *   venueUrl optional link for the venue name
 *   poster   optional image URL for the gig poster
 *   note     optional one line — guests, subs, programme
 *   video    optional YouTube id, for a set that was recorded
 *   playlist optional YouTube playlist id, when a whole night was filmed
 *   repeat   "first-saturday" for a residency — the next few dates are worked out for you
 *   links    optional [{ label, url }]
 *   tbc      true if the date is not confirmed
 */

var BLUE_NOTE = 'https://www.bluenotetaipei.com';

window.EVENTS = [
  {
    repeat: 'first-saturday', kind: 'gig',
    title: 'Sing Sang Sung with ETO',
    venue: 'Blue Note Taipei',
    venueUrl: 'https://www.bluenotetaipei.com/events/tai-bei-lan-diao-shou-zhou-zhou-liu-te-yan-xiao-jiu-guan-li-de-da-le-tuan-8',
    poster: 'https://static.wixstatic.com/media/973c52_883a700c30f04574bbc80b8e008b3792~mv2.png/v1/fill/w_900,h_900,al_c/973c52_883a700c30f04574bbc80b8e008b3792~mv2.png',
    note: 'A big band in a small bar. Three hours with the ETO Jazz Big Band, swapping between full band and smaller combos. Doors at 8, music at 9.'
  },
  {
    date: '2026-11-20', kind: 'gig',
    title: 'Jones Project',
    venue: 'Riff Bar, Taipei',
    venueUrl: 'https://riffbarlivejazz.netlify.app/',
    poster: 'https://riffbarlivejazz.netlify.app/photos/riff/202602_Riff_0015.jpg',
    note: 'Modern jazz with drummer Jones Lin and friends — a different line-up every Friday at Riff Bar. 21:00 to 23:00, doors at 20:00.'
  },
  {
    date: '2026-11-29', kind: 'gig',
    title: 'Tenor Showdown! — JHQ ft. Iming Lin',
    venue: 'Blue Note Taipei',
    venueUrl: 'https://www.bluenotetaipei.com/events/tai-bei-lan-diao-zhou-ri-te-yan-h',
    poster: 'https://static.wixstatic.com/media/973c52_084a51377f1f4368855c8c8325b4f866~mv2.png/v1/fill/w_900,h_900,al_c/973c52_084a51377f1f4368855c8c8325b4f866~mv2.png',
    note: 'Two tenor saxophones on one stage — soul jazz, bebop and hard bop. With Iming Lin, Yu Chen Wu, Chiala Lee and Chi-lung Hsieh.',
    links: [
      { label: 'Blue Note Taipei', url: 'https://www.bluenotetaipei.com/events/tai-bei-lan-diao-zhou-ri-te-yan-h' },
      { label: 'The announcement', url: 'https://www.instagram.com/p/DfryUjmgV6E/' }
    ]
  },

  {
    date: '2026-10-03', kind: 'gig', title: 'Sing Sang Sung with ETO',
    venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, playlist: 'PLVws2-tNAatw',
    note: 'The October night — Donna Lee, El Gatote, Widow’s Walk, and an hour of combo.'
  },
  {
    date: '2026-05-29', kind: 'gig', title: 'ETO Combo — Blue Note special',
    venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, playlist: 'PLP_iwARvvcYTnZO8C8EyrD6c4dl4TNW9b',
    note: 'Two combos across the night, and Joy Spring twice.'
  },

  { date: '2026-10-16', kind: 'gig', title: 'Jazz Meta Band',     venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: '7jYHTUNpsXY' },
  { date: '2026-09-18', kind: 'gig', title: 'Jazz Meta Band',     venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'xUiDcbsulNI' },
  { date: '2026-08-29', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'UnoP6s00KWs' },
  { date: '2026-08-22', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'lC15ZTNRM3s' },
  { date: '2026-08-15', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'Swaf4S_65Fg', note: 'With Daniel.' },
  { date: '2026-08-08', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'oG3jlJ7vpT4', note: 'With Tom.' },
  { date: '2026-07-24', kind: 'gig', title: 'Jazz Meta Band',     venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'wh53Z2HcksU' },
  { date: '2026-07-18', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'tyORJn0aoZE' },
  { date: '2026-06-27', kind: 'gig', title: 'Uno Kaoru Quartet',  venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'qveZjnN5fxM' },
  { date: '2026-06-12', kind: 'gig', title: 'Jazz Meta Band',     venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'pVWl5lOuzFQ' },
  {
    date: '2026-06-10', kind: 'gig', title: 'Jason Ho Quintet',
    venue: 'Blue Note Taipei', venueUrl: BLUE_NOTE, video: 'WqYekGSZDcw',
    note: 'Guitar, piano, bass and drums. Joshua Redman, Herbie Hancock, and a few other corners of jazz, fusion and pop.',
    links: [{ label: 'The announcement', url: 'https://www.instagram.com/p/DY9JhUQASs3/' }]
  }
];
