import { requireSuperadmin } from "@/lib/session";
import { GAP_BASIS_LABEL, getGapBasis, listCapabilities } from "@/lib/queries";
import { saveGapBasis, saveRubric } from "./actions";

/**
 * Required levels and scoring conventions.
 *
 * Two things the client's dashboard proposal made necessary. Their example rows implied an
 * average required level of 2.80, which the seeded rubric cannot reach (its averages are
 * 2.11 / 2.11, and only Account Management asks for L3). Rather than argue about whose
 * number is right, the rubric is editable: set the levels the business actually expects and
 * every score, gap, radar and report follows immediately.
 *
 * The gap basis is the second: their worked example subtracted required from the SELF score,
 * the app uses the weighted score. Both are offered, and whichever is chosen is printed on
 * the reports.
 */
export default async function RubricPage() {
  await requireSuperadmin();
  const caps = listCapabilities();
  const basis = getGapBasis();

  const mean = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x != null);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : "n/a";
  };
  const avgAcq = mean(caps.map((c) => c.req_acq));
  const avgSat = mean(caps.map((c) => c.req_sat));

  const clusters: { name: string; caps: typeof caps }[] = [];
  for (const c of caps) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== c.cluster) clusters.push({ name: c.cluster, caps: [c] });
    else last.caps.push(c);
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Admin</div>
        <h1 className="page-title">Rubric &amp; scoring</h1>
        <p className="page-sub">
          The level each capability requires, per track, and how the Gap column is calculated.
          Changing a required level immediately changes every score, gap, radar and report.
        </p>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Gap calculation</h2>
        <p className="card-sub">
          Used by the Population Overview table and its PDF. The individual reports, the radars
          and the strength/development rules always use the weighted score, because those
          definitions are relied on elsewhere in the app.
        </p>
        <form action={saveGapBasis} className="rubric-basis">
          {(["weighted", "self"] as const).map((b) => (
            <label key={b} className={`basis-option${basis === b ? " active" : ""}`}>
              <input type="radio" name="basis" value={b} defaultChecked={basis === b} />
              <span>
                <strong>{GAP_BASIS_LABEL[b]}</strong>
                <small>
                  {b === "weighted"
                    ? "The app's canonical score: Self 20% · APEX Panel 35% · Manager 45%."
                    : "As worked in the dashboard proposal's example rows."}
                </small>
              </span>
            </label>
          ))}
          <button className="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">Required levels</h2>
        <p className="card-sub">
          Blank means the capability is not assessed on that track. Current averages:{" "}
          <strong>{avgAcq}</strong> on Acquisition, <strong>{avgSat}</strong> on Saturation.
        </p>
        <form action={saveRubric}>
          <div className="hm-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Acquisition</th>
                  <th>Saturation</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((cl) => (
                  <>
                    <tr key={cl.name}>
                      <td colSpan={3} style={{ paddingTop: 14 }}>
                        <span className="cluster-kicker">{cl.name}</span>
                      </td>
                    </tr>
                    {cl.caps.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 550 }}>
                          {c.name}
                          <input type="hidden" name="capId" value={c.id} />
                        </td>
                        {(["acq", "sat"] as const).map((t) => (
                          <td key={t}>
                            <select
                              className="input rubric-level"
                              name={`${t}_${c.id}`}
                              defaultValue={(t === "acq" ? c.req_acq : c.req_sat) ?? ""}
                            >
                              <option value="">n/a</option>
                              <option value="1">L1</option>
                              <option value="2">L2</option>
                              <option value="3">L3</option>
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 16 }}>
            Save required levels
          </button>
        </form>
      </div>
    </div>
  );
}
