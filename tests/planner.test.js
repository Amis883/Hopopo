import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, phasesFor, chunkStart, nextChunkStart } from '../js/core/planner.js';
import { newTrack } from '../js/data/store.js';

const sentences = Array.from({ length: 200 }, (_, i) => `Das ist Satz Nummer ${i} in meinem Buch.`);
const meta = (pos = 0, last = null) => ({ pos, last, total: sentences.length });

test('speech check replaces echo phases with N checked repeats', () => {
  const t = { ...newTrack('de', 'A1'), check: true, checkReps: 2 };
  assert.deepEqual(phasesFor(t).map(p => p.t), ['listen', 'check', 'check', 'shadow', 'shadow']);
  assert.deepEqual(phasesFor({ ...t, check: false }).map(p => p.t), ['listen', 'echo', 'echo', 'shadow', 'shadow']);
});

test('plan fits the time budget and takes whole sentences', () => {
  for (const minutes of [10, 15, 20]) {
    const t = { ...newTrack('de', 'A1'), minutes };
    const p = buildPlan(t, meta(), sentences);
    assert.ok(p.est <= minutes * 60, `est ${p.est} > ${minutes * 60}`);
    assert.ok(p.est > minutes * 60 * 0.8, 'uses most of the budget');
    assert.equal(p.start, 0); assert.equal(p.end, p.newCount);
  }
});

test('longer budget → more material', () => {
  const t = newTrack('en', 'B2');
  const a = buildPlan({ ...t, minutes: 10 }, meta(), sentences), b = buildPlan({ ...t, minutes: 20 }, meta(), sentences);
  assert.ok(b.newCount > a.newCount);
});

test('plan continues from the saved position and warms up with the last session', () => {
  const t = newTrack('de', 'A1');
  const p = buildPlan(t, meta(40, [30, 40]), sentences);
  assert.equal(p.start, 40);
  assert.equal(p.steps[0].sec, 'review');
  assert.deepEqual([...new Set(p.steps.filter(s => s.sec === 'review').map(s => p.chunks[s.k].sent))], [38, 39]);
  assert.equal(p.steps.at(-1).sec, 'final');
});

test('chunk navigation helpers', () => {
  const p = buildPlan(newTrack('de', 'A1'), meta(), sentences);
  const i = 3; // inside the first chunk's phases
  assert.equal(chunkStart(p.steps, i), 0);
  assert.equal(p.steps[nextChunkStart(p.steps, i)].k, 1);
});

test('a finished book yields an empty plan', () => {
  const p = buildPlan(newTrack('de', 'A1'), meta(sentences.length), sentences);
  assert.equal(p.newCount, 0);
});
