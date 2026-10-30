/** Random-access local file, shared by bounded readers and account uploads. */
export async function localFileSource(path) {
  const { open } = await import('node:fs/promises');
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    return {
      size,
      name: path.split(/[\\/]/).at(-1),
      read: async (offset, length) => {
        const buffer = Buffer.alloc(length);
        let bytesRead = 0;
        while (bytesRead < length) {
          const chunk = await handle.read(
            buffer,
            bytesRead,
            length - bytesRead,
            offset + bytesRead
          );
          if (!chunk.bytesRead) {
            throw new Error('Upload file changed or ended unexpectedly');
          }
          bytesRead += chunk.bytesRead;
        }
        return buffer;
      },
      close: () => handle.close(),
    };
  } catch (error) {
    await handle.close();
    throw error;
  }
}
