import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { Telegraf, Telegram } from '../src/index.js';
const plain = new HttpAgent({ keepAlive: true });
const secure = new HttpsAgent({ keepAlive: true });
const telegram = {
  agent: secure,
  attachmentAgent: (url: URL) => (url.protocol === 'https:' ? secure : plain),
};
new Telegraf('123:example', { telegram });
new Telegram('123:example', telegram);
plain.destroy();
secure.destroy();
