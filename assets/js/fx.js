/* Three effects from the BIAS X source, rebuilt for the browser.
 *
 *   EQ       ten bands — low shelf 30 Hz, peaks 60 Hz–8 kHz at Q 1.5,
 *            high shelf 16 kHz, ±12 dB          (FxEQ10Mod.cpp)
 *   Tremolo  gain * (1 - depth·cos²(2π·rate·t)) (FxDemeterTremulatorTremolo.cpp)
 *   Reverb   Freeverb — but generated once into an impulse response and played
 *            back through a ConvolverNode       (Freeverb/tuning.h)
 *
 * The reverb is the reason for that last detour. Freeverb is recursive: eight
 * comb filters feeding back at up to 0.98. Running that live in a node graph is
 * where a reverb explodes. Running it once, offline, into a fixed impulse
 * response gives the same character through an FIR, which has no feedback path
 * and cannot run away. */

window.FX = (function () {
  'use strict';

  /* ── Freeverb, from tuning.h ──────────────────────────────────── */
  var FS0 = 22050, SPREAD = 23;
  var COMB_L = [558, 594, 638, 678, 711, 745, 778, 808];
  var COMB_R = [558 + SPREAD, 597 + SPREAD, 638 + SPREAD, 678 + SPREAD,
                711 + SPREAD, 745 + SPREAD, 778 + SPREAD, 808 + SPREAD];
  var AP_L = [278, 220, 170, 112];
  var AP_R = AP_L.map(function (t) { return t + SPREAD; });
  var SCALE_ROOM = 0.28, OFFSET_ROOM = 0.70;   /* feedback lands in 0.70 … 0.98 */
  var SCALE_DAMP = 0.4;
  var AP_FEEDBACK = 0.5;
  var MAX_SECONDS = 3;                          /* bounded memory and CPU */

  function channelIR(out, n, sr, feedback, damp1) {
    var damp2 = 1 - damp1;
    var combs = out.tunings.map(function (t) {
      return { buf: new Float32Array(Math.max(1, Math.round(t / FS0 * sr))), i: 0, store: 0 };
    });
    var aps = out.apTunings.map(function (t) {
      return { buf: new Float32Array(Math.max(1, Math.round(t / FS0 * sr))), i: 0 };
    });
    var data = out.data;
    for (var s = 0; s < n; s++) {
      var input = s === 0 ? 1 : 0;
      var acc = 0, k;
      for (k = 0; k < combs.length; k++) {
        var c = combs[k];
        var y = c.buf[c.i];
        c.store = y * damp2 + c.store * damp1;          /* damping inside the loop */
        c.buf[c.i] = input + c.store * feedback;        /* feedback < 1, always */
        c.i = (c.i + 1) % c.buf.length;
        acc += y;
      }
      for (k = 0; k < aps.length; k++) {
        var a = aps[k];
        var bufout = a.buf[a.i];
        var z = -acc + bufout;
        a.buf[a.i] = acc + bufout * AP_FEEDBACK;
        a.i = (a.i + 1) % a.buf.length;
        acc = z;
      }
      data[s] = acc;
    }
  }

  /* room and damp are 0…1. Returns an AudioBuffer, or null if the result is
     not something we are willing to play. */
  function buildIR(ac, room, damp) {
    room = Math.max(0, Math.min(1, room));
    damp = Math.max(0, Math.min(1, damp));
    var feedback = Math.min(0.98, OFFSET_ROOM + SCALE_ROOM * room);
    var damp1 = SCALE_DAMP * damp;
    var seconds = Math.min(MAX_SECONDS, 0.5 + room * 2.5);
    var sr = ac.sampleRate, n = Math.floor(sr * seconds);
    var buf = ac.createBuffer(2, n, sr);

    channelIR({ data: buf.getChannelData(0), tunings: COMB_L, apTunings: AP_L }, n, sr, feedback, damp1);
    channelIR({ data: buf.getChannelData(1), tunings: COMB_R, apTunings: AP_R }, n, sr, feedback, damp1);

    /* refuse anything that is not finite, and set a known peak */
    var peak = 0;
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < d.length; i++) {
        var v = d[i];
        if (!isFinite(v)) return null;
        var a = Math.abs(v);
        if (a > peak) peak = a;
      }
    }
    if (!(peak > 0)) return null;
    var g = 0.5 / peak;
    for (ch = 0; ch < 2; ch++) {
      var e = buf.getChannelData(ch);
      for (i = 0; i < e.length; i++) e[i] *= g;
    }
    return buf;
  }

  /* the decay envelope, for drawing, and an RT60 read off it */
  function envelope(buf, points) {
    var d = buf.getChannelData(0), n = d.length;
    var step = Math.max(1, Math.floor(n / points));
    var env = [], peak = 0, i, j;
    for (i = 0; i < n; i += step) {
      var m = 0;
      for (j = i; j < Math.min(n, i + step); j++) { var a = Math.abs(d[j]); if (a > m) m = a; }
      env.push(m);
      if (m > peak) peak = m;
    }
    /* the combs emit only delayed samples, so the tail builds from silence —
       start looking for the decay after the loudest point, not at zero */
    var top = 0;
    for (i = 0; i < env.length; i++) if (env[i] === peak) { top = i; break; }
    var rt = buf.duration;
    for (i = top; i < env.length; i++) {
      if (env[i] < peak * 0.001) { rt = (i / env.length) * buf.duration; break; }
    }
    return { env: env, peak: peak, rt60: rt, seconds: buf.duration };
  }

  /* ── Tremolo ──────────────────────────────────────────────────
     The source modulates by depth·cos²(2π·rate·t). Since
     cos²(x) = (1 + cos 2x)/2, that is a steady offset plus a cosine at twice
     the rate — which is exactly what an oscillator into a gain param gives. */
  function tremoloRate(x) { return 0.1 + 2.4 * Math.max(0, Math.min(1, x)); }

  /* Generating a response costs real time, so quantise the control and keep
     what we build. Dragging then reuses buffers instead of rebuilding. */
  var cache = {};
  var STEPS = 14;
  function quantise(x) { return Math.round(Math.max(0, Math.min(1, x)) * (STEPS - 1)); }
  function cachedIR(ac, room, damp) {
    var key = quantise(room) + ':' + quantise(damp) + ':' + ac.sampleRate;
    if (cache[key]) return cache[key];
    var ir = buildIR(ac, quantise(room) / (STEPS - 1), quantise(damp) / (STEPS - 1));
    if (ir) cache[key] = ir;
    return ir;
  }

  return {
    buildIR: buildIR,
    cachedIR: cachedIR,
    quantise: quantise,
    STEPS: STEPS,
    envelope: envelope,
    tremoloRate: tremoloRate,
    MAX_SECONDS: MAX_SECONDS
  };
})();
