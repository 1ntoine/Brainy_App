import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { readJson, writeJson, newId, env } from "../shared/util.js";
import { schedule } from "./scheduler.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = env.calendarPort;

let events = readJson("calendar", "events.json", []);

function save() { writeJson("calendar", "events.json", events); }

app.get("/api/calendar/events", (req, res) => {
  const { from, to, taskId } = req.query;
  let list = [...events];
  if (from) list = list.filter((e) => dayjs(e.end).isAfter(dayjs(from)));
  if (to) list = list.filter((e) => dayjs(e.start).isBefore(dayjs(to)));
  if (taskId) list = list.filter((e) => e.taskId === taskId);
  list.sort((a, b) => new Date(a.start) - new Date(b.start));
  res.json(list);
});

app.post("/api/calendar/events", (req, res) => {
  const { title, start, end, type, project, notes } = req.body || {};
  if (!title || !start || !end) return res.status(400).json({ error: "title, start, end requis" });
  if (dayjs(end).isBefore(dayjs(start))) return res.status(400).json({ error: "end avant start" });
  const event = {
    id: newId("e"),
    title,
    start: dayjs(start).toISOString(),
    end: dayjs(end).toISOString(),
    type: type || "event",
    project: project || null,
    notes: notes || "",
    taskId: null,
    createdAt: new Date().toISOString(),
  };
  events.push(event);
  save();
  res.status(201).json(event);
});

app.post("/api/calendar/schedule", (req, res) => {
  const { task } = req.body || {};
  if (!task?.id || !task?.deadline) return res.status(400).json({ error: "task avec id et deadline requis" });

  events = events.filter((e) => e.taskId !== task.id);
  const result = schedule({ task, events });

  if (result.placed.length) {
    for (const block of result.placed) {
      events.push({ id: newId("e"), createdAt: new Date().toISOString(), taskId: task.id, notes: "", ...block });
    }
    save();
  }
  res.status(201).json({ scheduled: result.placed, reason: result.reason, remainingMinutes: result.remainingMinutes || 0 });
});

app.delete("/api/calendar/by-task/:taskId", (req, res) => {
  const before = events.length;
  events = events.filter((e) => e.taskId !== req.params.taskId);
  if (events.length !== before) save();
  res.json({ removed: before - events.length });
});

app.delete("/api/calendar/events/:id", (req, res) => {
  const before = events.length;
  events = events.filter((e) => e.id !== req.params.id);
  if (events.length === before) return res.status(404).json({ error: "Événement introuvable" });
  save();
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`[calendar] prêt sur http://localhost:${PORT}`);
});
