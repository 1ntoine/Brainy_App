import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, dataDir } from "../shared/util.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const TENANT = process.env.AZURE_TENANT_ID || "common";
const BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const SCOPE = "https://outlook.office.com/IMAP.AccessAsUser.All offline_access";
const TOKENS_FILE = path.join(dataDir("routine"), "tokens.json");

export function oauthConfigured() {
  return Boolean(env.azureClientId && env.imap.user);
}

function readTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeTokens(tokens) {
  fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

async function tokenRequest(params) {
  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || `Erreur token HTTP ${res.status}`);
    err.code = data.error;
    throw err;
  }
  return data;
}

async function refreshAccessToken(refreshToken) {
  const data = await tokenRequest({
    grant_type: "refresh_token",
    client_id: env.azureClientId,
    refresh_token: refreshToken,
    scope: SCOPE,
  });
  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in - 120) * 1000,
  };
  writeTokens(tokens);
  return tokens.accessToken;
}

async function deviceCodeFlow() {
  const startRes = await fetch(`${BASE}/devicecode`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.azureClientId, scope: SCOPE }),
  });
  const start = await startRes.json();
  if (!startRes.ok) {
    throw new Error(start.error_description || `Erreur device code HTTP ${startRes.status}`);
  }

  console.log("\n═══════════ CONNEXION MICROSOFT ═══════════");
  console.log(`1. Ouvrez : ${start.verification_uri}`);
  console.log(`2. Entrez le code : ${start.user_code}`);
  console.log(`   (valable ${Math.round(start.expires_in / 60)} min)`);
  console.log("═══════════════════════════════════════════\n");

  const intervalMs = (start.interval || 5) * 1000;
  const deadline = Date.now() + start.expires_in * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const data = await tokenRequest({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: env.azureClientId,
        device_code: start.device_code,
      });
      const tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in - 120) * 1000,
      };
      writeTokens(tokens);
      console.log("✅ Connexion réussie — jetons enregistrés dans", path.relative(root, TOKENS_FILE));
      return tokens.accessToken;
    } catch (err) {
      if (err.code === "authorization_pending") continue;
      if (err.code === "slow_down") {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Délai dépassé : relancez la commande pour obtenir un nouveau code");
}

export async function getAccessToken({ interactive = false } = {}) {
  if (process.env.IMAP_ACCESS_TOKEN) return process.env.IMAP_ACCESS_TOKEN;

  const tokens = readTokens();
  if (tokens?.accessToken && Date.now() < tokens.expiresAt) return tokens.accessToken;
  if (tokens?.refreshToken) {
    try {
      return await refreshAccessToken(tokens.refreshToken);
    } catch (err) {
      console.error("[routine] refresh token refusé :", err.message);
    }
  }
  if (!interactive) {
    throw new Error("Jeton OAuth absent ou expiré — lancez « npm run routine:auth » pour vous reconnecter");
  }
  return deviceCodeFlow();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!env.azureClientId) {
    console.error("AZURE_CLIENT_ID manquant dans .env — voir README, section « Boîte Microsoft (OAuth2) »");
    process.exit(1);
  }
  if (!env.imap.user) {
    console.error("IMAP_USER manquant dans .env (votre adresse mail complète)");
    process.exit(1);
  }
  getAccessToken({ interactive: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Échec :", err.message);
      process.exit(1);
    });
}