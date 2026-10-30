// Finite credential-free TCP/WebSocket probe. Never print keys or sessions.
import { Mtproto } from '../src/mtproto.js';

const mode = process.argv[2] ?? 'full';
const kind = process.argv.includes('--websocket') ? 'websocket' : 'tcp';
const obfuscate = kind === 'websocket' || process.argv.includes('--obfuscated');
const transport = `${kind}/${mode}${obfuscate ? '/obfuscated' : ''}`;
const client = new Mtproto({
  transport: kind,
  mode,
  obfuscate,
  timeout: 15000,
});
try {
  await client.connect();
  console.log({ transport, keyExchange: 'verified' });
  await client.call('help.getConfig');
  console.log({ encryptedRpc: 'verified' });
} catch (error) {
  if (client.cipher && error.type === 'CONNECTION_NOT_INITED') {
    console.log({
      transport,
      encryptedRpcError: error.type,
      verified: true,
      accountAuthorization: 'unverified: application credentials required',
    });
  } else {
    console.error({
      transport,
      error: error.message,
      type: error.type,
    });
    process.exitCode = 1;
  }
} finally {
  await client.disconnect();
}
