import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { methodProxy } from '../src/requests.js';

it('serializes method proxies without invoking synthetic toJSON requests', () => {
  const calls = [];
  const api = methodProxy((...args) => {
    calls.push(args);
    return Promise.resolve(true);
  });
  assert.equal(JSON.stringify({ api, nested: api.messages }), '{}');
  assert.deepEqual(calls, []);
});

it('keeps explicit raw method dispatch and promise assimilation intact', async () => {
  const calls = [];
  const api = methodProxy((...args) => {
    calls.push(args);
    return Promise.resolve('result');
  });
  assert.equal(await Promise.resolve(api), api);
  assert.equal(await api.messages.sendMessage({ message: 'hello' }), 'result');
  assert.deepEqual(calls, [['messages.sendMessage', { message: 'hello' }]]);
  assert.equal(api.toJSON, undefined);
});
