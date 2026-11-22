/* Renders window.EVENTS into: the next date up, a year axis per year, and the lists. */

(function () {
  'use strict';

  var events = (window.EVENTS || []).slice();
  if (!events.length) return;

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /* parse without letting the timezone shift the day */
  function parse(s) {
    var p = String(s).split('-').map(Number);
    return { y: p[0], m: p.length > 1 ? p[1] - 1 : null, d: p.length > 2 ? p[2] : null };
  }
  function toDate(e) {
    var p = e.parsed;
    return new Date(p.y, p.m === null ? 11 : p.m, p.d === null ? 28 : p.d);
  }
  function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function dayOfYear(dt) {
    var start = new Date(dt.getFullYear(), 0, 1);
    return Math.floor((dt - start) / 86400000);
  }

  var today = new Date(); today.setHours(0, 0, 0, 0);

  /* "first-saturday" means a residency: work out the next few dates rather than
     making someone type them in every month. */
  function firstSaturday(y, m) {
    var first = new Date(y, m, 1);
    return new Date(y, m, 1 + ((6 - first.getDay() + 7) % 7));
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var AHEAD = 3;
  var expanded = [];
  events.forEach(function (e) {
    if (e.repeat !== 'first-saturday') { expanded.push(e); return; }
    var cursor = new Date(today.getFullYear(), today.getMonth(), 1), found = 0;
    while (found < AHEAD) {
      var d = firstSaturday(cursor.getFullYear(), cursor.getMonth());
      if (d >= today) {
        var copy = {};
        for (var k in e) if (e.hasOwnProperty(k)) copy[k] = e[k];
        delete copy.repeat;
        copy.recurring = true;
        copy.date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        expanded.push(copy);
        found++;
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  });
  events = expanded;

  events.forEach(function (e) { e.parsed = parse(e.date); e.when = toDate(e); });
  events.sort(function (a, b) { return b.when - a.when; });

  var upcoming = events.filter(function (e) { return e.when >= today; }).reverse();
  var past = events.filter(function (e) { return e.when < today; });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function dateLabel(e) {
    var p = e.parsed;
    if (p.m === null) return String(p.y);
    if (p.d === null) return SHORT[p.m] + ' ' + p.y;
    return p.d + ' ' + SHORT[p.m] + ' ' + p.y;
  }

  /* ── one entry in a list ─────────────────────────────────────── */
  function entry(e) {
    var li = el('li', 'entry kind-' + e.kind);
    li.id = idOf(e);
    if (e.snow) li.classList.add('wants-snow');
    if (e.tbc) li.classList.add('is-tbc');

    var when = el('div', 'entry-when');
    var p = e.parsed;
    if (p.d !== null) {
      when.appendChild(el('span', 'date', p.d + ' ' + SHORT[p.m]));
      when.appendChild(el('span', 'meta', DAYS[e.when.getDay()] + ' · ' + p.y));
      if (e.recurring) when.appendChild(el('span', 'meta repeat', 'every first Saturday'));
    } else {
      when.appendChild(el('span', 'date', dateLabel(e)));
      when.appendChild(el('span', 'meta', e.tbc ? 'date to confirm' : ''));
    }
    var side = el('div', 'entry-side');
    side.appendChild(when);
    if (e.poster) {
      var pa = el('a', 'poster');
      pa.href = e.venueUrl || e.poster;
      var pi = document.createElement('img');
      pi.src = e.poster;
      pi.alt = 'Poster for ' + e.title;
      pi.loading = 'lazy';
      pa.appendChild(pi);
      side.appendChild(pa);
    }
    li.appendChild(side);

    var body = el('div', 'entry-body');
    body.appendChild(el('h3', null, e.title));
    if (e.venue) body.appendChild(venueLine(e));
    if (e.note) body.appendChild(el('p', 'note', e.note));

    if (e.video || e.playlist || (e.links && e.links.length)) {
      var links = el('p', 'entry-links');
      if (e.video) {
        var v = el('a', null, 'Watch the set');
        v.href = 'https://www.youtube.com/watch?v=' + e.video;
        links.appendChild(v);
      }
      if (e.playlist) {
        var pl = el('a', null, 'Watch the night');
        pl.href = 'https://www.youtube.com/playlist?list=' + e.playlist;
        links.appendChild(pl);
      }
      (e.links || []).forEach(function (l) {
        var a = el('a', null, l.label);
        a.href = l.url;
        links.appendChild(a);
      });
      body.appendChild(links);
    }
    li.appendChild(body);
    return li;
  }

  function venueLine(e) {
    var p = el('p', 'venue');
    if (e.venueUrl) {
      var a = el('a', null, e.venue);
      a.href = e.venueUrl;
      p.appendChild(a);
    } else {
      p.textContent = e.venue;
    }
    return p;
  }

  function list(into, items, emptyText) {
    var host = document.getElementById(into);
    if (!host) return;
    if (!items.length) { host.appendChild(el('p', 'empty', emptyText)); return; }
    var ul = el('ul', 'entries');
    items.forEach(function (e) { ul.appendChild(entry(e)); });
    host.appendChild(ul);
  }


  /* ── the photographs behind the card ──────────────────────────
     Four nights at the Blue Note, cycling. Two layers crossfade, and the
     next picture is only fetched a moment before its turn, so the page
     costs one image on arrival rather than four. */
  var STAGE_SHOTS = [
    'assets/img/blue-note-stage.jpg?v=67',
    'assets/img/stage-1.jpg?v=67',
    'assets/img/stage-2.jpg?v=67',
    'assets/img/stage-4.jpg?v=67'
  ];
  var SHOT_HOLD = 7000;    /* ms each photograph stays */

  function stageBackdrop() {
    var bg = el('div', 'next-bg');
    var a = document.createElement('i');
    var b = document.createElement('i');
    bg.appendChild(a); bg.appendChild(b);

    var layers = [a, b], front = 0, i = 0, timer = null;

    function paint(n, layer) {
      layer.style.backgroundImage = 'url("' + STAGE_SHOTS[n] + '")';
    }

    paint(0, a); a.classList.add('on');

    /* no rotation without a real image loader — the headless render check
       has a stub DOM, and there is nothing to look at there anyway */
    if (STAGE_SHOTS.length < 2 || typeof Image !== 'function') return bg;

    function advance() {
      i = (i + 1) % STAGE_SHOTS.length;
      var back = layers[1 - front];
      var img = new Image();
      img.onload = img.onerror = function () {
        paint(i, back);
        back.classList.add('on');
        layers[front].classList.remove('on');
        front = 1 - front;
      };
      img.src = STAGE_SHOTS[i];
    }

    function start() { if (!timer) timer = setInterval(advance, SHOT_HOLD); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!still || !still.matches) start();

    /* a background tab should not keep swapping pictures nobody is watching */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (!still || !still.matches) start();
    });

    return bg;
  }

  /* ── the next one up ─────────────────────────────────────────── */
  var nextHost = document.getElementById('next-up');
  if (nextHost) {
    var next = upcoming.filter(function (e) { return !e.tbc; })[0] || upcoming[0];
    if (next) {
      var card = el('div', 'next kind-' + next.kind);
      if (next.snow) card.classList.add('wants-snow');
      card.appendChild(stageBackdrop());
      card.appendChild(el('p', 'next-label', 'Next up'));
      var big = el('p', 'next-date');
      big.appendChild(el('span', 'd', next.parsed.d !== null ? String(next.parsed.d) : ''));
      big.appendChild(el('span', 'm', next.parsed.m !== null ? MONTHS[next.parsed.m] : String(next.parsed.y)));
      card.appendChild(big);
      card.appendChild(el('h2', null, next.title));
      if (next.venue) card.appendChild(venueLine(next));
      if (next.note) card.appendChild(el('p', 'note', next.note));
      if (next.links) {
        var nl = el('p', 'entry-links');
        next.links.forEach(function (l) { var a = el('a', null, l.label); a.href = l.url; nl.appendChild(a); });
        card.appendChild(nl);
      }
      nextHost.appendChild(card);
    } else {
      nextHost.appendChild(el('p', 'empty', 'Nothing booked right now. The next date appears here as soon as there is one.'));
    }
  }

  /* ── a year as an axis, the way the front page draws frequency ── */
  var axesHost = document.getElementById('axes');
  if (axesHost) {
    var years = [];
    events.forEach(function (e) {
      if (e.parsed.m === null) return;           /* a year with no dated event has no axis to draw */
      if (years.indexOf(e.parsed.y) < 0) years.push(e.parsed.y);
    });
    years.sort(function (a, b) { return b - a; });

    years.forEach(function (y) {
      var row = el('div', 'axis');
      row.appendChild(el('span', 'axis-year', String(y)));

      var track = el('div', 'axis-track');
      for (var m = 0; m < 12; m++) {
        var tick = el('span', 'axis-month');
        tick.style.left = (m / 12 * 100) + '%';
        tick.appendChild(el('span', 'axis-month-label', SHORT[m][0]));
        track.appendChild(tick);
      }

      var days = leap(y) ? 366 : 365;
      events.filter(function (e) { return e.parsed.y === y && e.parsed.m !== null; }).forEach(function (e) {
        var mark = el('a', 'mark kind-' + e.kind);
        mark.href = '#' + idOf(e);
        mark.style.left = (dayOfYear(e.when) / days * 100) + '%';
        mark.title = dateLabel(e) + ' — ' + e.title;
        mark.setAttribute('aria-label', mark.title);
        if (e.when >= today) mark.classList.add('is-ahead');
        track.appendChild(mark);
      });

      if (y === today.getFullYear()) {
        var now = el('span', 'axis-now');
        now.style.left = (dayOfYear(today) / days * 100) + '%';
        now.title = 'Today';
        track.appendChild(now);
      }

      row.appendChild(track);
      axesHost.appendChild(row);
    });
  }

  function idOf(e) { return 'e-' + e.date + '-' + e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  list('upcoming', upcoming, 'Nothing coming up yet.');
  list('past', past, 'Nothing here yet.');

  /* the back catalogue is long — keep it folded until asked for */
  var toggle = document.querySelector('.played-toggle');
  var pastHost = document.getElementById('past');
  if (toggle && pastHost) {
    var count = past.length;
    var open = false;
    function render() {
      pastHost.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'hide' : 'show all ' + count;
    }
    toggle.addEventListener('click', function () { open = !open; render(); });
    render();
  }
})();
