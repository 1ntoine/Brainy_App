import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { readJson, writeJson, newId, env } from "../shared/util.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = env.notificationsPort;

let reminders = readJson("notifications", "reminders.json", []);
let history = readJson("notifications", "history.json", []);
const clients = new Set();

function save() {
  writeJson("notifications", "reminders.json", reminders);
  writeJson("notifications", "history.json", history.slice(-500));
}

app.use((req, res, next) => {
  if (req.path.startsWith("/api/notifications/stream")) {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  next();
});

function broadcast(notification) {
  const payload = `data: ${JSON.stringify(notification)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

app.get("/api/notifications", (req, res) => {
  res.json(history.slice(-100).reverse());
});

app.post("/api/notifications/notify", (req, res) => {
  const { title, body, kind } = req.body || {};
  if (!title) return res.status(400).json({ error: "title requis" });
  const notification = {
    id: newId("n"),
    kind: kind || "info",
    title,
    body: body || "",
    at: new Date().toISOString(),
    read: false,
  };
  history.push(notification);
  save();
  broadcast(notification);
  res.status(201).json(notification);
});

app.post("/api/notifications/reminders", (req, res) => {
  const { taskId, title, dueAt, priority } = req.body || {};
  if (!taskId || !title) return res.status(400).json({ error: "taskId et title requis" });

  reminders = reminders.filter((r) => r.taskId !== taskId);

  const created = [];
  if (dueAt) {
    const due = dayjs(dueAt);
    if (due.isAfter(dayjs())) {
      created.push({ id: newId("r"), taskId, title, at: due.subtract(1, "day").toISOString(), kind: "rappel-j24", status: "pending" });
      created.push({ id: newId("r"), taskId, title, at: due.hour(8).minute(30).toISOString(), kind: "rappel-matin", status: "pending" });
      created.push({ id: newId("r"), taskId, title, at: due.toISOString(), kind: "echeance", status: "pending" });
    }
  } else {
    created.push({ id: newId("r"), taskId, title, at: dayjs().add(1, "day").hour(8).minute(30).toISOString(), kind: "suivi", status: "pending" });
  }

  reminders.push(...created.filter((r) => dayjs(r.at).isAfter(dayjs())));
  save();
  res.status(201).json(created);
});

app.delete("/api/notifications/reminders/task/:taskId", (req, res) => {
  reminders = reminders.filter((r) => r.taskId !== req.params.taskId);
  save();
  res.json({ ok: true });
});

function pushNotification(kind, title, body) {
  const notification = { id: newId("n"), kind, title, body: body || "", at: new Date().toISOString(), read: false };
  history.push(notification);
  broadcast(notification);
}

const TICK_MS = 30_000;
setInterval(() => {
  const now = dayjs();
  let changed = false;
  for (const reminder of reminders) {
    if (reminder.status !== "pending") continue;
    if (dayjs(reminder.at).isAfter(now)) continue;
    reminder.status = "sent";
    changed = true;
    pushNotification(reminder.kind, `⏰ ${reminder.title}`, reminder.kind === "echeance" ? "Échéance atteinte." : "Rappel de suivi de tâche.");
  }
  if (changed) save();
}, TICK_MS);

app.listen(PORT, () => {
  console.log(`[notifications] prêt sur http://localhost:${PORT}`);
});
