import type * as Original from '@grammyjs/types';
import type { Telegram } from '../src/index.js';

// General wire models preserve their historical permissive shapes.
declare const wire: Telegram.RichText;
// @ts-expect-error Wire rich text is broader than the SDK-discriminated union.
export const originalWire: Original.RichText = wire;

// Named rich components refine both recursive date formats and button actions.
declare const named: Telegram.RichMessageButton.AbstractRichMessageButton;
export const originalNamed: Original.RichMessageButton.AbstractRichMessageButton =
  named;
declare const sdk: Original.RichMessageButton.AbstractRichMessageButton;
export const ownedNamed: Telegram.RichMessageButton.AbstractRichMessageButton =
  sdk;
