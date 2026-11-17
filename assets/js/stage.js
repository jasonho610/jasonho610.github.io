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

  /* the rack: three units, each independently bypassable */
  var eqOn = true;
  var tremOn = false, tremRate = 0.75, tremDepth = 0.6;
  var verbOn = false, verbRoom = 0.45, verbMix = 0.3, verbDamp = 0.5;
  /* the control the drag writes, and the value the audio actually follows —
     the same one-pole smoother the plugin uses: x += (target - x) * 0.1 */
  var verbRoomTarget = 0.45, verbMixTarget = 0.3;
  var convA = null, convB = null, fadeA = null, fadeB = null, activeConv = 'A', loadedBucket = -1;
  var trem = null, lfo = null, lfoAmt = null;
  var dryGain = null, wetGain = null, irInfo = null;
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
  function resizeAll() { if (hasEQ) resize(); sizePanel(tremCv, tremCtx, tremBox); sizePanel(verbCv, verbCtx, verbBox); }

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

    /* tremolo: a gain stage wobbled by an oscillator */
    trem = ac.createGain();
    trem.gain.value = 1;
    node.connect(trem);
    node = trem;

    lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = FX.tremoloRate(tremRate) * 2;  /* cos² is a cosine at twice the rate */
    lfoAmt = ac.createGain();
    lfoAmt.gain.value = 0;
    lfo.connect(lfoAmt);
    lfoAmt.connect(trem.gain);
    lfo.start();

    /* reverb: Freeverb rendered once into an impulse response, then convolved.
       No feedback path exists at playback, so there is nothing to run away.
       Two convolvers so a change of decay can be crossfaded instead of cut. */
    convA = ac.createConvolver(); convA.normalize = true;
    convB = ac.createConvolver(); convB.normalize = true;
    fadeA = ac.createGain(); fadeA.gain.value = 1;
    fadeB = ac.createGain(); fadeB.gain.value = 0;
    var guard = ac.createDynamicsCompressor();   /* belt and braces on the wet bus */
    guard.threshold.value = -6;
    guard.ratio.value = 12;
    dryGain = ac.createGain();
    wetGain = ac.createGain();
    dryGain.gain.value = 1;
    wetGain.gain.value = 0;
    node.connect(dryGain);
    node.connect(convA); convA.connect(fadeA); fadeA.connect(guard);
    node.connect(convB); convB.connect(fadeB); fadeB.connect(guard);
    guard.connect(wetGain);
    var sum = ac.createGain();
    dryGain.connect(sum);
    wetGain.connect(sum);
    node = sum;

    rebuildIR(true);
    applyTrem();
    applyVerb();

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

  function applyTrem() {
    if (!ac || !trem) return;
    var d = tremOn ? tremDepth : 0;
    lfo.frequency.setTargetAtTime(FX.tremoloRate(tremRate) * 2, ac.currentTime, 0.02);
    trem.gain.setTargetAtTime(1 - d / 2, ac.currentTime, 0.02);
    lfoAmt.gain.setTargetAtTime(-d / 2, ac.currentTime, 0.02);
  }

  function applyVerb() {
    if (!ac || !wetGain) return;
    var m = verbOn ? verbMix : 0;
    wetGain.gain.setTargetAtTime(Math.sin(m * Math.PI / 2), ac.currentTime, 0.03);
    dryGain.gain.setTargetAtTime(Math.cos(m * Math.PI / 2), ac.currentTime, 0.03);
  }

  /* Swap the response only when the smoothed control crosses into a new step,
     and crossfade the two convolvers so the tail is never cut mid-flight. */
  function rebuildIR(force) {
    if (!ac || !convA) return;
    var bucket = FX.quantise(verbRoom);
    if (!force && bucket === loadedBucket) return;
    var ir = FX.cachedIR(ac, verbRoom, verbDamp);
    if (!ir) return;                      /* refused: keep what is already loaded */
    loadedBucket = bucket;
    irInfo = FX.envelope(ir, 220);
    var incoming = activeConv === 'A' ? convB : convA;
    var inFade   = activeConv === 'A' ? fadeB : fadeA;
    var outFade  = activeConv === 'A' ? fadeA : fadeB;
    incoming.buffer = ir;
    var t = ac.currentTime, dur = 0.12;
    inFade.gain.cancelScheduledValues(t);
    outFade.gain.cancelScheduledValues(t);
    inFade.gain.setValueAtTime(inFade.gain.value, t);
    outFade.gain.setValueAtTime(outFade.gain.value, t);
    inFade.gain.linearRampToValueAtTime(1, t + dur);
    outFade.gain.linearRampToValueAtTime(0, t + dur);
    activeConv = activeConv === 'A' ? 'B' : 'A';
  }
  function rebuildIRSoon() { rebuildIR(false); }

  /* called every frame: ease the value towards where the drag put it */
  function smoothVerb() {
    var before = FX.quantise(verbRoom);
    verbRoom += (verbRoomTarget - verbRoom) * 0.1;
    verbMix  += (verbMixTarget  - verbMix)  * 0.1;
    if (Math.abs(verbRoomTarget - verbRoom) < 0.002) verbRoom = verbRoomTarget;
    if (Math.abs(verbMixTarget - verbMix) < 0.002) verbMix = verbMixTarget;
    if (FX.quantise(verbRoom) !== before) rebuildIR(false);
    applyVerb();
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
        gains: gains,
        rack: { eqOn: eqOn, tremOn: tremOn, tremRate: tremRate, tremDepth: tremDepth,
                verbOn: verbOn, verbRoom: verbRoomTarget, verbMix: verbMixTarget }
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
    if (!eqOn) db = 0;
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
  var dragFromY = 0, dragFromGain = 0;

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
    dragFromY = p.y; dragFromGain = gains[i];   /* move from here, not to here */
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = local(e);
    if (dragging >= 0) {
      dragMoved = true;
      var span = (H - PAD_B) - PAD_T;
      var perPixel = (DB * 2) / Math.max(1, span);
      var db = dragFromGain + (dragFromY - p.y) * perPixel;
      setGain(dragging, Math.max(-MAX_GAIN, Math.min(MAX_GAIN, db)), false);
      e.preventDefault();            /* on a phone, drag the band — not the page */
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

  function applyEQ() {
    if (!filters.length) return;
    filters.forEach(function (f, i) {
      var v = eqOn ? gains[i] : 0;
      f.gain.cancelScheduledValues(ac.currentTime);
      f.gain.setTargetAtTime(v, ac.currentTime, 0.02);
    });
  }

  /* ── the other two panels ───────────────────────────────────── */
  var tremCv = document.getElementById('trem');
  var verbCv = document.getElementById('verb');
  var tremCtx = tremCv && tremCv.getContext ? tremCv.getContext('2d') : null;
  var verbCtx = verbCv && verbCv.getContext ? verbCv.getContext('2d') : null;
  var tremBox = { w: 0, h: 0 }, verbBox = { w: 0, h: 0 };

  function sizePanel(cv, c, box) {
    if (!c) return;
    var r = cv.getBoundingClientRect();
    box.w = r.width; box.h = r.height;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawTrem() {
    if (!tremCtx) return;
    var w = tremBox.w, h = tremBox.h, pad = 10;
    tremCtx.clearRect(0, 0, w, h);
    var rate = FX.tremoloRate(tremRate);
    var span = 2.2;                                   /* seconds across the panel */
    var now = ac ? ac.currentTime : 0;
    var mid = h / 2, amp = (h / 2 - pad) * 0.92;

    tremCtx.strokeStyle = 'rgba(188,168,147,0.12)';
    tremCtx.lineWidth = 1;
    tremCtx.beginPath(); tremCtx.moveTo(0, mid); tremCtx.lineTo(w, mid); tremCtx.stroke();

    /* gain = 1 - depth·cos²(2π·rate·t), drawn as it is heard */
    var on = tremOn;
    tremCtx.beginPath();
    for (var px = 0; px <= w; px++) {
      var t = (px / w) * span;
      var c = Math.cos(2 * Math.PI * rate * t);
      var g = 1 - (on ? tremDepth : 0) * c * c;
      tremCtx.lineTo(px, mid + amp - g * amp);
    }
    tremCtx.strokeStyle = on ? '#F4B23F' : 'rgba(214,197,174,0.35)';
    tremCtx.lineWidth = 1.8;
    tremCtx.stroke();

    if (on && playing) {                               /* where the music is in the cycle */
      var ph = (now % span) / span * w;
      var tt = (now % span);
      var cc = Math.cos(2 * Math.PI * rate * tt);
      var gg = 1 - tremDepth * cc * cc;
      tremCtx.beginPath();
      tremCtx.arc(ph, mid + amp - gg * amp, 4, 0, Math.PI * 2);
      tremCtx.fillStyle = '#F4B23F';
      tremCtx.fill();
    }

    tremCtx.font = '10px Newsreader, Georgia, serif';
    tremCtx.fillStyle = 'rgba(160,139,116,0.9)';
    tremCtx.textAlign = 'left';
    tremCtx.fillText(rate.toFixed(2) + ' Hz', 2, h - 3);
    tremCtx.textAlign = 'right';
    tremCtx.fillText(Math.round(tremDepth * 100) + '% depth', w - 2, h - 3);
  }

  function drawVerb() {
    if (!verbCtx) return;
    var w = verbBox.w, h = verbBox.h, pad = 10;
    verbCtx.clearRect(0, 0, w, h);
    var base = h - pad - 8;

    verbCtx.strokeStyle = 'rgba(188,168,147,0.12)';
    verbCtx.lineWidth = 1;
    verbCtx.beginPath(); verbCtx.moveTo(0, base); verbCtx.lineTo(w, base); verbCtx.stroke();

    var on = verbOn;
    if (irInfo && irInfo.env.length) {
      var env = irInfo.env, n = env.length, peak = irInfo.peak || 1;
      var grad = verbCtx.createLinearGradient(0, pad, 0, base);
      grad.addColorStop(0, on ? 'rgba(79,188,228,0.55)' : 'rgba(214,197,174,0.18)');
      grad.addColorStop(1, 'rgba(79,188,228,0.03)');
      verbCtx.beginPath();
      verbCtx.moveTo(0, base);
      for (var i = 0; i < n; i++) {
        verbCtx.lineTo((i / (n - 1)) * w, base - (env[i] / peak) * (base - pad));
      }
      verbCtx.lineTo(w, base);
      verbCtx.fillStyle = grad;
      verbCtx.fill();
      verbCtx.strokeStyle = on ? '#4FBCE4' : 'rgba(214,197,174,0.35)';
      verbCtx.lineWidth = 1.4;
      verbCtx.stroke();
    }

    verbCtx.font = '10px Newsreader, Georgia, serif';
    verbCtx.fillStyle = 'rgba(160,139,116,0.9)';
    verbCtx.textAlign = 'left';
    verbCtx.fillText(irInfo ? irInfo.rt60.toFixed(2) + ' s' : '—', 2, h - 3);
    verbCtx.textAlign = 'right';
    verbCtx.fillText(Math.round(verbMix * 100) + '% wet', w - 2, h - 3);
  }

  /* dragging either panel: across sets the main parameter, up sets the amount */
  function panelDrag(cv, box, read, onMove) {
    if (!cv) return;
    var down = false, fromX = 0, fromY = 0, baseX = 0, baseY = 0;
    cv.addEventListener('pointerdown', function (e) {
      if (!ac && !build()) return;
      down = true;
      var r = cv.getBoundingClientRect();
      fromX = e.clientX; fromY = e.clientY;
      var v = read();
      baseX = v[0]; baseY = v[1];           /* carry on from the present setting */
      cv.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) { if (down) { move(e); e.preventDefault(); } });
    function end(e) {
      if (!down) return;
      down = false;
      if (e && e.pointerId !== undefined && cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    function move(e) {
      var r = cv.getBoundingClientRect();
      var x = clamp01(baseX + (e.clientX - fromX) / r.width);
      var y = clamp01(baseY - (e.clientY - fromY) / r.height);
      onMove(x, y);
    }
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  panelDrag(tremCv, tremBox, function () { return [tremRate, tremDepth]; }, function (x, y) {
    tremRate = x; tremDepth = y;
    if (!tremOn) { tremOn = true; markUnit('trem', true); }
    applyTrem(); save();
  });
  panelDrag(verbCv, verbBox, function () { return [verbRoomTarget, verbMixTarget]; }, function (x, y) {
    verbRoomTarget = x; verbMixTarget = y;
    if (!verbOn) { verbOn = true; markUnit('verb', true); }
    save();
  });

  function markUnit(name, on) {
    var btn = document.querySelector('[data-bypass="' + name + '"]');
    if (!btn) return;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? 'on' : 'off';
    var unit = btn.closest('.unit');
    if (unit) unit.classList.toggle('is-off', !on);
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-bypass]'), function (btn) {
    btn.addEventListener('click', function () {
      if (!ac && !build()) return;
      var which = btn.getAttribute('data-bypass');
      if (which === 'eq')   { eqOn = !eqOn;     markUnit('eq', eqOn);     applyEQ(); }
      if (which === 'trem') { tremOn = !tremOn; markUnit('trem', tremOn); applyTrem(); }
      if (which === 'verb') { verbOn = !verbOn; markUnit('verb', verbOn); applyVerb(); }
      save();
    });
  });

  /* ── presets for the other two units ────────────────────────── */
  var TREM_PRESETS = {               /* rate 0…1 maps to 0.1 + 2.4x Hz */
    gentle:  [0.22, 0.35],
    classic: [0.55, 0.60],
    fast:    [1.00, 0.70],
    deep:    [0.40, 1.00]
  };
  var VERB_PRESETS = {               /* room, wet */
    room:    [0.18, 0.20],
    hall:    [0.55, 0.30],
    cavern:  [1.00, 0.42]
  };

  function markPreset(unit, name) {
    document.querySelectorAll('[data-unit="' + unit + '"]').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-choice') === name);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-unit="trem"]'), function (btn) {
    btn.addEventListener('click', function () {
      if (!ac && !build()) return;
      var p = TREM_PRESETS[btn.getAttribute('data-choice')];
      if (!p) return;
      tremRate = p[0]; tremDepth = p[1];
      if (!tremOn) { tremOn = true; markUnit('trem', true); }
      applyTrem(); markPreset('trem', btn.getAttribute('data-choice')); save();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-unit="verb"]'), function (btn) {
    btn.addEventListener('click', function () {
      if (!ac && !build()) return;
      var p = VERB_PRESETS[btn.getAttribute('data-choice')];
      if (!p) return;
      verbRoomTarget = p[0]; verbMixTarget = p[1];
      if (!verbOn) { verbOn = true; markUnit('verb', true); }
      markPreset('verb', btn.getAttribute('data-choice')); save();
    });
  });

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
    if (!hasEQ) { smoothVerb(); drawTrem(); drawVerb(); schedule(); return; }
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

    smoothVerb();
    drawTrem();
    drawVerb();
    schedule();
  }

  function schedule() {
    if ((!hasEQ && !tremCtx) || !onScreen) { ticking = false; return; }
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
    if (saved.rack) {
      eqOn = saved.rack.eqOn !== false;
      tremOn = !!saved.rack.tremOn;
      verbOn = !!saved.rack.verbOn;
      if (typeof saved.rack.tremRate === 'number') tremRate = saved.rack.tremRate;
      if (typeof saved.rack.tremDepth === 'number') tremDepth = saved.rack.tremDepth;
      if (typeof saved.rack.verbRoom === 'number') verbRoom = verbRoomTarget = saved.rack.verbRoom;
      if (typeof saved.rack.verbMix === 'number') verbMix = verbMixTarget = saved.rack.verbMix;
    }
  }
  describe();
  resizeAll();
  window.addEventListener('resize', resizeAll);
  markUnit('eq', eqOn); markUnit('trem', tremOn); markUnit('verb', verbOn);
  if (hasEQ || tremCtx) schedule();
  setInterval(tick, 250);

  if (saved && saved.time && build()) {
    audio.currentTime = saved.time;
    tick();
  }

  /* Carry the previous page's state across. If the music was paused there,
     leave it paused — arriving on the calendar should never start sound the
     visitor just stopped. With no stored state at all this is a first visit,
     so it is worth an attempt the browser will usually refuse anyway. */
  if (!saved || saved.playing !== false) play();
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
