import React, { useCallback, useEffect, useState } from "react";
import { api, openNotificationStream } from "./api.js";
import QuickAdd from "./components/QuickAdd.jsx";
import TasksWidget from "./components/TasksWidget.jsx";
import CalendarWidget from "./components/CalendarWidget.jsx";
import BriefWidget from "./components/BriefWidget.jsx";
import Notifications from "./components/Notifications.jsx";

window.__api = {
  quickAdd: api.quickAdd,
  getTasks: api.getTasks,
  updateTask: api.updateTask,
  deleteTask: api.deleteTask,
  getEvents: api.getEvents,
  getBrief: api.getBrief,
  runRoutine: api.runRoutine,
  getNotifications: api.getNotifications,
  openStream: openNotificationStream,
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    api.getTasks().then(setTasks).catch(() => {});
    api.getProjects().then(setProjects).catch(() => {});
  }, [refreshKey]);

  return (
    <div className="app">
      <header>
        <h1>🗂️ TaskHub</h1>
        <Notifications onRefresh={refresh} />
      </header>

      <QuickAdd onCreated={refresh} />

      <main className="grid">
        <TasksWidget tasks={tasks} projects={projects} onChanged={refresh} />
        <CalendarWidget refreshKey={refreshKey} />
        <BriefWidget refreshKey={refreshKey} />
      </main>
    </div>
  );
}
