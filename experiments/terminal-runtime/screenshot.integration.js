import { it } from 'node:test';
import assert from 'node:assert/strict';
import { screenshotScenario } from './screenshot-scenario.mjs';

it(
  'uploads a real static PNG after a regular terminal command and decodes its pixels',
  { timeout: 10000 },
  async () => {
    const before = await screenshotScenario({ migrated: false });
    assert.equal(
      before.bytes,
      null,
      'Pinned original has no static photo path'
    );
    const after = await screenshotScenario();
    assert.equal(
      after.bytes.subarray(0, 8).toString('hex'),
      '89504e470d0a1a0a'
    );
    assert.equal(after.width, 537);
    assert.equal(after.height, 614);
    assert(after.foreground > 1000);
    assert.equal(after.app.errors.length, 0);
    assert.equal(after.app.clock.pending, 0);
    assert.deepEqual(after.app.exits, [0]);
  }
);
