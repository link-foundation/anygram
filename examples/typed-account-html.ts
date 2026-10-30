import {
  Anygram,
  Api,
  HTMLParser,
  type AccountParseMode,
  type AccountMessage,
} from '../src/index.js';

export async function builtinHtml(client: Anygram, message: AccountMessage) {
  client.setParseMode('html');
  client.gramjs.parseMode = HTMLParser;
  client.teleproto.setParseMode('html');
  const mode: AccountParseMode = HTMLParser;
  const [text, entities] = mode.parse('🚀 <b>Ada</b>');
  const html: string = HTMLParser.unparse(text, entities);
  HTMLParser.unparse('Ada', [
    new Api.MessageEntityBold({ offset: 0, length: 3 }),
  ]);
  await client.sendMessage('me', html, { parseMode: 'html' });
  await message.edit({ text: html, parseMode: 'html' });
  // @ts-expect-error Builtin mode names are checked.
  client.setParseMode('htm');
  const invalid = { _: 'messageEntityBold', offset: '0', length: 3 };
  // @ts-expect-error HTML entities require a numeric span.
  HTMLParser.unparse('Ada', [invalid]);
  return { text, entities };
}
