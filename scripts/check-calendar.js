#!/usr/bin/env node
/* Renders the real calendar code against a DOM stub and reports what a visitor
 * would see. Catches the two things that have broken before: a runtime error in
 * entry() that silently empties both lists, and a date that is not the weekday
 * it claims to be.
 *
 *   node scripts/check-calendar.js                 — today
 *   node scripts/check-calendar.js 2026-12-06      — pretend it is that day
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function render(fakeNow) {
  const Real = Date;
  if (fakeNow) {
    class Fake extends Real {
      constructor(...a) { if (!a.length) super(fakeNow + 'T12:00:00'); else super(...a); }
      static now() { return new Real(fakeNow + 'T12:00:00').getTime(); }
    }
    global.Date = Fake;
  }
  const el = t => ({ tag: t, children: [], attrs: {}, style: {}, id: '', hidden: false,
    classList: { add(){}, toggle(){}, remove(){}, contains(){ return false; } },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    addEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; },
    set textContent(v) { this._t = v; }, get textContent() { return this._t || ''; },
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; } });

  const hosts = {};
  global.document = { createElement: el, body: el('body'),
    getElementById: id => hosts[id] || (hosts[id] = el('div')),
    querySelector: () => null, querySelectorAll: () => [], addEventListener(){} };
  global.window = {};
  for (const k of Object.keys(require.cache)) delete require.cache[k];
  require(path.join(ROOT, 'assets/js/events.js'));
  require(path.join(ROOT, 'assets/js/calendar.js'));

  const card = hosts['next-up'].children[0];
  const h2 = card && card.children.find(c => c.tag === 'h2');
  const count = id => hosts[id].children[0] ? hosts[id].children[0].children.length : 0;
  const out = { next: h2 ? h2.textContent : '(none)', ahead: count('upcoming'), played: count('past'),
                events: global.window.EVENTS };
  global.Date = Real;
  return out;
}

const when = process.argv[2];
const r = render(when);

console.log(`date:     ${when || 'today'}`);
console.log(`next up:  ${r.next}`);
console.log(`ahead:    ${r.ahead}`);
console.log(`played:   ${r.played}`);

if (r.ahead === 0 && r.played === 0) {
  console.error('\nFAIL: both lists are empty — the renderer threw.');
  process.exit(1);
}

console.log('\nweekday check (a wrong date is the easiest mistake to make):');
let bad = 0;
for (const e of r.events) {
  if (!e.date || e.date.length !== 10) continue;
  const [y, m, d] = e.date.split('-').map(Number);
  const actual = DAYS[new Date(y, m - 1, d).getDay()];
  const claimed = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.exec((e.note || '') + ' ' + (e.title || ''));
  const flag = claimed && claimed[0].toLowerCase() !== actual.toLowerCase();
  if (flag) bad++;
  console.log(`  ${e.date}  ${actual.padEnd(9)} ${flag ? 'MISMATCH — text says ' + claimed[0] + '  ' : ''}${e.title}`);
}
if (bad) { console.error(`\nFAIL: ${bad} entr${bad === 1 ? 'y' : 'ies'} name a weekday that does not match the date.`); process.exit(1); }
console.log('\nOK');
