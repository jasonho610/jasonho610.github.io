# jasonho610.github.io

Personal site for Kuan-Hsun (Jason) Ho — audio DSP and machine learning, and tenor saxophone.

Plain HTML, CSS, and JavaScript. No build step, no dependencies. GitHub Pages serves it
straight from the repository root (`.nojekyll` tells Pages not to run Jekyll over it).

## Files

```
index.html                 the front page — hero, about, work, notes, contact
calendar.html              gigs, conferences and other dates
assets/js/events.js        THE calendar data — the only file to edit when a date changes
assets/js/calendar.js      draws the year axis and the lists from events.js
notes.html                 index of notes
notes/*.html               one file per note
assets/css/site.css        every style on the site
assets/js/spectrum.js      the hero filterbank, rail highlighting, click-to-load video
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

Open `assets/js/events.js` and add an entry — the file's header documents every field. Dates can be
`"2027-03-14"`, `"2027-03"` or `"2027"`, so something pencilled in for next year is still allowed on
the page; add `tbc: true` and it is labelled "to confirm". `kind` is `gig`, `conference` or
`release`, which sets the colour on the year axis. A past set with a recording gets
`video: "<youtube id>"` and the entry grows a "watch the set" link.

Past and upcoming are split automatically against today's date — nothing to move by hand.

## Adding a note

Copy `notes/filterbank-on-the-front-page.html`, change the title, dateline, and body, then add
an entry at the top of the list in both `notes.html` and the `Notes` section of `index.html`.
The seed note is yours to edit or delete.

The site is deliberately short — an introduction, not a CV. The detail belongs in the two PDFs
and in the notes; keep the front page to the few things worth stopping for.

## Publishing

Push to `main`. GitHub Pages serves `https://jasonho610.github.io` from the repository root —
check Settings → Pages is set to "Deploy from a branch", branch `main`, folder `/ (root)`.
