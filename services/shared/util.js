import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

for (const line of loadEnvFile()) {
  if (!(line.key in process.env)) process.env[line.key] = line.value;
}

function loadEnvFile() {
  const out = [];
  try {
    const content = fs.readFileSync(path.join(root, ".env"), "utf8");
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      out.push({ key, value });
    }
  } catch {
    /* pas de fichier .env : valeurs par défaut */
  }
  return out;
}

export const env = {
  gatewayPort: Number(process.env.GATEWAY_PORT || 4000),
  tasksPort: Number(process.env.TASKS_PORT || 4001),
  calendarPort: Number(process.env.CALENDAR_PORT || 4002),
  notificationsPort: Number(process.env.NOTIFICATIONS_PORT || 4003),
  routinePort: Number(process.env.ROUTINE_PORT || 4004),
  routineTime: process.env.ROUTINE_TIME || "07:00",
  weatherCity: process.env.WEATHER_CITY || "Paris",
  imap: {
    host: process.env.IMAP_HOST || "",
    port: Number(process.env.IMAP_PORT || 993),
    user: process.env.IMAP_USER || "",
    pass: process.env.IMAP_PASS || "",
    tls: (process.env.IMAP_TLS || "true") !== "false",
    folder: process.env.IMAP_FOLDER || "INBOX",
  },
};

export function dataDir(service) {
  const dir = path.join(root, "data", service);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(service, name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir(service), name), "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(service, name, value) {
  const file = path.join(dataDir(service), name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function serviceUrl(port) {
  return `http://localhost:${port}`;
}

export async function callService(port, method, urlPath, body) {
  const res = await fetch(`${serviceUrl(port)}${urlPath}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

let counter = 0;
export function newId(prefix) {
  counter = (counter + 1) % 10000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
