import { Anygram, Api } from '../src/index.js';
import type {
  AccountMessageButton,
  AccountButtonResult,
} from '../src/index.js';

export async function interact(client: Anygram, signal: AbortSignal) {
  const [message] = await client.teleproto.getMessages(
    new Api.InputPeerUser({ userId: 9n, accessHash: 17n })
  );
  if (!message) return;
  const count: number = message.buttonCount;
  const rows: AccountMessageButton[][] | undefined = await message.getButtons({
    signal,
  });
  const result: AccountButtonResult = await rows?.[0]?.[0]?.click({ signal });
  const label: string | undefined = rows?.[0]?.[0]?.text;
  const payload: Uint8Array | undefined = rows?.[0]?.[0]?.data;
  await message.click({ text: 'Continue', signal });
  await message.click({ i: 1, j: 0, signal });
  await message.click({ i: [2, 0], signal });
  await message.click({
    data: new Uint8Array([1, 2]),
    password: 'explicit test password',
    signal,
  });
  await message.click({
    sharePhone: new Api.InputMediaContact({
      phoneNumber: '123',
      firstName: 'Self',
      lastName: '',
      vcard: '',
    }),
    signal,
  });
  await message.click({ shareGeo: [30, 45], signal });
  await message.click({
    shareGeo: new Api.InputGeoPoint({ long: 30, lat: 45 }),
    signal,
  });
  // @ts-expect-error Callback data must be bytes.
  await message.click({ data: 'payload' });
  // @ts-expect-error Selection indices must be numbers.
  await message.click({ i: 'first' });
  // @ts-expect-error A coordinate pair has exactly two entries.
  await message.click({ shareGeo: [30] });
  // @ts-expect-error Password proof input is a string.
  await rows?.[0]?.[0]?.click({ password: 123 });
  return { count, result, label, payload };
}
