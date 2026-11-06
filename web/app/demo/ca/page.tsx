import { capitalGains, harvest, income, inr, totalCapGainsTax } from "@/lib/demo/data";

export const metadata = { title: "Tax · Demo · FolioLense" };

export default function TaxDemo() {
  return (
    <div className="demo-owner">
      <div className="demo-band">
        <div className="demo-band-head">
          <span className="demo-kicker">Tax</span>
          <h2>Capital gains &amp; income</h2>
          <p>FIFO realised gains by financial year, ready for your return. Exportable for your CA.</p>
        </div>

        <div className="demo-split">
          <div className="demo-card">
            <div className="demo-card-head">Capital gains · {capitalGains.fy} (FIFO)</div>
            <table className="demo-tax">
              <tbody>
                {capitalGains.rows.map((r) => (
                  <tr key={r.kind}>
                    <td>{r.kind}<small>{r.rate}</small></td>
                    <td className="num">{inr(r.gain)}</td>
                    <td className="num tax">{r.tax ? inr(r.tax) : "—"}</td>
                  </tr>
                ))}
                <tr className="demo-tax-total">
                  <td>Estimated tax on gains</td>
                  <td className="num"></td>
                  <td className="num">{inr(totalCapGainsTax)}</td>
                </tr>
              </tbody>
            </table>
            <p className="demo-note"><b>112A</b> {harvest.text}</p>
          </div>

          <div className="demo-card">
            <div className="demo-card-head">Income · {capitalGains.fy}</div>
            <div className="demo-line"><span>Dividends</span><b>{inr(income.dividends)}</b></div>
            <div className="demo-line"><span>Interest (FD + bonds)</span><b>{inr(income.interest)}</b></div>
            <div className="demo-line"><span>TDS deducted<small>{income.ais}</small></span><b>{inr(income.tdsDeducted)}</b></div>
            <div className="demo-line"><span>Total income</span><b>{inr(income.dividends + income.interest)}</b></div>
            <p className="demo-note" style={{ marginTop: 12 }}>Exports: realised gains CSV and the Schedule 112A format, straight from the Reports screen.</p>
          </div>
        </div>

        <p className="demo-tone">Old-vs-new regime, a tax calendar and a read-only CA share link are planned — they need a quick income profile and sharing setup.</p>
      </div>
    </div>
  );
}
