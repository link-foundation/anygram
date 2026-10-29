import { Api } from '../src/index.js';
import type { Anygram } from '../src/index.js';

export async function inspectSelf(client: Anygram) {
  const request = new Api.users.GetUsers({ id: [new Api.InputUserSelf()] });
  const name: 'users.GetUsers' = request.className;
  return { name, users: await client.invoke(request) };
}

export function draftMessage(message: string) {
  const request = new Api.messages.SendMessage({
    peer: new Api.InputPeerSelf(),
    message,
    noWebpage: true,
  });
  request.message = `${message}!`;
  return { request, bytes: request.getBytes() };
}

/** Compile-time contract checks: typo and schema errors must stay visible. */
export function checkConstructorTypes() {
  // @ts-expect-error The schema has no such namespace member.
  new Api.users.MissingMethod();
  // @ts-expect-error Required vector argument is absent.
  new Api.users.GetUsers();
  new Api.users.GetUsers({
    // @ts-expect-error A file is not a resolvable peer.
    id: [new Api.InputFile({ id: 7n, parts: 1, name: 'x', md5Checksum: '' })],
  });
  // @ts-expect-error CamelCase field names are checked.
  new Api.InputPeerUser({ user_id: 7n, accessHash: 17n });
  // @ts-expect-error TL strings do not accept integers.
  new Api.messages.SendMessage({ peer: new Api.InputPeerSelf(), message: 7 });
}

export async function sendWithUsername(client: Anygram) {
  const request = new Api.messages.SendMessage({
    peer: '@alice',
    message: 'Hello',
    sendAs: 'me',
  });
  await request.resolve(client);
  return client.invoke(request);
}
