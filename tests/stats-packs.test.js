import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stats, dayKey } from '../js/core/stats.js';
import { makePack, parsePack, packFileName } from '../js/core/packs.js';

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const daysAgo = (now, n) => { const d = new Date(now); d.setDate(d.getDate() - n); return dayKey(d); };

test('streak counts consecutive days and survives an unfinished today', () => {
  const now = new Date(2026, 10, 22, 9);
  const track = { minutes: 15, history: [1, 2, 3, 5].map(n => ({ d: daysAgo(now, n), sec: 900 })) };
  const s = stats(track, WD, now);
  assert.equal(s.streak, 3); assert.equal(s.doneToday, false); assert.equal(s.week.length, 7);
  track.history.push({ d: dayKey(now), sec: 700 });
  assert.equal(stats(track, WD, now).streak, 4);
});

test('pack round trip and validation', () => {
  const json = makePack({ lang: 'nl', level: 'A1', title: 'Les 1', sentences: ['Hallo!', ' ', 'Ik heet Sanne.'] });
  assert.deepEqual(parsePack(json).sentences, ['Hallo!', 'Ik heet Sanne.']);
  assert.equal(parsePack('{"format":"other"}'), null);
  assert.equal(parsePack('not json'), null);
  assert.equal(parsePack(JSON.stringify({ format: 'shadowing-pack', lang: 'xx', sentences: [] })), null);
  assert.equal(packFileName('Lektion 1: Hallo!'), 'Lektion-1-Hallo.shadow.json');
});
