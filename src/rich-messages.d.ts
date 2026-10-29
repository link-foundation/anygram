import type { Api } from './api.js';
import type { TlObject } from './api-classes.js';

/** Canonical TL values, owned classes and SDK constructors are accepted. */
export type RichNode =
  | TlObject
  | { className: string }
  | { _: string; [key: string]: unknown };
export type RichFileMap = Record<string, RichNode>;
export interface RichInputOptions {
  rtl?: boolean;
  noAutolink?: boolean;
  files?: RichFileMap;
}
export interface RichBlocksOptions {
  rtl?: boolean;
  noAutolink?: boolean;
  photos?: readonly RichNode[];
  documents?: readonly RichNode[];
  users?: readonly RichNode[];
}
export type RichSource = RichNode & { blocks: readonly RichNode[] };
export type RenderMode = 'text' | 'md' | 'html';
export declare function html(
  content: string,
  options?: RichInputOptions
): InstanceType<typeof Api.InputRichMessageHTML>;
export declare function markdown(
  content: string,
  options?: RichInputOptions
): InstanceType<typeof Api.InputRichMessageMarkdown>;
export declare function blocks(
  pageBlocks: readonly RichNode[],
  options?: RichBlocksOptions
): InstanceType<typeof Api.InputRichMessage>;
export declare function renderRichText(
  text: RichNode | undefined,
  mode?: RenderMode
): string;
export declare function renderBlocks(
  pageBlocks: readonly RichNode[],
  mode?: RenderMode
): string;
export declare function toPlainText(
  source: RichSource | readonly RichNode[]
): string;
export declare function toMarkdown(
  source: RichSource | readonly RichNode[]
): string;
export declare function toHtml(
  source: RichSource | readonly RichNode[]
): string;
