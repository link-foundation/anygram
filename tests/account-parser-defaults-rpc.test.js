import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  TelegramClient as GramClient,
  Logger as GramLogger,
  sessions as GramSessions,
} from 'telegram';
import {
  TelegramClient as TeleClient,
  Logger as TeleLogger,
  sessions as TeleSessions,
} from 'teleproto';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { CustomMessage as GramMessage } from 'telegram/tl/custom/message.js';
import { Anygram, createAdapter } from '../src/index.js';
import { gramRequest, objectRequest, requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import {
  ownedMessage,
  sdkMessage,
  messagePage,
  canonical,
} from './fixtures/account-message-models.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };
const file = {
  _: 'inputMediaPhoto',
  id: {
    _: 'inputPhoto',
    id: 11n,
    access_hash: 13n,
    file_reference: new Uint8Array([1]),
  },
};
const entity = { _: 'messageEntityBold', offset: 0, length: 3 };
const codec = new TlCodec();

for (const [style, Client, Logger, sessions, Vendor] of [
  ['gramjs', GramClient, GramLogger, GramSessions, GramApi],
  ['teleproto', TeleClient, TeleLogger, TeleSessions, TeleApi],
]) {
  for (const mode of ['default', 'disabled', 'null-inherit']) {
    for (const action of ['send', 'file', 'album', 'edit']) {
      it(`compares ${style} ${mode} ${action} parser bytes with the actual SDK constructor`, async () => {
        const sdk = new Client(
          new sessions.StringSession(''),
          12345,
          'example',
          {
            deviceModel: 'Anygram tests',
            systemVersion: 'test',
            baseLogger: new Logger('none'),
          }
        );
        const requests = [];
        sdk.getInputEntity = async () => gramRequest(Vendor, requestOf(peer));
        sdk._getResponseMessage = () => undefined;
        sdk.invoke = async (request) => {
          requests.push(request);
          return new Vendor.UpdatesTooLong();
        };
        const source = mode === 'null-inherit' ? '<b>Ada</b>' : '**Ada**';
        const settings = mode === 'null-inherit' ? { parseMode: null } : {};
        const { client, message, calls } = await ownedMessage(style);
        if (mode !== 'default') {
          const configured = mode === 'disabled' ? undefined : 'html';
          sdk.setParseMode(configured);
          client.setParseMode(configured);
        }
        const media = () => gramRequest(Vendor, requestOf(file));
        if (action === 'send') {
          await sdk.sendMessage(peer, { message: source, ...settings });
          await client[style].sendMessage(peer, {
            message: source,
            ...settings,
          });
        } else if (action === 'edit') {
          await sdk.editMessage(peer, {
            message: 7,
            text: source,
            file: media(),
            ...settings,
          });
          await message.edit({
            text: source,
            file,
            linkPreview: true,
            ...settings,
          });
        } else if (action === 'file') {
          await sdk.sendFile(peer, {
            file: media(),
            caption: source,
            ...settings,
          });
          await client[style].sendFile(peer, {
            file,
            caption: source,
            ...settings,
          });
        } else {
          await sdk.sendFile(peer, {
            file: [media(), media()],
            caption: [source, source],
            ...settings,
          });
          await client[style].sendAlbum(peer, [file, file], {
            caption: [source, source],
            ...settings,
          });
        }
        assert.equal(requests.length, 1);
        assert.equal(calls.length, 1);
        const [method, params] = calls[0];
        if (action === 'album') {
          requests[0].multiMedia.forEach((item, index) => {
            item.randomId = params.multi_media[index].random_id;
          });
        } else if (action !== 'edit') {
          requests[0].randomId = params.random_id;
        }
        for (const caption of params.multi_media ?? [params]) {
          assert.equal(caption.message, mode === 'disabled' ? source : 'Ada');
          assert.deepEqual(
            caption.entities,
            mode === 'disabled' ? [] : [entity]
          );
        }
        const request = { _: method, ...params };
        assert.deepEqual(
          new Uint8Array(gramRequest(Vendor, requestOf(request)).getBytes()),
          new Uint8Array(requests[0].getBytes())
        );
        const current = gramRequest(
          TeleApi,
          requestOf(objectRequest(requestOf(requests[0])))
        );
        assert.deepEqual(
          codec.encode(request),
          new Uint8Array(current.getBytes())
        );
      });
    }
  }

  it(`compares ${style} default and disabled model reads/writes with actual SDK state`, async () => {
    const sdkClient = new Client(
      new sessions.StringSession(''),
      12345,
      'example',
      {
        deviceModel: 'Anygram tests',
        systemVersion: 'test',
        baseLogger: new Logger('none'),
      }
    );
    const page = messagePage();
    page.messages[0].message = 'Ada';
    page.messages[0].entities = [entity];
    const sdk = sdkMessage(Vendor, page).message;
    sdk.client.parseMode = sdkClient.parseMode;
    const { client, message } = await ownedMessage(style, page);
    assert.equal(message.text, sdk.text);
    assert.equal(message.text, '**Ada**');
    message.text = '**Bob**';
    if (style === 'gramjs') {
      Object.getOwnPropertyDescriptor(GramMessage.prototype, 'text').set.call(
        sdk,
        '**Bob**'
      );
    } else {
      sdk.text = '**Bob**';
    }
    assert.equal(message.rawText, sdk.rawText);
    assert.deepEqual(canonical(message.entities), canonical(sdk.entities));
    client.setParseMode(undefined);
    sdkClient.setParseMode(undefined);
    sdk.client.parseMode = sdkClient.parseMode;
    message.text = '**Literal**';
    if (style === 'gramjs') {
      Object.getOwnPropertyDescriptor(GramMessage.prototype, 'text').set.call(
        sdk,
        '**Literal**'
      );
    } else {
      sdk.text = '**Literal**';
    }
    assert.equal(message.rawText, sdk.rawText);
    assert.deepEqual(canonical(message.entities), canonical(sdk.entities));
  });

  for (const disabled of [false, true]) {
    it(`carries ${style} ${disabled ? 'disabled' : 'default'} parsing over encrypted native TCP and backend scopes`, async () => {
      const calls = [];
      const remote = await secretRpcPeer((request) => {
        calls.push(request);
        return request._ === 'messages.getHistory'
          ? messagePage()
          : { _: 'updatesTooLong' };
      });
      const client = new Anygram({
        adapters: [createAdapter('native', remote.client, { kind: 'mtproto' })],
      });
      if (disabled) {
        client.setParseMode(undefined);
      }
      const scoped = client.withBackend('native');
      try {
        const [message] = await scoped[style].getMessages(peer);
        await scoped[style].sendMessage(peer, { message: '**Ada**' });
        await scoped[style].sendFile(peer, { file, caption: '**Ada**' });
        await scoped[style].sendAlbum(peer, [file, file], {
          caption: ['**Ada**', '**Ada**'],
        });
        await message.reply({ message: '**Ada**' });
        await message.edit({ text: '**Ada**', file });
        assert.equal(calls.length, 6);
        for (const request of calls.slice(1)) {
          assert.equal(request.peer.access_hash, 17n);
          for (const caption of request.multi_media ?? [request]) {
            assert.equal(caption.message, disabled ? '**Ada**' : 'Ada');
            assert.deepEqual(caption.entities, disabled ? [] : [entity]);
          }
        }
        assert.equal(calls[4].reply_to.reply_to_msg_id, 7);
        assert.equal(calls[5].id, 7);
      } finally {
        await scoped.disconnect();
        await remote.close();
      }
    });
  }
}
