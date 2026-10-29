import type {
  BotOptions,
  CommonContext,
  TelegrafApi,
  BotUpdate,
  PollingOptions,
  WebhookResponse,
} from './index.js';
import type { BotOther, BotApiResult } from './bot-api-types.js';
import type { TelegrafUpdateType } from './telegraf-filter-types.js';

/** Structural Node contracts also accept real IncomingMessage/ServerResponse. */
export interface TelegrafWebhookRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  removeListener?(event: string, listener: (...args: any[]) => void): this;
}
export interface TelegrafWebhookResponse extends WebhookResponse {
  statusCode: number;
  writeHead(status: number): this;
}
export type TelegrafWebhookCallback = (
  request: TelegrafWebhookRequest,
  response: TelegrafWebhookResponse,
  next?: () => void
) => Promise<void>;
export interface TelegrafWebhookOptions {
  secretToken?: string;
  /** Owned body/read deadline and byte-limit extensions. */
  timeoutMilliseconds?: number;
  maxBytes?: number;
}
export interface TelegrafFilterOptions {
  hookPath: string;
  path: string;
  secretToken?: string;
}
export interface TelegrafOptions<C extends CommonContext> extends BotOptions {
  contextType?: new (
    update: BotUpdate,
    telegram: TelegrafApi,
    botInfo: BotApiResult<'getMe'>
  ) => C;
  handlerTimeout?: number;
}
export interface TelegrafLaunchOptions extends PollingOptions {
  dropPendingUpdates?: boolean;
  allowedUpdates?: TelegrafUpdateType[];
  webhook?: {
    domain: string;
    path?: string;
    hookPath?: string;
    host?: string;
    port?: number;
    ipAddress?: string;
    maxConnections?: number;
    secretToken?: string;
    certificate?: BotOther<'setWebhook', 'url'>['certificate'];
    /** Node TLS options are passed to https.createServer without modification. */
    tlsOptions?: object;
    cb?: {
      handle(
        request: TelegrafWebhookRequest,
        response: TelegrafWebhookResponse
      ): unknown;
    }['handle'];
  };
}
export type TelegrafCreateWebhookOptions = {
  domain: string;
  path?: string;
} & BotOther<'setWebhook', 'url'>;
