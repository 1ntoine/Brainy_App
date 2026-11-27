async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  quickAdd: (text) => request("/api/tasks/quick-add", { method: "POST", body: { text } }),
  getTasks: (status) => request(`/api/tasks${status ? `?status=${status}` : ""}`),
  getTask: (id) => request(`/api/tasks/${id}`),
  updateTask: (id, patch) => request(`/api/tasks/${id}`, { method: "PATCH", body: patch }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),
  getProjects: () => request("/api/projects"),
  getEvents: (from, to) =>
    request(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  addEvent: (event) => request("/api/calendar/events", { method: "POST", body: event }),
  getBrief: (refresh) => request(`/api/routine/brief${refresh ? "?refresh=1" : ""}`),
  runRoutine: () => request("/api/routine/run", { method: "POST" }),
  getNotifications: () => request("/api/notifications"),
};

export function openNotificationStream(onNotification) {
  const source = new EventSource("/api/notifications/stream");
  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "connected") return;
      onNotification(data);
    } catch { /* message SSE malformé */ }
  };
  return source;
}
