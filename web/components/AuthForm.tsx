"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up" | "forgot" | "update";

const TITLES: Record<Mode, string> = {
  "sign-in": "Welcome back",
  "sign-up": "Create your account",
  forgot: "Reset your password",
  update: "Choose a new password",
};

const SUBTITLES: Record<Mode, string> = {
  "sign-in": "Sign in to your FolioLense account",
  "sign-up": "Start tracking your family's portfolio",
  forgot: "We'll email you a secure reset link",
  update: "Pick something you'll remember",
};

const MailIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    // arriving from a page that needs the 2-factor code (already signed in with the password)
    if (mode === "sign-in" && new URLSearchParams(window.location.search).get("mfa") === "1") setNeedCode(true);
  }, [mode]);

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.[0];
    if (!factor) {
      setBusy(false);
      return setError("No authenticator is set up on this account. Sign in again.");
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setBusy(false);
    if (error) return setError("That code didn't match. Try the newest code in your app.");
    router.replace("/");
    router.refresh();
  }

  if (needCode)
    return (
      <div className="auth-card">
        <h1>Enter your code</h1>
        <form onSubmit={verifyCode} noValidate>
          <label className="field">
            6-digit code from your authenticator app
            <input id="code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div className="err" role="alert">{error}</div>
          <button className="btn primary" disabled={busy || code.trim().length !== 6} style={{ justifyContent: "center" }}>
            {busy ? "Checking…" : "Verify"}
          </button>
        </form>
        <div className="auth-foot">
          <button
            className="link"
            onClick={async () => {
              await supabaseBrowser().auth.signOut();
              setNeedCode(false);
              router.replace("/sign-in");
            }}
          >
            Use a different account
          </button>
        </div>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (mode !== "update" && !email.trim()) return setError("Enter your email address.");
    if (mode !== "forgot" && password.length < 8) return setError("Use a password of at least 8 characters.");
    setBusy(true);
    const supabase = supabaseBrowser();
    const callback = `${window.location.origin}/auth/callback`;
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
          setNeedCode(true);
          return;
        }
        router.replace("/");
        router.refresh();
      } else if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: callback },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setDone("Check your email and click the confirmation link, then sign in.");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${callback}?next=/update-password`,
        });
        if (error) throw error;
        setDone("If that email has an account, a reset link is on its way.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === "Invalid login credentials" ? "That email and password don't match an account." : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h1>{TITLES[mode]}</h1>
        <p>{SUBTITLES[mode]}</p>
      </div>
      <form onSubmit={submit} noValidate>
        {mode !== "update" && (
          <label className="field">
            Email
            <span className="field-in">
              <span className="field-ic"><MailIcon /></span>
              <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </span>
          </label>
        )}
        {mode !== "forgot" && (
          <label className="field">
            {mode === "update" ? "New password" : "Password"}
            <span className="field-in">
              <span className="field-ic"><LockIcon /></span>
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="field-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? "Hide" : "Show"}
              </button>
            </span>
          </label>
        )}
        <div className="err" role="alert">{error}</div>
        {done && <div className="ok" role="status">{done}</div>}
        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save password"}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
      </form>
      <div className="auth-foot">
        {mode === "sign-in" && (
          <>
            <span className="auth-sep"><i /><span>new here?</span><i /></span>
            <div className="auth-foot-row">
              <Link className="link" href="/sign-up">Create an account</Link>
              <Link className="mut-link" href="/forgot-password">Forgot password?</Link>
            </div>
          </>
        )}
        {(mode === "sign-up" || mode === "forgot") && <Link className="link" href="/sign-in">Back to sign in</Link>}
      </div>
    </div>
  );
}
