import { Bot, InputFile } from '../src/index.js';

/** The positional view retains the selected transport and request controls. */
export async function positionalBot(bot: Bot, signal: AbortSignal) {
  await bot.api.getChat(7, signal);
  await bot.api.getUpdates({ timeout: 30 }, { signal, timeout: 2000 });
  await bot.api.getChat({ chat_id: 7 }, { signal, timeout: 2000 });
  await bot.api.restrictChatMember(
    7,
    8,
    { can_send_messages: false },
    { until_date: 0 },
    signal
  );
  await bot.api.sendPoll(7, 'Choose', ['yes', { text: 'no' }], {}, signal);
  await bot.api.editMessageCaptionInline(
    'inline',
    { caption: 'caption' },
    signal
  );
  await bot.api.editEphemeralMessageText(7, 8, 9, { blocks: [] }, {}, signal);
  await bot.api.sendMediaGroup(
    7,
    [{ type: 'photo', media: new InputFile(new Uint8Array([1]), 'photo.png') }],
    { signal, timeout: 2000 }
  );
  await bot.api.kickChatMember(7, 8, {}, signal);
  await bot.api.getChatMembersCount(7, signal);
  // @ts-expect-error A positional chat ID alone omits the required user ID.
  await bot.api.restrictChatMember(7);
}
