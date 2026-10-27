"use client";

import { useMemo, useState, useTransition } from "react";
import { saveTransaction, type TxInput } from "@/app/tx-actions";
import { ASSET_CLASSES, classInfo } from "@/lib/assetClasses";
import type { DepositTerms } from "@/lib/calc/deposits";
import type { TxType } from "@/lib/calc/fifo";
import type { TxRow } from "@/lib/holdings";
import { Modal } from "./Modal";

export type AssetOption = { id: string; name: string; asset_class: string };
type Port = { id: string; name: string };

const UNIT_TYPES: { v: TxType; l: string }[] = [
  { v: "buy", l: "Buy" },
  { v: "sell", l: "Sell" },
  { v: "dividend", l: "Dividend received" },
  { v: "bonus", l: "Bonus shares" },
  { v: "split", l: "Split" },
];
const BAL_TYPES: { v: TxType; l: string }[] = [
  { v: "deposit", l: "Deposit / invest" },
  { v: "withdraw", l: "Withdraw / redeem" },
  { v: "interest", l: "Interest received (paid out)" },
];

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function TxDialog({
  portfolios,
  defaultPortfolio,
  defaultClass,
  assets,
  edit,
  asOf,
  onClose,
  onSaved,
}: {
  portfolios: Port[];
  defaultPortfolio?: string;
  defaultClass?: string;
  assets: AssetOption[];
  edit?: TxRow | null;
  asOf: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const e = edit;
  const editBal = e ? !!classInfo(e.asset.asset_class).balance : false;
  const [portfolioId, setPortfolio] = useState(e?.portfolio_id ?? defaultPortfolio ?? portfolios[0]?.id ?? "");
  const [cls, setCls] = useState(e?.asset.asset_class ?? (defaultClass && defaultClass !== "ALL" ? defaultClass : "EQ"));
  const [name, setName] = useState(e?.asset.name ?? "");
  const balance = !!classInfo(cls).balance;
  const types = balance ? BAL_TYPES : UNIT_TYPES;
  const [type, setType] = useState<TxType>(e?.type === "opening" ? (editBal ? "deposit" : "buy") : e?.type ?? (balance ? "deposit" : "buy"));
  const [date, setDate] = useState(e?.trade_date ?? asOf);
  const [qty, setQty] = useState(e ? String(Number(e.quantity) || "") : "");
  const [price, setPrice] = useState(e ? String(Number(e.price_paise) / 100 || "") : "");
  const [charges, setCharges] = useState(e ? String(Number(e.charges_paise) / 100 || "") : "");
  const [current, setCurrent] = useState("");
  const [notes, setNotes] = useState(e?.notes ?? "");
  const dep = e?.asset.meta?.deposit;
  const [rate, setRate] = useState(dep ? String(dep.ratePct) : "");
  const [comp, setComp] = useState<DepositTerms["compounding"]>(dep?.compounding ?? (cls === "CD" ? "simple" : "quarterly"));
  const [maturity, setMaturity] = useState(dep?.maturity ?? "");
  const [payout, setPayout] = useState(!!dep?.payout);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const known = useMemo(() => assets.filter((a) => a.asset_class === cls), [assets, cls]);
  const match = known.find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
  const showQty = !balance && !["dividend"].includes(type);
  const showPrice = !["bonus", "split"].includes(type);
  const isDeposit = (cls === "FD" || cls === "CD") && type === "deposit";
  const amountLabel = balance || type === "dividend" ? "Amount (₹)" : "Price per unit (₹)";
  const total = showQty && showPrice && num(qty) > 0 && num(price) > 0 ? num(qty) * num(price) + (num(charges) || 0) * (type === "sell" ? -1 : 1) : null;

  const changeClass = (c: string) => {
    setCls(c);
    const b = !!classInfo(c).balance;
    if (b !== balance) setType(b ? "deposit" : "buy");
    if (c === "CD") setComp("simple");
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    const input: TxInput = {
      portfolioId,
      assetClass: cls,
      assetName: name,
      assetId: e && e.asset.name === name && e.asset.asset_class === cls ? e.asset_id : match?.id,
      type,
      date,
      quantity: type === "split" ? num(qty) : showQty ? num(qty) : 1,
      price: showPrice ? num(price) : 0,
      charges: num(charges) || 0,
      currentPrice: num(current) > 0 ? num(current) : null,
      deposit: isDeposit && num(rate) > 0 ? { ratePct: num(rate), compounding: comp, start: date, maturity: maturity || undefined, payout } : null,
      notes,
    };
    start(async () => {
      const r = await saveTransaction(input, e?.id);
      if (r.error) setError(r.error);
      else onSaved(e ? "Transaction updated" : "Transaction saved");
    });
  };

  return (
    <Modal onClose={onClose}>
      <form className="dlg" onSubmit={submit} noValidate>
        <h2>{e ? "Edit transaction" : "Add a transaction"}</h2>
        <div className="grid2">
          <label className="field">
            Portfolio
            <select id="txPortfolio" value={portfolioId} onChange={(x) => setPortfolio(x.target.value)}>
              {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field">
            Asset class
            <select id="txClass" value={cls} onChange={(x) => changeClass(x.target.value)} disabled={!!e}>
              {ASSET_CLASSES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          Asset name
          <input id="txName" list="txAssets" autoComplete="off" placeholder={balance ? "e.g. SBI FD 7.1% 2027" : "e.g. HDFC Bank"} value={name} onChange={(x) => setName(x.target.value)} />
          <datalist id="txAssets">{known.map((a) => <option key={a.id} value={a.name} />)}</datalist>
          {name.trim() && !match && !e && <span className="note">New asset: it will be created.</span>}
        </label>
        <div className="grid2">
          <label className="field">
            Type
            <select id="txType" value={type} onChange={(x) => setType(x.target.value as TxType)}>
              {types.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
          <label className="field">
            Date
            <input id="txDate" type="date" value={date} max={asOf} onChange={(x) => setDate(x.target.value)} />
          </label>
          {showQty && (
            <label className="field">
              {type === "split" ? "New shares per old share (1:10 split = 10)" : type === "bonus" ? "Bonus shares received" : "Quantity"}
              <input id="txQty" type="number" step="any" min="0" inputMode="decimal" value={qty} onChange={(x) => setQty(x.target.value)} />
            </label>
          )}
          {showPrice && (
            <label className="field">
              {amountLabel}
              <input id="txPrice" type="number" step="any" min="0" inputMode="decimal" value={price} onChange={(x) => setPrice(x.target.value)} />
            </label>
          )}
          {!balance && (type === "buy" || type === "sell") && (
            <label className="field">
              Charges (brokerage, STT, stamp, GST) ₹
              <input id="txCharges" type="number" step="any" min="0" inputMode="decimal" value={charges} onChange={(x) => setCharges(x.target.value)} />
            </label>
          )}
          {!e && type !== "dividend" && type !== "interest" && !isDeposit && (
            <label className="field">
              {balance ? "Current value (₹, optional)" : "Current price (₹, optional)"}
              <input id="txCurrent" type="number" step="any" min="0" inputMode="decimal" placeholder="Keep as it is" value={current} onChange={(x) => setCurrent(x.target.value)} />
            </label>
          )}
        </div>
        {isDeposit && (
          <fieldset className="grid2" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, margin: 0 }}>
            <legend className="label" style={{ padding: "0 4px" }}>{cls === "CD" ? "Loan terms" : "FD terms"} (value is worked out daily)</legend>
            <label className="field">
              Interest rate % a year
              <input id="txRate" type="number" step="any" min="0" value={rate} onChange={(x) => setRate(x.target.value)} />
            </label>
            <label className="field">
              Interest
              <select id="txComp" value={comp} onChange={(x) => setComp(x.target.value as DepositTerms["compounding"])}>
                <option value="quarterly">Compounded quarterly</option>
                <option value="monthly">Compounded monthly</option>
                <option value="half-yearly">Compounded half-yearly</option>
                <option value="yearly">Compounded yearly</option>
                <option value="simple">Simple interest</option>
              </select>
            </label>
            <label className="field">
              Maturity date
              <input id="txMaturity" type="date" value={maturity} onChange={(x) => setMaturity(x.target.value)} />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 18 }}>
              <input type="checkbox" checked={payout} onChange={(x) => setPayout(x.target.checked)} /> Interest paid out (not added to the FD)
            </label>
          </fieldset>
        )}
        <label className="field">
          Notes (optional)
          <input id="txNotes" value={notes} onChange={(x) => setNotes(x.target.value)} />
        </label>
        {total != null && <span className="note">Total {type === "sell" ? "received" : "paid"}: ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
        <div className="err" role="alert">{error}</div>
        <div className="row-end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
