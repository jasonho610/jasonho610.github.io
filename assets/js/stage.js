/* The band across the top of the page is a ten-band EQ with a live analyser,
 * built the same way as the one in BIAS X: a low shelf at 30 Hz, eight peaks an
 * octave apart from 60 Hz to 8 kHz at Q 1.5, a high shelf at 16 kHz, ±15 dB.
 *
 * Left alone it just shows the music moving. Click a band and that band is
 * actually boosted — the curve rises and you hear it. Click it again to flatten. */

(function () {
  'use strict';

  var canvas = document.getElementById('eq');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var F_MIN = 20, F_MAX = 20000, DB = 18, MAX_GAIN = 15;

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
  var playing = false, hover = -1;

  /* ── geometry ───────────────────────────────────────────────── */
  var dpr = 1, W = 0, H = 0, PAD_B = 18, PAD_T = 8;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  var logMin = Math.log(F_MIN), logSpan = Math.log(F_MAX) - logMin;
  function xOf(f) { return (Math.log(f) - logMin) / logSpan * W; }
  function fOf(x) { return Math.exp(logMin + (x / W) * logSpan); }
  function yOf(db) {
    var top = PAD_T, bot = H - PAD_B;
    return bot - ((db + DB) / (DB * 2)) * (bot - top);
  }
  resize();
  window.addEventListener('resize', resize);

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
      f.gain.value = 0;
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

  /* ── transport ──────────────────────────────────────────────── */
  var button = document.querySelector('.transport');
  var label = button && button.querySelector('.label');
  var nowPlaying = document.querySelector('.now-playing');

  function describe() {
    if (!nowPlaying) return;
    var t = TRACKS[track];
    nowPlaying.innerHTML = '';
    var a = document.createElement('a');
    a.href = t.url;
    a.textContent = t.title + ' — ' + t.artist;
    nowPlaying.appendChild(a);
    nowPlaying.appendChild(document.createTextNode(' · CC BY'));
  }

  function play() {
    if (!ac && !build()) return;
    if (ac.state === 'suspended') ac.resume();
    audio.play().then(function () {
      playing = true;
      if (button) { button.classList.add('is-playing'); button.setAttribute('aria-pressed', 'true'); }
      if (label) label.textContent = 'pause';
      describe();
    }).catch(pause);
  }
  function pause() {
    playing = false;
    if (audio) audio.pause();
    if (button) { button.classList.remove('is-playing'); button.setAttribute('aria-pressed', 'false'); }
    if (label) label.textContent = 'play';
  }
  if (button) button.addEventListener('click', function () { playing ? pause() : play(); });

  /* ── clicking a band boosts it, for real ────────────────────── */
  function nearest(x) {
    var best = -1, bestDist = 1e9;
    BANDS.forEach(function (b, i) {
      var d = Math.abs(xOf(b.f) - x);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return bestDist < 36 ? best : -1;
  }
  canvas.addEventListener('pointermove', function (e) {
    hover = nearest(e.clientX - canvas.getBoundingClientRect().left);
    canvas.style.cursor = hover >= 0 ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', function () { hover = -1; });
  canvas.addEventListener('click', function (e) {
    var i = nearest(e.clientX - canvas.getBoundingClientRect().left);
    if (i < 0) return;
    if (!ac && !build()) return;
    var g = filters[i].gain;
    var target = Math.abs(g.value) < 0.5 ? MAX_GAIN : 0;
    g.cancelScheduledValues(ac.currentTime);
    g.setValueAtTime(g.value, ac.currentTime);
    g.linearRampToValueAtTime(target, ac.currentTime + 0.18);
  });
  var reset = document.querySelector('.eq-reset');
  if (reset) reset.addEventListener('click', function () {
    if (!ac) return;
    filters.forEach(function (f) {
      f.gain.cancelScheduledValues(ac.currentTime);
      f.gain.setValueAtTime(f.gain.value, ac.currentTime);
      f.gain.linearRampToValueAtTime(0, ac.currentTime + 0.18);
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
    if (!filters.length) return total;
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
    ctx.beginPath(); ctx.moveTo(0, yOf(0)); ctx.lineTo(W, yOf(0)); ctx.stroke();
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
      ctx.moveTo(0, H - PAD_B);
      for (var x = 0; x <= W; x += 2) {
        var f = fOf(x);
        var bin = Math.round(f / nyquist * bins.length);
        var v = bins[Math.min(bins.length - 1, bin)] / 255;
        ctx.lineTo(x, (H - PAD_B) - v * (H - PAD_B - PAD_T) * 0.92);
      }
      ctx.lineTo(W, H - PAD_B);
      var grad = ctx.createLinearGradient(0, PAD_T, 0, H - PAD_B);
      grad.addColorStop(0, 'rgba(244,178,63,0.30)');
      grad.addColorStop(1, 'rgba(244,178,63,0.02)');
      ctx.fillStyle = grad;
      ctx.fill();
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
      var gain = filters.length ? filters[i].gain.value : 0;
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
    if (!onScreen) { ticking = false; return; }
    ticking = true;
    requestAnimationFrame(frame);
  }
  function wake() { if (!ticking) schedule(); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; wake(); },
      { rootMargin: '120px' }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });

  describe();
  schedule();

  /* try to start on arrival; browsers usually say no until you click */
  play();
})();

/* ── the rail follows what you are reading ──────────────────────
   A link to another page can still light up: give it data-watch="<id>"
   and it tracks that block. That is how "calendar" lights up on the
   gig listing. */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav] a'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var map = {};
  links.forEach(function (a) {
    var id = a.getAttribute('data-watch') ||
             (a.getAttribute('href').charAt(0) === '#' ? a.getAttribute('href').slice(1) : null);
    if (!id || !document.getElementById(id)) return;
    (map[id] = map[id] || []).push(a);
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      (map[e.target.id] || []).forEach(function (a) { a.classList.toggle('is-active', e.isIntersecting); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
})();
