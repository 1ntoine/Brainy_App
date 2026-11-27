import React, { useMemo } from "react";
import dayjs from "dayjs";

export default function CalendarWidget({ refreshKey }) {
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [events, setEvents] = React.useState([]);

  React.useEffect(() => {
    const start = dayjs().add(weekOffset, "week").startOf("week");
    const end = start.endOf("week");
    window.__api.getEvents(start.toISOString(), end.toISOString())
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [weekOffset, refreshKey]);

  const days = useMemo(() => {
    const start = dayjs().add(weekOffset, "week").startOf("week");
    return Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
  }, [weekOffset]);

  const hours = Array.from({ length: 10 }, (_, i) => i + 9);

  function eventsFor(day, hour) {
    return events.filter((e) => {
      const s = dayjs(e.start);
      return s.isSame(day, "day") && s.hour() === hour;
    });
  }

  return (
    <section className="card calendar">
      <div className="calendar-header">
        <h2>🗓️ Calendrier</h2>
        <div>
          <button className="chip" onClick={() => setWeekOffset(weekOffset - 1)}>◀</button>
          <button className="chip" onClick={() => setWeekOffset(0)}>Cette semaine</button>
          <button className="chip" onClick={() => setWeekOffset(weekOffset + 1)}>▶</button>
        </div>
      </div>
      <div className="week-grid">
        <div className="col hours">
          {hours.map((h) => <div key={h} className="cell hour-label">{h}h</div>)}
        </div>
        {days.map((day) => (
          <div key={day.format("YYYY-MM-DD")} className={`col ${day.isSame(dayjs(), "day") ? "today" : ""}`}>
            <div className="day-label">{day.format("ddd DD/MM")}</div>
            {hours.map((h) => (
              <div key={h} className="cell">
                {eventsFor(day, h).map((e) => (
                  <div key={e.id} className={`event ${e.type}`} title={`${e.title} (${e.project || "agenda"})`}>
                    {e.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
