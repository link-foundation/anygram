import { Bot, fmt } from '../src/index.js';
import type { Telegram } from '../src/index.js';
const bot = new Bot('123:example');
export async function dispatch() {
  const chat: Telegram.ChatFullInfo = await bot.api.callApi('getChat', {
    chat_id: 1,
  });
  const name: string = (await bot.api.raw.getMe()).first_name;
  const exact: Telegram.Message = await bot.api.raw.sendMessage({
    chat_id: 1n,
    text: 'exact',
  });
  await bot.api.sendMessage(1, fmt`formatted`, {
    signal: new AbortController().signal,
  });
  await bot.api.getChat(1n);
  const custom = await bot.api.callApi<{ value: string }>('futureMethod', {
    extension: true,
  });
  const rawCustom = await bot.api.raw.futureMethod<{ value: string }>({
    extension: true,
  });
  void [chat, name, exact, custom.value, rawCustom.value];
}
// @ts-expect-error Known callApi methods check required arguments.
bot.api.callApi('getChat', {});
// @ts-expect-error Known callApi methods check field types.
bot.api.callApi('sendMessage', { chat_id: 1, text: false });
// @ts-expect-error Ephemeral message identifiers are integers.
bot.api.editEphemeralMessageText(1, 2, 'invalid', 'text');

export async function invalidResults() {
  // @ts-expect-error Known dispatcher results cannot be inferred as a number.
  const wrongCall: number = await bot.api.callApi('getChat', { chat_id: 1 });
  // @ts-expect-error Known raw results retain their declared model.
  const wrongRaw: number = await bot.api.raw.getMe();
  void [wrongCall, wrongRaw];
}
