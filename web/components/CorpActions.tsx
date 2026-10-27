"use client";

import { useEffect, useState, useTransition } from "react";
import { applyCorporateAction, heldEquityAssets, type CorpActionType, type HeldAsset } from "@/app/corp-actions";
import { Modal, ModalHead } from "./Modal";

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function CorpActions({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const [assets, setAssets] = useState<HeldAsset[] | null>(null);
  const [assetId, setAssetId] = useState("");
  const [type, setType] = useState<CorpActionType>("bonus");
  const [exDate, setExDate] = useState(today());
  const [a, setA] = useState("1"); // ratio from
  const [b, setB] = useState("1"); // ratio to
  const [perShare, setPerShare] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    void heldEquityAssets().then((list) => { setAssets(list); if (list[0]) setAssetId(list[0].id); });
  }, []);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!assetId) return setError("Pick a holding.");
    start(async () => {
      const r = await applyCorporateAction({
        assetId, type, exDate,
        ratioFrom: Number(a), ratioTo: Number(b),
        perSharePaise: type === "dividend" ? Math.round(Number(perShare) * 100) : undefined,
      });
      if (r.error) setError(r.error);
      else onDone(r.applied ? `Applied to ${r.applied} portfolio${r.applied === 1 ? "" : "s"}` : "No portfolio held this on the ex-date");
    });
  };

  const assetName = assets?.find((x) => x.id === assetId)?.name ?? "";

  return (
    <Modal onClose={onClose}>
      <ModalHead title="Corporate action" onClose={onClose} />
      <form className="dlg" onSubmit={apply}>
        <p className="note" style={{ margin: 0 }}>Apply a split, bonus or dividend to a stock. It adjusts every portfolio that held it on the ex-date, so your share counts and cost stay right.</p>
        <label className="field">
          Stock
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            {assets === null ? <option>Loading…</option> : assets.length === 0 ? <option value="">No stock holdings yet</option> : assets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <div className="grid2">
          <label className="field">
            Action
            <select value={type} onChange={(e) => setType(e.target.value as CorpActionType)}>
              <option value="bonus">Bonus shares</option>
              <option value="split">Stock split</option>
              <option value="dividend">Dividend</option>
            </select>
          </label>
          <label className="field">Ex-date<input type="date" value={exDate} max={today()} onChange={(e) => setExDate(e.target.value)} /></label>
        </div>
        {type === "bonus" && (
          <div className="grid2">
            <label className="field">Bonus shares (b)<input type="number" min="1" value={b} onChange={(e) => setB(e.target.value)} /></label>
            <label className="field">for every held (a)<input type="number" min="1" value={a} onChange={(e) => setA(e.target.value)} /></label>
            <span className="note" style={{ gridColumn: "1 / -1" }}>e.g. 1 bonus for every 1 held (1:1) doubles your shares at no extra cost.</span>
          </div>
        )}
        {type === "split" && (
          <div className="grid2">
            <label className="field">Old face value (a)<input type="number" min="1" value={a} onChange={(e) => setA(e.target.value)} /></label>
            <label className="field">New face value (b)<input type="number" min="1" value={b} onChange={(e) => setB(e.target.value)} /></label>
            <span className="note" style={{ gridColumn: "1 / -1" }}>e.g. ₹10 → ₹2 (10 and 2) turns 1 share into 5, price per share drops to match.</span>
          </div>
        )}
        {type === "dividend" && (
          <label className="field">Dividend per share (₹)<input type="number" step="any" min="0" value={perShare} onChange={(e) => setPerShare(e.target.value)} /></label>
        )}
        {assetName && <span className="note">Applies to {assetName}, on the ex-date, across all holders.</span>}
        <div className="err" role="alert">{error}</div>
        <div className="row-end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={pending || !assets?.length}>{pending ? "Applying…" : "Apply"}</button>
        </div>
      </form>
    </Modal>
  );
}
