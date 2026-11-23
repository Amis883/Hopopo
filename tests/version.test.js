import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../js/version.js';

test('sw.js and js/version.js carry the same release number', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], VERSION);
});

test('every JS module is in the offline shell', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const f of ['main.js', 'i18n.js', 'version.js', 'ui/session.js', 'ui/help.js', 'ui/welcome.js', 'core/text.js', 'services/audioclip.js'])
    assert.ok(sw.includes(`'./js/${f}'`), f);
});
