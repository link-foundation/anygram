import { Telegraf, BotApi, createClient } from '../src/index.js';

export async function telegrafApiExamples(bot: Telegraf, signal: AbortSignal) {
  await bot.telegram.forwardMessage(
    7,
    8,
    9,
    { disable_notification: true },
    signal
  );
  await bot.telegram.answerCbQuery('callback', 'Updated', {
    show_alert: false,
  });
  await bot.telegram.editMessageCaption(7, 9, undefined, 'caption');
  await bot.telegram.editMessageText(
    7,
    9,
    undefined,
    'text',
    {},
    {
      signal,
      timeout: 80,
    }
  );
  await bot.telegram.editMessageMedia(7, 9, undefined, {
    type: 'photo',
    media: 'file-id',
  });
  await bot.telegram.setChatMenuButton({
    chatId: 7,
    menuButton: { type: 'commands' },
  });
  await bot.telegram.setMyDefaultAdministratorRights();
  await bot.telegram.sendQuiz(7, 'Question?', ['Yes', 'No'], {
    correct_option_id: 0,
  });
  await bot.telegram.sendInvoice(7, {
    title: 'Invoice',
    payload: 'order',
    currency: 'USD',
    prices: [],
  });
  await bot.telegram.kickChatMember(7, 8, undefined, { revoke_messages: true });
  await bot.telegram.sendCopy(7, { chat: { id: 8 }, message_id: 9 });
  const url: URL = await bot.telegram.getFileLink('file-id', signal);
  const sharedUrl: URL = await bot.api.getFileLink('file-id', { signal });
  // @ts-expect-error A forwarded message needs its source and message IDs.
  await bot.telegram.forwardMessage(7);
  return [url, sharedUrl];
}

export async function canonicalFileLinkExamples(signal: AbortSignal) {
  const native = new BotApi({ token: 'example:token' });
  const client = await createClient({ token: 'example:token' });
  const first: URL = await native.getFileLink(
    { file_path: 'docs/example.pdf' },
    signal
  );
  const second: URL = await client.getFileLink('file-id', { signal });
  return [first, second];
}
