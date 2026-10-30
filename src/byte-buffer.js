/** Contiguous receive buffer with geometric growth and a strict capacity limit. */
export class ByteBuffer {
  #storage = Buffer.alloc(0);
  #start = 0;
  #end = 0;
  constructor(limit) {
    this.limit = limit;
  }
  get bytes() {
    return this.#storage.subarray(this.#start, this.#end);
  }
  get length() {
    return this.#end - this.#start;
  }
  append(bytes) {
    const length = this.length + bytes.byteLength;
    if (length > this.limit) {
      throw new RangeError('Buffered byte limit exceeded');
    }
    if (this.#storage.length - this.#end < bytes.byteLength) {
      this.reserve(length);
    }
    this.#storage.set(bytes, this.#end);
    this.#end += bytes.byteLength;
  }
  reserve(length) {
    let storage = this.#storage;
    if (length > storage.length) {
      const capacity = Math.min(
        this.limit,
        Math.max(1024, length, storage.length * 2)
      );
      storage = Buffer.allocUnsafe(capacity);
    }
    this.#storage.copy(storage, 0, this.#start, this.#end);
    this.#end = this.length;
    this.#start = 0;
    this.#storage = storage;
  }
  discard(length) {
    if (!Number.isSafeInteger(length) || length < 0 || length > this.length) {
      throw new RangeError('Invalid buffered byte consumption');
    }
    this.#start += length;
    if (this.#start === this.#end) {
      this.#start = this.#end = 0;
      // Do not keep a maximum-size allocation alive for an idle connection.
      if (this.#storage.length > 64 * 1024) {
        this.#storage = Buffer.alloc(0);
      }
    }
  }
}
