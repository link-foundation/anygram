import type { TelegramClient } from 'teleproto';
import { Api } from 'teleproto/tl/index.js';
import * as Actual from 'teleproto/richMessage.js';
import { returnBigInt } from 'teleproto/Helpers.js';
import { Rich } from '../src/index.js';
import type { AccountMessage, GramStyleClient } from '../src/index.js';

export function portableRendering(renderer: typeof Rich | typeof Actual) {
  const leaf = new Api.TextPlain({ text: 'Title' });
  const paragraph = new Api.PageBlockParagraph({ text: leaf });
  const photo = new Api.InputPhoto({
    id: returnBigInt('9007199254740993'),
    accessHash: returnBigInt('17'),
    fileReference: Buffer.from([1, 2]),
  });
  const html = renderer.html('<h1>Title</h1>', {
    rtl: true,
    noAutolink: true,
    files: { cover: photo },
  });
  const input = renderer.blocks([paragraph], { photos: [photo] });
  const markdown = renderer.markdown('# Title');
  const text: string = renderer.renderRichText(leaf, 'text');
  const blocks: string = renderer.renderBlocks([paragraph], 'html');
  const source = new Api.RichMessage({
    blocks: [paragraph],
    photos: [],
    documents: [],
  });
  const rendered: string = renderer.toHtml(source);
  // @ts-expect-error Both implementations require string content.
  renderer.markdown(3);
  // @ts-expect-error Both implementations use a closed render-mode union.
  renderer.renderBlocks([paragraph], 'xml');
  return { html, input, markdown, text, blocks, rendered };
}

export async function portableRichMessage(
  message: AccountMessage | Api.Message
) {
  const same = await message.fetchRichMessage();
  const text: string | undefined = same.richText;
  const html: string | undefined = same.richHtml;
  const markdown: string | undefined = same.richMarkdown;
  return { text, html, markdown };
}

export async function portableRichClient(
  client: GramStyleClient | TelegramClient
) {
  const message = await client.getRichMessage(new Api.InputPeerSelf(), 7);
  return message?.fetchRichMessage();
}
