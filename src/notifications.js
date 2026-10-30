const booleanFields = [
  'show_previews',
  'silent',
  'stories_muted',
  'stories_hide_sender',
];
const notifyPeers = new Set([
  'inputNotifyPeer',
  'inputNotifyUsers',
  'inputNotifyChats',
  'inputNotifyBroadcasts',
  'inputNotifyForumTopic',
  'inputNotifyCommunity',
]);

export function notificationOptions({
  until = 2147483647,
  showPreviews,
  silent,
  sound,
  storiesMuted,
  storiesHideSender,
  storiesSound,
  ...options
}) {
  const settings = {
    _: 'inputPeerNotifySettings',
    mute_until: until,
    show_previews: showPreviews,
    silent,
    sound,
    stories_muted: storiesMuted,
    stories_hide_sender: storiesHideSender,
    stories_sound: storiesSound,
  };
  if (
    !Number.isInteger(until) ||
    until < -2147483648 ||
    until > 2147483647 ||
    booleanFields.some(
      (field) =>
        settings[field] !== undefined && typeof settings[field] !== 'boolean'
    )
  ) {
    throw new TypeError('Invalid notification settings');
  }
  return {
    settings: Object.fromEntries(
      Object.entries(settings).filter(([, value]) => value !== undefined)
    ),
    options,
  };
}

export async function notificationPeer(operations, peer, options) {
  if (notifyPeers.has(peer?._)) {
    return peer;
  }
  return {
    _: 'inputNotifyPeer',
    peer: await operations.resolvePeer(peer, options),
  };
}
