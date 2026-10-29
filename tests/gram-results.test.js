import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { Api, Anygram, createAdapter } from '../src/index.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

function user() {
  return {
    _: 'user',
    id: 9007199254740993n,
    access_hash: -17n,
    first_name: 'Ada',
    last_name: 'Lovelace',
    photo: {
      _: 'userProfilePhoto',
      photo_id: 27n,
      dc_id: 2,
      stripped_thumb: Uint8Array.of(1, 2, 3),
    },
  };
}

for (const [kind, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`returns detached camelCase invocation data from actual ${kind} responses`, async () => {
    const source = new Vendor.User({
      id: 9007199254740993n,
      accessHash: -17n,
      firstName: 'Ada',
      photo: new Vendor.UserProfilePhoto({
        photoId: 27n,
        dcId: 2,
        strippedThumb: Buffer.from([1, 2, 3]),
      }),
    });
    const raw = [source];
    const client = new Anygram({
      adapters: [
        createAdapter(kind, { invoke: async () => raw }, { Api: Vendor }),
      ],
    });
    const result = await client.gramjs.invoke(
      new Api.users.GetUsers({ id: ['me'] })
    );
    assert.equal(result[0].className, 'User');
    assert.equal(result[0].firstName, source.firstName);
    assert.equal(result[0].id, BigInt(source.id.toString()));
    assert.equal(result[0].accessHash, -17n);
    assert.equal(result[0].photo.className, 'UserProfilePhoto');
    assert.equal(result[0].photo.photoId, 27n);
    result[0].photo.strippedThumb[0] = 99;
    result[0].firstName = 'Changed';
    assert.equal(source.firstName, 'Ada');
    assert.equal(source.photo.strippedThumb[0], 1);
    assert.equal(
      await client.invoke(new Vendor.users.GetUsers({ id: [] })),
      raw
    );
  });
}

for (const kind of ['mtcute', 'mtproto', 'native']) {
  it(`gives the GramJS-style facade camelCase results on ${kind}`, async () => {
    const raw = [user()];
    const calls = [];
    const backend = {
      async call(...args) {
        calls.push(args);
        return raw;
      },
    };
    const client = new Anygram({
      adapters: [
        createAdapter(kind, backend, {
          kind: kind === 'native' ? 'mtproto' : kind,
        }),
      ],
    });
    const request = new Api.users.GetUsers({ id: [new Api.InputUserSelf()] });
    const result = await client.teleproto.invoke(request);
    assert.equal(result[0].className, 'User');
    assert.equal(result[0].firstName, 'Ada');
    assert.equal(result[0].id, 9007199254740993n);
    assert.equal(result[0].photo.dcId, 2);
    result[0].photo.strippedThumb[0] = 99;
    assert.equal(raw[0].photo.stripped_thumb[0], 1);
    assert.equal(await client.invoke(request), raw);
    assert.equal(raw[0].firstName, undefined);
    assert.equal(calls.length, 2);
  });
}

it('forwards string and class invocation arguments and request cancellation options', async () => {
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter('mtproto', {
        call: async (...args) => {
          calls.push(args);
          return { _: 'config', this_dc: 2, dc_options: [] };
        },
      }),
    ],
  });
  const options = { signal: new globalThis.AbortController().signal };
  for (const invoke of [client.gramjs.invoke, client.teleproto.invoke]) {
    const result = await invoke('help.getConfig', {}, options);
    assert.equal(result.className, 'Config');
    assert.equal(result.thisDc, 2);
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0][2], options);
  assert.equal(calls[1][2], options);
  await client.gramjs.invoke(new Api.help.GetConfig(), options);
  assert.equal(calls[2][2], options);
});

it('converts sendMessage results and retains the selected shared operation options', async () => {
  const calls = [];
  const raw = {
    _: 'updates',
    seq_start: 1,
    updates: [
      {
        _: 'updateNewMessage',
        pts_count: 1,
        message: {
          _: 'message',
          id: 7,
          peer_id: { _: 'peerUser', user_id: 9n },
          message: 'hi',
        },
      },
    ],
  };
  const client = new Anygram({
    adapters: [
      createAdapter('gramjs', {
        sendMessage: async (...args) => {
          calls.push(args);
          return raw;
        },
      }),
    ],
  });
  const options = { message: 'hi', silent: true };
  const result = await client.gramjs.sendMessage('me', options);
  assert.equal(result.className, 'Updates');
  assert.equal(result.seqStart, 1);
  assert.equal(result.updates[0].ptsCount, 1);
  assert.equal(result.updates[0].message.peerId.userId, 9n);
  assert.deepEqual(calls, [['me', options]]);
  assert.equal(raw.updates[0].className, undefined);
});

it('preserves routed invocation failures without converting or replaying them', async () => {
  let attempts = 0;
  const client = new Anygram({
    adapters: [
      createAdapter('mtproto', {
        call: async () => {
          attempts++;
          throw Object.assign(new Error('FLOOD_WAIT_7'), {
            error_code: 420,
            error_message: 'FLOOD_WAIT_7',
          });
        },
      }),
    ],
  });
  await assert.rejects(
    client.gramjs.invoke(new Api.help.GetConfig()),
    /FLOOD_WAIT_7/
  );
  assert.equal(attempts, 1);
});

it('returns nested camelCase raw invocation results over encrypted native TCP', async () => {
  const peer = await secretRpcPeer((request) => {
    assert.equal(request._, 'users.getUsers');
    return [user()];
  });
  const client = new Anygram({
    adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
  });
  try {
    const result = await client.gramjs.invoke(
      new Api.users.GetUsers({ id: [new Api.InputUserSelf()] })
    );
    assert.equal(result[0].firstName, 'Ada');
    assert.equal(result[0].photo.strippedThumb[2], 3);
    assert.equal(result[0].photo.dcId, 2);
  } finally {
    await client.disconnect();
    await peer.close();
  }
});
