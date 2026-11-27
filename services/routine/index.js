import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import dayjsFr from "dayjs/locale/fr.js";
import { env, callService } from "../shared/util.js";

dayjs.locale(dayjsFr);
import { fetchRecentMails, mailConfigured } from "./mail.js";
import { summarizeMails } from "./summarizer.js";
import { getWeather, describeWeather } from "./weather.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = env.routinePort;
let lastBrief = null;

async function tasksPort() { return env.tasksPort; }

async function buildBrief() {
  const brief = {
    generatedAt: new Date().toISOString(),
    date: dayjs().format("dddd DD MMMM YYYY"),
    mailConfigured: mailConfigured(),
    weather: null,
    tasks: [],
    events: [],
    mails: { total: 0, unread: 0, newslettersEco: [], newslettersInfo: [], importantMails: [] },
    warnings: [],
  };

  try {
    const t = await callService(await tasksPort(), "GET", "/api/tasks");
    const today = dayjs();
    brief.tasks = (t.data || []).filter((task) => {
      if (task.status === "done") return false;
      if (!task.deadline) return task.priority >= 2;
      const d = dayjs(task.deadline);
      return d.isBefore(today.endOf("day").add(1, "day"));
    });
  } catch {
    brief.warnings.push("Service tasks indisponible");
  }

  try {
    const c = await callService(env.calendarPort, "GET", `/api/calendar/events?from=${dayjs().startOf("day").toISOString()}&to=${dayjs().endOf("day").toISOString()}`);
    brief.events = c.data || [];
  } catch {
    brief.warnings.push("Service calendrier indisponible");
  }

  try {
    const weather = await getWeather();
    brief.weather = describeWeather(weather);
    if (!weather.ok) brief.warnings.push(`Météo : ${weather.error}`);
  } catch {
    brief.warnings.push("Météo indisponible");
  }

  try {
    const mails = await fetchRecentMails({ sinceHours: 24 });
    if (mails.error) brief.warnings.push(`Mail : ${mails.error}`);
    brief.mails = summarizeMails(mails.mails);
  } catch {
    brief.warnings.push("Lecture des mails impossible");
  }

  lastBrief = brief;
  return brief;
}

app.get("/api/routine/brief", (req, res) => {
  if (req.query.refresh !== undefined) {
    buildBrief().then((brief) => res.json(brief)).catch((err) => res.status(500).json({ error: err.message }));
    return;
  }
  if (lastBrief) return res.json(lastBrief);
  buildBrief().then((brief) => res.json(brief)).catch((err) => res.status(500).json({ error: err.message }));
});

app.post("/api/routine/run", async (req, res) => {
  try {
    const brief = await buildBrief();
    try {
      const tasksCount = brief.tasks.length;
      const mailsCount = brief.mails.total;
      await callService(env.notificationsPort, "POST", "/api/notifications/notify", {
        kind: "routine",
        title: `☀️ Brief du matin — ${brief.date}`,
        body: `${tasksCount} tâche(s) aujourd'hui, ${brief.events.length} événement(s), ${mailsCount} mail(s) reçus (dont ${brief.mails.unread} non lus).`,
      });
    } catch { /* notifications indisponibles */ }
    res.json(brief);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function scheduleDaily() {
  const [h, m] = env.routineTime.split(":").map(Number);
  const now = dayjs();
  let next = now.hour(h).minute(m).second(0);
  if (next.isBefore(now)) next = next.add(1, "day");
  const delay = next.diff(now) + 1000;
  console.log(`[routine] prochaine exécution : ${next.format("DD/MM HH:mm")}`);
  setTimeout(async () => {
    try {
      await buildBrief();
      const brief = lastBrief;
      await callService(env.notificationsPort, "POST", "/api/notifications/notify", {
        kind: "routine",
        title: `☀️ Brief du matin — ${brief.date}`,
        body: `${brief.tasks.length} tâche(s) aujourd'hui, ${brief.events.length} événement(s), ${brief.mails.total} mail(s).`,
      });
    } catch (err) {
      console.error("[routine] échec :", err.message);
    }
    scheduleDaily();
  }, delay);
}

app.get("/api/routine/status", (req, res) => {
  res.json({ scheduledAt: env.routineTime, mailConfigured: mailConfigured(), lastBriefAt: lastBrief?.generatedAt || null });
});

app.listen(PORT, () => {
  console.log(`[routine] prêt sur http://localhost:${PORT}`);
  scheduleDaily();
});
