import schema from './schema/secret.json' with { type: 'json' };
import { TlCodec } from './tl.js';

/** Secret-chat TL has independent constructor versions and layer negotiation. */
export class SecretChatCodec extends TlCodec {
  constructor({ layer = 144, ...limits } = {}) {
    if (!Number.isSafeInteger(layer) || layer < 8 || layer > schema.layer) {
      throw new RangeError(`Unsupported secret chat layer: ${layer}`);
    }
    super({
      ...limits,
      registry: {
        layer,
        source: schema.source,
        methods: [],
        constructors: schema.constructors
          .filter((definition) => definition.layer <= layer)
          .sort((left, right) => left.layer - right.layer),
      },
    });
  }
}
