import Link from "next/link";
import { formatScheduleDate } from "@/lib/queries";

/**
 * Campaign timeline: every manager deadline and APEX Panel call across the roster, on one
 * date axis, with what is coming next spelled out underneath.
 *
 * The roster's Schedule column answers "when is this person's assessment". This answers the
 * other half of the question: what is the next step for the campaign, and what has already
 * slipped. Dates falling on the same day are grouped into one marker so 25 people do not
 * produce 50 overlapping dots.
 *
 * Server-rendered on purpose. Hover detail rides on `title`, so the card costs no JavaScript.
 */

export type TimelineEntry = {
  amId: number;
  amName: string;
  lens: "Manager" | "Panel";
  value: string;
  withTime: boolean;
  state: "done" | "overdue" | "pending";
};

const DAY = 86_400_000;

export default function ScheduleTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <h2 className="card-title">Assessment timeline</h2>
        <p className="card-sub" style={{ marginBottom: 0 }}>
          No assessment dates set yet. Open an Account Manager and use the Assessment schedule
          panel to set their manager deadline and APEX Panel call.
        </p>
      </div>
    );
  }

  const dayOf = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).getTime();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const now = today.getTime();

  const times = entries.map((e) => dayOf(e.value));
  // always include today, so "where we are" is on the axis even if every date is in the future
  const start = Math.min(now, ...times) - 2 * DAY;
  const end = Math.max(now, ...times) + 2 * DAY;
  const span = Math.max(end - start, DAY);
  const pct = (t: number) => ((t - start) / span) * 100;

  // one marker per calendar day, however many assessments land on it
  const byDay = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const key = e.value.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  const markers = [...byDay.entries()]
    .map(([key, list]) => ({
      key,
      at: dayOf(key),
      list,
      // the most urgent state on that day drives the colour
      state: list.some((e) => e.state === "overdue")
        ? "overdue"
        : list.some((e) => e.state === "pending")
          ? "pending"
          : "done",
    }))
    .sort((a, b) => a.at - b.at);

  // month ticks across the axis
  const ticks: { at: number; label: string }[] = [];
  const cursor = new Date(start);
  cursor.setDate(1);
  cursor.setHours(12, 0, 0, 0);
  while (cursor.getTime() <= end) {
    if (cursor.getTime() >= start) {
      ticks.push({
        at: cursor.getTime(),
        label: cursor.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const overdue = entries.filter((e) => e.state === "overdue");
  const upcoming = entries
    .filter((e) => e.state === "pending")
    .sort((a, b) => dayOf(a.value) - dayOf(b.value))
    .slice(0, 4);

  return (
    <div className="card card-pad" style={{ marginBottom: 22 }}>
      <h2 className="card-title">Assessment timeline</h2>
      <p className="card-sub">
        Every manager deadline and APEX Panel call across the roster. Red has passed with the
        assessment still open, green is still ahead, grey is already submitted.
      </p>

      <div className="tl">
        <div className="tl-track">
          {ticks.map((t) => (
            <div key={t.at} className="tl-tick" style={{ left: `${pct(t.at)}%` }}>
              <span className="tl-tick-label">{t.label}</span>
            </div>
          ))}
          <div className="tl-today" style={{ left: `${pct(now)}%` }}>
            <span className="tl-today-label">today</span>
          </div>
          {markers.map((m) => (
            <div
              key={m.key}
              className={`tl-dot tl-${m.state}`}
              style={{ left: `${pct(m.at)}%` }}
              title={m.list
                .map((e) => `${e.amName} · ${e.lens} · ${formatScheduleDate(e.value, e.withTime)}`)
                .join("\n")}
            >
              {m.list.length > 1 && <span className="tl-count">{m.list.length}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="tl-next">
        {overdue.length > 0 && (
          <div className="tl-next-group">
            <span className="tl-next-head tl-next-head-red">
              {overdue.length} overdue
            </span>
            {overdue.slice(0, 3).map((e) => (
              <Link key={`${e.amId}-${e.lens}`} className="tl-item" href={`/analysis/am/${e.amId}`}>
                <span className="badge badge-red">{e.lens}</span>
                {e.amName} · {formatScheduleDate(e.value, e.withTime)}
              </Link>
            ))}
            {overdue.length > 3 && <span className="tl-more">+{overdue.length - 3} more</span>}
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="tl-next-group">
            <span className="tl-next-head">Next up</span>
            {upcoming.map((e) => (
              <Link key={`${e.amId}-${e.lens}`} className="tl-item" href={`/analysis/am/${e.amId}`}>
                <span className="badge badge-sched">{e.lens}</span>
                {e.amName} · {formatScheduleDate(e.value, e.withTime)}
              </Link>
            ))}
          </div>
        )}
        {overdue.length === 0 && upcoming.length === 0 && (
          <span className="tl-more">Every scheduled assessment has been submitted.</span>
        )}
      </div>
    </div>
  );
}
