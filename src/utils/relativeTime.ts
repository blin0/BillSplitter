type TFunc = (key: string, opts?: Record<string, unknown>) => string;

export function relativeTime(iso: string, t: TFunc): string {
  const then = new Date(iso);
  const now  = new Date();
  const diff = now.getTime() - then.getTime();
  const s    = Math.floor(diff / 1000);

  if (s < 10)  return t('activity.justNow');
  if (s < 60)  return t('activity.secondsAgo', { count: s });

  const m = Math.floor(s / 60);
  if (m < 60)  return t('activity.minutesAgo', { count: m });

  const time = then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  const todayStr     = now.toDateString();
  const yesterdayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString();

  if (then.toDateString() === todayStr)     return t('activity.todayAt', { time });
  if (then.toDateString() === yesterdayStr) return t('activity.yesterdayAt', { time });

  if (diff < 6 * 24 * 60 * 60 * 1000) {
    const day = then.toLocaleDateString([], { weekday: 'short' });
    return t('activity.dayAt', { day, time });
  }

  return then.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
