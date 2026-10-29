import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as Vendor } from 'teleproto/tl/index.js';
import * as Actual from 'teleproto/richMessage.js';
import * as Package from '../src/index.js';
import {
  plain,
  paragraph,
  caption,
  richTextCases,
  pageBlockCases,
  inlineButtonCases,
  asClass,
  richMessage,
} from './fixtures/rich-messages.js';
import { canonical } from './fixtures/account-message-models.js';

const { Api } = Package;
for (const type of inlineButtonCases) {
  for (const mode of ['text', 'md', 'html']) {
    it(`renders rich inline ${type._} buttons in ${mode} like the SDK`, () => {
      const text = { _: 'textButton', text: plain('Button'), type };
      const row = {
        _: 'pageBlockButtonRow',
        buttons: [{ _: 'pageButton', text: text.text, type }],
      };
      assert.equal(
        Package.Rich.renderRichText(text, mode),
        Actual.renderRichText(asClass(Vendor, text), mode)
      );
      assert.equal(
        Package.Rich.renderBlocks([row], mode),
        Actual.renderBlocks([asClass(Vendor, row)], mode)
      );
    });
  }
}
const forms = {
  canonical: (value) => value,
  owned: (value) => asClass(Api, value),
  SDK: (value) => asClass(Vendor, value),
};
for (const mode of ['text', 'md', 'html']) {
  for (const [name, form] of Object.entries(forms)) {
    for (const value of richTextCases) {
      it(`renders ${value._} ${mode} from ${name} like the actual SDK`, () => {
        const input = form(value);
        const before = canonical(input);
        assert.equal(
          Package.Rich.renderRichText(input, mode),
          Actual.renderRichText(asClass(Vendor, value), mode)
        );
        assert.deepEqual(canonical(input), before);
      });
    }
    for (const value of pageBlockCases) {
      it(`renders ${value._} ${mode} from ${name} like the actual SDK`, () => {
        const input = form(value);
        const before = canonical(input);
        assert.equal(
          Package.Rich.renderBlocks([input], mode),
          Actual.renderBlocks([asClass(Vendor, value)], mode)
        );
        assert.deepEqual(canonical(input), before);
      });
    }
  }
}

const photo = () =>
  new Api.InputPhoto({
    id: 9007199254740993n,
    accessHash: 17n,
    fileReference: new Uint8Array([1, 2]),
  });
const document = () =>
  new Vendor.InputDocument({
    id: 9007199254740995n,
    accessHash: 19n,
    fileReference: Buffer.from([3, 4]),
  });

for (const factory of ['html', 'markdown']) {
  for (const label of [
    'CoverPhoto',
    '_',
    'className',
    'originalArgs',
    'CONSTRUCTOR_ID',
    '__proto__',
  ]) {
    it(`preserves exact ${factory} rich-file label ${label}`, () => {
      const files = Object.fromEntries([[label, photo()]]);
      const input = Package.Rich[factory]('Content', { files });
      assert.equal(input.files[0].id, label);
      const expected = Actual[factory]('Content', {
        files: Object.fromEntries([
          [label, asClass(Vendor, canonical(files[label]))],
        ]),
      });
      assert.deepEqual(input.getBytes(), expected.getBytes());
    });
  }
  for (const options of [
    {},
    { rtl: true, noAutolink: true },
    { rtl: false, noAutolink: false, files: {} },
    { files: { photo: photo(), document: document() } },
  ]) {
    it(`compares ${factory} rich input bytes with SDK options ${Object.keys(options)}`, () => {
      const owned = Package.Rich[factory]('Hello <& **world**', options);
      const sdk = Actual[factory]('Hello <& **world**', {
        ...options,
        files:
          options.files &&
          Object.fromEntries(
            Object.entries(options.files).map(([id, value]) => [
              id,
              asClass(Vendor, canonical(value)),
            ])
          ),
      });
      assert.ok(owned instanceof Api[owned.className]);
      assert.deepEqual(owned.getBytes(), sdk.getBytes());
      if (owned.files) {
        owned.files[0].photo.fileReference[0] = 99;
        assert.equal(options.files.photo.fileReference[0], 1);
      }
    });
  }
  for (const invalid of [true, 1, null, {}, paragraph()]) {
    it(`rejects invalid ${factory} rich file ${String(invalid)} before serialization`, () => {
      assert.throws(
        () => Package.Rich[factory]('Text', { files: { bad: invalid } }),
        TypeError
      );
    });
  }
}

for (const options of [
  {},
  { rtl: true, noAutolink: true, photos: [], documents: [], users: [] },
  {
    photos: [photo()],
    documents: [document()],
    users: [new Api.InputUser({ userId: 21n, accessHash: 23n })],
  },
]) {
  it(`compares raw rich block factory bytes with SDK ${Object.keys(options)}`, () => {
    const input = [asClass(Vendor, paragraph())];
    const result = Package.Rich.blocks(input, options);
    const sdk = Actual.blocks(input, {
      ...options,
      ...Object.fromEntries(
        ['photos', 'documents', 'users']
          .filter((key) => options[key])
          .map((key) => [
            key,
            options[key].map((value) => asClass(Vendor, canonical(value))),
          ])
      ),
    });
    assert.deepEqual(result.getBytes(), sdk.getBytes());
    result.blocks[0].text.text = 'Changed';
    assert.notEqual(input[0].text.text, 'Changed');
  });
}

const expected = [
  [plain('<&"'), '<&"', '<&"', '&lt;&amp;&quot;'],
  [plain('_[*|~`\\'), '_[*|~`\\', '\\_\\[\\*\\|\\~\\`\\\\', '_[*|~`\\'],
  [
    { _: 'textBold', text: { _: 'textItalic', text: plain('Nested') } },
    'Nested',
    '**_Nested_**',
    '<b><i>Nested</i></b>',
  ],
  [
    { _: 'textMentionName', text: plain('User'), user_id: 9007199254740993n },
    'User',
    'User',
    '<a href="tg://user?id=9007199254740993">User</a>',
  ],
  [
    { _: 'textUrl', text: plain('Site'), url: 'https://example.com/?a="&b=<' },
    'Site',
    '[Site](https://example.com/?a="&b=<)',
    '<a href="https://example.com/?a=&quot;&amp;b=&lt;">Site</a>',
  ],
];
for (const [value, ...outputs] of expected) {
  for (const [index, mode] of ['text', 'md', 'html'].entries()) {
    it(`matches independent expected ${value._} ${mode} output`, () => {
      assert.equal(Package.Rich.renderRichText(value, mode), outputs[index]);
    });
  }
}

for (const [helper, mode] of [
  ['toPlainText', 'text'],
  ['toMarkdown', 'md'],
  ['toHtml', 'html'],
]) {
  it(`renders ${helper} message and block-array sources with nested media/list/table content`, () => {
    const blocks = [
      { _: 'pageBlockHeading1', text: plain('Title') },
      {
        _: 'pageBlockDetails',
        open: true,
        title: plain('Details'),
        blocks: [
          ...pageBlockCases.filter((value) =>
            ['pageBlockList', 'pageBlockTable'].includes(value._)
          ),
          {
            _: 'pageBlockPhoto',
            photo_id: 9007199254740993n,
            caption: caption(),
          },
        ],
      },
    ];
    const source = { ...richMessage(), blocks };
    const wanted = Actual.renderBlocks(
      blocks.map((value) => asClass(Vendor, value)),
      mode
    );
    assert.equal(Package.Rich[helper](source), wanted);
    assert.equal(Package.Rich[helper](blocks), wanted);
  });
}

it('keeps future rich wrappers readable through their known children', () => {
  assert.equal(
    Package.Rich.toHtml([
      { _: 'futureBlock', blocks: [paragraph(plain('Future'))] },
    ]),
    '<p>Future</p>'
  );
  assert.equal(
    Package.Rich.renderRichText({ _: 'futureText', text: plain('Future') }),
    'Future'
  );
});

it('bounds cyclic, deep, excessive-node and output-expanding rich trees', () => {
  const cyclic = { _: 'textBold' };
  cyclic.text = cyclic;
  assert.throws(() => Package.Rich.renderRichText(cyclic), RangeError);
  let deep = plain('Bottom');
  for (let i = 0; i < 70; i++) {
    deep = { _: 'textBold', text: deep };
  }
  assert.throws(() => Package.Rich.renderRichText(deep), RangeError);
  assert.throws(
    () =>
      Package.Rich.renderRichText({
        _: 'textConcat',
        texts: Array(100001).fill(plain()),
      }),
    RangeError
  );
  assert.throws(
    () =>
      Package.Rich.renderRichText(plain('"'.repeat(3 * 1024 * 1024)), 'html'),
    RangeError
  );
});

it('rejects unknown render modes and malformed factory inputs', () => {
  assert.throws(() => Package.Rich.renderRichText(plain(), 'xml'), RangeError);
  assert.throws(() => Package.Rich.html(3), TypeError);
  assert.throws(() => Package.Rich.blocks('bad'), TypeError);
});
