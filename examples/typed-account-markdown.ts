import {
  Anygram,
  Api,
  MarkdownParser,
  MarkdownV2Parser,
  DEFAULT_DELIMITERS,
  type AccountMessage,
  type AccountParseMode,
} from '../src/index.js';

export async function markdownText(client: Anygram, message: AccountMessage) {
  const parser: AccountParseMode = MarkdownV2Parser;
  const [text, entities] = parser.parse('*Ada*');
  const rendered: string = MarkdownParser.unparse(text, entities);
  MarkdownV2Parser.unparse('Ada', [
    new Api.MessageEntityBold({ offset: 0, length: 3 }),
  ]);
  const bold = new DEFAULT_DELIMITERS['**']({ offset: 0, length: 3 });
  for (const mode of ['md', 'markdown', 'md2', 'markdownv2'] as const) {
    client.setParseMode(mode);
    client.gramjs.parseMode = mode;
    await client.teleproto.sendMessage('me', {
      message: '*Ada*',
      parseMode: mode,
    });
    await message.edit({ text: '*Ada*', parseMode: mode });
  }
  // @ts-expect-error Mode aliases are checked.
  client.setParseMode('md3');
  // @ts-expect-error Parse inputs must be text.
  MarkdownV2Parser.parse(1);
  const invalid = { _: 'messageEntityBold', offset: '0', length: 3 };
  // @ts-expect-error Entity ranges must be numeric.
  MarkdownParser.unparse('Ada', [invalid]);
  return { rendered, bold };
}
