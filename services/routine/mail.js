import { ImapFlow } from "imapflow";
import { env } from "../shared/util.js";
import { getAccessToken, oauthConfigured } from "./auth.js";

export function mailConfigured() {
  const basicAuth = env.imap.host && env.imap.user && env.imap.pass;
  return Boolean(basicAuth || (env.imap.host && env.imap.user && oauthConfigured()));
}

function decode(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.text) return value.text;
  return String(value);
}

export async function fetchRecentMails({ sinceHours = 24, limit = 50 } = {}) {
  if (!mailConfigured()) {
    return { configured: false, mails: [] };
  }
  let accessToken = null;
if (!env.imap.pass) {
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    return { configured: true, error: err.message, mails: [] };
  }
}
const auth = env.imap.pass
  ? { user: env.imap.user, pass: env.imap.pass }
  : { user: env.imap.user, accessToken };

const client = new ImapFlow({
  host: env.imap.host,
  port: env.imap.port,
  secure: env.imap.tls,
  auth,
  logger: false,
});

  const since = new Date(Date.now() - sinceHours * 3600 * 1000);
  const mails = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(env.imap.folder);
    try {
      const found = await client.search({ since });
      const uids = (found || []).slice(-limit);
      for await (const msg of client.fetch(uids, { envelope: true, flags: true, bodyStructure: false, internalDate: true })) {
        const envelope = msg.envelope || {};
        mails.push({
          uid: msg.uid,
          subject: decode(envelope.subject) || "(sans objet)",
          from: envelope.from?.[0] ? `${decode(envelope.from[0].name) || ""} <${envelope.from[0].address || ""}>`.trim() : "inconnu",
          fromAddress: envelope.from?.[0]?.address || "",
          date: (msg.internalDate || new Date()).toISOString(),
          seen: (msg.flags || new Set()).has("\\Seen"),
        });
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    return { configured: true, error: err.message, mails };
  }

  return { configured: true, mails };
}


