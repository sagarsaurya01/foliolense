import { allocation } from "@/lib/demo/data";

export const metadata = { title: "Review · Demo · FolioLense" };

type Status = "green" | "amber" | "red";
const LABEL: Record<Status, string> = { green: "On track", amber: "Review", red: "Act now" };

// Only the lenses the app actually computes from your holdings today.
const LENSES: { title: string; question: string; status: Status; metric: string; impact?: string; reason: string; fix: string }[] = [
  {
    title: "Asset allocation", question: "What is my money split into?", status: "amber",
    metric: "Equity 53% · Debt & cash 34%",
    reason: "Your equity-to-debt balance looks reasonable for a long-term investor.",
    fix: "A personalised target needs your age and risk comfort — add a profile to turn this into an exact rebalance amount.",
  },
  {
    title: "Concentration", question: "Am I too dependent on one holding?", status: "amber",
    metric: "Parag Parikh Flexi Cap = 9% · top 5 = 38%", impact: "₹3.6 L",
    reason: "No single holding dominates, but your top five are a big slice of the whole.",
    fix: "Keep trimming winners back toward 10% each and spread across more holdings.",
  },
  {
    title: "Liquidity", question: "Can I get cash quickly if I need it?", status: "green",
    metric: "58% reachable in ~1 week", impact: "₹83.1 L",
    reason: "You can raise a good chunk of cash fast without breaking long-term money.",
    fix: "Keep about 6 months of expenses this liquid.",
  },
  {
    title: "Income", question: "What cash does this produce?", status: "green",
    metric: "1.2% yield this year", impact: "₹1.42 L",
    reason: "Dividends and interest give you a steady cash stream on top of growth.",
    fix: "Record dividend and interest credits so this stays accurate.",
  },
];

const CLS_COLORS: Record<string, string> = {
  "Indian Equity": "#d9603a", "Mutual Fund": "#2f8f6f", "F&O": "#b5553a",
  "Fixed Deposit": "#6a8caf", "PPF / EPF": "#c99a3a", NPS: "#8a6fb0", Gold: "#d9a441", Bonds: "#5f9ea0",
};

export default function ReviewDemo() {
  const count = (s: Status) => LENSES.filter((l) => l.status === s).length;
  return (
    <div className="demo-owner">
      <div className="demo-band">
        <div className="demo-band-head">
          <span className="demo-kicker">Review</span>
          <h2>Is my money arranged well?</h2>
          <p>Lenses computed from your holdings. Each gives a status, a reason and a fix.</p>
        </div>

        <div className="demo-card">
          <div className="demo-card-head">Where your money is</div>
          <div className="demo-allocbar">
            {allocation.map((a) => (
              <span key={a.cls} style={{ width: `${a.pct}%`, background: CLS_COLORS[a.cls] ?? "#888" }} title={`${a.cls} ${a.pct.toFixed(0)}%`} />
            ))}
          </div>
          <ul className="demo-legend">
            {allocation.map((a) => (
              <li key={a.cls}><i style={{ background: CLS_COLORS[a.cls] ?? "#888" }} />{a.cls}<b>{a.pct.toFixed(0)}%</b></li>
            ))}
          </ul>
        </div>

        <div className="demo-lens-summary">
          <span className="ls-pill green">{count("green")} on track</span>
          <span className="ls-pill amber">{count("amber")} to review</span>
          <span className="ls-pill red">{count("red")} need action</span>
        </div>

        <div className="demo-lenses">
          {LENSES.map((l) => (
            <div className={`demo-lens s-${l.status}`} key={l.title}>
              <div className="demo-lens-top">
                <span className="demo-lens-dot" />
                <div><b>{l.title}</b><p className="mut small">{l.question}</p></div>
                <span className={`demo-lens-tag t-${l.status}`}>{LABEL[l.status]}</span>
              </div>
              <div className="demo-lens-metric">{l.metric}{l.impact && <em>{l.impact}</em>}</div>
              <p className="demo-lens-reason">{l.reason}</p>
              <p className="demo-lens-fix"><b>Fix</b> {l.fix}</p>
            </div>
          ))}
        </div>

        <p className="demo-tone">More lenses — personalised allocation targets, MF overlap, cost drag and quality scores — turn on once you add a risk profile or we connect a fund-data source.</p>
      </div>
    </div>
  );
}
