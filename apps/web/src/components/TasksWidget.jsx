import React, { useState } from "react";

function minutesLabel(min) {
  return min >= 60 ? `${Math.round((min / 60) * 10) / 10} h` : `${min} min`;
}

export default function TasksWidget({ tasks, projects, onChanged }) {
  const [filter, setFilter] = useState("all");

  const visible = tasks.filter((t) => filter === "all" || t.project === filter);

  async function toggle(task) {
    await window.__api.updateTask(task.id, { status: task.status === "done" ? "todo" : "done" });
    onChanged?.();
  }

  async function remove(task) {
    await window.__api.deleteTask(task.id);
    onChanged?.();
  }

  return (
    <section className="card tasks">
      <h2>📋 Tâches</h2>
      <div className="filters">
        <button className={filter === "all" ? "chip active" : "chip"} onClick={() => setFilter("all")}>
          Tout ({tasks.length})
        </button>
        {projects.map((p) => (
          <button key={p.id} className={filter === p.name ? "chip active" : "chip"} onClick={() => setFilter(p.name)}>
            {p.name}
          </button>
        ))}
      </div>
      <ul>
        {visible.map((task) => (
          <li key={task.id} className={task.status === "done" ? "done" : ""}>
            <label>
              <input type="checkbox" checked={task.status === "done"} onChange={() => toggle(task)} />
              <span className="title">{task.title}</span>
            </label>
            <span className="meta">
              <span className={`badge prio-${task.priority}`}>{task.priorityLabel}</span>
              <span className="badge">⏱️ {minutesLabel(task.estimatedMinutes)}</span>
              {task.deadline && (
                <span className="badge deadline">
                  📅 {new Date(task.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              )}
              <span className="badge project">📁 {task.project}</span>
              <button className="icon" title="Supprimer" onClick={() => remove(task)}>✕</button>
            </span>
          </li>
        ))}
        {!visible.length && <li className="empty">Aucune tâche — utilisez la barre d'ajout rapide.</li>}
      </ul>
    </section>
  );
}
