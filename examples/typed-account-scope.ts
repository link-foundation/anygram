import type { Anygram } from '../src/index.js';

/** Login, perform account work and await cleanup on the chosen backend. */
export function inspectGroups(
  client: Anygram,
  phoneNumber: string,
  phoneCode: () => Promise<string>,
  signal?: AbortSignal
): Promise<{ me: unknown; groups: bigint[] }> {
  return client.withConnection(
    async (connected) => {
      const me = await connected.getMe();
      const groups: bigint[] = [];
      for await (const entry of connected.iterDialogs({ signal })) {
        if (entry.entity._ === 'channel' || entry.entity._ === 'chat') {
          groups.push(entry.entity.id as bigint);
        }
      }
      return { me, groups };
    },
    {
      start: { phoneNumber, phoneCode },
      signal,
      cleanupAttempts: 3,
      cleanupDelay: 100,
    }
  );
}
