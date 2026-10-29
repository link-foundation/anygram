import { Telegram } from '../src/index.js';
const api: Telegram = new Telegram('123:example', {
  apiRoot: 'https://api.telegram.org/',
  apiMode: 'bot',
  testEnv: false,
  webhookReply: true,
});
api.options.testEnv = true;
api.webhookReply = false;
const token: string = api.token;
async function send() {
  const message = await api.sendMessage(7, 'Hello');
  const id: number = message.message_id;
  await api.sendDocument(7, {
    url: 'https://example.org/file',
    filename: 'file.txt',
  });
  return id;
}
void token;
void send;
class CustomTelegram extends Telegram {
  override sendMessage(...args: Parameters<Telegram['sendMessage']>) {
    return super.sendMessage(...args);
  }
}
void new CustomTelegram('123:subclass');
// @ts-expect-error Unsupported API mode.
new Telegram('123:example', { apiMode: 'other' });
// @ts-expect-error Required message text.
api.sendMessage(7);
// @ts-expect-error Token is immutable.
api.token = 'changed';
