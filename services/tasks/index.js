import express from "express";
import cors from "cors";
import { readJson, writeJson, newId, callService, env } from "../shared/util.js";
import { analyze } from "./analyzer.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = env.tasksPort;

let tasks = readJson("tasks", "tasks.json", []);
let projects = readJson("tasks", "projects.json", [{ id: "p_inbox", name: "Inbox", color: "#64748b" }]);

function saveTasks() { writeJson("tasks", "tasks.json", tasks); }
function saveProjects() { writeJson("tasks", "projects.json", projects); }

const PRIORITY_LABEL = { 3: "haute", 2: "moyenne", 1: "basse" };

function publicTask(t) {
  return { ...t, priorityLabel: PRIORITY_LABEL[t.priority] || "moyenne" };
}

app.get("/api/tasks", (req, res) => {
  const { status, project } = req.query;
  let list = [...tasks];
  if (status) list = list.filter((t) => t.status === status);
  if (project) list = list.filter((t) => t.project === project);
  list.sort((a, b) => {
    if (a.status !== b.status) return a.status === "done" ? 1 : -1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(a.deadline || "9999") - new Date(b.deadline || "9999");
  });
  res.json(list.map(publicTask));
});

app.get("/api/tasks/:id", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tâche introuvable" });
  res.json(publicTask(task));
});

app.post("/api/tasks", (req, res) => {
  const { title, project, priority, estimatedMinutes, complexity, deadline, dueAt, notes } = req.body || {};
  if (!title) return res.status(400).json({ error: "title requis" });
  const task = {
    id: newId("t"),
    title,
    project: project || "Inbox",
    priority: Number(priority) || 2,
    estimatedMinutes: Number(estimatedMinutes) || 45,
    complexity: Number(complexity) || 3,
    deadline: deadline || dueAt || null,
    notes: notes || "",
    status: "todo",
    createdAt: new Date().toISOString(),
    doneAt: null,
  };
  tasks.push(task);
  saveTasks();
  res.status(201).json(publicTask(task));
});

app.patch("/api/tasks/:id", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tâche introuvable" });
  const allowed = ["title", "project", "priority", "estimatedMinutes", "complexity", "deadline", "notes", "status"];
  for (const key of allowed) {
    if (key in req.body) task[key] = req.body[key];
  }
  if (req.body.status === "done" && !task.doneAt) task.doneAt = new Date().toISOString();
  if (req.body.status && req.body.status !== "done") task.doneAt = null;
  saveTasks();
  res.json(publicTask(task));
});

app.delete("/api/tasks/:id", (req, res) => {
  const before = tasks.length;
  tasks = tasks.filter((t) => t.id !== req.params.id);
  if (tasks.length === before) return res.status(404).json({ error: "Tâche introuvable" });
  saveTasks();
  try { callService(env.calendarPort, "DELETE", `/api/calendar/by-task/${req.params.id}`); } catch {}
  res.status(204).end();
});

app.get("/api/projects", (req, res) => res.json(projects));

app.post("/api/projects", (req, res) => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: "name requis" });
  if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: "Projet déjà existant" });
  }
  const project = { id: newId("p"), name, color: color || "#0ea5e9" };
  projects.push(project);
  saveProjects();
  res.status(201).json(project);
});

app.get("/api/projects/:name/tasks", (req, res) => {
  res.json(tasks.filter((t) => t.project === req.params.name).map(publicTask));
});

app.post("/api/tasks/quick-add", async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Envoyez une phrase, ex : 'Rédiger le rapport client avant vendredi #Palo'" });

  let analysis;
  try {
    analysis = analyze(text, { projectNames: projects.map((p) => p.name) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const task = {
    id: newId("t"),
    title: analysis.title,
    project: analysis.project,
    priority: analysis.priority,
    estimatedMinutes: analysis.estimatedMinutes,
    complexity: analysis.complexity,
    deadline: analysis.deadline,
    notes: `Phrase d'origine : « ${text} »`,
    status: "todo",
    createdAt: new Date().toISOString(),
    doneAt: null,
  };
  tasks.push(task);
  saveTasks();

  if (!projects.some((p) => p.name === task.project)) {
    projects.push({ id: newId("p"), name: task.project, color: "#0ea5e9" });
    saveProjects();
  }

  let scheduled = false;
  if (task.deadline) {
    try {
      const r = await callService(env.calendarPort, "POST", "/api/calendar/schedule", { task });
      scheduled = r.status === 201;
    } catch { /* calendrier indisponible : la tâche reste non planifiée */ }
  }

  try {
    await callService(env.notificationsPort, "POST", "/api/notifications/reminders", {
      taskId: task.id,
      title: task.title,
      dueAt: task.deadline,
      priority: task.priority,
    });
  } catch { /* notifications indisponibles */ }

  res.status(201).json({ task: publicTask(task), analysis, scheduled });
});

app.listen(PORT, () => {
  console.log(`[tasks] prêt sur http://localhost:${PORT}`);
});
