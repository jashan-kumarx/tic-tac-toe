/**
 * Game-result emails through Looper's connectors door.
 *
 * A published app never holds the Gmail OAuth token. Binding the `gmail` alias
 * in Production → Config → Connections makes Looper inject
 * LOOPER_CONNECTORS_URL + LOOPER_CONNECTORS_TOKEN; the app POSTs
 * { alias, action, params } to `${LOOPER_CONNECTORS_URL}/call` and Looper makes
 * the Gmail call with the connected mailbox's credentials.
 */

const GMAIL_ALIAS = "gmail";
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

/** A single bare address; rejects lists and display-name forms. */
function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

/** Header values must stay on one line, or a caller could inject Bcc: etc. */
function headerSafe(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047-encode a non-ASCII subject so Gmail shows it correctly. */
function encodeSubject(subject) {
  const safe = headerSafe(subject);
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(safe) ? safe : `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

/** Compose the RFC 822 message the gmail_send_message action expects. */
function buildRawMessage({ to, subject, body }) {
  return [
    `To: ${headerSafe(to)}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    String(body).replace(/\r?\n/g, "\r\n"),
  ].join("\r\n");
}

/** Plain-text summary of a finished game. */
function resultEmail({ winner, moves }) {
  const headline = winner === "draw" ? "It's a draw!" : `${winner} wins!`;
  const count = Number.isInteger(moves) && moves >= 0 ? moves : null;
  return {
    subject: `Tic Tac Toe — ${headline}`,
    body: `${headline}\n${count !== null ? `The game took ${count} moves.\n` : ""}\nSent by the Tic Tac Toe app through Looper's Gmail connector.`,
  };
}

/** Whether the connectors door is wired for this process. */
function connectorsConfigured(env) {
  return Boolean(env.LOOPER_CONNECTORS_URL && env.LOOPER_CONNECTORS_TOKEN);
}

/**
 * Call one connector action through the door.
 * @returns {Promise<unknown>} the action result
 * @throws Error with `.status` (HTTP status to relay) on any failure
 */
async function callConnector(alias, action, params, { env = process.env, fetchImpl = fetch } = {}) {
  if (!connectorsConfigured(env)) {
    const err = new Error("Connectors are not wired — bind the gmail alias in Production → Config → Connections and publish.");
    err.status = 503;
    throw err;
  }
  const res = await fetchImpl(`${env.LOOPER_CONNECTORS_URL.replace(/\/+$/, "")}/call`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.LOOPER_CONNECTORS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ alias, action, params }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    const err = new Error((data && data.error) || `connector call failed (${res.status})`);
    err.status = res.ok ? 502 : res.status;
    err.code = data && data.errorCode;
    throw err;
  }
  return data.result;
}

/** Send the result email from the bound Gmail mailbox. */
function sendResultEmail({ to, winner, moves }, opts) {
  const { subject, body } = resultEmail({ winner, moves });
  return callConnector(GMAIL_ALIAS, "gmail_send_message", { raw_message: buildRawMessage({ to, subject, body }) }, opts);
}

module.exports = {
  GMAIL_ALIAS,
  isValidEmail,
  headerSafe,
  encodeSubject,
  buildRawMessage,
  resultEmail,
  connectorsConfigured,
  callConnector,
  sendResultEmail,
};
