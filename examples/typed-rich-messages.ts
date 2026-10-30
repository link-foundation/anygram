import { Anygram, Api, Rich } from '../src/index.js';

const client = new Anygram();
const peer = new Api.InputPeerUser({ userId: 9n, accessHash: 17n });
const photo = new Api.InputPhoto({
  id: 9007199254740993n,
  accessHash: 19n,
  fileReference: new Uint8Array(),
});
const input = Rich.html('<h1>Title</h1><img src="cover">', {
  files: { cover: photo },
  rtl: true,
  noAutolink: true,
});
const html: string = input.html;
const markdown = Rich.markdown('# Title');
const tree = Rich.blocks([
  new Api.PageBlockParagraph({ text: new Api.TextPlain({ text: 'Body' }) }),
]);
const text: string = Rich.toPlainText(tree.blocks);
const rendered: string = Rich.renderRichText(
  new Api.TextBold({
    text: new Api.TextPlain({ text: 'Bold' }),
  }),
  'html'
);
const message = await client.teleproto.getRichMessage(peer, 7);
if (message) {
  const same: typeof message = await message.fetchRichMessage();
  const richHtml: string | undefined = same.richHtml;
  const richText: string | undefined = same.richText;
  const richMarkdown: string | undefined = same.richMarkdown;
  void [richHtml, richText, richMarkdown];
}
const canonical = await client.getRichMessage(peer, { id: 7 });
void [html, markdown, text, rendered, canonical];
// @ts-expect-error rich input content is text
Rich.html(3);
// @ts-expect-error rich blocks are an array
Rich.blocks('bad');
// @ts-expect-error render mode is a closed union
Rich.renderRichText(new Api.TextEmpty(), 'xml');
// @ts-expect-error message IDs are numeric
client.gramjs.getRichMessage(peer, '7');
