import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = new globalThis.URL(
  '../docs/case-studies/issue-1/data/bot-api/',
  import.meta.url
);
const facts = JSON.parse(
  readFileSync(new globalThis.URL('model-facts.json', directory), 'utf8')
);
const models = new Map(facts.models.map((model) => [model.name, model]));
const field = (model, name) =>
  models.get(model).fields.find((entry) => entry.name === name);

it('pins all official model facts to the archived primary document', () => {
  assert.equal(models.size, 400);
  assert.equal(
    facts.models.reduce((n, model) => n + model.fields.length, 0),
    1888
  );
  const document = readFileSync(
    new globalThis.URL('api-2026-10-29.html', directory)
  );
  assert.equal(
    createHash('sha256').update(document).digest('hex'),
    facts.sha256
  );
});

it('retains nested arrays, recursive unions and plain keyboard buttons', () => {
  assert.equal(
    field('ReplyKeyboardMarkup', 'keyboard').type,
    'Array of Array of KeyboardButton'
  );
  assert.deepEqual(models.get('KeyboardButton').alternatives, ['String']);
  assert.deepEqual(models.get('RichText').alternatives, [
    'String',
    'Array of RichText',
  ]);
  assert.equal(models.get('RichText').members.length, 26);
});

it('preserves constant, enum, upload and optional field distinctions', () => {
  assert.deepEqual(field('InputMediaPhoto', 'type').values, ['photo']);
  assert.deepEqual(field('InputSticker', 'format').values, [
    'static',
    'animated',
    'video',
  ]);
  assert.deepEqual(field('InaccessibleMessage', 'date').values, [0]);
  assert.equal(field('UniqueGift', 'number').values, undefined);
  assert.equal(field('InputMediaPhoto', 'media').upload, true);
  assert.equal(field('InputMediaPhoto', 'caption').optional, true);
  assert.equal(field('User', 'first_name').optional, false);
  assert.equal(field('SuccessfulPayment', 'invoice_payload').values, undefined);
  assert.equal(field('ReactionTypeEmoji', 'emoji').values.length, 73);
});
