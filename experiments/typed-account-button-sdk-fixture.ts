import type { Api as GramApi } from 'telegram/tl/index.js';
import type { Api as TeleApi } from 'teleproto/tl/index.js';
import type { AccountMessage } from '../src/index.js';

export async function portableButtons(
  message: AccountMessage | GramApi.Message | TeleApi.Message
) {
  const count: number = message.buttonCount;
  const rows = await message.getButtons();
  const label: string | undefined = rows?.[0]?.[0]?.text;
  const data: Uint8Array | undefined = rows?.[0]?.[0]?.data;
  const url: string | undefined = rows?.[0]?.[0]?.url;
  await rows?.[0]?.[0]?.click({ password: 'explicit test password' });
  await message.click({ i: 0, j: 1 });
  await message.click({ i: [2, 0] });
  await message.click({ text: 'Continue' });
  await message.click({ data: Buffer.from([1, 2]) });
  await message.click({ sharePhone: true });
  await message.click({ shareGeo: [30, 45] });
  // @ts-expect-error Every model requires numeric indices.
  await message.click({ i: 'first' });
  // @ts-expect-error Every model requires a string password.
  await message.click({ password: 123 });
  return { count, label, data, url };
}
