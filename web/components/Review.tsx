"use client";

import { computeReview, type RiskProfile, type Status } from "@/lib/review";
import { shortRupees } from "@/lib/format";
import type { Holding, TxRow } from "@/lib/holdings";
import { Modal, ModalHead } from "./Modal";

const LABEL: Record<Status, string> = { green: "On track", amber: "Review", red: "Act now" };
const GROUP_COLOR: Record<string, string> = {
  Equity: "#d9603a",
  "Debt & cash": "#2f8f6f",
  Gold: "#d9a441",
  Retirement: "#8a6fb0",
};

/** The Advisor review content, without any modal chrome — used inline (Advisor view) and in the modal. */
export function ReviewBody({
  holdings,
  rows,
  asOf,
  risk,
}: {
  holdings: Holding[];
  rows: TxRow[];
  asOf: string;
  risk: RiskProfile | null;
}) {
  const r = computeReview(holdings, rows, asOf, risk);
  const count = (s: Status) => r.lenses.filter((l) => l.status === s).length;

  return (
    <div className="demo-owner" style={{ padding: "4px 2px 8px" }}>
      {/* allocation overview */}
      <div className="demo-card">
        <div className="demo-card-head">Where your money is</div>
        <div className="demo-allocbar">
          {r.slices.map((s) => (
            <span key={s.group} style={{ width: `${s.pct}%`, background: GROUP_COLOR[s.group] ?? "#888" }} title={`${s.group} ${s.pct.toFixed(0)}%`} />
          ))}
        </div>
        <ul className="demo-legend">
          {r.slices.map((s) => (
            <li key={s.group}>
              <i style={{ background: GROUP_COLOR[s.group] ?? "#888" }} />
              {s.group}
              <b>{s.pct.toFixed(0)}%</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="demo-lens-summary">
        <span className="ls-pill green">{count("green")} on track</span>
        <span className="ls-pill amber">{count("amber")} to review</span>
        <span className="ls-pill red">{count("red")} need action</span>
      </div>

      <div className="demo-lenses">
        {r.lenses.map((l) => (
          <div className={`demo-lens s-${l.status}`} key={l.title}>
            <div className="demo-lens-top">
              <span className="demo-lens-dot" />
              <div>
                <b>{l.title}</b>
                <p className="mut small">{l.question}</p>
              </div>
              <span className={`demo-lens-tag t-${l.status}`}>{LABEL[l.status]}</span>
            </div>
            <div className="demo-lens-metric">
              {l.metric}
              {l.impactPaise != null && <em>{shortRupees(l.impactPaise)}</em>}
            </div>
            <p className="demo-lens-reason">{l.reason}</p>
            <p className="demo-lens-fix"><b>Fix</b> {l.fix}</p>
          </div>
        ))}
      </div>

      <p className="demo-tone">
        {risk
          ? "More lenses — MF overlap, fund cost drag and quality scores — turn on once we connect a fund-data source."
          : "More lenses — personalised allocation targets, MF overlap, fund cost drag and quality scores — turn on once you add a risk profile (Preferences) or we connect a fund-data source."}
      </p>
    </div>
  );
}

/** Modal wrapper, kept for any caller that still opens Advisor as a dialog. */
export function Review({
  holdings,
  rows,
  asOf,
  title,
  risk,
  onClose,
}: {
  holdings: Holding[];
  rows: TxRow[];
  asOf: string;
  title: string;
  risk: RiskProfile | null;
  onClose: () => void;
}) {
  return (
    <Modal wide onClose={onClose}>
      <ModalHead
        title="Advisor"
        extra={<div className="mut" style={{ fontSize: 13 }}>{title} · is my money arranged well?</div>}
        onClose={onClose}
      />
      <ReviewBody holdings={holdings} rows={rows} asOf={asOf} risk={risk} />
    </Modal>
  );
}
