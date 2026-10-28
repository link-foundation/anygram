export interface SessionStore {
  load(): Promise<string>;
  save(session: string): Promise<void>;
}
export declare class FileSessionStore implements SessionStore {
  constructor(path: string);
  path: string;
  load(): Promise<string>;
  save(session: string): Promise<void>;
}
