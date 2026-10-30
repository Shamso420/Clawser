'use client';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase, makeDemoApi, makeSupabaseApi } from '@/lib/api';
import Auth from './Auth';
import Onboarding from './Onboarding';
import Workspace from './Workspace';
import { Logo } from './ui';

const WS_KEY = 'clawser.workspace';
const readKey = () => { try { return localStorage.getItem(WS_KEY); } catch { return null; } };
const writeKey = (v) => { try { localStorage.setItem(WS_KEY, v); } catch {} };

export default function Root({ mode }) {
  const api = useMemo(() => {
    if (mode === 'demo') return makeDemoApi();
    const sb = getSupabase();
    return sb ? makeSupabaseApi(sb) : null;
  }, [mode]);

  const [session, setSession] = useState(undefined);
  const [spaces, setSpaces] = useState(undefined);
  const [current, setCurrent] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!api) return;
    let alive = true;
    api.getSession().then((s) => alive && setSession(s ?? null));
    const off = api.onAuthChange((s) => setSession(s ?? null));
    return () => { alive = false; off(); };
  }, [api]);

  const userId = session?.user?.id;

  async function loadSpaces(preferId) {
    const list = await api.myWorkspaces(userId);
    setSpaces(list);
    const want = preferId || current || readKey();
    const pick = list.find((w) => w.id === want) || list[0] || null;
    setCurrent(pick?.id || null);
    if (pick) writeKey(pick.id);
    return list;
  }

  useEffect(() => {
    if (!userId) { setSpaces(undefined); return; }
    loadSpaces().catch(() => setSpaces([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!api) return <MissingConfig />;
  if (session === undefined) return <Splash />;
  if (!session) return <Auth api={api} />;
  if (spaces === undefined) return <Splash />;

  const ws = spaces.find((w) => w.id === current);
  if (!ws || adding) {
    return (
      <Onboarding
        api={api}
        email={session.user.email}
        canCancel={!!ws}
        onCancel={() => setAdding(false)}
        onDone={async (id) => { await loadSpaces(id); setAdding(false); }}
      />
    );
  }

  return (
    <Workspace
      key={ws.id}
      api={api}
      user={session.user}
      ws={ws}
      spaces={spaces}
      onSwitch={(id) => { setCurrent(id); writeKey(id); }}
      onAddSpace={() => setAdding(true)}
      onSpacesChanged={() => loadSpaces(ws.id)}
      onLeft={() => loadSpaces()}
    />
  );
}

function Splash() {
  return (
    <div className="splash">
      <Logo size={48} />
    </div>
  );
}

function MissingConfig() {
  return (
    <div className="center-page">
      <div className="auth-card">
        <Logo size={44} />
        <h1>Almost there</h1>
        <p className="muted">
          Clawser can&apos;t find its database keys. In Vercel, open the project, go to Settings, then Environment
          Variables, and add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Then redeploy.
        </p>
        <a className="btn" href="/demo">Open the demo instead</a>
      </div>
    </div>
  );
}
