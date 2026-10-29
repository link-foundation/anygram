import { parseTelegramLink } from '../src/index.js';
import {
  followGroups,
  listGroups,
  readGroup,
  leaveGroup,
} from './follow-groups.js';

function groupInfo({ entity }) {
  return {
    id: String(entity.id),
    markedId: entity._.startsWith('channel')
      ? `-100${entity.id}`
      : String(-BigInt(entity.id)),
    title: entity.title ?? 'Unnamed',
    username: entity.username ?? null,
    type: entity._.startsWith('channel')
      ? entity.megagroup
        ? 'Supergroup'
        : 'Channel'
      : 'Group',
    members: entity.participants_count ?? 0,
    link: entity.username ? `https://t.me/${entity.username}` : null,
  };
}

async function joinedEntity(client, link, options) {
  const target = parseTelegramLink(link);
  if (target.type !== 'invite') {
    return client.getEntity(link, options);
  }
  const invite = await client.checkChatInvite(target.hash, options);
  if (invite._ !== 'chatInviteAlready') {
    throw new Error('Joined private invite membership could not be confirmed');
  }
  return invite.chat;
}

async function join(client, argv, options) {
  const result = await followGroups(client, [argv.link], options);
  if (
    ['joined', 'alreadyMember'].includes(result.outcomes[0]?.status) &&
    (argv.info || argv.messages)
  ) {
    const entity = await joinedEntity(client, argv.link, options);
    if (argv.info) {
      result.info = entity;
    }
    if (argv.messages) {
      result.messages = await readGroup(client, entity, {
        ...options,
        limit: 10,
      });
    }
  }
  return result;
}

export async function followAction(client, argv, links, signal) {
  const command = argv._[0] ?? 'follow';
  const options = { signal };
  if (command === 'list') {
    return (await listGroups(client, options)).map(groupInfo);
  }
  if (command === 'leave') {
    if (/^-?\d+$/.test(argv.group)) {
      await listGroups(client, options);
    }
    await leaveGroup(client, argv.group, options);
    return { left: argv.group };
  }
  if (command === 'join') {
    return join(client, argv, options);
  }
  return followGroups(client, links, {
    ...options,
    mute: argv.mute,
    archive: argv.archive,
    delay: argv.delay * 1000,
    continueOnFloodWait: argv.skipRateLimit,
  });
}

export function followExitCode(result) {
  return result.stop ||
    result.outcomes?.some((item) =>
      ['failed', 'invalid', 'inviteRequired', 'verificationRequired'].includes(
        item.status
      )
    )
    ? 1
    : 0;
}

export function followJson(value) {
  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === 'bigint') {
        return String(item);
      }
      if (item instanceof Error) {
        return {
          message: item.message,
          type: item.type,
          retryAfter: item.retryAfter,
        };
      }
      return item;
    },
    2
  );
}

export function followOutput(result, argv) {
  if (argv.json || argv.verbose) {
    return `${followJson(result)}\n`;
  }
  if (Array.isArray(result)) {
    return `${result
      .map((group) => `[${group.type}] ${group.title} (${group.markedId})`)
      .join('\n')}\n`;
  }
  if (result.left) {
    return `Left ${result.left}\n`;
  }
  const lines = result.outcomes.map((item) => `${item.link}: ${item.status}`);
  if (result.info) {
    lines.push(`Group: ${result.info.title} (${result.info.id})`);
  }
  if (result.messages) {
    lines.push(
      ...result.messages.map((item) => `${item.id}: ${item.message ?? ''}`)
    );
  }
  if (result.stop) {
    lines.push(`Stopped: ${result.stop.type}`);
  }
  return `${lines.join('\n')}\n`;
}
