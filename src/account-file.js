const attributes = {
  name: [['documentAttributeFilename'], 'fileName'],
  width: [['documentAttributeImageSize', 'documentAttributeVideo'], 'w'],
  height: [['documentAttributeImageSize', 'documentAttributeVideo'], 'h'],
  duration: [['documentAttributeAudio', 'documentAttributeVideo'], 'duration'],
  title: [['documentAttributeAudio'], 'title'],
  performer: [['documentAttributeAudio'], 'performer'],
  emoji: [['documentAttributeSticker'], 'alt'],
  stickerSet: [['documentAttributeSticker'], 'stickerset'],
};

/** Derived metadata over detached message media, without a vendor runtime. */
export class AccountFile {
  constructor(media) {
    this.media = media;
  }
  get id() {
    throw new Error('Unsupported');
  }
  get mimeType() {
    return this.media._ === 'photo' ? 'image/jpeg' : this.media.mimeType;
  }
  get size() {
    if (this.media._ === 'document') {
      return this.media.size;
    }
    const size = this.media.sizes?.at(-1);
    switch (size?._) {
      case 'photoSize':
        return size.size;
      case 'photoSizeEmpty':
        return 0;
      case 'photoCachedSize':
        return size.bytes.length;
      case 'photoStrippedSize':
        return (
          size.bytes.length +
          (size.bytes.length >= 3 && size.bytes[0] === 1 ? 622 : 0)
        );
      case 'photoSizeProgressive':
        return size.sizes.at(-1);
      default:
        return undefined;
    }
  }
}

for (const [name, [types, field]] of Object.entries(attributes)) {
  Object.defineProperty(AccountFile.prototype, name, {
    get() {
      return this.media.attributes?.find((entry) => types.includes(entry._))?.[
        field
      ];
    },
  });
}
