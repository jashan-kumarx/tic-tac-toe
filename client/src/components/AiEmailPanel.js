import React, { useEffect, useState } from "react";
import { Looper } from "../codehook/index.js";
import { isValidEmail, describeHint, describeApiError } from "../lib/integrations.mjs";

// Test · 32 — code hook → LLM recap → Gmail send (see .looper/agents/a6000032-….json).
const RECAP_HOOK =
  "/api/agents/a6000032-0000-4000-8000-000000000032/code-hook/YOUR_HOOK_TOKEN/hook-ge-32?devSessionId=YOUR_DEV_SESSION_ID";

const LLM_LABEL = { gateway: "LLM gateway", direct: "Anthropic key (dev)", fallback: "not wired — rule-based hints" };

/**
 * AI hint + result-email controls. Hints and the direct email go through the
 * score server (/api/hint, /api/email-result), which reaches Looper's LLM
 * gateway and Gmail connector with server-side credentials; the "AI recap"
 * button runs the Test · 32 agent instead, showing the same flow as an agent.
 *
 * @param {{ squares: (string|null)[], next: "X"|"O", gameOver: boolean, result: "X"|"O"|"draw"|null, moves: number }} props
 */
const AiEmailPanel = ({ squares, next, gameOver, result, moves }) => {
  const [integrations, setIntegrations] = useState(null);
  const [hint, setHint] = useState(null); // { boardKey, text }
  const [hintBusy, setHintBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sendState, setSendState] = useState(null); // { kind: "ok"|"error"|"busy", text }
  const boardKey = squares.map((s) => s || ".").join("");

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setIntegrations(body || { error: true }))
      .catch(() => setIntegrations({ error: true }));
  }, []);

  // A new game clears the last send result so it isn't mistaken for this one.
  useEffect(() => {
    if (!gameOver) setSendState(null);
  }, [gameOver]);

  const askHint = async () => {
    setHintBusy(true);
    const key = boardKey;
    try {
      const r = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squares, next }),
      });
      const body = await r.json().catch(() => null);
      setHint({ boardKey: key, text: r.ok ? describeHint(body) : describeApiError(body, "Hint failed.") });
    } catch {
      setHint({ boardKey: key, text: "Hint failed — is the score server running?" });
    } finally {
      setHintBusy(false);
    }
  };

  const emailOk = isValidEmail(email);
  const canSend = gameOver && emailOk && sendState?.kind !== "busy";

  const sendDirect = async () => {
    setSendState({ kind: "busy", text: "Sending…" });
    try {
      const r = await fetch("/api/email-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email.trim(), winner: result, moves }),
      });
      const body = await r.json().catch(() => null);
      setSendState(r.ok ? { kind: "ok", text: `Result emailed to ${email.trim()}.` } : { kind: "error", text: describeApiError(body, "Email failed.") });
    } catch {
      setSendState({ kind: "error", text: "Email failed — is the score server running?" });
    }
  };

  const sendViaAgent = () => {
    setSendState({ kind: "busy", text: "Agent is writing the recap…" });
    Looper.automation.codeHook(
      RECAP_HOOK,
      { to: email.trim(), winner: result === "draw" ? "draw" : `${result} won`, moves: String(moves) },
      (err) => {
        if (err) setSendState({ kind: "error", text: `Agent failed to start: ${err.message || err}` });
      },
      (err, reply) => {
        if (err) return setSendState({ kind: "error", text: `Agent failed: ${err.message || err}` });
        setSendState({ kind: "ok", text: typeof reply === "string" ? reply : JSON.stringify(reply) });
      }
    );
  };

  const hintText = hint && hint.boardKey === boardKey ? hint.text : null;

  return (
    <div className="ai-panel" data-cmp="game.ai-panel_wrap">
      <div className="ai-panel-head" data-cmp="game.ai-head_row">
        <span className="ai-panel-title" data-cmp="game.ai-title_text">AI &amp; email</span>
        <div className="ai-panel-status" data-cmp="game.ai-status_row">
          {integrations === null ? (
            <span className="ai-badge" data-cmp="game.ai-status_loading">Checking integrations…</span>
          ) : integrations.error ? (
            <span className="ai-badge ai-badge-warn" data-cmp="game.ai-status_error">Integrations unknown</span>
          ) : (
            <>
              <span className={`ai-badge ${integrations.llm === "fallback" ? "ai-badge-warn" : "ai-badge-ok"}`} data-cmp="game.ai-status-llm_badge">
                LLM: {LLM_LABEL[integrations.llm] || integrations.llm}
              </span>
              <span className={`ai-badge ${integrations.gmail ? "ai-badge-ok" : "ai-badge-warn"}`} data-cmp="game.ai-status-gmail_badge">
                Gmail: {integrations.gmail ? "connected" : "not bound"}
              </span>
            </>
          )}
        </div>
      </div>

      <button className="ai-button" data-cmp="game.ai-hint_button" onClick={askHint} disabled={gameOver || hintBusy}>
        {hintBusy ? "Thinking…" : `Get AI hint for ${next}`}
      </button>
      {hintText && (
        <p className="ai-hint" data-cmp="game.ai-hint_text">{hintText}</p>
      )}

      <div className="ai-email" data-cmp="game.ai-email_wrap">
        <label className="ai-email-label" htmlFor="ai-email-input" data-cmp="game.ai-email_label">
          Send the result to
        </label>
        <input
          id="ai-email-input"
          className="ai-email-input"
          data-cmp="game.ai-email_input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="ai-email-actions" data-cmp="game.ai-email-actions_row">
          <button className="ai-button" data-cmp="game.ai-email-direct_button" onClick={sendDirect} disabled={!canSend} title="The app's own server sends a fixed result email via the Gmail connection">
            Email result
          </button>
          <button className="ai-button ai-button-alt" data-cmp="game.ai-email-agent_button" onClick={sendViaAgent} disabled={!canSend} title="Runs the Test 32 agent: an AI step writes a recap, then its Gmail step sends it">
            Email AI recap
          </button>
        </div>
        {!gameOver && (
          <p className="ai-note" data-cmp="game.ai-email_note">Finish a game to email its result.</p>
        )}
        {gameOver && email && !emailOk && (
          <p className="ai-note ai-note-error" data-cmp="game.ai-email-invalid_text">Enter a single valid email address.</p>
        )}
        {sendState && (
          <p className={`ai-note ${sendState.kind === "error" ? "ai-note-error" : sendState.kind === "ok" ? "ai-note-ok" : "ai-note-busy"}`} data-cmp="game.ai-email-status_text">
            {sendState.text}
          </p>
        )}
      </div>
    </div>
  );
};

export default AiEmailPanel;
