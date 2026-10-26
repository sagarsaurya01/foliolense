"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createFamily, createGroup, createPortfolio, signOut } from "@/app/actions";
import { ASSET_CLASSES, PORTFOLIO_TYPES, classInfo, typeLabel } from "@/lib/assetClasses";
import { sumFigures } from "@/lib/calc/figures";
import { initials, rupees, shortRupees } from "@/lib/format";
import { buildHoldings, xirrPct, type Holding, type TxRow } from "@/lib/holdings";
import { AnalyticsCards, AnalyticsModal } from "./Analytics";
import { HoldingsTable } from "./Holdings";
import { ImportOpening } from "./ImportOpening";
import { Logo } from "./Logo";
import { DeleteDialog, PriceDialog, RenameDialog } from "./SmallDialogs";
import { ThemeButton, ThemeChoice } from "./ThemeSwitch";
import { TxDialog, type AssetOption } from "./TxDialog";
import { TxList } from "./TxList";

export type ShellGroup = { id: string; name: string; members: string[] }; // id is "g:<uuid>"
type Family = { id: string; name: string };
type Portfolio = { id: string; family_id: string; name: string; type: string; book: string };

type Props = {
  email: string;
  families: Family[];
  family: Family;
  portfolios: Portfolio[];
  groups: ShellGroup[];
  book: "inv" | "fno";
  selected: string;
  tab: string;
  rows: TxRow[];
  assets: AssetOption[];
  asOf: string;
};

type Dialog =
  | { kind: "tx"; edit?: TxRow | null }
  | { kind: "list" }
  | { kind: "price"; h: Holding }
  | { kind: "rename" | "delete"; what: "family" | "portfolio" | "group"; id: string; name: string }
  | { kind: "import" }
  | { kind: "analytics" }
  | { kind: "addPortfolio" }
  | null;

const pct = (n: number | null) => (n == null || !isFinite(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const tone = (n: number | null) => (n == null ? "mut" : n >= 0 ? "gain" : "loss");

export function Shell({ email, families, family, portfolios, groups, book, selected, tab, rows, assets, asOf }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [showType, setShowType] = useState("");
  const [assetQ, setAssetQ] = useState("");
  const [dlg, setDlg] = useState<Dialog>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const famPorts = portfolios.filter((p) => p.family_id === family.id);
  const invPorts = famPorts.filter((p) => p.book === "inv");
  const bookPorts = famPorts.filter((p) => p.book === book);
  const current = bookPorts.find((p) => p.id === selected);
  const currentGroup = groups.find((g) => g.id === selected);
  const combined = selected === "all" || !!currentGroup;
  const viewName = current?.name ?? currentGroup?.name ?? (book === "inv" ? "Family Group" : "—");
  const portName = (id: string) => portfolios.find((p) => p.id === id)?.name ?? "";

  const holdings = useMemo(() => buildHoldings(rows, asOf), [rows, asOf]);
  const total = sumFigures(holdings.map((h) => h.fig));
  const xirr = useMemo(() => xirrPct(rows, holdings, asOf), [rows, holdings, asOf]);
  const shown = holdings.filter((h) => (tab === "ALL" || h.cls === tab) && (!assetQ || h.name.toLowerCase().includes(assetQ.toLowerCase())));
  const unpriced = holdings.filter((h) => h.fig.currentPaise == null).length;

  const say = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };
  const soon = (what: string, phase: number) => () => {
    setOpen(null);
    say(`${what} arrives in Phase ${phase}`);
  };
  const show = (d: Dialog) => {
    setOpen(null);
    setDlg(d);
  };
  const done = (m: string) => {
    setDlg(null);
    say(m);
    router.refresh();
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

  // value of one portfolio's share of the loaded holdings (rail figures)
  const membersOf = (id: string) => (id === "all" ? bookPorts.map((p) => p.id) : groups.find((g) => g.id === id)?.members ?? [id]);
  const valueOf = (id: string) => {
    const ids = membersOf(id);
    return holdings.reduce((s, h) => {
      const cost = h.lots.reduce((a, l) => a + l.costPaise, 0) || 1;
      const mine = h.lots.filter((l) => ids.includes(l.portfolioId));
      if (h.fig.currentPaise == null) return s + mine.reduce((a, l) => a + l.costPaise, 0);
      if (h.balance) return s + (h.fig.currentPaise * mine.reduce((a, l) => a + l.costPaise, 0)) / cost;
      return s + mine.reduce((a, l) => a + l.qty, 0) * (h.meta.price_paise ?? 0);
    }, 0);
  };
  const showValue = (id: string) => membersOf(id).every((m) => membersOf(selected).includes(m));
  const railList = [
    ...(book === "inv"
      ? [
          { id: "all", name: "Family Group", type: "All members", group: true },
          ...groups.map((g) => ({ id: g.id, name: g.name, type: `Group · ${g.members.length} portfolios`, group: true })),
        ]
      : []),
    ...bookPorts.filter((p) => !showType || p.type === showType).map((p) => ({ ...p, type: book === "fno" ? "F&O" : typeLabel(p.type), group: false })),
  ].filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const xirrByClass = ASSET_CLASSES.map((c) => {
    const hs = holdings.filter((h) => h.cls === c.code);
    const ids = new Set(hs.map((h) => h.assetId));
    return { c, hs, x: hs.length ? xirrPct(rows.filter((r) => ids.has(r.asset_id)), hs, asOf) : null };
  }).filter((r) => r.hs.length);

  const thingToEdit = current
    ? { what: "portfolio" as const, id: current.id, name: current.name }
    : currentGroup
      ? { what: "group" as const, id: currentGroup.id, name: currentGroup.name }
      : null;

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
            <div className="dd">
              <button className="car" onClick={toggle("import")} aria-expanded={open === "import"}>Import</button>
              {open === "import" && (
                <div className="panel">
                  <button className="it" onClick={() => show({ kind: "import" })} disabled={book !== "inv"}>Opening balances (Excel)</button>
                  <button className="it" onClick={soon("Statement import (CAS, contract notes)", 3)}>Statements (CAS, contract notes)</button>
                </div>
              )}
            </div>
            <button onClick={() => show({ kind: "analytics" })} disabled={book !== "inv"}>Analytics <span className="new">NEW</span></button>
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
            <ThemeButton />
            <div className="dd">
              <button className="car" onClick={toggle("user")} aria-expanded={open === "user"}>
                <span className="avatar">{initials(email)}</span>
              </button>
              {open === "user" && (
                <div className="panel">
                  <div className="hd mut" style={{ fontSize: 12 }}>{email}</div>
                  <Link className="it" href="/account">My Account</Link>
                  <ThemeChoice />
                  <hr />
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
            {open === "fam" && (
              <FamilyPanel
                families={families}
                portfolios={portfolios}
                href={href}
                onDone={() => setOpen(null)}
                say={say}
                onEdit={() => show({ kind: "rename", what: "family", id: family.id, name: family.name })}
                onDelete={() => show({ kind: "delete", what: "family", id: family.id, name: family.name })}
              />
            )}
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
                  <small>{p.type}</small>
                </span>
                {book === "inv" && showValue(p.id) ? <small className="num">{shortRupees(valueOf(p.id))}</small> : p.group && <GroupIcon />}
              </Link>
            ))}
            {!railList.length && <span className="mut" style={{ fontSize: 13 }}>{bookPorts.length ? "No match" : "No portfolios yet."}</span>}
          </div>
          <button className="addp" onClick={() => show({ kind: "addPortfolio" })}><span className="plus">+</span>Add Portfolio</button>
        </aside>

        {/* S04–S07 main */}
        <main className="main pad">
          <div className="phead">
            <span className="crumb">{book === "fno" ? "F&O Portfolio:" : currentGroup ? "Group:" : "Portfolio:"}</span>
            <h1>{viewName}</h1>
            <span className="chip">
              {current
                ? book === "fno" ? "F&O" : typeLabel(current.type)
                : currentGroup
                  ? currentGroup.members.map((m) => portName(m)).join(" + ")
                  : `${bookPorts.length} portfolios combined`}
            </span>
            {book === "inv" && (
              <div className="actions">
                <button className="addc" title="Add a transaction" onClick={() => show({ kind: "tx" })} disabled={!invPorts.length}>+</button>
                <div className="dd">
                  <button className="mb car" onClick={toggle("xirr")}>XIRR</button>
                  {open === "xirr" && (
                    <div className="panel">
                      <div className="hd label">Since first investment, a year</div>
                      <div className="it"><b>{viewName}</b><b className={`num ${tone(xirr)}`}>{pct(xirr)}</b></div>
                      <hr />
                      {xirrByClass.map(({ c, x }) => (
                        <div className="it" key={c.code}><span>{c.name}</span><span className={`num ${tone(x)}`}>{pct(x)}</span></div>
                      ))}
                      {unpriced > 0 && <div className="hd note">Blank where a holding has no price yet.</div>}
                      <div className="hd note">Nifty 50 comparison arrives in Phase 2.</div>
                    </div>
                  )}
                </div>
                <div className="dd">
                  <button className="mb car" onClick={toggle("actions")}>Actions</button>
                  {open === "actions" && (
                    <div className="panel">
                      <button className="it" onClick={() => show({ kind: "list" })}>View All Transactions</button>
                      <button className="it" onClick={() => show({ kind: "tx" })} disabled={!invPorts.length}>Add a transaction</button>
                      <button className="it" onClick={() => show({ kind: "import" })}>Import opening balances (Excel)</button>
                      <button className="it" onClick={() => show({ kind: "addPortfolio" })}>Add portfolio or group</button>
                      {thingToEdit && (
                        <>
                          <hr />
                          <button className="it" onClick={() => show({ kind: "rename", ...thingToEdit })}>Rename {thingToEdit.what}</button>
                          <button className="it" style={{ color: "var(--loss)" }} onClick={() => show({ kind: "delete", ...thingToEdit })}>Delete {thingToEdit.what}…</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="dd">
                  <button className="mb car" onClick={toggle("prefs")}>Preferences</button>
                  {open === "prefs" && (
                    <div className="panel">
                      <ThemeChoice />
                      <hr />
                      <div className="hd note">Cost method: FIFO (oldest sold first), as income tax requires. Average price is shown for reference.</div>
                      <div className="hd note">Financial year: April to March.</div>
                    </div>
                  )}
                </div>
                <button className="mb" onClick={soon("Reports", 4)}>Reports</button>
                <div className="dd hov">
                  <button className="anl" title="Analytics" aria-label="Open analytics" onClick={() => show({ kind: "analytics" })}>
                    <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true">
                      <path d="M2 16h16" stroke="currentColor" strokeWidth="1.6" />
                      <rect x="3" y="9" width="2.6" height="6" fill="currentColor" />
                      <rect x="7.5" y="6" width="2.6" height="9" fill="currentColor" />
                      <rect x="12" y="3" width="2.6" height="12" fill="currentColor" />
                      <path d="M3 7l5-4 4 3 5-4" stroke="var(--accent)" strokeWidth="1.6" fill="none" />
                    </svg>
                  </button>
                  {holdings.length > 0 && (
                    <div className="panel anpanel hp">
                      <AnalyticsCards holdings={holdings} xirr={xirr} onOpen={() => show({ kind: "analytics" })} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {book === "fno" ? (
            <div className="tbox">
              <div className="empty">
                {bookPorts.length ? "No F&O trades yet. The F&O book is built in Phase 5." : "No F&O portfolio in this family yet."}
                {!bookPorts.length && <button className="addp" onClick={() => show({ kind: "addPortfolio" })}><span className="plus">+</span>Add Portfolio</button>}
              </div>
            </div>
          ) : (
            <>
              <section className="summary" aria-label="Summary">
                <div className="stat"><span className="label">Invested</span><span className="v num">₹{rupees(total.investedPaise)}</span><span className="s mut">{holdings.length} holdings</span></div>
                <div className="stat">
                  <span className="label">Current value</span>
                  <span className="v num">{total.currentPaise == null ? "—" : `₹${rupees(total.currentPaise)}`}</span>
                  <span className="s mut">{total.currentPaise == null ? `${unpriced} without a price` : shortRupees(total.currentPaise)}</span>
                </div>
                <div className="stat"><span className="label">Today&apos;s gain</span><span className={`v num ${tone(total.todayPaise)}`}>{total.todayPaise == null ? "—" : `₹${rupees(total.todayPaise)}`}</span><span className={`s num ${tone(total.todayPct)}`}>{pct(total.todayPct)}</span></div>
                <div className="stat"><span className="label">Unrealised gain</span><span className={`v num ${tone(total.unrealisedPaise)}`}>{total.unrealisedPaise == null ? "—" : `₹${rupees(total.unrealisedPaise)}`}</span><span className={`s num ${tone(total.unrealisedPct)}`}>{pct(total.unrealisedPct)}</span></div>
                <div className="stat"><span className="label">XIRR</span><span className={`v num ${tone(xirr)}`}>{pct(xirr)}</span><span className="s mut">a year, since first buy</span></div>
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

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label className="asearch" style={{ width: "min(280px, 100%)", background: "var(--surface)" }}>
                  <SearchIcon />
                  <input placeholder="Search assets" aria-label="Search assets" value={assetQ} onChange={(e) => setAssetQ(e.target.value)} />
                </label>
                <span className="label">Prices typed in · daily prices from Phase 2 · as of {asOf.split("-").reverse().join("-")}</span>
              </div>

              <div className="tbox">
                <HoldingsTable
                  holdings={shown}
                  combined={combined}
                  portName={portName}
                  asOf={asOf}
                  onSetPrice={(h) => show({ kind: "price", h })}
                  onAdd={() => (invPorts.length ? show({ kind: "tx" }) : show({ kind: "addPortfolio" }))}
                  emptyText={
                    assetQ ? "No assets match that search."
                      : !invPorts.length ? "Add your first portfolio to get started."
                        : `Nothing in ${tab === "ALL" ? "this view" : classInfo(tab).name} yet.`
                  }
                />
              </div>
            </>
          )}
        </main>
      </div>

      {dlg?.kind === "tx" && (
        <TxDialog
          portfolios={(currentGroup ? invPorts.filter((p) => currentGroup.members.includes(p.id)) : invPorts).map((p) => ({ id: p.id, name: p.name }))}
          defaultPortfolio={current?.id}
          defaultClass={tab}
          assets={assets}
          edit={dlg.edit}
          asOf={asOf}
          onClose={() => setDlg(null)}
          onSaved={done}
        />
      )}
      {dlg?.kind === "list" && (
        <TxList rows={rows} title={viewName} portName={portName} onEdit={(t) => setDlg({ kind: "tx", edit: t })} onClose={() => setDlg(null)} say={(m) => { say(m); router.refresh(); }} />
      )}
      {dlg?.kind === "price" && <PriceDialog h={dlg.h} onClose={() => setDlg(null)} onDone={done} />}
      {dlg?.kind === "rename" && <RenameDialog kind={dlg.what} id={dlg.id} name={dlg.name} onClose={() => setDlg(null)} onDone={done} />}
      {dlg?.kind === "delete" && (
        <DeleteDialog
          kind={dlg.what}
          id={dlg.id}
          name={dlg.name}
          onClose={() => setDlg(null)}
          onDone={(m) => {
            setDlg(null);
            say(m);
            router.push(dlg.what === "family" ? "/" : `/family/${family.id}`);
            router.refresh();
          }}
        />
      )}
      {dlg?.kind === "import" && (
        <ImportOpening familyId={family.id} portfolios={invPorts.map((p) => p.name)} onClose={() => setDlg(null)} onDone={done} />
      )}
      {dlg?.kind === "analytics" && (
        <AnalyticsModal holdings={holdings} rows={rows} xirr={xirr} asOf={asOf} title={viewName} onClose={() => setDlg(null)} />
      )}
      {dlg?.kind === "addPortfolio" && (
        <AddPortfolio
          familyId={family.id}
          book={book}
          invPortfolios={invPorts}
          onClose={() => setDlg(null)}
          onAdded={(id, b, kind) => {
            setDlg(null);
            say(kind === "group" ? "Group added" : "Portfolio added");
            router.push(`/family/${family.id}?${b === "fno" ? "book=fno&" : ""}p=${encodeURIComponent(id)}`);
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
  onEdit,
  onDelete,
}: {
  families: Family[];
  portfolios: Portfolio[];
  href: (q: { p?: string; book?: string; fam?: string }) => string;
  onDone: () => void;
  say: (m: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const rows = families
    .flatMap((f) => [{ f, p: null as Portfolio | null }, ...portfolios.filter((p) => p.family_id === f.id).map((p) => ({ f, p }))])
    .filter((r) => !q || `${r.f.name} ${r.p ? r.p.name : "Family Group"}`.toLowerCase().includes(q.toLowerCase()));

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
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <button className="link" onClick={onEdit}>✎ Rename Family</button>
        <button className="link" onClick={() => setAdding(true)}>+ Add Family</button>
        <button className="link" style={{ color: "var(--loss)", marginLeft: "auto" }} onClick={onDelete}>Delete…</button>
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
  invPortfolios,
  onClose,
  onAdded,
}: {
  familyId: string;
  book: string;
  invPortfolios: Portfolio[];
  onClose: () => void;
  onAdded: (id: string, book: string, kind: "portfolio" | "group") => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<"portfolio" | "group">("portfolio");
  const [name, setName] = useState("");
  const [b, setB] = useState(book);
  const [type, setType] = useState("individual");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      if (kind === "group") {
        const r = await createGroup(familyId, name, members);
        if (r.error) setError(r.error);
        else onAdded(`g:${r.id}`, "inv", "group");
      } else {
        const r = await createPortfolio(familyId, name, type, b);
        if (r.error) setError(r.error);
        else onAdded(r.id!, b, "portfolio");
      }
    });
  };
  const flip = (id: string) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form className="dlg" onSubmit={save}>
        <h2>{kind === "group" ? "Add group" : "Add portfolio"}</h2>
        <div className="seg" role="group" aria-label="What to add">
          {(["portfolio", "group"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => { setKind(k); setError(""); }}
              style={{ flex: 1, border: 0, padding: "6px 0", borderRadius: 6, fontWeight: 600, fontSize: 13, background: kind === k ? "var(--brand)" : "transparent", color: kind === k ? "var(--brand-ink)" : "var(--muted)" }}
            >
              {k === "portfolio" ? "Portfolio" : "Group"}
            </button>
          ))}
        </div>
        <label className="field">
          Name
          <input id="portfolioName" autoFocus placeholder={kind === "group" ? "e.g. Ajay + HUF" : "e.g. Meera HUF"} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {kind === "group" ? (
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 6 }}>Portfolios in this group (pick two or more)</legend>
            <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
              {invPortfolios.map((p) => (
                <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)", fontSize: 14 }}>
                  <input type="checkbox" checked={members.includes(p.id)} onChange={() => flip(p.id)} />
                  {p.name} <span className="mut" style={{ fontSize: 12 }}>{typeLabel(p.type)}</span>
                </label>
              ))}
              {invPortfolios.length < 2 && <span className="mut">Add at least two portfolios first.</span>}
            </div>
          </fieldset>
        ) : (
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
        )}
        <div className="err" role="alert">{error}</div>
        <div className="row-end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={pending}>{pending ? "Adding…" : kind === "group" ? "Add group" : "Add portfolio"}</button>
        </div>
      </form>
    </dialog>
  );
}

function GroupIcon() {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-label="group" style={{ color: "var(--muted)", flex: "none" }}>
      <circle cx="5.5" cy="4" r="2.6" fill="currentColor" />
      <circle cx="11.5" cy="4.6" r="2.1" fill="currentColor" opacity=".7" />
      <path d="M0.8 13c0-2.9 2.1-4.8 4.7-4.8s4.7 1.9 4.7 4.8z" fill="currentColor" />
      <path d="M10.9 13c0-1.6-.5-3-1.4-3.9.6-.4 1.3-.6 2-.6 2.1 0 3.7 1.6 3.7 4.5z" fill="currentColor" opacity=".7" />
    </svg>
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
