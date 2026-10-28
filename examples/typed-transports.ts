import { createClient } from '../src/index.js';
import {
  Mtproto,
  TcpTransport,
  TransportFraming,
  ObfuscatedFraming,
  createSocks5Connector,
} from '../src/mtproto.js';

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
const proxied = createClient({ proxy: { host: '127.0.0.1', port: 1080 } });
const connector = createSocks5Connector({
  host: '127.0.0.1',
  port: 1080,
  username: 'example',
  password: 'example',
});
const obfuscated = new ObfuscatedFraming({ mode: 'padded' });
const mtproxy = createClient({
  proxy: {
    type: 'mtproxy',
    host: '127.0.0.1',
    port: 443,
    secret: '91919191919191919191919191919191',
  },
});
void [
  client,
  custom,
  framing,
  factory,
  proxied,
  connector,
  obfuscated,
  mtproxy,
];
