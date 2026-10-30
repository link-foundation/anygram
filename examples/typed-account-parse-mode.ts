import {
  Anygram,
  Api,
  type AccountParseMode,
  type AccountMessage,
} from '../src/index.js';

const parser: AccountParseMode = {
  parse(text) {
    return [
      text,
      [new Api.MessageEntityBold({ offset: 0, length: text.length })],
    ];
  },
  unparse(text, entities) {
    return entities.length ? `<b>${text}</b>` : text;
  },
};

export async function customFormatting(
  client: Anygram,
  message: AccountMessage
) {
  client.setParseMode(parser);
  client.gramjs.setParseMode(parser);
  client.teleproto.parseMode = parser;
  const configured = new Anygram({ parseMode: parser });
  await client.teleproto.sendMessage('me', {
    message: 'Hello',
    parseMode: false,
  });
  await message.reply({ message: 'Hello', formattingEntities: [] });
  await message.edit({ text: 'Hello', parseMode: parser });
  message.text = 'Hello';
  const rendered: string = message.text;
  const selected: AccountParseMode | undefined = configured.parseMode;
  // @ts-expect-error A parser needs both methods.
  client.setParseMode({ parse: (text: string) => [text, []] });
  // @ts-expect-error Parser text must remain a string.
  client.setParseMode({ parse: () => [1, []], unparse: () => '' });
  return { rendered, selected };
}
