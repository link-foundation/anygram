import { isBotSignal } from './bot-operations.js';
import {
  contextMethod,
  contextRequired as required,
  contextOptions,
  contextApiCall,
} from './bot-context-scope.js';

// Data argument counts exclude the options and cancellation arguments.
const edits = [
  ['editMessageText', 1, 2],
  ['editMessageCaption', 0, 2],
  ['editMessageMedia', 1, 2],
  ['editMessageReplyMarkup', 0, 1],
  ['editMessageLiveLocation', 2, 3],
  ['stopMessageLiveLocation', 0, 1],
];
const ephemeral = [
  'editEphemeralMessageText',
  'editEphemeralMessageMedia',
  'editEphemeralMessageCaption',
  'editEphemeralMessageReplyMarkup',
  'deleteEphemeralMessage',
];

function messageScope(ctx, name) {
  return [required(ctx.chatId, name), required(ctx.msgId, name)];
}

function installGrammyEdits(Type) {
  for (const [name, count] of [...edits, ['stopPoll', 0]]) {
    contextMethod(Type, name, function (...args) {
      const inline = name !== 'stopPoll' && this.inlineMessageId !== undefined;
      return contextApiCall(
        this,
        inline ? `${name}Inline` : name,
        inline ? [this.inlineMessageId] : messageScope(this, name),
        [
          ...Array.from({ length: count }, (_, index) => args[index]),
          contextOptions(this, 'b', args[count]),
          args[count + 1],
        ]
      );
    });
  }
  contextMethod(Type, 'editMessageChecklist', function (...args) {
    const name = 'editMessageChecklist';
    const msg = required(this.msg, name);
    const target =
      msg.checklist_tasks_done?.checklist_message ??
      msg.checklist_tasks_added?.checklist_message ??
      msg;
    return contextApiCall(
      this,
      name,
      [
        required(this.businessConnectionId, name),
        required(target.chat.id, name),
        required(target.message_id, name),
      ],
      args
    );
  });
  for (const name of ephemeral) {
    contextMethod(Type, name, function (...args) {
      const msg = required(this.msg, name);
      return contextApiCall(
        this,
        name,
        [
          msg.chat.id,
          required(msg.receiver_user, name).id,
          required(msg.ephemeral_message_id, name),
        ],
        args
      );
    });
  }
}

function installGrammyReactions(Type) {
  contextMethod(Type, 'react', function (reaction, other, signal) {
    const list = Array.isArray(reaction) ? reaction : [reaction];
    return this.api.setMessageReaction(
      ...messageScope(this, 'setMessageReaction'),
      list.map((value) =>
        typeof value === 'string' ? { type: 'emoji', emoji: value } : value
      ),
      other,
      signal
    );
  });
  for (const name of [
    'approveSuggestedPost',
    'declineSuggestedPost',
    'deleteMessageReactionUser',
    'deleteMessageReactionChat',
  ]) {
    contextMethod(Type, name, function (...args) {
      return contextApiCall(this, name, messageScope(this, name), args);
    });
  }
  contextMethod(Type, 'deleteMessageReaction', function (other, signal) {
    const name = 'deleteMessageReaction';
    const reaction = required(this.messageReaction, name);
    for (const [field, suffix] of [
      ['user', 'User'],
      ['actor_chat', 'Chat'],
    ]) {
      if (reaction[field] !== undefined) {
        return this[`${name}${suffix}`](reaction[field].id, other, signal);
      }
    }
    throw new Error(
      `Missing information from message_reaction update for API call to ${name}`
    );
  });
  contextMethod(Type, 'deleteAllMessageReactions', function (other, signal) {
    const name = 'deleteAllMessageReactions';
    const chat = required(this.chatId, name);
    const actor =
      this.messageReaction?.actor_chat ??
      this.senderChat ??
      this.pollAnswer?.voter_chat;
    const user = actor === undefined ? required(this.from, name) : undefined;
    return this.api[`${name}${actor === undefined ? 'User' : 'Chat'}`](
      chat,
      (actor ?? user).id,
      other,
      signal
    );
  });
  for (const name of [
    'deleteAllMessageReactionsUser',
    'deleteAllMessageReactionsChat',
    'deleteBusinessMessages',
  ]) {
    contextMethod(Type, name, function (...args) {
      const scope =
        name === 'deleteBusinessMessages'
          ? this.businessConnectionId
          : this.chatId;
      return contextApiCall(this, name, [required(scope, name)], args);
    });
  }
}

// Omit the optional anygram request extension when the caller did not supply it.
function telegrafCall(ctx, name, prefix, args, width) {
  const supplied = Array.from({ length: width }, (_, index) => args[index]);
  if (args[width] !== undefined) {
    supplied.push(args[width]);
  }
  return ctx.telegram[name](...prefix, ...supplied);
}

function installTelegrafEdits(Type) {
  for (const [name, , width] of edits) {
    contextMethod(Type, name, function (...args) {
      this.assert(this.msgId ?? this.inlineMessageId, name);
      return telegrafCall(
        this,
        name,
        [this.chat?.id, this.msgId, this.inlineMessageId],
        args,
        width
      );
    });
  }
  contextMethod(Type, 'stopPoll', function (...args) {
    this.assert(this.chat, 'stopPoll');
    return this.telegram.stopPoll(this.chat.id, ...args);
  });
  contextMethod(Type, 'react', function (reaction, isBig, request) {
    this.assert(this.chat, 'setMessageReaction');
    this.assert(this.msgId, 'setMessageReaction');
    const list = reaction
      ? Array.isArray(reaction)
        ? reaction
        : [reaction]
      : undefined;
    const reactions = list?.map((value) => {
      if (typeof value !== 'string') {
        return value;
      }
      return /^[0-9]/.test(value)
        ? { type: 'custom_emoji', custom_emoji_id: value }
        : { type: 'emoji', emoji: value };
    });
    return telegrafCall(
      this,
      'setMessageReaction',
      [this.chat.id, this.msgId],
      [reactions, isBig, request],
      2
    );
  });
}

function installForwarding(Type, style) {
  for (const name of [
    'forwardMessage',
    'forwardMessages',
    'copyMessage',
    'copyMessages',
  ]) {
    const multiple = name.endsWith('Messages');
    contextMethod(Type, name, function (destination, ...args) {
      let source;
      let message;
      if (style === 'telegraf') {
        this.assert(this.chat, name);
        source = this.chat.id;
        if (!multiple) {
          this.assert(this.msgId, name);
        }
        message = multiple ? args[0] : this.msgId;
      } else {
        source = required(this.chatId, name);
        message = multiple ? args[0] : required(this.msgId, name);
      }
      const index = multiple ? 1 : 0;
      const prefix = [destination, source, message];
      return style === 'telegraf'
        ? telegrafCall(this, name, prefix, args.slice(index), 1)
        : contextApiCall(this, name, prefix, [
            contextOptions(this, 'd', args[index]),
            args[index + 1],
          ]);
    });
  }
}

function installDeletion(Type, style) {
  contextMethod(Type, 'deleteMessage', function (idOrRequest, request) {
    const name = 'deleteMessage';
    const control =
      isBotSignal(idOrRequest) ||
      (idOrRequest !== null && typeof idOrRequest === 'object');
    const explicit = idOrRequest !== undefined && !control;
    if (style === 'telegraf') {
      this.assert(this.chat, name);
      if (!explicit) {
        this.assert(this.msgId, name);
      }
      return telegrafCall(
        this,
        name,
        [this.chat.id],
        [
          explicit ? idOrRequest : this.msgId,
          request ?? (control ? idOrRequest : undefined),
        ],
        1
      );
    }
    return this.api.deleteMessage(
      required(this.chatId, name),
      explicit ? idOrRequest : required(this.msgId, name),
      request ?? (control ? idOrRequest : undefined)
    );
  });
  contextMethod(Type, 'deleteMessages', function (ids, request) {
    if (style === 'telegraf') {
      this.assert(this.chat, 'deleteMessages');
      return telegrafCall(
        this,
        'deleteMessages',
        [this.chat.id],
        [ids, request],
        1
      );
    }
    return this.api.deleteMessages(
      required(this.chatId, 'deleteMessages'),
      ids,
      request
    );
  });
}

function installPersistentChatAction(Type) {
  contextMethod(
    Type,
    'persistentChatAction',
    async function (
      action,
      callback,
      { intervalDuration, onError, ...extra } = {}
    ) {
      await this.sendChatAction(action, { ...extra });
      const timer = globalThis.setInterval(() => {
        this.sendChatAction(action, { ...extra })
          .catch((error) => onError?.(error))
          .catch(() => undefined);
      }, intervalDuration ?? 4000);
      try {
        await callback();
      } finally {
        globalThis.clearInterval(timer);
      }
    }
  );
}

/** Context actions only choose scope; selected positional APIs own the request. */
export function installContextMessageActions(Type, style = 'grammy') {
  installForwarding(Type, style);
  installDeletion(Type, style);
  if (style === 'telegraf') {
    installTelegrafEdits(Type);
    installPersistentChatAction(Type);
  } else {
    installGrammyEdits(Type);
    installGrammyReactions(Type);
  }
}
