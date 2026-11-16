/* The band across the top of the page is a ten-band EQ with a live analyser,
 * built the same way as the one in BIAS X: a low shelf at 30 Hz, eight peaks an
 * octave apart from 60 Hz to 8 kHz at Q 1.5, a high shelf at 16 kHz, ±15 dB.
 *
 * Left alone it just shows the music moving. Click a band and that band is
 * actually boosted — the curve rises and you hear it. Click it again to flatten. */

(function () {
  'use strict';

  var canvas = document.getElementById('eq');
  var hasEQ = !!(canvas && canvas.getContext);
  var ctx = hasEQ ? canvas.getContext('2d') : null;

  var F_MIN = 20, F_MAX = 20000, DB = 14, MAX_GAIN = 12;

  var BANDS = [
    { type: 'lowshelf',  f: 30,    q: 4.0,  color: '#F4B23F', label: '30' },
    { type: 'peaking',   f: 60,    q: 1.5,  color: '#F2A03E', label: '60' },
    { type: 'peaking',   f: 120,   q: 1.5,  color: '#EE8B3C', label: '120' },
    { type: 'peaking',   f: 250,   q: 1.5,  color: '#E8763A', label: '250' },
    { type: 'peaking',   f: 500,   q: 1.5,  color: '#D75C3B', color2: 1, label: '500' },
    { type: 'peaking',   f: 1000,  q: 1.5,  color: '#C8453C', label: '1k' },
    { type: 'peaking',   f: 2000,  q: 1.5,  color: '#A3466F', label: '2k' },
    { type: 'peaking',   f: 4000,  q: 1.5,  color: '#6E5BA0', label: '4k' },
    { type: 'peaking',   f: 8000,  q: 1.5,  color: '#3F6FC4', label: '8k' },
    { type: 'highshelf', f: 16000, q: 4.0,  color: '#4FBCE4', label: '16k' }
  ];
  var TICKS = [100, 1000, 10000];

  var TRACKS = [
    { src: 'assets/audio/hard-bop-rainy-night.mp3', title: 'Hard Bop Rainy Night', artist: 'Alex Morgan',
      url: 'https://freemusicarchive.org/music/alex-morgan/moods-atmospheres-vol-4/hard-bop-rainy-night-bright-late-session/' },
    { src: 'assets/audio/too-cool-for-school.mp3', title: 'Too Cool for School', artist: 'NoKings XXX',
      url: 'https://freemusicarchive.org/music/nokings-xxx/too-cool-for-school/too-cool-for-school/' }
  ];

  var track = 0, audio = null, ac = null, analyser = null, filters = [], bins = null;
  var gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var playing = false, hover = -1;

  /* ── geometry ───────────────────────────────────────────────── */
  var dpr = 1, W = 0, H = 0, PAD_B = 18, PAD_T = 8;
  var PAD_L = 0, PAD_R = 0, PLOT = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PAD_L = W * 0.07;
    PAD_R = W * 0.10;
    PLOT = W - PAD_L - PAD_R;
  }
  var logMin = Math.log(F_MIN), logSpan = Math.log(F_MAX) - logMin;
  function xOf(f) { return PAD_L + (Math.log(f) - logMin) / logSpan * PLOT; }
  function fOf(x) { return Math.exp(logMin + ((x - PAD_L) / PLOT) * logSpan); }
  function yOf(db) {
    var top = PAD_T, bot = H - PAD_B;
    return bot - ((db + DB) / (DB * 2)) * (bot - top);
  }
  if (hasEQ) { resize(); window.addEventListener('resize', resize); }

  /* ── audio graph ────────────────────────────────────────────── */
  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();

    audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.55;
    audio.src = TRACKS[track].src;
    audio.addEventListener('ended', next);

    var node = ac.createMediaElementSource(audio);
    filters = BANDS.map(function (b) {
      var f = ac.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.f;
      f.Q.value = b.q;
      f.gain.value = gains[BANDS.indexOf(b)] || 0;
      node.connect(f);
      node = f;
      return f;
    });

    analyser = ac.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.76;
    analyser.minDecibels = -92;
    analyser.maxDecibels = -12;
    node.connect(analyser);
    analyser.connect(ac.destination);
    bins = new Uint8Array(analyser.frequencyBinCount);
    return true;
  }

  function next() {
    track = (track + 1) % TRACKS.length;
    audio.src = TRACKS[track].src;
    describe();
    audio.play().catch(pause);
  }

  /* ── the floating player, with a panel on hover ─────────────── */
  var KEY = 'stage-player';

  var dock = document.createElement('div');
  dock.className = 'player-dock';
  dock.innerHTML =
    '<div class="player-panel" hidden>' +
      '<div class="pp-tracks"></div>' +
      '<input class="pp-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek">' +
      '<p class="pp-time"><span class="pp-now">0:00</span> / <span class="pp-dur">0:00</span></p>' +
    '</div>' +
    '<span class="player-nudge">play the music</span>' +
    '<button class="player" type="button" aria-pressed="false" aria-label="Play music">' +
      '<span class="sr">Play music</span>' +
      '<svg class="ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>' +
      '<svg class="ico-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.2v14H7zm6.8 0H17v14h-3.2z"/></svg>' +
    '</button>';
  try { if (sessionStorage.getItem('stage-played')) dock.classList.add('has-played'); } catch (e) {}
  document.body.appendChild(dock);

  var button = dock.querySelector('.player');
  var label = dock.querySelector('.sr');
  var panel = dock.querySelector('.player-panel');
  var seek = dock.querySelector('.pp-seek');
  var nowEl = dock.querySelector('.pp-now');
  var durEl = dock.querySelector('.pp-dur');
  var nowPlaying = document.querySelector('.now-playing');

  TRACKS.forEach(function (t, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pp-track';
    b.textContent = t.title;
    b.addEventListener('click', function () { choose(i); });
    dock.querySelector('.pp-tracks').appendChild(b);
  });

  function markTrack() {
    Array.prototype.forEach.call(dock.querySelectorAll('.pp-track'), function (b, i) {
      b.classList.toggle('is-on', i === track);
    });
  }

  function showPanel(on) { panel.hidden = !on; }
  dock.addEventListener('pointerenter', function () { showPanel(true); });
  dock.addEventListener('pointerleave', function () { showPanel(false); });
  dock.addEventListener('mouseenter', function () { showPanel(true); });
  dock.addEventListener('mouseleave', function () { showPanel(false); });
  /* touch has no hover: tapping the panel area opens it */
  button.addEventListener('contextmenu', function (e) { e.preventDefault(); showPanel(panel.hidden); });
  dock.addEventListener('focusin', function () { showPanel(true); });
  dock.addEventListener('focusout', function (e) {
    if (!dock.contains(e.relatedTarget)) showPanel(false);
  });

  function clock(sec) {
    if (!isFinite(sec)) return '0:00';
    var m = Math.floor(sec / 60), s2 = Math.floor(sec % 60);
    return m + ':' + (s2 < 10 ? '0' : '') + s2;
  }
  function tick() {
    if (!audio || !audio.duration) return;
    if (!seeking) seek.value = String(Math.round(audio.currentTime / audio.duration * 1000));
    nowEl.textContent = clock(audio.currentTime);
    durEl.textContent = clock(audio.duration);
  }
  var seeking = false;
  seek.addEventListener('pointerdown', function () { seeking = true; });
  seek.addEventListener('change', function () {
    seeking = false;
    if (audio && audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
  });
  seek.addEventListener('input', function () {
    if (audio && audio.duration) nowEl.textContent = clock((seek.value / 1000) * audio.duration);
  });

  function choose(i) {
    var wasPlaying = playing;
    if (!ac && !build()) return;
    track = i;
    audio.src = TRACKS[track].src;
    markTrack();
    describe();
    save();
    if (wasPlaying) play(); else tick();
  }

  function describe() {
    markTrack();
    if (!nowPlaying) return;
    var t = TRACKS[track];
    nowPlaying.innerHTML = '';
    var a = document.createElement('a');
    a.href = t.url;
    a.textContent = t.title + ' — ' + t.artist;
    nowPlaying.appendChild(a);
    nowPlaying.appendChild(document.createTextNode(' · CC BY'));
  }

  /* carry the music across a page change */
  function save() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({
        track: track,
        time: audio ? audio.currentTime : 0,
        playing: playing,
        gains: gains
      }));
    } catch (e) {}
  }
  function restore() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);
  setInterval(function () { if (playing) save(); }, 2000);

  function play() {
    if (!ac && !build()) return;
    var ready = ac.state === 'suspended' ? ac.resume() : Promise.resolve();
    ready.then(function () {
      audio.preload = 'auto';
      return audio.play();
    }).then(function () {
      playing = true;
      dock.classList.add('has-played');
      try { sessionStorage.setItem('stage-played', '1'); } catch (e) {}
      button.classList.add('is-playing');
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute('aria-label', 'Pause music');
      label.textContent = 'Pause music';
      describe();
      save();
    }).catch(pause);
  }
  function pause() {
    playing = false;
    if (audio) audio.pause();
    button.classList.remove('is-playing');
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Play music');
    label.textContent = 'Play music';
    save();
  }
  button.addEventListener('click', function () { playing ? pause() : play(); });

  /* ── bands can be dragged, or clicked to toggle ─────────────── */
  function nearest(x, y) {
    var best = -1, bestDist = 1e9;
    BANDS.forEach(function (b, i) {
      var gain = gains[i];
      var dx = xOf(b.f) - x, dy = yOf(gain) - (y === undefined ? yOf(gain) : y);
      var d = Math.sqrt(dx * dx + dy * dy * 0.35);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return bestDist < 44 ? best : -1;
  }
  function gainAt(y) {
    var top = PAD_T, bot = H - PAD_B;
    var db = ((bot - y) / (bot - top)) * (DB * 2) - DB;
    return Math.max(-MAX_GAIN, Math.min(MAX_GAIN, db));
  }
  function setGain(i, db, glide) {
    gains[i] = db;
    if (!filters.length) return;
    var g = filters[i].gain;
    g.cancelScheduledValues(ac.currentTime);
    if (glide && ac.state === 'running') {
      g.setValueAtTime(g.value, ac.currentTime);
      g.linearRampToValueAtTime(db, ac.currentTime + 0.12);
    } else {
      /* a suspended context never renders, so a ramp would hang at the old
         value — write it straight in instead */
      g.value = db;
    }
  }

  var dragging = -1, dragMoved = false, current = 'flat';

  function local(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  if (hasEQ) {
  canvas.addEventListener('pointerdown', function (e) {
    if (!ac && !build()) return;
    var p = local(e);
    var i = nearest(p.x, p.y);
    if (i < 0) return;
    dragging = i; dragMoved = false;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = local(e);
    if (dragging >= 0) {
      dragMoved = true;
      setGain(dragging, gainAt(p.y), false);
      return;
    }
    hover = nearest(p.x, p.y);
    canvas.style.cursor = hover >= 0 ? 'ns-resize' : 'default';
  });
  function endDrag(e) {
    if (dragging < 0) return;
    /* a click on its own does nothing on purpose — drag to set a band,
       double-click to put it back to the preset */
    dragging = -1;
    if (e && e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }
  canvas.addEventListener('dblclick', function (e) {
    if (!ac && !build()) return;
    var p = local(e);
    var i = -1, best = 1e9;
    BANDS.forEach(function (b, k) {
      var d = Math.abs(xOf(b.f) - p.x);
      if (d < best) { best = d; i = k; }
    });
    if (best > 36) return;
    var preset = PRESETS[current] || PRESETS.flat;
    setGain(i, preset[i], true);
  });
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', function () { if (dragging < 0) hover = -1; });
  }

  /* ── presets ────────────────────────────────────────────────── */
  var PRESETS = {
    'flat':      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'warm':      [4, 3, 2, 1, 0, -1, -2, -3, -2, -3],
    'bright':    [-3, -2, -2, -1, 0, 1, 2, 3, 4, 4],
    'smile':     [5, 4, 2, 0, -2, -3, -1, 2, 4, 5],
    'telephone': [-12, -10, -6, 2, 5, 6, 4, -2, -8, -12]
  };
  Array.prototype.slice.call(document.querySelectorAll('[data-preset]')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!ac && !build()) return;
      var p = PRESETS[btn.getAttribute('data-preset')];
      if (!p) return;
      p.forEach(function (db, i) { setGain(i, db, true); });
      current = btn.getAttribute('data-preset');
      document.querySelectorAll('[data-preset]').forEach(function (b) { b.classList.remove('is-on'); });
      btn.classList.add('is-on');
    });
  });

  /* ── the composite EQ curve, straight from the filters ──────── */
  var CURVE_N = 160;
  var curveF = new Float32Array(CURVE_N);
  for (var i = 0; i < CURVE_N; i++) curveF[i] = Math.exp(logMin + (i / (CURVE_N - 1)) * logSpan);
  var magOut = new Float32Array(CURVE_N), phaseOut = new Float32Array(CURVE_N);
  var total = new Float32Array(CURVE_N);

  function composite() {
    for (var i = 0; i < CURVE_N; i++) total[i] = 1;
    if (!filters.length) return total;   /* nothing built yet: a flat line */
    filters.forEach(function (f) {
      f.getFrequencyResponse(curveF, magOut, phaseOut);
      for (var i = 0; i < CURVE_N; i++) total[i] *= magOut[i];
    });
    return total;
  }

  /* ── draw ───────────────────────────────────────────────────── */
  var onScreen = true, ticking = false;

  function frame() {
    ctx.clearRect(0, 0, W, H);

    /* 0 dB line and frequency ticks */
    ctx.strokeStyle = 'rgba(188,168,147,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, yOf(0)); ctx.lineTo(W - PAD_R, yOf(0)); ctx.stroke();
    ctx.font = '10px Newsreader, Georgia, serif';
    ctx.fillStyle = 'rgba(139,117,99,0.8)';
    ctx.textAlign = 'center';
    TICKS.forEach(function (f) {
      var x = xOf(f);
      ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, H - PAD_B); ctx.stroke();
      ctx.fillText(f >= 1000 ? (f / 1000) + 'k' : f, x, H - 5);
    });

    /* the analyser, filled, the way a plugin draws it */
    if (playing && analyser) {
      analyser.getByteFrequencyData(bins);
      var nyquist = ac.sampleRate / 2;
      ctx.beginPath();
      ctx.moveTo(PAD_L, H - PAD_B);
      for (var x = PAD_L; x <= W - PAD_R; x += 2) {
        var f = fOf(x);
        var bin = Math.round(f / nyquist * bins.length);
        var v = bins[Math.min(bins.length - 1, bin)] / 255;
        ctx.lineTo(x, (H - PAD_B) - v * (H - PAD_B - PAD_T) * 0.92);
      }
      ctx.lineTo(W - PAD_R, H - PAD_B);
      var grad = ctx.createLinearGradient(PAD_L, 0, W - PAD_R, 0);
      BANDS.forEach(function (b, i) {
        grad.addColorStop(i / (BANDS.length - 1), b.color + 'B0');
      });
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = grad;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* the EQ response */
    var mags = composite();
    ctx.beginPath();
    for (var i = 0; i < CURVE_N; i++) {
      var db = 20 * Math.log10(Math.max(mags[i], 1e-6));
      var px = xOf(curveF[i]), py = yOf(Math.max(-DB, Math.min(DB, db)));
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.strokeStyle = 'rgba(244,234,219,0.85)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    /* band handles */
    BANDS.forEach(function (b, i) {
      var gain = gains[i];
      var x = xOf(b.f), y = yOf(Math.max(-DB, Math.min(DB, gain)));
      var lit = Math.abs(gain) > 0.5, on = hover === i;
      ctx.beginPath();
      ctx.arc(x, y, on ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = lit ? b.color : 'rgba(21,16,14,0.9)';
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (on || lit) {
        ctx.fillStyle = b.color;
        ctx.font = '10px Newsreader, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, x, Math.max(12, y - 11));
      }
    });

    schedule();
  }

  function schedule() {
    if (!hasEQ || !onScreen) { ticking = false; return; }
    ticking = true;
    requestAnimationFrame(frame);
  }
  function wake() { if (!ticking) schedule(); }

  if (hasEQ && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; wake(); },
      { rootMargin: '120px' }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });

  /* pick up wherever the last page left off */
  var saved = restore();
  if (saved) {
    if (typeof saved.track === 'number') track = saved.track % TRACKS.length;
    if (Array.isArray(saved.gains)) gains = saved.gains.slice(0, BANDS.length);
  }
  describe();
  if (hasEQ) schedule();
  setInterval(tick, 250);

  if (saved && saved.time && build()) {
    audio.currentTime = saved.time;
    tick();
  }

  /* resume if the music was playing on the previous page; browsers block this
     until the visitor has interacted with the site, so it is best effort */
  play();
})();

/* ── the rail follows what you are reading ──────────────────────
   A link to another page can still light up: give it data-watch="<id>"
   and it tracks that block. That is how "calendar" lights up on the
   gig listing. */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav] a'));
  if (!links.length || !('IntersectionObserver' in window)) return;

  var watched = [];
  links.forEach(function (a) {
    var id = a.getAttribute('data-watch') ||
             (a.getAttribute('href').charAt(0) === '#' ? a.getAttribute('href').slice(1) : null);
    var el = id && document.getElementById(id);
    if (!el) return;
    var entry = watched.filter(function (w) { return w.el === el; })[0];
    if (entry) entry.links.push(a);
    else watched.push({ el: el, links: [a], visible: false });
  });
  if (!watched.length) return;

  function refresh() {
    /* when a block sits inside a section, the inner one wins — so the
       calendar link lights up instead of work, not alongside it */
    var live = watched.filter(function (w) { return w.visible; });
    var winner = null;
    live.forEach(function (w) {
      if (!winner || w.el.offsetHeight < winner.el.offsetHeight) winner = w;
    });
    watched.forEach(function (w) {
      w.links.forEach(function (a) { a.classList.toggle('is-active', w === winner); });
    });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      watched.forEach(function (w) { if (w.el === e.target) w.visible = e.isIntersecting; });
    });
    refresh();
  }, { rootMargin: '-45% 0px -50% 0px' });
  watched.forEach(function (w) { io.observe(w.el); });
})();
