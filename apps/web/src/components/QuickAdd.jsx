import React, { useState } from "react";

export default function QuickAdd({ onCreated }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await window.__api.quickAdd(text);
      setResult(data);
      setText("");
      onCreated?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const a = result?.analysis;
  const durationLabel = a ? (a.estimatedMinutes >= 60 ? `${Math.round(a.estimatedMinutes / 60)} h` : `${a.estimatedMinutes} min`) : "";

  return (
    <section className="card quickadd">
      <form onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ajout rapide : « Rédiger le rapport client avant vendredi, urgent #ClientX »"
          autoFocus
        />
        <button type="submit" disabled={busy || !text.trim()}>
          {busy ? "Analyse…" : "Ajouter"}
        </button>
      </form>
      {error && <p className="error">⚠️ {error}</p>}
      {a && (
        <div className="analysis">
          <strong>✅ {result.task.title}</strong>
          <span className="badge">📁 {a.project}</span>
          <span className={`badge prio-${a.priority}`}>Priorité {result.task.priorityLabel}</span>
          <span className="badge">⏱️ {durationLabel}</span>
          <span className="badge">🧩 complexité {a.complexity}/5</span>
          {a.deadline && (
            <span className="badge deadline">
              📅 échéance {new Date(a.deadline).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {result.scheduled && <span className="badge ok">🗓️ planifiée dans le calendrier</span>}
          {a.deadline && !result.scheduled && <span className="badge warn">non planifiée (créneaux pleins)</span>}
        </div>
      )}
    </section>
  );
}
