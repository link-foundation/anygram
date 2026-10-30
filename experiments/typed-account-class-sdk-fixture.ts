import { Api as AnygramApi } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';

export function portableClassGuards(
  value: unknown,
  Api: typeof AnygramApi | typeof GramApi | typeof TeleApi
) {
  if (value instanceof Api.User) {
    console.log(value.id.toString(), value.firstName?.toUpperCase());
    console.log(value.getBytes().byteLength);
  }
  if (value instanceof Api.Message) {
    console.log(value.message.toUpperCase(), value.id.toFixed());
    if (value.peerId instanceof Api.PeerUser) {
      console.log(value.peerId.userId.toString());
    }
  }
}
