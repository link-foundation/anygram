import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as GramUtils from 'telegram/Utils.js';
import * as TeleUtils from 'teleproto/Utils.js';
import {
  mediaValues,
  mediaCastCases,
  mediaRequest,
  mediaField,
} from './fixtures/account-media-casts.js';

const noLookup = {
  getInputEntity() {
    throw new Error('Media casts must not perform peer lookups');
  },
};

for (const [label, Vendor, utils] of [
  ['gramjs', GramApi, GramUtils],
  ['teleproto', TeleApi, TeleUtils],
]) {
  for (const [type, names] of Object.entries(mediaCastCases)) {
    for (const name of names) {
      it(`casts ${name} to ${type} with actual ${label} argument bytes`, async () => {
        const source = mediaValues(Api)[name];
        const request = mediaRequest(Api, type, source);
        await request.resolve(noLookup);
        const expected = utils[`get${type}`](mediaValues(Vendor)[name]);
        const vendorRequest = mediaRequest(
          Vendor,
          type,
          mediaValues(Vendor)[name]
        );
        await vendorRequest.resolve(
          {
            getInputEntity(value) {
              assert(value instanceof Vendor.InputPeerSelf);
              return value;
            },
            getPeerId(value) {
              return value;
            },
          },
          utils
        );
        assert.deepEqual(
          mediaField(vendorRequest, type).getBytes(),
          expected.getBytes()
        );
        const actual = mediaField(request, type);
        assert.equal(actual.className, expected.className);
        // Newer media layouts add optional fields; these fixtures leave them unset.
        assert.deepEqual(
          actual.getBytes().subarray(4),
          expected.getBytes().subarray(4)
        );
        const identity = actual;
        await request.resolve(noLookup);
        assert.equal(mediaField(request, type), identity);
      });
    }
  }
}
