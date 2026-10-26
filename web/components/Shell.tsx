"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createFamily, createPortfolio, signOut } from "@/app/actions";
import { ASSET_CLASSES, PORTFOLIO_TYPES, classInfo, typeLabel } from "@/lib/assetClasses";
import { initials, quantity, rupees, shortRupees } from "@/lib/format";
import { Logo } from "./Logo";

export type ShellTx = {
  portfolio_id: string;
  type: string;
  trade_date: string;
  quantity: number;
  amount_paise: number;
  asset: { id: string; name: string; asset_class: string };
};
type Family = { id: string; name: string };
type Portfolio = { id: string; family_id: string; name: string; type: string; book: string };

type Props = {
  email: string;
  families: Family[];
  family: Family;
  portfolios: Portfolio[];
  book: "inv" | "fno";
  selected: string;
  tab: string;
  tx: ShellTx[];
};

const INFLOW = new Set(["buy", "deposit", "opening", "bonus", "merge_in"]);
const OUTFLOW = new Set(["sell", "withdraw", "merge_out"]);

// Phase 0 roll-up: quantity and cost by average cost. Phase 1 replaces this with FIFO lots (lib/calc/fifo.ts).
function rollUp(tx: ShellTx[]) {
  const m = new Map<string, { id: string; name: string; cls: string; qty: number; cost: number; owners: Set<string> }>();
  [...tx]
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
    .forEach((t) => {
      const h = m.get(t.asset.id) ?? { id: t.asset.id, name: t.asset.name, cls: t.asset.asset_class, qty: 0, cost: 0, owners: new Set<string>() };
      const q = Number(t.quantity);
      if (INFLOW.has(t.type)) {
        h.qty += q;
        h.cost += Number(t.amount_paise);
      } else if (OUTFLOW.has(t.type) && h.qty > 0) {
        h.cost -= (h.cost * Math.min(q, h.qty)) / h.qty;
        h.qty -= q;
      }
      h.owners.add(t.portfolio_id);
      m.set(t.asset.id, h);
    });
  return [...m.values()].filter((h) => h.qty > 1e-9 || h.cost > 0);
}

export function Shell({ email, families, family, portfolios, book, selected, tab, tx }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [showType, setShowType] = useState("");
  const [assetQ, setAssetQ] = useState("");
  const [dlg, setDlg] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const famPorts = portfolios.filter((p) => p.family_id === family.id);
  const bookPorts = famPorts.filter((p) => p.book === book);
  const current = bookPorts.find((p) => p.id === selected);
  const holdings = useMemo(() => rollUp(tx), [tx]);
  const portName = (id: string) => portfolios.find((p) => p.id === id)?.name ?? "";

  const say = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };
  const soon = (what: string, phase: number) => () => {
    setOpen(null);
    say(`${what} arrives in Phase ${phase}`);
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".dd")) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const href = (q: { p?: string; book?: string; tab?: string; fam?: string }) => {
    const params = new URLSearchParams();
    const b = q.book ?? book;
    if (b === "fno") params.set("book", "fno");
    const p = q.p ?? (q.book && q.book !== book ? undefined : selected);
    if (p && p !== "all") params.set("p", p);
    const t = q.tab ?? (q.p || q.book ? "ALL" : tab);
    if (t !== "ALL") params.set("tab", t);
    const s = params.toString();
    return `/family/${q.fam ?? family.id}${s ? "?" + s : ""}`;
  };
  const toggle = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(open === id ? null : id);
  };

  const shown = holdings.filter((h) => (tab === "ALL" || h.cls === tab) && (!assetQ || h.name.toLowerCase().includes(assetQ.toLowerCase())));
  const invested = holdings.reduce((s, h) => s + h.cost, 0);
  const shownInvested = shown.reduce((s, h) => s + h.cost, 0);
  const valueOf = (pid: string | "all") => {
    // invested per portfolio for the rail (current value needs prices: Phase 2)
    const ids = pid === "all" ? bookPorts.map((p) => p.id) : [pid];
    return tx.filter((t) => ids.includes(t.portfolio_id)).reduce((s, t) => s + (INFLOW.has(t.type) ? Number(t.amount_paise) : 0), 0);
  };
  const railList = [
    ...(book === "inv" ? [{ id: "all", name: "Family Group", type: "All members" }] : []),
    ...bookPorts.filter((p) => !showType || p.type === showType),
  ].filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {/* S01 top bar */}
      <header className="top">
        <div className="top-in pad">
          <Logo />
          <nav className="menu" aria-label="Main menu">
            <div className="dd">
              <button className="car" onClick={toggle("api")} aria-expanded={open === "api"}>API</button>
              {open === "api" && (
                <div className="panel">
                  <div className="hd label">Connect a broker</div>
                  {["Zerodha", "Dhan", "Upstox", "Angel One"].map((b) => (
                    <button key={b} className="it" onClick={soon(`${b} connect`, 6)}>{b}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={soon("Import", 3)}>Import</button>
            <button onClick={soon("Analytics", 1)}>Analytics <span className="new">NEW</span></button>
            <div className="dd">
              <button className="car" onClick={toggle("tools")} aria-expanded={open === "tools"}>Tools</button>
              {open === "tools" && (
                <div className="panel">
                  <button className="it" onClick={soon("Global Reports", 4)}>Global Reports</button>
                  <button className="it" onClick={soon("Corporate Actions", 6)}>Corporate Actions</button>
                  <button className="it" onClick={soon("Global Asset Search", 2)}>Global Asset Search</button>
                  <button className="it" onClick={soon("Reconcile Holdings", 3)}>Reconcile Holdings</button>
                </div>
              )}
            </div>
            <button onClick={() => say("Help centre comes later")}>Help</button>
            <div className="dd">
              <button className="car" onClick={toggle("user")} aria-expanded={open === "user"}>
                <span className="avatar">{initials(email)}</span>
              </button>
              {open === "user" && (
                <div className="panel">
                  <div className="hd mut" style={{ fontSize: 12 }}>{email}</div>
                  <button className="it" onClick={soon("My Account", 1)}>My Account</button>
                  <form action={signOut}>
                    <button className="it">Sign out</button>
                  </form>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* S02 family bar */}
      <div className="sub">
        <div className="sub-in pad">
          <div className="dd">
            <button className="famBtn car" onClick={toggle("fam")} aria-expanded={open === "fam"}>{family.name}</button>
            {open === "fam" && <FamilyPanel families={families} portfolios={portfolios} href={href} onDone={() => setOpen(null)} say={say} />}
          </div>
          <label className="gsearch">
            <SearchIcon />
            <input placeholder="Search portfolios and families" aria-label="Search portfolios and families" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="shell">
        {/* S03 rail */}
        <aside className="rail">
          <div className="seg" role="group" aria-label="Book">
            <Link href={href({ book: "inv" })} aria-current={book === "inv"}>INV</Link>
            <Link href={href({ book: "fno" })} aria-current={book === "fno"}>F&amp;O</Link>
          </div>
          <div className="idx">
            <div><span className="nm">Sensex</span><span className="mut">—</span></div>
            <div><span className="nm">Nifty 50</span><span className="mut">—</span></div>
            <span className="note">Index prices start in Phase 2</span>
          </div>
          {book === "inv" && (
            <label className="field">
              Show
              <select value={showType} onChange={(e) => setShowType(e.target.value)}>
                <option value="">All portfolios</option>
                {PORTFOLIO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          )}
          <div className="plist">
            {railList.map((p) => (
              <Link key={p.id} className="pbtn" href={href({ p: p.id })} aria-current={p.id === selected}>
                <span className="who">
                  <span>{p.name}</span>
                  <small>{p.id === "all" ? p.type : book === "fno" ? "F&O" : typeLabel(p.type)}</small>
                </span>
                {book === "inv" && (selected === "all" || p.id === selected) && <small className="num">{shortRupees(valueOf(p.id))}</small>}
              </Link>
            ))}
            {!railList.length && <span className="mut" style={{ fontSize: 13 }}>{bookPorts.length ? "No match" : "No portfolios yet."}</span>}
          </div>
          <button className="addp" onClick={() => setDlg(true)}><span className="plus">+</span>Add Portfolio</button>
        </aside>

        {/* S04–S07 main */}
        <main className="main pad">
          <div className="phead">
            <span className="crumb">{book === "fno" ? "F&O Portfolio:" : "Portfolio:"}</span>
            <h1>{current?.name ?? (book === "inv" ? "Family Group" : "—")}</h1>
            <span className="chip">{current ? (book === "fno" ? "F&O" : typeLabel(current.type)) : `${bookPorts.length} portfolios combined`}</span>
            <div className="actions">
              <button className="addc" title="Add a transaction" onClick={soon("Adding transactions", 1)}>+</button>
              <button className="mb car" onClick={soon("XIRR", 1)}>XIRR</button>
              <button className="mb car" onClick={soon("Actions menu", 1)}>Actions</button>
              <button className="mb car" onClick={soon("Preferences", 1)}>Preferences</button>
              <button className="mb" onClick={soon("Reports", 4)}>Reports</button>
            </div>
          </div>

          {book === "fno" ? (
            <div className="tbox">
              <div className="empty">
                {bookPorts.length ? "No F&O trades yet. The F&O book is built in Phase 5." : "No F&O portfolio in this family yet."}
                {!bookPorts.length && <button className="addp" onClick={() => setDlg(true)}><span className="plus">+</span>Add Portfolio</button>}
              </div>
            </div>
          ) : (
            <>
              <section className="summary" aria-label="Summary">
                <div className="stat"><span className="label">Invested</span><span className="v num">₹{rupees(invested)}</span><span className="s mut">{holdings.length} holdings</span></div>
                <div className="stat"><span className="label">Current value</span><span className="v num mut">—</span><span className="s mut">needs prices (Phase 2)</span></div>
                <div className="stat"><span className="label">Today&apos;s gain</span><span className="v num mut">—</span><span className="s mut">needs prices</span></div>
                <div className="stat"><span className="label">Unrealised gain</span><span className="v num mut">—</span><span className="s mut">needs prices</span></div>
                <div className="stat"><span className="label">XIRR</span><span className="v num mut">—</span><span className="s mut">Phase 1</span></div>
              </section>

              <div className="tabsWrap">
                <div className="tabs" role="tablist" aria-label="Asset class">
                  {[{ code: "ALL", chip: "ALL", name: "All assets" }, ...ASSET_CLASSES].map((c) => {
                    const n = c.code === "ALL" ? holdings.length : holdings.filter((h) => h.cls === c.code).length;
                    return (
                      <Link key={c.code} className="tab" role="tab" href={href({ tab: c.code })} aria-selected={tab === c.code}>
                        <code>{c.chip}</code>{c.name}{n > 0 && <span className="n">{n}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <label className="asearch" style={{ flex: "0 1 280px", background: "var(--surface)" }}>
                <SearchIcon />
                <input placeholder="Search assets" aria-label="Search assets" value={assetQ} onChange={(e) => setAssetQ(e.target.value)} />
              </label>

              <div className="tbox">
                {shown.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Qty.<br /><span style={{ color: "var(--accent)", fontWeight: 500 }}>Avg. pur. price</span></th>
                        <th>Amt.<br />Invested</th>
                        <th>Current<br />Price</th>
                        <th>Today&apos;s<br />Gain</th>
                        <th>Unrealised<br />Gain</th>
                        <th>Current<br />Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ASSET_CLASSES.filter((c) => shown.some((h) => h.cls === c.code)).flatMap((c) => {
                        const group = shown.filter((h) => h.cls === c.code).sort((a, b) => b.cost - a.cost);
                        return [
                          <tr className="grp" key={c.code}>
                            <td><code className="gcode">{c.chip}</code> {c.name} <span className="chip">{group.length}</span></td>
                            <td /><td className="num">{rupees(group.reduce((s, h) => s + h.cost, 0))}</td><td /><td /><td /><td />
                          </tr>,
                          ...group.map((h) => (
                            <tr className="row" key={h.id}>
                              <td>
                                {h.name}
                                {selected === "all" && (
                                  <span className="mut" style={{ fontSize: 11 }}>
                                    {" "}· {h.owners.size > 1 ? `${h.owners.size} members` : portName([...h.owners][0])}
                                  </span>
                                )}
                              </td>
                              <td>
                                {classInfo(h.cls).balance ? <span className="mut">—</span> : (
                                  <div className="two"><span className="num">{quantity(h.qty)}</span><small className="num">{rupees(h.cost / h.qty)}</small></div>
                                )}
                              </td>
                              <td className="num">{rupees(h.cost)}</td>
                              <td className="mut">—</td><td className="mut">—</td><td className="mut">—</td><td className="mut">—</td>
                            </tr>
                          )),
                        ];
                      })}
                    </tbody>
                    <tfoot>
                      <tr><td>NET WORTH</td><td /><td className="num">{rupees(shownInvested)}</td><td /><td /><td /><td className="mut">—</td></tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="empty">
                    {assetQ ? "No assets match that search." : bookPorts.length ? `Nothing in ${tab === "ALL" ? "this portfolio" : classInfo(tab).name} yet.` : "Add your first portfolio to get started."}
                    {bookPorts.length ? (
                      <button className="addp" onClick={soon("Adding transactions", 1)}><span className="plus">+</span>Add a transaction</button>
                    ) : (
                      <button className="addp" onClick={() => setDlg(true)}><span className="plus">+</span>Add Portfolio</button>
                    )}
                  </div>
                )}
              </div>
              <span className="note">Phase 0: quantities and invested amounts only. Prices, gains and XIRR are filled in by Phases 1–2.</span>
            </>
          )}
        </main>
      </div>

      {dlg && (
        <AddPortfolio
          familyId={family.id}
          book={book}
          onClose={() => setDlg(false)}
          onAdded={(id, b) => {
            setDlg(false);
            say("Portfolio added");
            router.push(`/family/${family.id}?${b === "fno" ? "book=fno&" : ""}p=${id}`);
          }}
        />
      )}
      <div className={`toast${toast ? " on" : ""}`} role="status">{toast}</div>
    </>
  );
}

function FamilyPanel({
  families,
  portfolios,
  href,
  onDone,
  say,
}: {
  families: Family[];
  portfolios: Portfolio[];
  href: (q: { p?: string; book?: string; fam?: string }) => string;
  onDone: () => void;
  say: (m: string) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const rows = families.flatMap((f) => [
    { f, p: null as Portfolio | null },
    ...portfolios.filter((p) => p.family_id === f.id).map((p) => ({ f, p })),
  ]).filter((r) => !q || `${r.f.name} ${r.p ? r.p.name : "Family Group"}`.toLowerCase().includes(q.toLowerCase()));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createFamily(name);
      if (r.error) return say(r.error);
      onDone();
      say(`Family "${name.trim()}" added`);
      router.push(`/family/${r.id}`);
    });
  };

  return (
    <div className="panel left fampanel" onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 14 }}>
        <button className="link" onClick={() => say("Renaming a family arrives in Phase 1")}>✎ Edit Family</button>
        <button className="link" onClick={() => setAdding(true)}>+ Add Family</button>
      </div>
      {adding && (
        <form onSubmit={add} style={{ display: "flex", gap: 6 }}>
          <input className="inp" autoFocus placeholder="New family name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <button className="btn primary" disabled={pending}>Add</button>
        </form>
      )}
      <label className="gsearch" style={{ margin: 0, flex: "none" }}>
        <SearchIcon />
        <input placeholder="Search families" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="it label" style={{ padding: "4px 10px" }}><span>Family</span><span>Portfolio</span></div>
      <div className="list">
        {rows.map((r) => (
          <Link
            key={r.f.id + (r.p?.id ?? "all")}
            className="it"
            onClick={onDone}
            href={r.p ? href({ fam: r.f.id, p: r.p.id, book: r.p.book }) : `/family/${r.f.id}`}
          >
            <span>{r.f.name}</span>
            <span className="mut">{r.p ? r.p.name : "Family Group"}</span>
          </Link>
        ))}
        {!rows.length && <div className="it mut">No match</div>}
      </div>
    </div>
  );
}

function AddPortfolio({
  familyId,
  book,
  onClose,
  onAdded,
}: {
  familyId: string;
  book: string;
  onClose: () => void;
  onAdded: (id: string, book: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [b, setB] = useState(book);
  const [type, setType] = useState("individual");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await createPortfolio(familyId, name, type, b);
      if (r.error) setError(r.error);
      else onAdded(r.id!, b);
    });
  };

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form className="dlg" onSubmit={save}>
        <h2>Add portfolio</h2>
        <label className="field">
          Name
          <input id="portfolioName" autoFocus placeholder="e.g. Meera HUF" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid2">
          <label className="field">
            Book
            <select id="portfolioBook" value={b} onChange={(e) => setB(e.target.value)}>
              <option value="inv">Investments</option>
              <option value="fno">F&amp;O</option>
            </select>
          </label>
          <label className="field">
            Type
            <select id="portfolioType" value={type} onChange={(e) => setType(e.target.value)}>
              {PORTFOLIO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
        </div>
        <div className="err" role="alert">{error}</div>
        <div className="row-end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={pending}>{pending ? "Adding…" : "Add portfolio"}</button>
        </div>
      </form>
    </dialog>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
