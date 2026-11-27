import dayjs from "dayjs";

const WORK_START = 9;
const WORK_END = 18;
const SLOT_MINUTES = 30;

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
}

export function schedule({ task, events, now } = {}) {
  const ref = now ? dayjs(now) : dayjs();
  if (!task?.deadline) return { placed: [], reason: "no-deadline" };

  const deadline = dayjs(task.deadline);
  const busy = events
    .filter((e) => e.start && e.end)
    .map((e) => ({ start: dayjs(e.start), end: dayjs(e.end) }));

  const remaining = Math.max(SLOT_MINUTES, Math.round(task.estimatedMinutes || 45));
  const placed = [];
  let cursor = ref.minute() <= 30 && ref.hour() >= WORK_START ? ref.minute(0) : ref.add(1, "hour").minute(0);
  if (cursor.hour() < WORK_START) cursor = cursor.hour(WORK_START).minute(0);

  let left = remaining;
  let guard = 0;
  while (left > 0 && guard < 1000) {
    guard += 1;
    if (!cursor.isBefore(deadline)) break;
    if (cursor.day() === 0 || cursor.day() === 6) {
      cursor = cursor.add(1, "day").hour(WORK_START).minute(0);
      continue;
    }
    if (cursor.hour() >= WORK_END) {
      cursor = cursor.add(1, "day").hour(WORK_START).minute(0);
      continue;
    }
    const slotEnd = cursor.add(SLOT_MINUTES, "minute");
    const dayEnd = cursor.hour(WORK_END).minute(0);
    const end = slotEnd.isAfter(dayEnd) ? dayEnd : slotEnd;
    if (end.diff(cursor, "minute") <= 0) {
      cursor = cursor.add(1, "day").hour(WORK_START).minute(0);
      continue;
    }
    const conflict = busy.find((b) => overlaps(cursor, end, b.start, b.end));
    if (conflict) {
      cursor = conflict.end;
      continue;
    }
    placed.push({
      title: task.title,
      taskId: task.id,
      type: "task",
      project: task.project,
      priority: task.priority,
      start: cursor.toISOString(),
      end: end.toISOString(),
    });
    busy.push({ start: cursor.clone(), end: end.clone() });
    left -= end.diff(cursor, "minute");
    cursor = end;
  }

  return { placed, reason: left > 0 ? "partial" : "ok", remainingMinutes: Math.max(left, 0) };
}
