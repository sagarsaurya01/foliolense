"use client";

import { gainsSummary, incomeRows } from "@/lib/reports";
import { LTCG_EQUITY_EXEMPT_PAISE } from "@/lib/calc/gains";
import { computeFno, type FnoTrade } from "@/lib/calc/fno";
import { rupees } from "@/lib/format";
import type { TxRow } from "@/lib/holdings";
import type { FnoTradeRow } from "./FnoBook";

const STCG_EQUITY = 0.2; // listed equity / equity funds, short term (post Jul-2024)
const LTCG_RATE = 0.125; // 12.5%
const fyOfDate = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  const s = m >= 4 ? y : y - 1;
  return `${s}-${String((s + 1) % 100).padStart(2, "0")}`;
};
const money = (p: number) => <span className={`num ${p >= 0 ? "gain" : "loss"}`}>{rupees(p)}</span>;

/** CA view: capital gains (FIFO), F&O turnover/P&L, and income — all from the family's own transactions. */
export function CaView({
  rows,
  fnoTrades,
  title,
}: {
  rows: TxRow[];
  fnoTrades: FnoTradeRow[];
  title: string;
}) {
  // Capital gains, newest financial year that has any realised gain
  const summ = gainsSummary(rows);
  const fy = summ.length ? summ[summ.length - 1].fy : "2025-26";
  const cg = summ.find((s) => s.fy === fy);
  const st = cg?.shortTermPaise ?? 0;
  const ltEq = cg?.longTermEquityPaise ?? 0;
  const ltOther = (cg?.longTermPaise ?? 0) - ltEq;
  const stTax = Math.max(0, Math.round(st * STCG_EQUITY));
  const ltEqTax = Math.round(Math.max(0, ltEq - LTCG_EQUITY_EXEMPT_PAISE) * LTCG_RATE);
  const ltOtherTax = Math.round(Math.max(0, ltOther) * LTCG_RATE);
  const totalTax = stTax + ltEqTax + ltOtherTax;
  const harvestRoom = Math.max(0, LTCG_EQUITY_EXEMPT_PAISE - ltEq);

  // F&O turnover + P&L for the same FY
  const ftrades: FnoTrade[] = fnoTrades.map((t) => ({
    underlying: t.underlying, instrument: t.instrument, expiry: t.expiry,
    strikePaise: t.strike_paise ?? undefined, segment: t.segment,
    date: t.trade_date, side: t.side, quantity: t.quantity, pricePaise: t.price_paise,
  }));
  const fno = computeFno(ftrades);
  const turnover = fno.turnoverPaiseByFy[fy] ?? 0;
  const fnoPnl = fno.realised.filter((r) => fyOfDate(r.closeDate) === fy).reduce((a, r) => a + r.pnlPaise, 0);
  const hasFno = fnoTrades.length > 0;

  // Income for the same FY
  const inc = incomeRows(rows).filter((r) => r.fy === fy);
  const div = inc.filter((r) => r.kind === "dividend").reduce((a, r) => a + r.amountPaise, 0);
  const interest = inc.filter((r) => r.kind === "interest").reduce((a, r) => a + r.amountPaise, 0);

  return (
    <div className="demo-owner" style={{ padding: "4px 2px 8px" }}>
      <div className="demo-band">
        <div className="demo-band-head">
          <span className="demo-kicker">CA</span>
          <h2>Tax, calendar &amp; family</h2>
          <p>{title} · FY {fy} · FIFO realised gains and F&amp;O turnover, from your own transactions.</p>
        </div>

        <div className="demo-split">
          <div className="demo-card">
            <div className="demo-card-head">Capital gains · {fy} (FIFO)</div>
            <table className="demo-tax">
              <tbody>
                <tr><td>Short-term<small>20% (listed equity)</small></td><td className="num">{money(st)}</td><td className="num tax">{stTax ? rupees(stTax) : "—"}</td></tr>
                <tr><td>Long-term equity<small>12.5% over ₹1.25L</small></td><td className="num">{money(ltEq)}</td><td className="num tax">{ltEqTax ? rupees(ltEqTax) : "—"}</td></tr>
                <tr><td>Long-term other<small>12.5%</small></td><td className="num">{money(ltOther)}</td><td className="num tax">{ltOtherTax ? rupees(ltOtherTax) : "—"}</td></tr>
                <tr className="demo-tax-total"><td>Estimated tax on gains</td><td className="num"></td><td className="num">{rupees(totalTax)}</td></tr>
              </tbody>
            </table>
            <p className="demo-note">
              <b>112A</b>{" "}
              {harvestRoom > 0
                ? `You can still book about ${rupees(harvestRoom)} of long-term equity gains tax-free this year (₹1.25L exemption).`
                : "You've used the ₹1.25L long-term equity exemption this year."}
            </p>
          </div>

          <div className="demo-card">
            <div className="demo-card-head">F&amp;O &amp; income · {fy}</div>
            <div className="demo-line"><span>F&amp;O turnover<small>for the tax-audit check</small></span><b>{hasFno ? rupees(turnover) : "—"}</b></div>
            <div className="demo-line"><span>F&amp;O profit / loss</span><b>{hasFno ? money(fnoPnl) : "—"}</b></div>
            <div className="demo-line"><span>Dividends</span><b>{rupees(div)}</b></div>
            <div className="demo-line"><span>Interest (FD + bonds)</span><b>{rupees(interest)}</b></div>
            {!hasFno && <p className="demo-note" style={{ marginTop: 12 }}>No F&amp;O trades in this family — turnover and P/L appear once there are F&amp;O positions.</p>}
            <p className="demo-note" style={{ marginTop: 12 }}>Exports: realised-gains CSV and the Schedule 112A format are on the Reports screen.</p>
          </div>
        </div>

        <p className="demo-tone">
          Old-vs-new regime, a tax calendar and a read-only CA share link are planned — they need a quick income profile (Preferences) and sharing setup. Gains and turnover are exact from your transactions; the tax figures are estimates.
        </p>
      </div>
    </div>
  );
}
