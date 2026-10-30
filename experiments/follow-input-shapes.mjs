// Finite parser probe for the pinned follow input contract; no network or sessions.
import { Parser } from 'links-notation';
import { parseFollowLinks } from '../examples/follow-input.js';

const parser = new Parser();
for (const input of [
  't.me/first t.me/second',
  '(t.me/first t.me/second)',
  '(telegramLinks: t.me/first t.me/second)',
  't.me/first\nt.me/second',
  '("https://t.me/first" "tg://join?invite=ABC")',
  '()',
  'https://t.me/first',
  'tg://join?invite=ABC',
  '(t.me/first (t.me/second))',
]) {
  let migrated;
  try {
    migrated = parseFollowLinks(input);
  } catch (error) {
    migrated = { error: error.message };
  }
  console.log(JSON.stringify({ input, parsed: parser.parse(input), migrated }));
}
