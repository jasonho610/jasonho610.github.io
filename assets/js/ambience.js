/* Background music — opt-in, never automatic.
 *
 * Browsers block autoplay without a gesture, and unannounced sound on someone
 * else's website is rude, so this starts paused and remembers the choice.
 * While it plays it feeds the hero filterbank, so the curves follow the music
 * instead of noise. If the files are not there, the control hides itself. */

(function () {
  'use strict';

  var TRACKS = [
    {
      src: 'assets/audio/hard-bop-rainy-night.mp3',
      title: 'Hard Bop Rainy Night',
      artist: 'Alex Morgan',
      url: 'https://freemusicarchive.org/music/alex-morgan/moods-atmospheres-vol-4/hard-bop-rainy-night-bright-late-session/'
    },
    {
      src: 'assets/audio/too-cool-for-school.mp3',
      title: 'Too Cool for School',
      artist: 'NoKings XXX',
      url: 'https://freemusicarchive.org/music/nokings-xxx/too-cool-for-school/too-cool-for-school/'
    }
  ];

  var KEY = 'ambience';
  var index = 0, audio = null, ctx = null, analyser = null, started = false;

  var box = document.createElement('div');
  box.className = 'ambience';
  box.hidden = true;
  box.innerHTML =
    '<button type="button" class="ambience-toggle" aria-pressed="false">' +
      '<span class="ambience-bars" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="ambience-label">play</span>' +
    '</button>' +
    '<p class="ambience-now"></p>';
  document.body.appendChild(box);

  var toggle = box.querySelector('.ambience-toggle');
  var label = box.querySelector('.ambience-label');
  var now = box.querySelector('.ambience-now');

  function describe() {
    var t = TRACKS[index];
    now.innerHTML = '';
    var a = document.createElement('a');
    a.href = t.url;
    a.textContent = t.title + ' — ' + t.artist;
    now.appendChild(a);
    now.appendChild(document.createTextNode(' · CC BY'));
  }

  function build() {
    audio = new Audio();
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.5;
    audio.addEventListener('ended', function () {
      index = (index + 1) % TRACKS.length;
      audio.src = TRACKS[index].src;
      describe();
      audio.play().catch(stop);
    });
    audio.addEventListener('error', stop);
    audio.src = TRACKS[index].src;
  }

  /* hand the hero canvas something to draw */
  function listen() {
    if (analyser) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      var source = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      window.__ambience = { analyser: analyser, ctx: ctx, playing: function () { return started; } };
    } catch (e) { /* the canvas simply keeps its idle motion */ }
  }

  function play() {
    if (!audio) build();
    listen();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    audio.play().then(function () {
      started = true;
      box.classList.add('is-playing');
      toggle.setAttribute('aria-pressed', 'true');
      label.textContent = 'pause';
      describe();
      try { localStorage.setItem(KEY, 'on'); } catch (e) {}
    }).catch(stop);
  }

  function stop() {
    started = false;
    if (audio) audio.pause();
    box.classList.remove('is-playing');
    toggle.setAttribute('aria-pressed', 'false');
    label.textContent = 'play';
    try { localStorage.setItem(KEY, 'off'); } catch (e) {}
  }

  toggle.addEventListener('click', function () { started ? stop() : play(); });

  /* only offer the control if the audio is actually published */
  fetch(TRACKS[0].src, { method: 'HEAD' }).then(function (r) {
    if (!r.ok) return;
    box.hidden = false;
    describe();
    /* a returning visitor who switched it on still has to click once —
       browsers do not accept a stored preference as a gesture */
    /* Try to start on arrival. Browsers block audible autoplay until the visitor
       has interacted with the site, so this usually fails on a first visit and
       the button is what actually starts it. Chrome does allow it once a
       visitor has played audio here often enough. */
    play();
  }).catch(function () { /* no files, no control */ });
})();
