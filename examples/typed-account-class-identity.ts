import { Api, type Anygram, type AccountMessage } from '../src/index.js';

export async function inspectMessages(client: Anygram) {
  const messages = await client.gramjs.getMessages('me');
  for (const value of messages) {
    if (value instanceof Api.Message) {
      console.log(value.message.toUpperCase(), value.getBytes());
      if (value.peerId instanceof Api.PeerUser) {
        console.log(value.peerId.userId.toString());
      }
      await value.reply({ message: 'Acknowledged', parseMode: false });
    }
  }
}

export function inspectUnknown(value: unknown) {
  if (value instanceof Api.User) {
    console.log(value.id.toString(), value.firstName?.toUpperCase());
    // @ts-expect-error User identifiers retain their exact checked type.
    const invalid: number = value.id;
    console.log(invalid);
  }
}

export function serializableBoundMessage(value: AccountMessage) {
  if (value instanceof Api.MessageService) {
    console.log(value.action.className, value.getBytes());
  }
}
