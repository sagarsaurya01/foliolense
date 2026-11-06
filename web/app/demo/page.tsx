import {
  allocation,
  byMember,
  hindsight,
  income,
  inr,
  inrShort,
  inrSigned,
  totalCurrent,
  totalGain,
  totalGainPct,
  totalInvested,
} from "@/lib/demo/data";

function Band({ kicker, title, sub, children }: { kicker: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="demo-band">
      <div className="demo-band-head">
        <span className="demo-kicker">{kicker}</span>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </section>
  );
}

const CLS_COLORS: Record<string, string> = {
  "Indian Equity": "#d9603a",
  "Mutual Fund": "#2f8f6f",
  "F&O": "#b5553a",
  "Fixed Deposit": "#6a8caf",
  "PPF / EPF": "#c99a3a",
  NPS: "#8a6fb0",
  Gold: "#d9a441",
  Bonds: "#5f9ea0",
  Insurance: "#c0718f",
  "Private Equity": "#7b8a3a",
  Bank: "#4f8a8b",
};

export default function OverviewDemo() {
  const realised = hindsight.realised;
  const estTax = hindsight.estTax;
  const incomeTotal = income.dividends + income.interest;
  const xirr = hindsight.returns.you;
  const fd = hindsight.returns.fd;
  const realReturn = xirr - 6;
  const winMax = Math.max(...hindsight.winners.map((w) => Math.abs(w.gain)), ...hindsight.losers.map((w) => Math.abs(w.gain)));

  return (
    <div className="demo-owner">
      {/* portfolio snapshot — all real in the app today */}
      <Band kicker="Overview" title="Your family's wealth today">
        <div className="demo-hero">
          <div className="demo-hero-main">
            <span className="demo-hero-label">Net worth</span>
            <span className="demo-hero-value">{inrShort(totalCurrent)}</span>
            <span className={`demo-hero-gain ${totalGain >= 0 ? "gain" : "loss"}`}>
              {inrSigned(totalGain)} · {totalGainPct.toFixed(1)}% all time
            </span>
          </div>
          <div className="demo-tiles">
            <div className="demo-tile"><span>Invested</span><b>{inrShort(totalInvested)}</b></div>
            <div className="demo-tile"><span>Current</span><b>{inrShort(totalCurrent)}</b></div>
            <div className="demo-tile"><span>Total gain</span><b className={totalGain >= 0 ? "gain" : "loss"}>{inrShort(totalGain)}</b></div>
            <div className="demo-tile"><span>Booked this yr</span><b className="gain">{inrShort(realised)}</b></div>
          </div>
        </div>

        <div className="demo-split">
          <div className="demo-card">
            <div className="demo-card-head">Asset mix</div>
            <div className="demo-allocbar">
              {allocation.map((a) => (
                <span key={a.cls} style={{ width: `${a.pct}%`, background: CLS_COLORS[a.cls] ?? "#888" }} title={`${a.cls} ${a.pct.toFixed(0)}%`} />
              ))}
            </div>
            <ul className="demo-legend">
              {allocation.map((a) => (
                <li key={a.cls}>
                  <i style={{ background: CLS_COLORS[a.cls] ?? "#888" }} />
                  {a.cls}
                  <b>{a.pct.toFixed(0)}%</b>
                </li>
              ))}
            </ul>
          </div>

          <div className="demo-card">
            <div className="demo-card-head">By member</div>
            <ul className="demo-members">
              {byMember.map((m) => (
                <li key={m.name}>
                  <div className="demo-mem-row">
                    <span>{m.name}<small>{m.role}</small></span>
                    <b>{inrShort(m.current)}</b>
                  </div>
                  <div className="demo-mem-bar"><span style={{ width: `${m.pct}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Band>

      {/* Hindsight — only the parts that are real in the app */}
      <Band kicker="Hindsight" title="What happened to me this year" sub={`${hindsight.fy} · computed from your own transactions`}>
        <div className="demo-card hl">
          <div className="demo-q">Did I make money?</div>
          <div className="demo-money">
            <div className="demo-money-big">
              <span className="gain">{inrSigned(totalGain)}</span>
              <small>gain on your holdings · {totalGainPct.toFixed(1)}%</small>
            </div>
            <div className="demo-money-steps">
              <div><span>Invested</span><b>{inr(totalInvested)}</b></div>
              <div><span>Current value</span><b>{inr(totalCurrent)}</b></div>
              <div><span>Booked this year</span><b className="gain">{inr(realised)}</b><em>−{inrShort(estTax)} est. tax</em></div>
            </div>
          </div>
        </div>

        <div className="demo-split">
          <div className="demo-card">
            <div className="demo-card-head">Made most of the gain</div>
            {hindsight.winners.map((w) => (
              <div className="demo-contrib" key={w.name}>
                <span className="demo-contrib-name">{w.name}<small>{w.member}</small></span>
                <div className="demo-contrib-bar"><span className="pos" style={{ width: `${(Math.abs(w.gain) / winMax) * 100}%` }} /></div>
                <b className="gain">{inrShort(w.gain)}</b>
              </div>
            ))}
          </div>
          <div className="demo-card">
            <div className="demo-card-head">Dragged the most</div>
            {hindsight.losers.map((w) => (
              <div className="demo-contrib" key={w.name}>
                <span className="demo-contrib-name">{w.name}<small>{w.member}</small></span>
                <div className="demo-contrib-bar"><span className={w.gain < 0 ? "neg" : "pos"} style={{ width: `${(Math.abs(w.gain) / winMax) * 100}%` }} /></div>
                <b className={w.gain < 0 ? "loss" : "gain"}>{inrShort(w.gain)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="demo-split">
          <div className="demo-card">
            <div className="demo-card-head">What it earned you</div>
            <div className="demo-line"><span>Income this year<small>dividends + interest</small></span><b>{inr(incomeTotal)}</b></div>
            <div className="demo-line"><span>Realised gains this year</span><b>{inr(realised)}</b></div>
            <div className="demo-line"><span>Estimated tax on booked gains</span><b className="loss">{inr(estTax)}</b></div>
          </div>
          <div className="demo-card">
            <div className="demo-card-head">Was it worth the effort?</div>
            <div className="demo-line"><span>Your return (XIRR)</span><b className="gain">{xirr.toFixed(1)}%</b></div>
            <div className="demo-line"><span>A bank FD would give</span><b>{fd.toFixed(1)}%</b></div>
            <div className="demo-line"><span>After ~6% inflation, real return</span><b className="gain">{realReturn.toFixed(1)}%</b></div>
          </div>
        </div>
      </Band>
    </div>
  );
}
