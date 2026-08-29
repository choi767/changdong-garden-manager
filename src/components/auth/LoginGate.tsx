import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isCloudModeEnabled } from "../../infrastructure/supabaseClient";

interface LoginGateProps {
  children: ReactNode;
}

export default function LoginGate({ children }: LoginGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isCloudModeEnabled());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const client = getSupabaseClient();

  useEffect(() => {
    if (!client) return;
    let mounted = true;
    void client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;
    setSubmitting(true);
    setMessage("");
    const { error } = await client.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setMessage(error.message);
  }

  if (!client) return <>{children}</>;
  if (!ready) return <div className="loading-bar">로그인 상태를 확인하는 중입니다.</div>;
  if (session) return <>{children}</>;

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={onSubmit}>
        <p className="eyebrow">창동 틀밭관리 V2.3</p>
        <h1>로그인</h1>
        <label>
          이메일
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        <button className="primary-button wide" type="submit" disabled={submitting}>
          {submitting ? "확인 중..." : "로그인"}
        </button>
        {message && <p className="form-error">{message}</p>}
      </form>
    </div>
  );
}
