import React, { useEffect, useState } from "react";

export default function Notifications({ onRefresh }) {
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    window.__api.getNotifications().then((list) => setHistory(list || [])).catch(() => {});
    const source = window.__api.openStream((notification) => {
      setHistory((prev) => [notification, ...prev].slice(0, 100));
      setToasts((prev) => [{ ...notification }, ...prev].slice(0, 4));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notification.id));
      }, 8000);
      if (notification.kind === "routine" || notification.kind === "echeance") onRefresh?.();
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(notification.title, { body: notification.body });
      }
    });
    return () => source.close();
  }, [onRefresh]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const unread = history.length;

  return (
    <>
      <button className="bell" onClick={() => setOpen(!open)} title="Notifications">
        🔔{unread > 0 && <span className="count">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel card">
          <h3>🔔 Notifications</h3>
          <ul className="compact">
            {history.slice(0, 30).map((n) => (
              <li key={n.id}>
                <strong>{n.title}</strong>
                {n.body && <div className="muted">{n.body}</div>}
                <div className="muted small">{new Date(n.at).toLocaleString("fr-FR")}</div>
              </li>
            ))}
            {!history.length && <li className="empty">Aucune notification pour l'instant.</li>}
          </ul>
        </div>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast kind-${t.kind}`}>
            <strong>{t.title}</strong>
            {t.body && <p>{t.body}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
