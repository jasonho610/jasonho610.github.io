# jasonho610.github.io

Personal site for Kuan-Hsun (Jason) Ho — audio DSP and machine learning, and tenor saxophone.

Plain HTML, CSS, and JavaScript. No build step, no dependencies. GitHub Pages serves it
straight from the repository root (`.nojekyll` tells Pages not to run Jekyll over it).

## Files

```
index.html                 the front page — intro, about, work, experience, on stage, listen, contact
calendar.html              gigs, conferences and other dates
assets/js/events.js        THE calendar data — the only file to edit when a date changes
assets/js/calendar.js      draws the year axis and the lists from events.js
assets/audio/              the music files — see the README in that folder
assets/css/site.css        every style on the site
assets/js/fx.js            the Freeverb impulse response generator and the tremolo maths
assets/js/stage.js         the three-unit rack, the music, the rail highlighting
scripts/check-calendar.js  renders the calendar headlessly — run it before every deploy
assets/img/*.jpg           the one photograph on the site, behind the next date up
assets/cv/*.pdf            the two CVs, offered as downloads from the page
```

## Running it locally

```sh
python3 -m http.server 8787
# then open http://localhost:8787
```

## The EQ at the top of the page

A real ten-band equaliser, laid out like the one in BIAS X: a low shelf at 30 Hz (Q 4), eight peaks
an octave apart from 60 Hz to 8 kHz (Q 1.5), a high shelf at 16 kHz (Q 4), ±15 dB.

Left alone it shows the music moving through the analyser. Drag a band up or down and the Web Audio
biquad really changes — the curve redraws from `getFrequencyResponse` and you hear it. A tap with no
drag toggles that band between 0 and +12 dB. The preset buttons set all ten at once; edit `PRESETS`
in `stage.js` to change them.

Note the range here is ±12 dB. `FxEQ10Mod.cpp` uses ±15.

To change the bands, edit the `BANDS` array at the top of `assets/js/stage.js`.

## Still to fill in

- **Video, if you want it.** The gig list replaced the placeholder video tiles. If you would rather
  show playing than list it, a YouTube embed under `On stage` would do more than any description.
- **A photo**, if you want one — drop it in `assets/img/` and place it in the hero or beside the statement.
- **Audio examples** — before/after clips of an effect, or MixJudge examples, would carry more
  than any amount of prose. `<audio controls src="assets/audio/…">` is enough.
- **The CVs are published.** `assets/cv/*.pdf` are committed and linked from the Experience block
  and the contact section. Both PDFs contain a phone number — replace them with redacted copies if
  that is not wanted.
- **Keep the calendar current.** Everything lives in `assets/js/events.js` — add an object, reload.
  The front page still hard-codes the next gig under `On stage`; update that one line when the
  Tenor Showdown passes, or point it at whatever is next.

## Adding a date

There is a skill for this: `.claude/skills/gigs-update/SKILL.md`. Mention a gig to Claude and it
researches the venue, writes the entry, checks it renders and deploys it.


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

A round control floats in the bottom-right corner of every page. Hovering it opens a panel with the
track list and a seek bar. Playback position, track and EQ settings are kept in `sessionStorage`, so
moving between pages picks up where it left off — though the browser may require one click before it
will make sound again.

The old note still applies: The page tries to start the music on arrival, but
browsers block audible autoplay until a visitor has interacted with the site, so on a first visit the
button is what actually starts it. There is no way around that from a web page — it is a browser
policy, not a setting. While music plays, the curves at the top of the page follow it.

The audio files are not in the repo — see `assets/audio/README.md` for which two to download and
what to name them. With the files missing the control hides itself, so nothing looks broken.

## After you push: the cache

GitHub Pages serves every file with `cache-control: max-age=600`. Both your browser *and* GitHub's
CDN keep each URL for ten minutes, so after a push an already-visited page can keep showing the old
version — or worse, new HTML with old CSS, which renders half-styled and looks broken. A new tab
does not help; Chrome's HTTP cache is shared across tabs. Adding any query string (`?x=1`) is a
different URL and fetches fresh, which is the quickest way to check what the server really has.

The stylesheet and scripts are therefore linked with a version query: `site.css?v=45`. **Bump that
number in every HTML file whenever you change CSS or JS.**

One rule about `site.css`: the `@media (max-width: 900px)` block at the very end overrides rules
defined above it. Put mobile overrides there, and add new base rules **above** that block — anything
written below it silently wins on mobile. This has bitten the layout twice. New URL, no stale cache, no waiting.

(A hard reload — ⌘⇧R — fixes it for you, but not for anyone else visiting.)

## Publishing

Push to `main`. GitHub Pages serves `https://jasonho610.github.io` from the repository root —
check Settings → Pages is set to "Deploy from a branch", branch `main`, folder `/ (root)`.
