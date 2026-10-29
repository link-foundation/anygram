import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const root = new globalThis.URL('../', import.meta.url);
const archive = new globalThis.URL(
  'docs/case-studies/issue-1/data/bot-api/',
  root
);
const data = await readFile(new globalThis.URL('subtype-facts.json', archive));
if (
  createHash('sha256').update(data).digest('hex') !==
  '79890b89699b505d07878c65dc87ac1e97d4c34db295c9a53c6376e205a03822'
) {
  throw new Error('Unreviewed public subtype facts');
}
const facts = JSON.parse(data);
const models = JSON.parse(
  await readFile(new globalThis.URL('model-facts.json', archive))
);
const message = models.models.find(({ name }) => name === 'Message');
const fields = new Set(message.fields.map(({ name }) => name));
const keys = (values) =>
  values
    .map((value) => {
      if (!fields.has(value)) {
        throw new Error(`Unknown official message field: ${value}`);
      }
      return JSON.stringify(value);
    })
    .join(' | ');
const declarations = [];
let previous = [];
let previousName;
for (const [name, values] of Object.entries(facts.bases)) {
  const added = values.filter((value) => !previous.includes(value));
  declarations.push(
    `export type ${name} = ${previousName ? `${previousName} & ` : ''}Pick<Message, ${keys(added)}>;`
  );
  previous = values;
  previousName = name;
}
for (const [name, entry] of Object.entries(facts.aliases)) {
  if (!Object.hasOwn(facts.bases, entry.base)) {
    throw new Error(`Unknown message base: ${entry.base}`);
  }
  declarations.push(
    `export type ${name} = ${entry.base} & Required<Pick<Message, ${keys(entry.required)}>>${entry.optional.length ? ` & Pick<Message, ${keys(entry.optional)}>` : ''};`
  );
}
const chats = ['private', 'group', 'supergroup', 'channel'];
const chatNamespaces = ['Chat', 'ChatFullInfo'].map((model) => {
  const aliases = chats.map((kind) => {
    const name = `${kind[0].toUpperCase()}${kind.slice(1)}Chat`;
    return `export type ${name} = ChatShape<${model}, ${JSON.stringify(kind)}>;`;
  });
  return `export type ${model} = BotModels['${model}'];\nexport declare namespace ${model} {${aliases.join('\n')}}`;
});
const source = `// Public subtype names and owned official field projections; no SDK implementation.
// Regenerate: node experiments/generate-bot-subtypes.mjs
import type { BotModels } from './bot-types/index.js';
export type Message = BotModels['Message'];
export declare namespace Message {${declarations.join('\n')}}
type ChatKind = 'private' | 'group' | 'supergroup' | 'channel';
type ChatShape<T, K extends ChatKind> = Omit<T, 'type' | 'title' | 'first_name' | 'last_name' | 'username' | 'is_forum' | 'is_direct_messages'> & {
  type: K;
} & (K extends 'private' ? {first_name: string; last_name?: string; title?: undefined} : {title: string; first_name?: undefined; last_name?: undefined}) & {
  username?: K extends 'group' ? undefined : string;
  is_forum?: K extends 'supergroup' ? true : undefined;
  is_direct_messages?: K extends 'supergroup' ? true : undefined;
};
${chatNamespaces.join('\n')}
export type Update = BotModels['Update'];
export declare namespace Update {
 export type Private = {chat: Chat.PrivateChat};
 export type Channel = {chat: Chat.ChannelChat};
 export type NonChannel = {chat: Chat.GroupChat | Chat.SupergroupChat | Chat.PrivateChat; from: BotModels['User']};
 export type Edited = {edit_date: number};
}
`;
const output = await format(source, {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'es5',
});
const file = new globalThis.URL('src/bot-message-types.d.ts', root);
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output) {
    throw new Error('Stale Bot API message subtypes');
  }
} else {
  await writeFile(file, output);
}
console.log(
  `Verified ${declarations.length} message subtype names and 12 chat/update aliases`
);
