import type { Anygram, GramStyleDialog } from '../src/index.js';

/** Follow's dialog fields are available through either migration alias. */
export async function archivedGroups(
  client: Anygram
): Promise<GramStyleDialog[]> {
  const groups: GramStyleDialog[] = [];
  for await (const dialog of client.teleproto.iterDialogs({ folderId: 1 })) {
    if (dialog.isGroup || dialog.isChannel) {
      const peer = await client.gramjs.getInputEntity(dialog.entity);
      if (peer.className === 'InputPeerChannel') {
        // Schema-dependent fields remain unknown until narrowed by the caller.
        if (typeof peer.accessHash !== 'bigint') {
          throw new TypeError('Missing exact channel access hash');
        }
      }
      groups.push(dialog);
    }
  }
  return groups;
}
