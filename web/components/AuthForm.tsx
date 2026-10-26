"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up" | "forgot" | "update";

const TITLES: Record<Mode, string> = {
  "sign-in": "Sign in",
  "sign-up": "Create your account",
  forgot: "Reset your password",
  update: "Choose a new password",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");

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
      <h1>{TITLES[mode]}</h1>
      <form onSubmit={submit} noValidate>
        {mode !== "update" && (
          <label className="field">
            Email
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
        {mode !== "forgot" && (
          <label className="field">
            {mode === "update" ? "New password" : "Password"}
            <input
              id="password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <div className="err" role="alert">{error}</div>
        {done && <div className="ok" role="status">{done}</div>}
        <button className="btn primary" disabled={busy} style={{ justifyContent: "center" }}>
          {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save password"}
        </button>
      </form>
      <div className="auth-foot">
        {mode === "sign-in" && (
          <>
            <Link className="link" href="/sign-up">Create an account</Link>
            <Link className="link" href="/forgot-password">Forgot password?</Link>
          </>
        )}
        {(mode === "sign-up" || mode === "forgot") && <Link className="link" href="/sign-in">Back to sign in</Link>}
      </div>
    </div>
  );
}
