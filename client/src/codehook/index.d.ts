/** Typings for the Looper automation client in index.js — rewritten by Looper, do not edit. */
export interface LooperCodeHookOptions {
  token?: string;
  headerName?: string;
  headers?: Record<string, string>;
  origin?: string;
}
export interface LooperListenOptions {
  devSessionId: string;
  token?: string;
  headerName?: string;
  origin?: string;
  transport?: 'sse' | 'poll';
  onError?: (err: unknown) => void;
}
export declare const Looper: {
  automation: {
    codeHook(
      uri: string,
      params?: Record<string, unknown>,
      onPoll?: (err: Error | null, run: any) => void,
      onComplete?: (err: Error | null, result: any) => void,
      options?: LooperCodeHookOptions,
    ): void;
    listen(id: string, handler: (event: any) => void, options: LooperListenOptions): () => void;
  };
};
