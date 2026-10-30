import { Api } from './api.js';
import { canonicalValue } from './requests.js';
import { passwordProof } from './password.js';
import { randomId } from './random.js';
import { responseMessage } from './account-response.js';

const owners = new WeakMap();
const legacyTypes = {
  keyboardButton: 'buttonTypeDefault',
  keyboardButtonCallback: 'inlineButtonTypeCallback',
  keyboardButtonUrl: 'inlineButtonTypeUrl',
  keyboardButtonGame: 'inlineButtonTypeGame',
  keyboardButtonSwitchInline: 'inlineButtonTypeSwitchInline',
  keyboardButtonRequestPhone: 'buttonTypeRequestPhone',
  keyboardButtonRequestGeoLocation: 'buttonTypeRequestGeoLocation',
};

function typeOf(button) {
  return button.type?._ ?? legacyTypes[button._];
}

function fields(button) {
  return button.type ?? button;
}

function rows(message) {
  return ['replyInlineMarkup', 'replyKeyboardMarkup'].includes(
    message.replyMarkup?._
  )
    ? message.replyMarkup.rows
    : undefined;
}

function botFor(message, button, context) {
  if (typeOf(button) !== 'inlineButtonTypeSwitchInline') {
    return undefined;
  }
  if (fields(button).samePeer || !message.viaBotId) {
    return message.inputSender;
  }
  try {
    return context.wrap(
      context.operations.resolveObjectPeer({
        _: 'peerUser',
        user_id: message.viaBotId,
      })
    );
  } catch (error) {
    if (error.type !== 'PEER_NOT_FOUND') {
      throw error;
    }
    return undefined;
  }
}

export function messageButtonCount(message) {
  return (
    rows(message)?.reduce((count, row) => count + row.buttons.length, 0) ?? 0
  );
}

export function messageButtons(
  message,
  context,
  state,
  chat = message.inputChat,
  sender = message
) {
  const markup = rows(message);
  if (state.buttons || !markup || !chat) {
    return state.buttons;
  }
  const result = [];
  for (const row of markup) {
    const entries = [];
    for (const original of row.buttons) {
      const bot = botFor(sender, original, context);
      if (typeOf(original) === 'inlineButtonTypeSwitchInline' && !bot) {
        return undefined;
      }
      const button = Object.assign(Object.create(AccountButton.prototype), {
        button: original,
      });
      owners.set(button, { message, context, chat, bot });
      entries.push(button);
    }
    result.push(entries);
  }
  state.buttons = result;
  return result;
}

export async function getMessageButtons(message, context, state, options = {}) {
  options.signal?.throwIfAborted();
  const cached = messageButtons(message, context, state);
  if (cached || !rows(message)) {
    return cached;
  }
  const chat = await message.getInputChat(options);
  if (!chat) {
    return undefined;
  }
  const available = messageButtons(message, context, state, chat);
  if (available) {
    return available;
  }
  const [refetched] = await context.operations.getMessages(chat, {
    ...options,
    ids: message.id,
  });
  const result = messageButtons(
    message,
    context,
    state,
    chat,
    refetched && context.wrap(refetched, chat)
  );
  if (!result) {
    throw new TypeError('Inline button bot input sender is unavailable');
  }
  return result;
}

async function callback(owner, data, game, options) {
  let password;
  if (options.password !== undefined) {
    if (typeof options.password !== 'string') {
      throw new TypeError('Callback password must be a string');
    }
    const parameters = await owner.context.operations.rpc(
      'account.getPassword',
      {},
      options
    );
    options.signal?.throwIfAborted();
    password = await passwordProof(parameters, options.password);
    options.signal?.throwIfAborted();
  }
  try {
    return owner.context.wrap(
      await owner.context.operations.rpc(
        'messages.getBotCallbackAnswer',
        {
          peer: owner.chat,
          msg_id: owner.message.id,
          data: data && Uint8Array.from(data),
          game,
          password,
        },
        options
      )
    );
  } catch (error) {
    if (error.type === 'BOT_RESPONSE_TIMEOUT') {
      return null;
    }
    throw error;
  }
}

async function contact(owner, sharePhone, options) {
  if (!sharePhone) {
    throw new TypeError('Phone buttons require explicit sharePhone consent');
  }
  if (sharePhone === true || typeof sharePhone === 'string') {
    const me = await owner.context.operations.getMe(options);
    return {
      _: 'inputMediaContact',
      phone_number: (sharePhone === true ? me.phone : sharePhone) ?? '',
      first_name: me.first_name ?? '',
      last_name: me.last_name ?? '',
      vcard: '',
    };
  }
  const media = canonicalValue(sharePhone);
  if (media?._ !== 'inputMediaContact') {
    throw new TypeError(
      'sharePhone requires a phone string, true or InputMediaContact'
    );
  }
  return media;
}

function coordinates(point) {
  if (
    point?._ !== 'inputGeoPoint' ||
    !Number.isFinite(point.long) ||
    !Number.isFinite(point.lat) ||
    Math.abs(point.long) > 180 ||
    Math.abs(point.lat) > 90
  ) {
    throw new RangeError(
      'shareGeo requires valid longitude and latitude coordinates'
    );
  }
  return point;
}

function location(shareGeo) {
  if (!shareGeo) {
    throw new TypeError('Location buttons require explicit shareGeo consent');
  }
  if (Array.isArray(shareGeo)) {
    const [long, lat] = shareGeo;
    if (shareGeo.length !== 2) {
      throw new RangeError(
        'shareGeo requires valid [longitude, latitude] coordinates'
      );
    }
    return {
      _: 'inputMediaGeoPoint',
      geo_point: coordinates({ _: 'inputGeoPoint', long, lat }),
    };
  }
  const media = canonicalValue(shareGeo);
  if (media?._ === 'inputGeoPoint') {
    return { _: 'inputMediaGeoPoint', geo_point: coordinates(media) };
  }
  if (media?._ !== 'inputMediaGeoPoint') {
    throw new TypeError('shareGeo requires coordinates or InputGeoPoint media');
  }
  return { ...media, geo_point: coordinates(media.geo_point) };
}

async function share(owner, type, options) {
  const media =
    type === 'buttonTypeRequestPhone'
      ? await contact(owner, options.sharePhone, options)
      : location(options.shareGeo);
  options.signal?.throwIfAborted();
  const nonce = randomId();
  const result = await owner.context.operations.rpc(
    'messages.sendMedia',
    { peer: owner.chat, media, message: '', random_id: nonce },
    options
  );
  return responseMessage(owner.context, result, {
    peer: owner.chat,
    randomId: nonce,
    text: '',
  });
}

class AccountButton {
  get client() {
    return owners.get(this).context.style;
  }
  get text() {
    return this.button.text;
  }
  get data() {
    return typeOf(this.button) === 'inlineButtonTypeCallback'
      ? fields(this.button).data
      : undefined;
  }
  get inlineQuery() {
    return typeOf(this.button) === 'inlineButtonTypeSwitchInline'
      ? fields(this.button).query
      : undefined;
  }
  get url() {
    return typeOf(this.button) === 'inlineButtonTypeUrl'
      ? fields(this.button).url
      : undefined;
  }
  async click(options = {}) {
    options.signal?.throwIfAborted();
    const owner = owners.get(this);
    const type = typeOf(this.button);
    if (
      type === 'inlineButtonTypeCallback' ||
      type === 'inlineButtonTypeGame'
    ) {
      return await callback(
        owner,
        this.data,
        type === 'inlineButtonTypeGame' || undefined,
        options
      );
    }
    if (type === 'inlineButtonTypeUrl') {
      return this.url;
    }
    if (type === 'buttonTypeDefault') {
      return owner.message.respond({
        ...options,
        message: this.text,
        parseMode: false,
      });
    }
    if (type === 'inlineButtonTypeSwitchInline') {
      return owner.context.style.invoke(
        new Api.messages.StartBot({
          bot: owner.bot,
          peer: owner.chat,
          startParam: this.inlineQuery,
        }),
        options
      );
    }
    if (
      type === 'buttonTypeRequestPhone' ||
      type === 'buttonTypeRequestGeoLocation'
    ) {
      return share(owner, type, options);
    }
    return undefined;
  }
}

function selectButton(buttons, { i = 0, j, text, filter }) {
  const flat = buttons.flat();
  if (text !== undefined) {
    return flat.find((button) =>
      typeof text === 'function' ? text(button.text) : button.text === text
    );
  }
  if (filter !== undefined) {
    return flat.find(filter);
  }
  const index = Array.isArray(i) ? i[0] : i;
  return j === undefined ? flat[index] : buttons[index]?.[j];
}

function pollOptions(poll, { i, text, filter }) {
  if (poll.closed) {
    throw new TypeError('Cannot vote in a closed poll');
  }
  const answers = poll.answers;
  if (i !== undefined) {
    const indices = Array.isArray(i) ? i : [i];
    if (
      new Set(indices).size !== indices.length ||
      indices.some(
        (index) =>
          !Number.isInteger(index) || index < 0 || index >= answers.length
      )
    ) {
      throw new RangeError('Invalid poll answer indices');
    }
    if (indices.length > 1 && !poll.multipleChoice) {
      throw new RangeError(
        'A single-choice poll does not accept multiple answers'
      );
    }
    return indices.map((index) => Uint8Array.from(answers[index].option));
  }
  const answer = answers.find((answer) =>
    text !== undefined
      ? typeof text === 'function'
        ? text(answer.text)
        : (answer.text.text ?? answer.text) === text
      : filter?.(answer)
  );
  return answer ? [Uint8Array.from(answer.option)] : [];
}

export async function clickMessage(message, context, state, options = {}) {
  options.signal?.throwIfAborted();
  if (options.data !== undefined) {
    if (!(options.data instanceof Uint8Array)) {
      throw new TypeError('Callback data must be bytes');
    }
    const data = Uint8Array.from(options.data);
    const chat = await message.getInputChat(options);
    return chat
      ? callback({ message, context, chat }, data, undefined, options)
      : undefined;
  }
  if (message.poll) {
    const selected = pollOptions(message.poll.poll, options);
    const chat = await message.getInputChat(options);
    return chat
      ? context.wrap(
          await context.operations.rpc(
            'messages.sendVote',
            { peer: chat, msg_id: message.id, options: selected },
            options
          )
        )
      : undefined;
  }
  const buttons = await getMessageButtons(message, context, state, options);
  return buttons ? selectButton(buttons, options)?.click(options) : undefined;
}
