// Finite credential-free probe. Never print authorization keys or sessions.
import { Mtproto } from '../src/mtproto.js';

const client = new Mtproto({ transport: 'tcp', mode: 'full', timeout: 15000 });
try {
  await client.connect();
  console.log({ transport: 'tcp/full', keyExchange: 'verified' });
  await client.call('help.getConfig');
  console.log({ encryptedRpc: 'verified' });
} catch (error) {
  if (client.cipher && error.type === 'CONNECTION_NOT_INITED') {
    console.log({
      transport: 'tcp/full',
      encryptedRpcError: error.type,
      verified: true,
      accountAuthorization: 'unverified: application credentials required',
    });
  } else {
    console.error({
      transport: 'tcp/full',
      error: error.message,
      type: error.type,
    });
    process.exitCode = 1;
  }
} finally {
  await client.disconnect();
}
