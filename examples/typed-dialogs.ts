import type { Anygram, DialogEntry, DialogOptions } from '../src/index.js';

/** Build follow's membership index across pages without rounding peer IDs. */
export async function listGroups(
  client: Anygram,
  options: DialogOptions = {}
): Promise<Map<string, DialogEntry>> {
  const groups = new Map<string, DialogEntry>();
  for await (const entry of client.iterDialogs(options)) {
    const type = entry.entity._.replace(/Forbidden$/, '');
    if (type === 'channel' || type === 'chat') {
      groups.set(`${type}:${String(entry.entity.id)}`, entry);
    }
  }
  return groups;
}

/** Apply follow's settings to an existing group using its own access hash. */
export async function muteAndArchive(
  client: Anygram,
  entry: DialogEntry,
  signal?: AbortSignal
): Promise<void> {
  await client.muteChat(entry.inputPeer, { signal });
  await client.archiveChat(entry.inputPeer, { signal });
}
