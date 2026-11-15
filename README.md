# jasonho610.github.io

Personal site for Kuan-Hsun (Jason) Ho — audio DSP and machine learning, and tenor saxophone.

Plain HTML, CSS, and JavaScript. No build step, no dependencies. GitHub Pages serves it
straight from the repository root (`.nojekyll` tells Pages not to run Jekyll over it).

## Files

```
index.html                 the front page — hero, about, work, on stage, listen, contact
calendar.html              gigs, conferences and other dates
assets/js/events.js        THE calendar data — the only file to edit when a date changes
assets/js/calendar.js      draws the year axis and the lists from events.js
assets/js/ambience.js      the opt-in background music player
assets/audio/              the music files — see the README in that folder
assets/css/site.css        every style on the site
assets/js/spectrum.js      the hero filterbank, rail highlighting, click-to-load video
assets/img/*.jpg           the one photograph on the site, behind the next date up
assets/cv/*.pdf            the two CVs — kept local, git-ignored (they carry a phone number)
```

## Running it locally

```sh
python3 -m http.server 8787
# then open http://localhost:8787
```

## The hero

The six curves are the magnitude responses of six bandpass filters an octave apart
(110 Hz to 3520 Hz), drawn on a log frequency axis. **hear the filterbank** builds the same
six filters in the Web Audio API, runs noise through them, opens them one at a time and then
all together, and drives the drawing from analysers on each band. Nothing plays until clicked,
and `prefers-reduced-motion` freezes the animation.

To change the bands, edit the `BANDS` array at the top of `assets/js/spectrum.js`.

## Still to fill in

- **Video, if you want it.** The gig list replaced the placeholder video tiles. If you would rather
  show playing than list it, a YouTube embed under `On stage` would do more than any description.
- **A photo**, if you want one — drop it in `assets/img/` and place it in the hero or beside the statement.
- **Audio examples** — before/after clips of an effect, or MixJudge examples, would carry more
  than any amount of prose. `<audio controls src="assets/audio/…">` is enough.
- **The CVs are not in the repo.** `.gitignore` keeps `assets/cv/*.pdf` out of git, so the site
  says "on request" rather than linking them. To publish them instead, drop the ignore rule and
  put the two links back in the contact section.
- **Keep the calendar current.** Everything lives in `assets/js/events.js` — add an object, reload.
  The front page still hard-codes the next gig under `On stage`; update that one line when the
  Tenor Showdown passes, or point it at whatever is next.

## Adding a date

The colours come from a photograph of a Blue Note set — fairy-light amber, brick red, and the blue
of the neon sign on warm black. `:root` in `site.css` holds the whole palette; the six band colours
are a warm-to-cool ramp used by the hero filterbank, the strand rules, and the calendar.

Open `assets/js/events.js` and add an entry — the file's header documents every field. Dates can be
`"2027-03-14"`, `"2027-03"` or `"2027"`, so something pencilled in for next year is still allowed on
the page; add `tbc: true` and it is labelled "to confirm". `kind` is `gig`, `conference` or
`release`, which sets the colour on the year axis. A past set with a recording gets
`video: "<youtube id>"` and the entry grows a "watch the set" link.

A residency is written once, not twelve times a year: `repeat: "first-saturday"` on an entry and the
page works out the next three dates itself. A night that was filmed in full takes
`playlist: "<youtube playlist id>"` instead of `video:`.

Past and upcoming are split automatically against today's date — nothing to move by hand.

## Background music

A small control sits in the bottom-left corner. It starts **paused** every time: browsers refuse to
autoplay sound without a gesture, and unannounced audio on someone else's site is hostile. While it
plays, the hero filterbank follows the music instead of its own idle motion.

The audio files are not in the repo — see `assets/audio/README.md` for which two to download and
what to name them. With the files missing the control hides itself, so nothing looks broken.

## After you push: the cache

GitHub Pages serves every file with `cache-control: max-age=600`. Both your browser *and* GitHub's
CDN keep each URL for ten minutes, so after a push an already-visited page can keep showing the old
version — or worse, new HTML with old CSS, which renders half-styled and looks broken. A new tab
does not help; Chrome's HTTP cache is shared across tabs. Adding any query string (`?x=1`) is a
different URL and fetches fresh, which is the quickest way to check what the server really has.

The stylesheet and scripts are therefore linked with a version query: `site.css?v=12`. **Bump that
number in every HTML file whenever you change CSS or JS.**

One rule about `site.css`: the `@media (max-width: 900px)` block at the very end overrides rules
defined above it. Put mobile overrides there, not in the earlier media query — an identical media
query that appears earlier in the file simply loses the cascade. New URL, no stale cache, no waiting.

(A hard reload — ⌘⇧R — fixes it for you, but not for anyone else visiting.)

## Publishing

Push to `main`. GitHub Pages serves `https://jasonho610.github.io` from the repository root —
check Settings → Pages is set to "Deploy from a branch", branch `main`, folder `/ (root)`.
