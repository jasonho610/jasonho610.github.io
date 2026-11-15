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
    if (e.tbc) li.classList.add('is-tbc');

    var when = el('div', 'entry-when');
    var p = e.parsed;
    if (p.d !== null) {
      when.appendChild(el('span', 'day', String(p.d)));
      when.appendChild(el('span', 'mon', SHORT[p.m]));
      when.appendChild(el('span', 'wd', DAYS[e.when.getDay()].slice(0, 3)));
    } else {
      when.appendChild(el('span', 'mon wide', dateLabel(e)));
      if (e.tbc) when.appendChild(el('span', 'wd', 'to confirm'));
    }
    li.appendChild(when);

    var body = el('div', 'entry-body');
    body.appendChild(el('h3', null, e.title));
    if (e.venue) body.appendChild(el('p', 'venue', e.venue));
    if (e.note) body.appendChild(el('p', 'note', e.note));

    if (e.video || (e.links && e.links.length)) {
      var links = el('p', 'entry-links');
      if (e.video) {
        var v = el('a', null, 'Watch the set');
        v.href = 'https://www.youtube.com/watch?v=' + e.video;
        links.appendChild(v);
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

  function list(into, items, emptyText) {
    var host = document.getElementById(into);
    if (!host) return;
    if (!items.length) { host.appendChild(el('p', 'empty', emptyText)); return; }
    var ul = el('ul', 'entries');
    items.forEach(function (e) { ul.appendChild(entry(e)); });
    host.appendChild(ul);
  }

  /* ── the next one up ─────────────────────────────────────────── */
  var nextHost = document.getElementById('next-up');
  if (nextHost) {
    var next = upcoming.filter(function (e) { return !e.tbc; })[0] || upcoming[0];
    if (next) {
      var card = el('div', 'next kind-' + next.kind);
      card.appendChild(el('p', 'next-label', 'Next up'));
      var big = el('p', 'next-date');
      big.appendChild(el('span', 'd', next.parsed.d !== null ? String(next.parsed.d) : ''));
      big.appendChild(el('span', 'm', next.parsed.m !== null ? MONTHS[next.parsed.m] : String(next.parsed.y)));
      card.appendChild(big);
      card.appendChild(el('h2', null, next.title));
      if (next.venue) card.appendChild(el('p', 'venue', next.venue));
      if (next.note) card.appendChild(el('p', 'note', next.note));
      if (next.links) {
        var nl = el('p', 'entry-links');
        next.links.forEach(function (l) { var a = el('a', null, l.label); a.href = l.url; nl.appendChild(a); });
        card.appendChild(nl);
      }
      nextHost.appendChild(card);
    } else {
      nextHost.appendChild(el('p', 'empty', 'Nothing booked at the moment. The next one goes up here as soon as it is.'));
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

  list('upcoming', upcoming, 'Nothing on the books yet.');
  list('past', past, 'Nothing here yet.');
})();
