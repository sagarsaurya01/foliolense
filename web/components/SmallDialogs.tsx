"use client";

import { useState, useTransition } from "react";
import { deleteThing, renameFamily, renameGroup, renamePortfolio, setAssetPrice } from "@/app/tx-actions";
import { rupees } from "@/lib/format";
import type { Holding } from "@/lib/holdings";
import { Modal } from "./Modal";

export function PriceDialog({ h, onClose, onDone }: { h: Holding; onClose: () => void; onDone: (m: string) => void }) {
  const current = h.balance ? h.meta.value_paise : h.meta.price_paise;
  const [v, setV] = useState(current != null ? String(current / 100) : "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await setAssetPrice(h.assetId, Number(v), h.balance);
      if (r.error) setError(r.error);
      else onDone(h.balance ? "Value updated" : "Price updated");
    });
  };
  return (
    <Modal onClose={onClose}>
      <form className="dlg" onSubmit={save}>
        <h2>{h.balance ? "Current value" : "Current price"}</h2>
        <span className="mut" style={{ fontSize: 13 }}>{h.name}</span>
        <label className="field">
          {h.balance ? "Value today (₹, whole holding)" : "Price per unit today (₹)"}
          <input id="priceInput" autoFocus type="number" step="any" min="0" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
        </label>
        {!h.balance && h.meta.price_paise != null && (
          <span className="note">Last price ₹{rupees(h.meta.price_paise)} on {h.meta.price_date}. The old price becomes yesterday&apos;s close, so Today&apos;s gain works.</span>
        )}
        <span className="note">Typed prices are temporary: daily prices from NSE/BSE and AMFI replace them in Phase 2.</span>
        <div className="err" role="alert">{error}</div>
        <div className="row-end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={pending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

type Kind = "family" | "portfolio" | "group";
const RENAME = { family: renameFamily, portfolio: renamePortfolio, group: renameGroup };

export function RenameDialog({ kind, id, name, onClose, onDone }: { kind: Kind; id: string; name: string; onClose: () => void; onDone: (m: string) => void }) {
  const [v, setV] = useState(name);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal onClose={onClose}>
      <form
        className="dlg"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await RENAME[kind](id, v);
            if (r.error) setError(r.error);
            else onDone("Renamed");
          });
        }}
      >
        <h2>Rename {kind}</h2>
        <label className="field">
          New name
          <input id="renameInput" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
        </label>
        <div className="err" role="alert">{error}</div>
        <div className="row-end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={pending}>Rename</button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteDialog({ kind, id, name, onClose, onDone }: { kind: Kind; id: string; name: string; onClose: () => void; onDone: (m: string) => void }) {
  const [v, setV] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const what =
    kind === "family" ? "the family, every portfolio in it and all their transactions"
      : kind === "portfolio" ? "this portfolio and all its transactions"
        : "the group only (its portfolios and transactions stay)";
  return (
    <Modal onClose={onClose}>
      <form
        className="dlg"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await deleteThing(kind, id, v);
            if (r.error) setError(r.error);
            else onDone(`Deleted ${kind}`);
          });
        }}
      >
        <h2>Delete {kind}?</h2>
        <p style={{ margin: 0 }}>This permanently removes {what}. It can&apos;t be undone.</p>
        <label className="field">
          Type <b style={{ color: "var(--ink)" }}>{name}</b> to confirm
          <input id="deleteConfirm" autoFocus autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} />
        </label>
        <div className="err" role="alert">{error}</div>
        <div className="row-end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" style={{ borderColor: "var(--loss)", color: "var(--loss)" }} disabled={pending || v.trim() !== name.trim()}>
            Delete
          </button>
        </div>
      </form>
    </Modal>
  );
}
