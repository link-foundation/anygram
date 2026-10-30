import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { default: MultipartStream } = require(
  join(dirname(require.resolve('telegraf')), 'core/network/multipart-stream.js')
);
const stream = new MultipartStream('finite-fixture');
for (const [name, body] of [
  ['method', 'sendDocument'],
  ['chat_id', '7'],
  ['document', Buffer.from([65, 66, 67])],
]) {
  stream.addPart({
    headers: { 'content-disposition': `form-data; name="${name}"` },
    body,
  });
}
await Promise.resolve();
const timer = globalThis.setTimeout(() => {
  console.error({
    active: stream.currentStream?.readableLength,
    ended: stream.currentStream?.readableEnded,
    pending: stream.streams.length,
  });
  stream.destroy(new Error('Finite multipart probe did not finish'));
}, 1000);
try {
  const chunks = [];
  for await (const chunk of stream) {
    assert(chunks.length < 32);
    chunks.push(chunk);
  }
  console.log(Buffer.concat(chunks).toString());
} finally {
  globalThis.clearTimeout(timer);
}
