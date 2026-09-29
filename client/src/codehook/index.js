/**
 * Client for both directions of Looper automation:
 *   `Looper.automation.codeHook(uri, params, …)` — code calls an agent.
 *   `Looper.automation.listen(id, handler, …)`   — an agent pushes into code.
 * Materialized on disk by Looper for this repo — part of the project, meant
 * to be committed alongside the code that imports it. Never published to any
 * registry; Looper rewrites it on demand, so local edits will be overwritten.
 */
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 300000;
const TERMINAL_STATUSES = ["succeeded","failed","cancelled"];
const LISTEN_BACKOFF_MS = [1000,2000,5000,10000,30000];
const LISTEN_STREAM_FAILURES_BEFORE_POLL = 3;
const LISTEN_POLL_WAIT_MS = 25000;
const LISTEN_RECONNECT_FLOOR_MS = 250;

// Subscription URL for one code listener. The token rides in the auth header
// rather than the path — URLs end up in proxy and browser logs — so the route's
// token segment carries a placeholder the backend ignores once the header is
// present.
function listenerUrl(id, kind, cursor, options, wait) {
  const base = options.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL('/api/agents/code-listener/header-auth/' + encodeURIComponent(id) + '/' + kind, base);
  url.searchParams.set('devSessionId', options.devSessionId);
  if (cursor) url.searchParams.set('cursor', String(cursor));
  if (wait) url.searchParams.set('wait', String(wait));
  return url.toString();
}

// The session's agent token, read from wherever this runtime keeps env vars.
// Looper puts the value in every runner it starts under each of these names
// (`codeListenerRunnerEnv`), because bundlers only forward prefixed vars into
// browser code: Vite exposes `VITE_*` on `import.meta.env`, CRA `REACT_APP_*`
// and Next.js `NEXT_PUBLIC_*` on `process.env`, all inlined at build time.
// Each read is wrapped because the *other* forms throw where they don't apply
// (`process` is undefined in a Vite bundle) — that, not the transport, is what
// used to take a browser app down at module evaluation.
function readEnv(read) {
  try { return read() || ''; } catch (_) { return ''; }
}
function resolveAgentToken() {
  return readEnv(() => process.env.LOOPER_AGENT_TOKEN)
    || readEnv(() => import.meta.env.VITE_LOOPER_AGENT_TOKEN)
    || readEnv(() => process.env.REACT_APP_LOOPER_AGENT_TOKEN)
    || readEnv(() => process.env.NEXT_PUBLIC_LOOPER_AGENT_TOKEN)
    || undefined;
}

// Code-hook auth token for one hook. A trigger with Authentication on checks
// its own per-agent secret, not the listener token above, so Looper hands each
// runner a JSON map `{"<agentId>/<hookId>": token}` (`LOOPER_CODE_HOOK_TOKENS`,
// same four forms) and the hook is looked up from its URL path. Literal env
// references only — Next.js inlines nothing else.
function readHookTokens() {
  const raw = readEnv(() => process.env.LOOPER_CODE_HOOK_TOKENS)
    || readEnv(() => import.meta.env.VITE_LOOPER_CODE_HOOK_TOKENS)
    || readEnv(() => process.env.REACT_APP_LOOPER_CODE_HOOK_TOKENS)
    || readEnv(() => process.env.NEXT_PUBLIC_LOOPER_CODE_HOOK_TOKENS);
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch (_) { return {}; }
}
function resolveHookToken(target) {
  const m = /\/api\/agents\/([^/?#]+)\/code-hook\/[^/?#]+\/([^/?#]+)/.exec(target);
  if (!m) return undefined;
  const key = decodeURIComponent(m[1]) + '/' + decodeURIComponent(m[2]);
  return readHookTokens()[key] || undefined;
}

// Where code-hook calls go. Snippets carry only a relative path, and Looper
// sets this per runner: the dev Looper backend locally, the app's own public
// address once published (its gateway serves the same path). Same four-form
// read as the token, for the same bundler reason.
function resolveHookOrigin() {
  return readEnv(() => process.env.LOOPER_CODE_HOOK_ORIGIN)
    || readEnv(() => import.meta.env.VITE_LOOPER_CODE_HOOK_ORIGIN)
    || readEnv(() => process.env.REACT_APP_LOOPER_CODE_HOOK_ORIGIN)
    || readEnv(() => process.env.NEXT_PUBLIC_LOOPER_CODE_HOOK_ORIGIN)
    || '';
}

// Absolute URIs (older snippets) pass through unchanged; a relative one is
// resolved against `options.origin`, then the env origin, then the page.
function resolveHookUri(uri, options) {
  if (uri.indexOf('://') !== -1) return uri;
  const base = (options && options.origin) || resolveHookOrigin()
    || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) throw new Error('Looper code hook: set LOOPER_CODE_HOOK_ORIGIN or pass options.origin outside the browser');
  return new URL(uri, base).toString();
}

function sleep(ms, state) {
  return new Promise((resolve) => { state.sleepTimer = setTimeout(resolve, ms); });
}

// Derives the run-status URL from the trigger URL by swapping its trailing
// hookId path segment for `runs/<runId>` — same origin/id/token, so it reuses
// the trigger URL's own auth instead of requiring a second credential.
function runStatusUrl(triggerUri, runId) {
  const url = new URL(triggerUri, typeof window !== 'undefined' ? window.location.href : undefined);
  const parts = url.pathname.split('/').filter(Boolean);
  parts.pop();
  parts.push('runs', runId);
  url.pathname = '/' + parts.join('/');
  return url.toString();
}

// Reads a JSON body, turning the two ways a wrong URL shows up — a non-JSON
// (often empty) body, or an HTTP error without a JSON `error` — into one
// readable Error instead of a bare "Unexpected end of JSON input". The usual
// cause is a snippet pointing at the frontend dev server (no /api there)
// instead of the Looper backend.
function readJson(res) {
  return res.text().then((text) => {
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    if (data && typeof data === 'object') {
      if (!res.ok && !data.error) data.error = 'HTTP ' + res.status;
      return data;
    }
    throw new Error(
      'Looper code hook: HTTP ' + res.status + ' from ' + res.url +
      ' with ' + (text ? 'a non-JSON' : 'an empty') + ' body. The URL must point at the Looper backend (API) origin, not the frontend dev server.',
    );
  });
}

function pollRun(triggerUri, runId, onPoll, onComplete, deadline, headers) {
  fetch(runStatusUrl(triggerUri, runId), { headers: headers || {} })
    .then(readJson)
    .then((run) => {
      // A JSON error with no status (404 unknown run, rotated token, …) is
      // final — there is nothing to keep polling for.
      if (run.error && !run.status) {
        onComplete(new Error(run.error), null);
        return;
      }
      if (onPoll) onPoll(null, run);
      if (TERMINAL_STATUSES.indexOf(run.status) === -1) {
        if (Date.now() > deadline) {
          onComplete(new Error('Timed out waiting for the code-hook run to finish'), null);
          return;
        }
        setTimeout(() => pollRun(triggerUri, runId, onPoll, onComplete, deadline, headers), POLL_INTERVAL_MS);
        return;
      }
      if (run.status === 'succeeded') onComplete(null, run.output);
      else onComplete(new Error(run.error || ('Run ' + run.status)), null);
    })
    .catch((err) => {
      if (onPoll) onPoll(err, null);
    });
}

export const Looper = {
  automation: {
    /**
     * Fires a code_hook trigger. `onPoll(err, run)` fires once the run is
     * queued, then again on every subsequent status check while it's running
     * (roughly once a second) — it's a progress callback, not the flow's
     * result. Pass `onComplete(err, result)` to be notified exactly once,
     * when the run reaches a terminal state.
     *
     * `uri` is normally the relative `/api/agents/…/code-hook/…` path; it is
     * resolved against `options.origin`, else `LOOPER_CODE_HOOK_ORIGIN` (or its
     * bundler-prefixed form), else the page origin. Absolute URLs still work.
     *
     * `options` is optional: `{ token, headerName }` sends the hook's token
     * on the request when its trigger requires header auth (default header
     * `X-Looper-Agent-Token`). `token` is read from the environment
     * when omitted — this hook's entry in `LOOPER_CODE_HOOK_TOKENS` (or its
     * bundler-prefixed form), which Looper fills in — so never hard-code it.
     *
     * `options.headers` adds extra request headers, for a trigger that reads
     * them as `{{trigger.headers.*}}`. They apply to the trigger request only
     * (status polling sends auth alone) and can never overwrite the auth header.
     */
    codeHook(uri, params, onPoll, onComplete, options) {
      let target;
      try {
        target = resolveHookUri(uri, options);
      } catch (err) {
        onPoll(err, null);
        return;
      }
      // The hook's own token first; the listener token stays as the fallback
      // so a hook without Authentication behaves exactly as before.
      const token = (options && options.token) || resolveHookToken(target) || resolveAgentToken();
      const authHeaders = token
        ? { [(options && options.headerName) || 'X-Looper-Agent-Token']: token }
        : {};
      const extraHeaders = (options && options.headers) || {};
      fetch(target, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders, authHeaders),
        body: JSON.stringify({ params }),
      })
        .then(readJson)
        .then((data) => {
          if (data.error) {
            onPoll(new Error(data.error), null);
            return;
          }
          onPoll(null, data);
          if (onComplete) pollRun(target, data.runId, onPoll, onComplete, Date.now() + POLL_TIMEOUT_MS, authHeaders);
        })
        .catch((err) => onPoll(err, null));
    },

    /**
     * Subscribes to a Looper **code listener** — the agent→code direction.
     * `handler(event)` runs for every value an agent's `output` node publishes
     * to `id`, where event is `{ id, payload, seq, missed }` (`payload` is
     * whatever the node sent, as a string; `missed` is how many events aged out
     * of the backend's replay buffer before this one).
     *
     * Returns an **unsubscribe function**. Nothing here throws into your stack:
     * connection problems go to `options.onError`, and the client keeps
     * reconnecting with backoff, resuming from the last event it saw.
     *
     * `options`: `{ devSessionId, origin, token, headerName, transport, onError }`.
     * `devSessionId` is required. The origin comes from `LOOPER_CODE_HOOK_ORIGIN`
     * (or its bundler-prefixed form) first, then `options.origin`, then the page:
     * Looper sets the env var to the dev backend locally and to the app's own
     * public address once published, so the env wins over an origin an older
     * snippet hard-coded (C1). `token` is read from the environment when
     * omitted — `LOOPER_AGENT_TOKEN` in Node, `VITE_`/`REACT_APP_`/`NEXT_PUBLIC_`
     * prefixed in a browser build — never hard-code it, this file is committed.
     * `transport: 'poll'` skips SSE for runtimes or proxies that cannot hold a
     * stream open.
     */
    listen(id, handler, options) {
      const opts = options || {};
      const onError = (opts.onError) || function () {};
      // Env first (C1): older snippets baked the dev origin into options.origin,
      // which must not win once the app is published.
      const base = resolveHookOrigin() || opts.origin
        || (typeof window !== 'undefined' ? window.location.origin : '');
      if (!base) {
        onError(new Error('Looper code listener: set LOOPER_CODE_HOOK_ORIGIN or pass options.origin outside the browser'));
        return function () {};
      }
      if (!opts.devSessionId) {
        onError(new Error('Looper code listener: options.devSessionId is required'));
        return function () {};
      }
      const settings = { origin: base, devSessionId: opts.devSessionId };
      const token = opts.token || resolveAgentToken();
      const headers = token
        ? { [opts.headerName || 'X-Looper-Agent-Token']: token }
        : {};
      const state = { stopped: false, cursor: 0, failures: 0, abort: null, sleepTimer: null };

      // Events arrive twice whenever a reconnect replays the buffer, so the
      // cursor is also the de-duplicator — the handler only ever sees each seq
      // once. A handler that throws is the caller's bug, not a connection
      // problem, but it must not kill the subscription either.
      const deliver = (event) => {
        if (state.stopped || !event || typeof event.seq !== 'number' || event.seq <= state.cursor) return;
        state.cursor = event.seq;
        try { handler(event); } catch (err) { onError(err); }
      };

      // A frame with data is an event; a frame with only an `id:` line is the
      // server's handshake — the current seq, adopted as the cursor so the next
      // reconnect resumes from "now" instead of starting fresh again. The id is
      // read only on data-less frames: on an event frame it equals the event's
      // seq, and adopting it first would make `deliver` drop that very event.
      const adoptCursor = (seq) => {
        if (typeof seq === 'number' && seq > state.cursor) state.cursor = seq;
      };
      const readFrame = (frame) => {
        let id = null;
        let hadData = false;
        frame.split('\n').forEach((line) => {
          if (line.indexOf('id:') === 0) { id = Number.parseInt(line.slice(3).trim(), 10); return; }
          if (line.indexOf('data:') !== 0) return; // ': ping' heartbeats
          hadData = true;
          try { deliver(JSON.parse(line.slice(5).trim())); } catch (err) { onError(err); }
        });
        if (!hadData && id !== null && Number.isFinite(id)) adoptCursor(id);
      };

      const failed = async (res) => {
        const data = await readJson(res).catch((err) => ({ error: err.message }));
        return new Error(data.error || ('Looper code listener: HTTP ' + res.status));
      };

      const streamOnce = async () => {
        const controller = new AbortController();
        state.abort = controller;
        const res = await fetch(listenerUrl(id, 'stream', state.cursor, settings), { headers, signal: controller.signal });
        if (!res.ok || !res.body) throw await failed(res);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) return; // Server closed — a clean end, not a failure.
          buffer += decoder.decode(chunk.value, { stream: true });
          let split = buffer.indexOf('\n\n');
          while (split !== -1) {
            readFrame(buffer.slice(0, split));
            buffer = buffer.slice(split + 2);
            split = buffer.indexOf('\n\n');
          }
        }
      };

      const pollOnce = async () => {
        const controller = new AbortController();
        state.abort = controller;
        const res = await fetch(listenerUrl(id, 'next', state.cursor, settings, LISTEN_POLL_WAIT_MS), { headers, signal: controller.signal });
        const data = await readJson(res);
        if (data.error) throw new Error(data.error);
        (data.events || []).forEach(deliver);
        adoptCursor(data.cursor); // first poll is a handshake: `{ events: [], cursor }`
      };

      const loop = async () => {
        while (!state.stopped) {
          try {
            if (opts.transport === 'poll' || state.failures >= LISTEN_STREAM_FAILURES_BEFORE_POLL) await pollOnce();
            else await streamOnce();
            state.failures = 0;
            await sleep(LISTEN_RECONNECT_FLOOR_MS, state);
          } catch (err) {
            if (state.stopped) return; // The abort we asked for, not a fault.
            state.failures += 1;
            onError(err);
            await sleep(LISTEN_BACKOFF_MS[Math.min(state.failures - 1, LISTEN_BACKOFF_MS.length - 1)], state);
          }
        }
      };
      loop();

      return function () {
        state.stopped = true;
        if (state.sleepTimer) clearTimeout(state.sleepTimer);
        if (state.abort) { try { state.abort.abort(); } catch (_) { /* already gone */ } }
      };
    },
  },
};
