import Link from "next/link";
import { formatScheduleDate } from "@/lib/queries";

/**
 * Campaign timeline: every manager deadline and APEX Panel call across the roster, on one
 * date axis, with what is coming next spelled out underneath.
 *
 * The roster's Schedule column answers "when is this person's assessment". This answers the
 * other half of the question: what is the next step for the campaign, and what has already
 * slipped.
 *
 * Laid out as one LANE PER LENS. A flat row of dots got read as "one dot per lens" and the
 * obvious question was why there were more than three; a dot is a DATE, not a lens, and
 * several people usually share a day. Lanes make that structure legible: the lane says which
 * assessment, the dot says when, the number says how many people. Self has no lane because
 * self-assessments carry no scheduled date, which the caption states rather than leaving as
 * a silent gap.
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

/** One lane per scheduled assessment. Self is absent by design: it has no date. */
const LANES = [
  { key: "Manager" as const, label: "Manager deadline" },
  { key: "Panel" as const, label: "APEX Panel call" },
];

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

  // one marker per lens per calendar day, however many people land on it
  const byDay = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const key = `${e.lens}|${e.value.slice(0, 10)}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  const markers = [...byDay.entries()]
    .map(([key, list]) => ({
      key,
      lens: list[0].lens,
      at: dayOf(key.split("|")[1]),
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
        // FULL year. A two-digit year rendered "Aug 26", which reads as the 26th of August
        // on a chart whose whole purpose is dates. Never abbreviate the year here.
        label: cursor.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
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
        One lane per assessment. Each dot is a scheduled <strong>date</strong>, and the number on
        it is how many Account Managers share that day. Red has passed with the assessment still
        open, green is still ahead, grey is already submitted. Self-assessments have no lane
        because they carry no scheduled date.
      </p>

      <div className="tl">
        <div className="tl-axis">
          <div className="tl-axis-label" />
          <div className="tl-axis-track">
            {ticks.map((t) => (
              <div key={t.at} className="tl-tick" style={{ left: `${pct(t.at)}%` }}>
                <span className="tl-tick-label">{t.label}</span>
              </div>
            ))}
            <div className="tl-today" style={{ left: `${pct(now)}%` }}>
              <span className="tl-today-label">
                today · {today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        {LANES.map((lane) => {
          const laneMarkers = markers.filter((m) => m.lens === lane.key);
          return (
            <div key={lane.key} className="tl-lane">
              <div className="tl-lane-label">
                {lane.label}
                <span className="tl-lane-count">
                  {laneMarkers.reduce((n, m) => n + m.list.length, 0)} scheduled
                </span>
              </div>
              <div className="tl-lane-track">
                <div className="tl-today-line" style={{ left: `${pct(now)}%` }} />
                {laneMarkers.map((m) => (
                  <div
                    key={m.key}
                    className={`tl-dot tl-${m.state}`}
                    style={{ left: `${pct(m.at)}%` }}
                    title={m.list
                      .map((e) => `${e.amName} · ${formatScheduleDate(e.value, e.withTime)}`)
                      .join("\n")}
                  >
                    {m.list.length > 1 && <span className="tl-count">{m.list.length}</span>}
                  </div>
                ))}
                {laneMarkers.length === 0 && <span className="tl-lane-empty">nothing scheduled</span>}
              </div>
            </div>
          );
        })}
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
