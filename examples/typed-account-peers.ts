import { Anygram, Api } from '../src/index.js';
import type { AccountForward, GramStyleObject } from '../src/index.js';

export async function inspectPeers(client: Anygram, signal: AbortSignal) {
  const [message] = await client.gramjs.getMessages(
    new Api.InputPeerUser({ userId: 9n, accessHash: 17n })
  );
  if (!message) return;
  const forward: AccountForward | undefined = message.forward;
  const originalDate: number | undefined = forward?.originalFwd.date;
  const hiddenName: string | undefined = forward?.originalFwd.fromName;
  const senderId: bigint | undefined = forward?.senderId;
  const sender = await forward?.getSender({ signal });
  const input = await message.getInputSender({ signal });
  const originalChat = await forward?.getChat({ signal });
  const originalInputChat = await forward?.getInputChat({ signal });
  const originalInputSender = await forward?.getInputSender({ signal });
  const viaBot: GramStyleObject | undefined = message.viaBot;
  const viaInputBot: GramStyleObject | undefined = message.viaInputBot;
  const actions: (GramStyleObject | undefined)[] | undefined =
    message.actionEntities;
  const destination: GramStyleObject | undefined = message.toId;
  // @ts-expect-error Lookups accept request options, not a peer identifier.
  await forward?.getSender('someone');
  // @ts-expect-error Original dates are Telegram integer timestamps.
  const invalidDate: string | undefined = forward?.originalFwd.date;
  // @ts-expect-error Action entity lists preserve missing entries.
  const completeActions: GramStyleObject[] | undefined = message.actionEntities;
  // @ts-expect-error Forward metadata is optional when a message has no header.
  const required: AccountForward = message.forward;
  return {
    originalDate,
    hiddenName,
    senderId,
    sender,
    input,
    originalChat,
    originalInputChat,
    originalInputSender,
    viaBot,
    viaInputBot,
    actions,
    destination,
    invalidDate,
    completeActions,
    required,
  };
}
