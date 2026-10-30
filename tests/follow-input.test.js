import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

const inputs = () => import('../examples/follow-input.js');

it('parses pinned follow positional and named Links Notation shapes without changing link spelling', async () => {
  const { parseFollowLinks } = await inputs();
  const expected = ['https://t.me/First', 'tg://join?invite=ABC'];
  for (const value of [
    "'https://t.me/First' 'tg://join?invite=ABC'",
    "('https://t.me/First' 'tg://join?invite=ABC')",
    "(telegramLinks: 'https://t.me/First' 'tg://join?invite=ABC')",
  ]) {
    assert.deepEqual(parseFollowLinks(value), expected);
  }
  assert.deepEqual(parseFollowLinks('()'), []);
});

it('retains every piped or cached row instead of dropping all but the first', async () => {
  const { parseFollowLinks } = await inputs();
  assert.deepEqual(
    parseFollowLinks('t.me/first\nt.me/second\n(t.me/third t.me/fourth)'),
    ['t.me/first', 't.me/second', 't.me/third', 't.me/fourth']
  );
  assert.deepEqual(parseFollowLinks('t.me/first t.me/first'), [
    't.me/first',
    't.me/first',
  ]);
});

it('preserves unquoted scheme URLs in ordinary arguments and piped rows instead of parsing the scheme as a label', async () => {
  const { parseFollowLinks } = await inputs();
  assert.deepEqual(
    parseFollowLinks('https://t.me/first\ntg://join?invite=ABC'),
    ['https://t.me/first', 'tg://join?invite=ABC']
  );
  assert.deepEqual(parseFollowLinks('telegramLinks: t.me/first t.me/second'), [
    't.me/first',
    't.me/second',
  ]);
});

it('rejects malformed and nested input rather than silently discarding values', async () => {
  const { parseFollowLinks } = await inputs();
  assert.throws(() => parseFollowLinks('(t.me/first'), /Parse error/);
  assert.throws(() => parseFollowLinks('(t.me/first (t.me/second))'), /flat/);
  assert.throws(() => parseFollowLinks({}), TypeError);
});

it('bounds UTF-8 bytes, nesting, link size and total links before account creation', async () => {
  const { parseFollowLinks } = await inputs();
  assert.throws(() => parseFollowLinks('界'.repeat(90000)), /256 KiB/);
  assert.throws(
    () => parseFollowLinks('('.repeat(17) + ')'.repeat(17)),
    /nesting/
  );
  assert.throws(() => parseFollowLinks('a'.repeat(4097)), /4096/);
  assert.throws(
    () => parseFollowLinks(Array(1001).fill('t.me/a').join(' ')),
    /1000/
  );
  assert.equal(
    parseFollowLinks(Array(1000).fill('t.me/a').join(' ')).length,
    1000
  );
});

it('prefers explicit arguments without consuming stdin or touching a missing cache', async () => {
  const { loadFollowLinks } = await inputs();
  const stdin = {
    [Symbol.asyncIterator]() {
      assert.fail('Explicit arguments must not consume stdin');
    },
  };
  assert.deepEqual(
    await loadFollowLinks({
      arguments: ['t.me/first', 't.me/second'],
      stdin,
      cachePath: '/missing',
    }),
    ['t.me/first', 't.me/second']
  );
});

it('decodes split UTF-8 pipe chunks, retains every row, and does not read cache', async () => {
  const { loadFollowLinks } = await inputs();
  const bytes = Buffer.from("('https://t.me/first?text=界')\nt.me/second");
  const boundary = bytes.indexOf(Buffer.from('界')) + 1;
  const stdin = (async function* () {
    yield bytes.subarray(0, boundary);
    yield bytes.subarray(boundary);
  })();
  assert.deepEqual(await loadFollowLinks({ stdin, cachePath: '/missing' }), [
    'https://t.me/first?text=界',
    't.me/second',
  ]);
});

it('uses the requested cache for omitted or empty pipe input and propagates missing cache', async () => {
  const { loadFollowLinks } = await inputs();
  const directory = await mkdtemp(join(tmpdir(), 'anygram-follow-input-'));
  const cachePath = join(directory, 'telegram-links.lino');
  try {
    await writeFile(cachePath, '(telegramLinks: t.me/one t.me/two)');
    assert.deepEqual(await loadFollowLinks({ cachePath }), [
      't.me/one',
      't.me/two',
    ]);
    assert.deepEqual(
      await loadFollowLinks({
        cachePath,
        stdin: (async function* () {
          yield ' ';
        })(),
      }),
      ['t.me/one', 't.me/two']
    );
    await assert.rejects(
      loadFollowLinks({ cachePath: join(directory, 'missing') }),
      { code: 'ENOENT' }
    );
    await writeFile(cachePath, Buffer.alloc(256 * 1024 + 1, 32));
    await assert.rejects(loadFollowLinks({ cachePath }), /256 KiB/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('closes an overflowing input iterator and preserves cancellation before consuming it', async () => {
  const { loadFollowLinks } = await inputs();
  let closed = false;
  const stdin = (async function* () {
    try {
      yield Buffer.alloc(256 * 1024 + 1);
      assert.fail('Read after input limit');
    } finally {
      closed = true;
    }
  })();
  await assert.rejects(loadFollowLinks({ stdin }), /256 KiB/);
  assert.equal(closed, true);
  const controller = new globalThis.AbortController();
  controller.abort(new Error('cancel input'));
  await assert.rejects(
    loadFollowLinks({ stdin, signal: controller.signal }),
    /cancel input/
  );
});

it('destroys a pending Node input stream on cancellation without waiting for another chunk', async () => {
  const { loadFollowLinks } = await inputs();
  const stdin = new PassThrough();
  const controller = new globalThis.AbortController();
  const pending = loadFollowLinks({ stdin, signal: controller.signal });
  controller.abort(new Error('cancel pending pipe'));
  const destroyed = stdin.destroyed;
  stdin.end();
  await assert.rejects(pending, /cancel pending pipe/);
  assert.equal(destroyed, true);
});
