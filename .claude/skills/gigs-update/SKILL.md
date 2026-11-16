---
name: gigs-update
description: Add or change a gig on jasonho610.github.io. Use whenever Jason mentions a show, booking, residency, concert or performance — a new date, a changed time, a venue, a poster, a recording of a past set, or a cancellation. Researches the venue and the band, writes the entry, checks it renders, deploys it, and confirms the live site.
---

# Updating gigs

Everything about a gig lives in one file: `assets/js/events.js`. Both pages read it.
There is no second place to edit, and **the front page needs no layout change when a
new soonest gig arrives** — `#next-up` on `index.html` is rendered by the same code
that fills the calendar, so the nearest future date appears there on its own. Verify
that it did; never hand-edit the card.

## What to do with a gig Jason hands you

### 1. Pin the date down first

Work out the weekday from the date and say it back to him. A date that falls on the
wrong weekday is the most common error, and it has happened: an Instagram post date
was read as the gig date and put a Wednesday show on a Saturday.

```
python3 -c "import datetime;print(datetime.date(2026,11,20).strftime('%A'))"
```

If he names a weekday ("this Friday") and the date disagrees, stop and ask.

### 2. Research before writing

Fetch whatever he gives you and look for the things the entry can carry:

- **The venue's event page** — `curl -sS "<url>" | grep -oE 'og:image" content="[^"]*"'` gives
  the poster. Blue Note Taipei (Wix) serves resizable posters: swap the `w_4491,h_4491`
  segment for `w_900,h_900`. Link the poster at the venue's URL rather than copying the
  image into the repo — it stays current and we are not republishing their artwork.
- **Personnel, set times, door times, the series it belongs to.** Venue pages usually list
  the full band; name them in the note.
- **A recording.** If the set was filmed, his channel's titles encode it as
  `BN YYYYMMDD Band`. Search the feed:
  `curl -sS "https://www.youtube.com/feeds/videos.xml?channel_id=UCjSoeq8t35tVJkQaPDF1Y0w"`
  A whole night filmed as several clips is a `playlist:` instead of a `video:`.
- Venues without per-night posters (Riff Bar) have a venue photograph — use that and say so.

Do not invent a poster, a time or a line-up. Leave the field out instead.

### 3. Write the entry

Insert in `assets/js/events.js`. Order inside the array does not matter — the renderer
sorts by date — but keeping upcoming dates near the top makes the file easier to read.

```js
{
  date: '2026-11-20',          // 'YYYY-MM-DD', or 'YYYY-MM' / 'YYYY' if not pinned; add tbc: true
  kind: 'gig',                 // gig | conference | release — sets the colour
  title: 'Jones Project',
  venue: 'Riff Bar, Taipei',
  venueUrl: 'https://riffbarlivejazz.netlify.app/',
  poster: 'https://…',         // optional image, hotlinked from the venue
  note: 'One or two sentences: who is playing, what kind of night, set times.',
  video: 'YOUTUBE_ID',         // optional, a past set
  playlist: 'PLAYLIST_ID',     // optional, a whole night in several clips
  links: [{ label: 'The announcement', url: '…' }]
}
```

A standing commitment is written once, not twelve times a year:

```js
{ repeat: 'first-saturday', kind: 'gig', title: 'Sing Sang Sung with ETO', … }
```

`repeat` currently understands `first-saturday` and generates the next three dates from
today. Adding another rule means a small change in `expand()` inside `assets/js/calendar.js`.
**Never turn a one-off into a `repeat` without asking** — it claims he plays every week.

### 4. Check it renders, before deploying

```
node scripts/check-calendar.js              # today
node scripts/check-calendar.js 2026-12-06   # pretend a later day
```

It prints what is next up, how many are ahead and played, and flags any entry whose note
names a weekday the date disagrees with. It exits non-zero if the renderer threw — which
has happened and silently emptied both lists. `node --check` does not catch that.

Confirm the new gig is next up if it is the soonest. If it is not the soonest, say which
one still leads.

### 5. Deploy, then prove it

Bump the asset version in **both** `index.html` and `calendar.html`, or returning visitors
get new markup against an old stylesheet:

```
sed -i '' 's/?v=29/?v=30/g' index.html calendar.html
```

Commit, push, then wait for the build and check the origin — not your browser:

```
for i in $(seq 1 14); do
  v=$(curl -sS "https://jasonho610.github.io/assets/js/events.js?x=$i$(date +%s)" | grep -c "Jones Project")
  echo "live: $v"; [ "$v" -gt 0 ] && break; sleep 15
done
```

GitHub Pages sends `max-age=600`, so a plain request can serve a ten-minute-old copy. Always
append a query string when verifying, and hard-reload (⌘⇧R) before judging a browser view.

## Things that already take care of themselves

- **The past/upcoming split** is computed from the visitor's clock at page load. When a date
  passes, that gig moves into *Played* and the next one leads the front page. No edit needed.
- **Residencies** regenerate their next three dates forever.
- **The year axis, the Played count and the toggle** all follow the data.

So "the gig is over" is never a reason to edit anything. The only reasons are: a new booking,
a change to one, a recording to attach, or a cancellation (delete the entry).

## Report back

Tell him: the date and weekday you confirmed, what you found and what you could not find,
whether it is now the soonest gig, and the live URL state. Flag anything you guessed.
