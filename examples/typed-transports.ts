import { createClient } from '../src/index.js';
import { Mtproto, TcpTransport, TransportFraming } from '../src/mtproto.js';

// Construction is offline; calls connect only when an operation is requested.
const client = new Mtproto({
  transport: 'tcp',
  mode: 'full',
  maxBytes: 16 * 1024 * 1024,
  maxQueuedBytes: 32 * 1024 * 1024,
});
const custom = new TcpTransport({ host: '127.0.0.1', port: 443 });
const framing = new TransportFraming({ mode: 'abridged' });
const factory = createClient({
  transport: 'tcp',
  mode: 'intermediate',
  transportFactory: (dc) => new TcpTransport({ dc }),
});
void [client, custom, framing, factory];
