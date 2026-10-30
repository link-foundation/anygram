import type { BotUpdate } from './index.js';

export interface ReqResHandler<T = void> {
  update: BotUpdate | Promise<BotUpdate>;
  header?: string;
  end?: () => void;
  respond: (json: string) => unknown | Promise<unknown>;
  unauthorized: () => unknown | Promise<unknown>;
  handlerReturn?: Promise<T>;
}
export type FrameworkAdapter = (...args: any[]) => ReqResHandler<any>;
export interface WebhookOptions {
  onTimeout?: 'throw' | 'return' | ((...args: any[]) => unknown);
  timeoutMilliseconds?: number;
  secretToken?: string;
  maxBytes?: number;
}
type HeadersRecord = Record<string, string | undefined>;
type HeaderLookup = Pick<Headers, 'get'>;
type JsonRequest = { headers: HeaderLookup; json(): Promise<unknown> };
type FetchAdapter = (request: JsonRequest) => ReqResHandler<Response>;
interface ExpressResponse {
  end(callback?: () => void): unknown;
  set(field: string, value?: string | string[]): this;
  send(body: string): unknown;
  status(code: number): this;
}
interface FastifyResponse {
  headers(headers: Record<string, string>): this;
  code(code: number): this;
  send(body?: string): unknown;
}
interface NodeWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
}
interface NodeWebhookResponse {
  writeHead(status: number, headers?: Record<string, string>): this;
  end(body?: string): unknown;
}
type NodeAdapter = (
  request: NodeWebhookRequest,
  response: NodeWebhookResponse
) => ReqResHandler;
type LambdaEvent = { body?: string; headers: HeadersRecord };
type LambdaResult = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};
type AzureResult = { status: number; body?: string } | { jsonBody: string };

/** Dependency-free structural contracts for each supported framework entry. */
export interface WebhookFrameworkAdapters {
  callback: (
    update: BotUpdate | Promise<BotUpdate>,
    respond: (json: string) => unknown,
    header?: string,
    unauthorized?: () => unknown
  ) => ReqResHandler;
  'aws-lambda': (
    event: LambdaEvent,
    context: unknown,
    callback: (error: unknown, response: LambdaResult) => unknown
  ) => ReqResHandler;
  'aws-lambda-async': (
    event: LambdaEvent,
    context: unknown
  ) => ReqResHandler<LambdaResult>;
  azure: (
    context: {
      res?: {
        set?(name: string, value: string): unknown;
        send?(...args: any[]): unknown;
      };
    },
    request: { body?: unknown; headers?: HeadersRecord }
  ) => ReqResHandler;
  'azure-v4': (request: JsonRequest) => ReqResHandler<AzureResult>;
  bun: FetchAdapter;
  cloudflare: (event: {
    request: JsonRequest;
    respondWith(response: Promise<Response>): void;
  }) => ReqResHandler;
  'cloudflare-mod': FetchAdapter;
  elysia: (context: {
    body: unknown;
    headers: HeadersRecord;
    set: { headers: Record<string, string | number>; status?: string | number };
  }) => ReqResHandler<string>;
  express: (
    request: { body: BotUpdate; header(name: string): string | undefined },
    response: ExpressResponse
  ) => ReqResHandler;
  fastify: (
    request: { body: unknown; headers: HeadersRecord },
    response: FastifyResponse
  ) => ReqResHandler;
  hono: (context: {
    req: { json(): Promise<unknown>; header(name: string): string | undefined };
    body(body: string): Response;
    status(status: number): void;
    json(value: string): Response;
  }) => ReqResHandler<Response>;
  http: NodeAdapter;
  https: NodeAdapter;
  koa: (context: {
    get(name: string): string | undefined;
    set(name: string, value: string): void;
    status: number;
    body: string;
    request: { body?: unknown };
    response: { body: unknown; status: number };
  }) => ReqResHandler;
  'next-js': (
    request: {
      body: BotUpdate;
      headers: Record<string, string | string[] | undefined>;
    },
    response: {
      end(callback?: () => void): unknown;
      status(code: number): typeof response;
      json(json: string): unknown;
      send(json: string): unknown;
    }
  ) => ReqResHandler;
  nhttp: (request: {
    body: unknown;
    headers: HeaderLookup;
    response: {
      sendStatus(status: number): void;
      status(status: number): { send(json: string): void };
    };
  }) => ReqResHandler;
  oak: (context: {
    request: { body: { json(): Promise<BotUpdate> }; headers: HeaderLookup };
    response: { status: number; type: string | undefined; body: unknown };
  }) => ReqResHandler;
  serveHttp: (event: {
    request: JsonRequest;
    respondWith(response: Response): void;
  }) => ReqResHandler;
  'std/http': FetchAdapter;
  sveltekit: (event: { request: JsonRequest }) => ReqResHandler<Response>;
  worktop: (
    request: { json(): Promise<BotUpdate>; headers: HeaderLookup },
    response: {
      end(data: BodyInit | null): void;
      send(status: number, json: string): void;
    }
  ) => ReqResHandler;
}
export type WebhookAdapter = keyof WebhookFrameworkAdapters | FrameworkAdapter;
type ResolveAdapter<A extends WebhookAdapter> =
  A extends keyof WebhookFrameworkAdapters
    ? WebhookFrameworkAdapters[A]
    : A extends FrameworkAdapter
      ? A
      : never;
type HandlerResult<H> = H extends { handlerReturn: Promise<infer T> }
  ? T
  : H extends { handlerReturn?: Promise<infer T> }
    ? T
    : void;
export type FrameworkWebhookCallback<A extends WebhookAdapter> = (
  ...args: Parameters<ResolveAdapter<A>>
) => Promise<HandlerResult<ReturnType<ResolveAdapter<A>>>>;
