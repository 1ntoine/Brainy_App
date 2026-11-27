import React, { useState } from "react";

export default function BriefWidget({ refreshKey }) {
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    window.__api.getBrief().then(setBrief).catch(() => {});
  }, [refreshKey]);

  async function runRoutine() {
    setBusy(true);
    try {
      setBrief(await window.__api.runRoutine());
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  if (!brief) return <section className="card brief"><h2>☀️ Brief du matin</h2><p className="empty">Chargement…</p></section>;

  return (
    <section className="card brief">
      <div className="brief-header">
        <h2>☀️ Brief du matin</h2>
        <button onClick={runRoutine} disabled={busy}>{busy ? "Analyse…" : "Lancer la routine"}</button>
      </div>
      <p className="muted">{brief.date}</p>

      {brief.weather && (
        <p className="weather">
          <strong>{brief.weather.headline}</strong> — {brief.weather.text}
        </p>
      )}

      <h3>Aujourd'hui ({brief.tasks.length} tâche{brief.tasks.length > 1 ? "s" : ""})</h3>
      <ul className="compact">
        {brief.tasks.slice(0, 8).map((t) => (
          <li key={t.id}>
            <span className={`badge prio-${t.priority}`}>{t.priorityLabel}</span> {t.title}
            {t.deadline && <span className="muted"> — échéance {new Date(t.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
          </li>
        ))}
        {!brief.tasks.length && <li className="empty">Rien d'urgent aujourd'hui 🎉</li>}
      </ul>

      {brief.events.length > 0 && (
        <>
          <h3>Agenda ({brief.events.length})</h3>
          <ul className="compact">
            {brief.events.map((e) => (
              <li key={e.id}>
                {new Date(e.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — {e.title}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>📬 Mails (24 h) : {brief.mails.total} reçus, {brief.mails.unread} non lus</h3>
      {!brief.mailConfigured && <p className="empty">Mail non configuré — renseignez IMAP_* dans .env</p>}
      {brief.mailConfigured && brief.mails.importantMails.length > 0 && (
        <ul className="compact">
          {brief.mails.importantMails.slice(0, 5).map((m, i) => (
            <li key={i}>{m.unread && <strong>•</strong>} {m.subject} <span className="muted">({m.from})</span></li>
          ))}
        </ul>
      )}

      {brief.mails.newslettersEco.length > 0 && (
        <>
          <h3>📈 Newsletter éco (6 h 30)</h3>
          <ul className="compact">
            {brief.mails.newslettersEco.map((m, i) => <li key={i}>{m.subject} <span className="muted">({m.from})</span></li>)}
          </ul>
        </>
      )}

      {brief.mails.newslettersInfo.length > 0 && (
        <>
          <h3>📰 Newsletters info (18 h)</h3>
          <ul className="compact">
            {brief.mails.newslettersInfo.map((m, i) => <li key={i}>{m.subject} <span className="muted">({m.from})</span></li>)}
          </ul>
        </>
      )}

      {brief.warnings.length > 0 && (
        <ul className="compact warnings">
          {brief.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
        </ul>
      )}
    </section>
  );
}
