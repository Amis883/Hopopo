// Streaks and weekly activity from session history. Pure.

const pad = n => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * @param track    a track with `history: [{d, sec, n}]` and `minutes`
 * @param weekdays seven labels, Sunday first (for the localized week strip)
 * @param now      injectable clock, for tests
 */
export function stats(track, weekdays, now = new Date()) {
  const days = new Set(track.history.map(h => h.d)), today = dayKey(now);
  let streak = 0; const d = new Date(now);
  if (!days.has(today)) d.setDate(d.getDate() - 1);          // today not done yet doesn't break the streak
  while (days.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const x = new Date(now); x.setDate(x.getDate() - i);
    week.push({ done: days.has(dayKey(x)), today: i === 0, label: weekdays[x.getDay()] });
  }
  const todaySec = track.history.filter(h => h.d === today).reduce((a, h) => a + h.sec, 0);
  return { streak, week, todaySec, doneToday: todaySec >= Math.min(600, track.minutes * 60 * 0.6) };
}
