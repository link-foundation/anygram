// Finite, credential-free network probe. No auth keys or sessions are logged.
import { TlCodec } from '../src/tl.js';
import { randomBytes } from 'node:crypto';
import { Mtproto } from '../src/mtproto.js';
const codec = new TlCodec();
const body = codec.encode({ _: 'req_pq_multi', nonce: randomBytes(16) });
const packet = Buffer.alloc(20 + body.length);
packet.writeBigInt64LE(((BigInt(Date.now()) * (1n << 32n)) / 1000n) & ~3n, 8);
packet.writeInt32LE(body.length, 16);
packet.set(body, 20);
for (const endpoint of [
  'https://venus.web.telegram.org/api',
  'https://venus.web.telegram.org/apiw1',
]) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: packet,
      signal: globalThis.AbortSignal.timeout(10000),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    console.log({
      endpoint,
      status: response.status,
      length: bytes.length,
      type: response.headers.get('content-type'),
    });
    if (response.ok && bytes.length > 20) {
      console.log({
        response: codec.decode(bytes.subarray(20))._,
        valid: true,
      });
    }
  } catch (error) {
    console.log({ endpoint, error: error.message });
  }
}
const client = new Mtproto({ timeout: 15000 });
try {
  await client.connect();
  console.log({
    authorizationKeyExchange: 'verified',
    keyBytes: client.cipher.authKey.length,
  });
  const config = await client.call('help.getConfig');
  console.log({ rpc: config._, dataCenters: config.dc_options.length });
} catch (error) {
  if (client.cipher && error.type === 'CONNECTION_NOT_INITED') {
    console.log({
      encryptedRpcError: error.type,
      verified: true,
      authenticatedApplication: 'not tested: no API credentials',
    });
  } else {
    console.error({ probe: 'failed', error: error.stack });
    process.exitCode = 1;
  }
} finally {
  await client.disconnect();
}
