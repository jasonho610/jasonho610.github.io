/* Hero filterbank — six octave-spaced bandpass filters drawn across a log
   frequency axis. Idle, they breathe. On "hear the filterbank", pink-ish noise
   runs through the real filters and the curves follow the analyser. */

(function () {
  'use strict';

  var canvas = document.getElementById('spectrum');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var F_MIN = 55, F_MAX = 11000;
  var BANDS = [
    { f: 110,  q: 3.4, color: '#F4B23F' },
    { f: 220,  q: 3.6, color: '#E8763A' },
    { f: 440,  q: 3.8, color: '#C8453C' },
    { f: 880,  q: 4.0, color: '#A3466F' },
    { f: 1760, q: 4.2, color: '#3F6FC4' },
    { f: 3520, q: 4.4, color: '#4FBCE4' }
  ];
  var TICKS = [110, 440, 1760, 7040];

  BANDS.forEach(function (b, i) {
    b.amp = 0;          // drawn height, 0..1
    b.target = 0.34;    // where amp is heading
    b.phase = i * 1.07;
  });

  var dpr = 1, W = 0, H = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  var logMin = Math.log(F_MIN), logSpan = Math.log(F_MAX) - logMin;
  function xOf(f) { return (Math.log(f) - logMin) / logSpan * W; }
  function fOf(x) { return Math.exp(logMin + (x / W) * logSpan); }

  /* magnitude of a 2nd-order bandpass at frequency f */
  function mag(f, fc, q) {
    var r = f / fc - fc / f;
    return 1 / Math.sqrt(1 + q * q * r * r);
  }

  var pointerX = null;
  canvas.addEventListener('pointermove', function (e) {
    pointerX = e.clientX - canvas.getBoundingClientRect().left;
  });
  canvas.addEventListener('pointerleave', function () { pointerX = null; });

  /* ── audio ─────────────────────────────────────────────────── */
  var audio = null, playing = false, stopAt = 0;

  function buildAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ac = new AC();

    var seconds = 2.5, buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < d.length; i++) {
      var white = Math.random() * 2 - 1;
      last = 0.97 * last + 0.03 * white;      /* lean on the low end, closer to pink */
      d[i] = (white * 0.35 + last * 3.2) * 0.4;
    }

    var src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;

    var master = ac.createGain();
    master.gain.value = 0.0;

    var analysers = BANDS.map(function (b) {
      var filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = b.f;
      filter.Q.value = b.q;

      var gain = ac.createGain();
      gain.gain.value = 0;

      var an = ac.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.72;

      src.connect(filter); filter.connect(gain); gain.connect(an); an.connect(master);
      return { gain: gain, analyser: an, data: new Uint8Array(an.frequencyBinCount) };
    });

    master.connect(ac.destination);
    src.start();
    return { ac: ac, src: src, master: master, chain: analysers };
  }

  var button = document.querySelector('.listen');
  var buttonLabel = button && button.querySelector('.label');

  function start() {
    if (!audio) audio = buildAudio();
    if (!audio) return;
    var ac = audio.ac;
    if (ac.state === 'suspended') ac.resume();

    var t = ac.currentTime, step = 0.42, hold = 0.52;
    audio.master.gain.cancelScheduledValues(t);
    audio.master.gain.setValueAtTime(0.0001, t);
    audio.master.gain.exponentialRampToValueAtTime(0.9, t + 0.12);

    audio.chain.forEach(function (node, i) {
      var on = t + 0.1 + i * step;
      var g = node.gain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.0001, t);
      g.exponentialRampToValueAtTime(1.6, on + 0.14);
      g.exponentialRampToValueAtTime(0.0001, on + hold + 0.5);
    });

    /* then open every band at once — the whole signal, reassembled */
    var all = t + 0.1 + BANDS.length * step + 0.25;
    audio.chain.forEach(function (node) {
      node.gain.gain.exponentialRampToValueAtTime(0.85, all + 0.3);
      node.gain.gain.setValueAtTime(0.85, all + 1.1);
      node.gain.gain.exponentialRampToValueAtTime(0.0001, all + 2.0);
    });
    audio.master.gain.setValueAtTime(0.9, all + 1.7);
    audio.master.gain.exponentialRampToValueAtTime(0.0001, all + 2.05);

    stopAt = (all + 2.1 - t) * 1000 + performance.now();
    playing = true;
    if (button) { button.classList.add('is-playing'); button.setAttribute('aria-pressed', 'true'); }
    if (buttonLabel) buttonLabel.textContent = 'stop';
  }

  function stop() {
    playing = false;
    if (audio) {
      var t = audio.ac.currentTime;
      audio.master.gain.cancelScheduledValues(t);
      audio.master.gain.setValueAtTime(audio.master.gain.value || 0.0001, t);
      audio.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    }
    if (button) { button.classList.remove('is-playing'); button.setAttribute('aria-pressed', 'false'); }
    if (buttonLabel) buttonLabel.textContent = 'hear the filterbank';
  }

  if (button) {
    button.addEventListener('click', function () { playing ? stop() : start(); });
  }

  /* ── draw ──────────────────────────────────────────────────── */
  var born = performance.now();
  var onScreen = true, ticking = false;

  /* when the background music is playing, read the real spectrum around each
     band centre instead of synthesising movement */
  var musicBins = null;
  function musicLevel(b) {
    var amb = window.__ambience;
    if (!amb || !amb.playing()) return null;
    var an = amb.analyser;
    if (!musicBins || musicBins.length !== an.frequencyBinCount) musicBins = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(musicBins);
    var nyquist = amb.ctx.sampleRate / 2;
    var lo = Math.max(0, Math.floor(b.f / Math.SQRT2 / nyquist * musicBins.length));
    var hi = Math.min(musicBins.length - 1, Math.ceil(b.f * Math.SQRT2 / nyquist * musicBins.length));
    var peak = 0;
    for (var i = lo; i <= hi; i++) if (musicBins[i] > peak) peak = musicBins[i];
    return peak / 255;
  }

  function level(node) {
    node.analyser.getByteFrequencyData(node.data);
    var peak = 0;
    for (var i = 0; i < node.data.length; i++) if (node.data[i] > peak) peak = node.data[i];
    return peak / 255;
  }

  function frame(now) {
    var t = (now - born) / 1000;
    var settle = Math.min(1, t / 1.4);              /* one page-load resolve */
    if (playing && now > stopAt) stop();

    ctx.clearRect(0, 0, W, H);

    /* frequency axis */
    ctx.font = '11px Newsreader, Georgia, serif';
    ctx.textAlign = 'center';
    TICKS.forEach(function (f) {
      var x = xOf(f);
      ctx.strokeStyle = 'rgba(188,168,147,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, H - 16); ctx.lineTo(x, H - 10); ctx.stroke();
      ctx.fillStyle = 'rgba(139,117,99,0.85)';
      ctx.fillText(f >= 1000 ? (f / 1000) + 'k' : f, x, H - 2);
    });

    var baseline = H - 20;
    var hoverF = pointerX === null ? null : fOf(Math.max(0, Math.min(W, pointerX)));

    BANDS.forEach(function (b, i) {
      var music = musicLevel(b);
      if (playing && audio) {
        b.target = 0.14 + level(audio.chain[i]) * 0.95;
      } else if (music !== null) {
        b.target = 0.12 + music * 1.0;
      } else if (reduced) {
        b.target = 0.36;
      } else {
        b.target = 0.3 + 0.12 * Math.sin(t * 0.55 + b.phase) + 0.05 * Math.sin(t * 1.31 + b.phase * 2);
      }
      if (hoverF !== null) {
        b.target += 0.4 * mag(hoverF, b.f, b.q * 0.75);
      }
      /* jitter at birth, resolving into clean bands */
      var jitter = (1 - settle) * (Math.random() * 0.5 - 0.1);
      b.amp += ((b.target + jitter) * settle - b.amp) * (playing || music !== null ? 0.3 : 0.07);

      var h = Math.max(0, b.amp) * (baseline * 0.86);
      ctx.beginPath();
      ctx.moveTo(0, baseline);
      for (var x = 0; x <= W; x += 2) {
        ctx.lineTo(x, baseline - mag(fOf(x), b.f, b.q) * h);
      }
      ctx.lineTo(W, baseline);

      var grad = ctx.createLinearGradient(0, baseline - h, 0, baseline);
      grad.addColorStop(0, b.color + '3D');
      grad.addColorStop(1, b.color + '00');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = playing ? 16 : 9;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    schedule();
  }

  function schedule() {
    if (!onScreen && !playing) { ticking = false; return; }
    ticking = true;
    requestAnimationFrame(frame);
  }
  function wake() { if (!ticking) schedule(); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      wake();
    }, { rootMargin: '120px' }).observe(canvas);
  }
  document.addEventListener('ambience', function () { wake(); });
  document.addEventListener('visibilitychange', function () {
    onScreen = onScreen && !document.hidden;
    if (!document.hidden) wake();
  });

  schedule();
})();

/* ── rail: mark the section you are reading ─────────────────────── */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav] a'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var map = {};
  links.forEach(function (a) {
    var el = document.querySelector(a.getAttribute('href'));
    if (el) map[el.id] = (map[el.id] || []).concat(a);
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var set = map[e.target.id] || [];
      set.forEach(function (a) { a.classList.toggle('is-active', e.isIntersecting); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
})();
