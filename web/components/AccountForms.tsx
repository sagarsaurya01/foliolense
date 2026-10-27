"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status: string };

export function AccountForms() {
  return (
    <>
      <PasswordForm />
      <TwoFactor />
    </>
  );
}

function PasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    if (pw.length < 8) return setMsg({ err: "Use at least 8 characters." });
    if (pw !== pw2) return setMsg({ err: "The two passwords don't match." });
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg({ err: error.message });
    else {
      setPw("");
      setPw2("");
      setMsg({ ok: "Password changed." });
    }
  };
  return (
    <section className="auth-card" style={{ margin: 0, width: "100%" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--f-display)", fontSize: 18 }}>Change password</h2>
      <form onSubmit={save}>
        <div className="grid2">
          <label className="field">New password<input id="newPw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <label className="field">Repeat it<input id="newPw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        </div>
        {msg.err && <div className="err">{msg.err}</div>}
        {msg.ok && <div className="ok">{msg.ok}</div>}
        <div><button className="btn dark" disabled={busy}>Change password</button></div>
      </form>
    </section>
  );
}

// 2-factor login with an authenticator app (Google Authenticator, Microsoft Authenticator…), via Supabase MFA (TOTP).
function TwoFactor() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [busy, setBusy] = useState(false);
  const supabase = supabaseBrowser();

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.all ?? []) as Factor[]);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const verified = factors?.filter((f) => f.status === "verified") ?? [];

  const start = async () => {
    setMsg({});
    setBusy(true);
    // clear any half-finished setup first
    for (const f of factors ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `FolioLense ${Date.now()}` });
    setBusy(false);
    if (error) return setMsg({ err: error.message });
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    setBusy(false);
    if (error) return setMsg({ err: "That code didn't match. Check the time on your phone and try the newest code." });
    setEnroll(null);
    setCode("");
    setMsg({ ok: "2-factor login is on. Next sign-in will ask for a code from your app." });
    void load();
  };
  const turnOff = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) setMsg({ err: error.message });
    else {
      setMsg({ ok: "2-factor login is off." });
      void load();
    }
  };

  return (
    <section className="auth-card" style={{ margin: 0, width: "100%" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--f-display)", fontSize: 18 }}>2-factor login</h2>
      {factors == null ? (
        <span className="mut">Checking…</span>
      ) : verified.length ? (
        <>
          <span className="ok">On. Sign-in asks for a 6-digit code from your authenticator app.</span>
          <div><button className="btn" disabled={busy} onClick={() => turnOff(verified[0].id)}>Turn off</button></div>
        </>
      ) : enroll ? (
        <form onSubmit={confirm}>
          <span>1. Scan this with Google Authenticator or Microsoft Authenticator:</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR code for your authenticator app" width={180} height={180} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />
          <span className="note">Can&apos;t scan? Enter this key in the app: <code>{enroll.secret}</code></span>
          <label className="field">2. Type the 6-digit code it shows<input id="mfaCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" disabled={busy || code.trim().length !== 6}>Turn on</button>
            <button type="button" className="btn" onClick={() => setEnroll(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <span className="mut">Off. Turn it on so a stolen password alone can&apos;t open your family&apos;s data.</span>
          <div><button className="btn dark" disabled={busy} onClick={start}>Set up 2-factor login</button></div>
        </>
      )}
      {msg.err && <div className="err">{msg.err}</div>}
      {msg.ok && <div className="ok">{msg.ok}</div>}
    </section>
  );
}
