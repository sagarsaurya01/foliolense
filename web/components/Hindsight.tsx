"use client";

import { computeHindsight } from "@/lib/hindsight";
import { rupees, shortRupees } from "@/lib/format";
import type { Holding, TxRow } from "@/lib/holdings";
import { Modal, ModalHead } from "./Modal";

export function Hindsight({
  holdings,
  rows,
  xirr,
  asOf,
  title,
  onClose,
}: {
  holdings: Holding[];
  rows: TxRow[];
  xirr: number | null;
  asOf: string;
  title: string;
  onClose: () => void;
}) {
  const h = computeHindsight(holdings, rows, asOf, xirr);
  const gainTone = h.unrealisedPaise >= 0 ? "gain" : "loss";
  const barMax = Math.max(1, ...h.winners.map((w) => Math.abs(w.gainPaise)), ...h.draggers.map((w) => Math.abs(w.gainPaise)));

  return (
    <Modal wide onClose={onClose}>
      <ModalHead
        title="Hindsight"
        extra={<div className="mut" style={{ fontSize: 13 }}>{title} · FY {h.fy}</div>}
        onClose={onClose}
      />
      <div className="demo-owner" style={{ padding: "4px 2px 8px" }}>
        {/* Did I make money */}
        <div className="demo-card hl">
          <div className="demo-q">Did I make money?</div>
          <div className="demo-money">
            <div className="demo-money-big">
              <span className={gainTone} style={{ fontFamily: "var(--f-num)", fontSize: 30, fontWeight: 700 }}>
                {h.unrealisedPaise >= 0 ? "+" : ""}{shortRupees(h.unrealisedPaise)}
              </span>
              <small>gain on your holdings{h.unrealisedPct != null ? ` · ${h.unrealisedPct.toFixed(1)}%` : ""}</small>
            </div>
            <div className="demo-money-steps">
              <div><span>Invested</span><b>{shortRupees(h.investedPaise)}</b></div>
              <div><span>Current value</span><b>{shortRupees(h.currentPaise)}</b></div>
              <div><span>Booked this year</span><b className={h.realisedFyPaise >= 0 ? "gain" : "loss"}>{shortRupees(h.realisedFyPaise)}</b><em>−{shortRupees(h.estTaxPaise)} est. tax</em></div>
            </div>
          </div>
          {h.harvestHeadroomPaise > 0 && h.harvestHeadroomPaise < 12_500_000 && (
            <p className="demo-note" style={{ marginTop: 12 }}>
              You can still book about {shortRupees(h.harvestHeadroomPaise)} of long-term equity gains tax-free this year (unused ₹1.25L 112A exemption).
            </p>
          )}
        </div>

        {/* Where the gain came from */}
        {(h.winners.length > 0 || h.draggers.length > 0) && (
          <div className="demo-split">
            <div className="demo-card">
              <div className="demo-card-head">Made most of the gain</div>
              {h.winners.length === 0 && <p className="mut small">No holding is in profit yet.</p>}
              {h.winners.map((w) => (
                <div className="demo-contrib" key={w.name}>
                  <span className="demo-contrib-name">{w.name}{w.pct != null && <small>{w.pct.toFixed(1)}%</small>}</span>
                  <div className="demo-contrib-bar"><span className="pos" style={{ width: `${(Math.abs(w.gainPaise) / barMax) * 100}%` }} /></div>
                  <b className="gain">{shortRupees(w.gainPaise)}</b>
                </div>
              ))}
            </div>
            <div className="demo-card">
              <div className="demo-card-head">Dragged the most</div>
              {h.draggers.length === 0 && <p className="mut small">Nothing is below cost — nice.</p>}
              {h.draggers.map((w) => (
                <div className="demo-contrib" key={w.name}>
                  <span className="demo-contrib-name">{w.name}{w.pct != null && <small>{w.pct.toFixed(1)}%</small>}</span>
                  <div className="demo-contrib-bar"><span className="neg" style={{ width: `${(Math.abs(w.gainPaise) / barMax) * 100}%` }} /></div>
                  <b className="loss">{shortRupees(w.gainPaise)}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What it earned + how it did */}
        <div className="demo-split">
          <div className="demo-card">
            <div className="demo-card-head">What it earned you</div>
            <div className="demo-line"><span>Income booked this year<small>dividends + interest</small></span><b>{rupees(h.incomeFyPaise)}</b></div>
            <div className="demo-line"><span>Realised gains this year<small>short + long term</small></span><b>{rupees(h.realisedFyPaise)}</b></div>
            <div className="demo-line"><span>Estimated tax on booked gains</span><b className="loss">{rupees(h.estTaxPaise)}</b></div>
          </div>
          <div className="demo-card">
            <div className="demo-card-head">Was it worth the effort?</div>
            {h.xirrPct != null ? (
              <>
                <div className="demo-line"><span>Your return (XIRR)</span><b className={h.xirrPct >= 0 ? "gain" : "loss"}>{h.xirrPct.toFixed(1)}%</b></div>
                <div className="demo-line"><span>A bank FD would give</span><b>{h.fdPct.toFixed(1)}%</b></div>
                <div className="demo-line"><span>After ~6% inflation, real return</span><b className={(h.realAfterInflationPct ?? 0) >= 0 ? "gain" : "loss"}>{h.realAfterInflationPct?.toFixed(1)}%</b></div>
              </>
            ) : (
              <p className="mut small">XIRR needs every holding to have a current price. Add prices to see your true return.</p>
            )}
          </div>
        </div>

        <p className="demo-tone">
          Decision review (sold-too-early, held-too-long) and the vs-Nifty comparison need daily price history — they turn on once FolioLense has been storing it for a while.
        </p>
      </div>
    </Modal>
  );
}
