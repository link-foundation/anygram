import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as Package from '../src/index.js';

for (const path of ['anygram/extensions/html.js', 'anygram/extensions/html']) {
  it(`exposes SDK-style HTML import ${path}`, async () => {
    const module = await import(path);
    assert.equal(module.HTMLParser, Package.HTMLParser);
    assert.equal(module.HTMLParser.parse('<b>Ada</b>')[0], 'Ada');
  });
}
