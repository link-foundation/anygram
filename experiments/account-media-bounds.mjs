import assert from 'node:assert/strict';
import { fileCaption, albumCaptions } from '../src/media-text.js';

const resolve = () => assert.fail('Plain captions must not resolve peers');
const text = 'x'.repeat(4194304);
const files = Array.from({ length: 10 }, () => ({ file: {} }));
const result = await albumCaptions(files, Array(10).fill(text), {}, resolve);
assert.equal(result.length, 10);
assert(result.every((entry) => entry.content.message === text));
await assert.rejects(fileCaption(`${text}x`, {}, resolve), /text limit/);
await assert.rejects(
  albumCaptions(files, Array(11).fill('x'), {}, resolve),
  /10 captions/
);
await assert.rejects(
  albumCaptions(files, Array(9).fill('x').concat(`${text}x`), {}, resolve),
  /text limit/
);
await assert.rejects(
  fileCaption(
    'x',
    {
      entities: Array(1001).fill({
        _: 'messageEntityBold',
        offset: 0,
        length: 1,
      }),
    },
    resolve
  ),
  /entity limit/
);
console.log('Finite ten-caption, text and entity bounds pass');
