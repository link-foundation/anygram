import type { Api as GramApi } from 'telegram/tl/index.js';
import type { Api as TeleApi } from 'teleproto/tl/index.js';
import type { AccountMessage } from '../src/index.js';

export async function portablePeerMetadata(
  message: AccountMessage | GramApi.Message | TeleApi.Message
) {
  const forward = message.forward;
  // @ts-expect-error Published SDK Forward types omit their runtime originalFwd field.
  const header = forward?.originalFwd;
  const sender = await forward?.getSender();
  const chat = await forward?.getChat();
  const inputSender = await forward?.getInputSender();
  const inputChat = await forward?.getInputChat();
  const viaBot = message.viaBot;
  const viaInputBot = message.viaInputBot;
  const actions = message.actionEntities;
  const destination = message.toId;
  // @ts-expect-error A forward header is optional in each model.
  const requiredDate: number = forward.originalFwd.date;
  return {
    header,
    sender,
    chat,
    inputSender,
    inputChat,
    viaBot,
    viaInputBot,
    actions,
    destination,
    requiredDate,
  };
}
