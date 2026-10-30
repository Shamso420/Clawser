'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StoreCtx } from './store';
import { startOfTodayISO } from '@/lib/dates';
import { Icon, Logo } from './ui';
import Today from './Today';
import Pipeline from './Pipeline';
import Leads from './Leads';
import Team from './Team';
import LeadSheet from './LeadSheet';

const TABS = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
  { id: 'leads', label: 'Leads', icon: 'leads' },
  { id: 'team', label: 'Team', icon: 'team' },
];

export default function Workspace({ api, user, ws, spaces, onSwitch, onAddSpace, onSpacesChanged, onLeft }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('today');
  const [sheet, setSheet] = useState(null); // { id } for a lead, { prefill } for a new one
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const reload = useCallback(async () => {
    try {
      const d = await api.loadAll(ws.id, startOfTodayISO());
      setData(d);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [api, ws.id]);

  useEffect(() => {
    reload();
    const onVis = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => document.visibilityState === 'visible' && reload(), 60000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, [reload]);

  const say = useCallback((text, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 6000 : 3000);
  }, []);

  const me = useMemo(() => {
    const m = data?.members.find((x) => x.user_id === user.id);
    return { id: user.id, email: user.email, name: m?.display_name || ws.myName, role: m?.role || ws.role };
  }, [data, user, ws]);

  const nameOf = useCallback(
    (uid) => data?.members.find((m) => m.user_id === uid)?.display_name || 'Former teammate',
    [data],
  );

  // Local state helpers so the screen updates before the server answers.
  const patchLead = useCallback((lead) => {
    setData((d) => d && { ...d, leads: d.leads.some((l) => l.id === lead.id)
      ? d.leads.map((l) => (l.id === lead.id ? lead : l))
      : [lead, ...d.leads] });
  }, []);

  const actions = useMemo(() => ({
    async saveLead(id, patch) {
      const lead = await api.updateLead(id, patch);
      patchLead(lead);
      return lead;
    },
    async createLead(row) {
      const lead = await api.insertLead({ ...row, workspace_id: ws.id, created_by: user.id });
      patchLead(lead);
      await api.addActivity({ workspace_id: ws.id, lead_id: lead.id, user_id: user.id, kind: 'note', body: 'Added the lead' });
      return lead;
    },
    async removeLead(id) {
      await api.deleteLead(id);
      setData((d) => ({ ...d, leads: d.leads.filter((l) => l.id !== id), acts: d.acts.filter((a) => a.lead_id !== id) }));
    },
    async log(kind, channel, leadId = null, body = null) {
      const act = await api.addActivity({ workspace_id: ws.id, lead_id: leadId, user_id: user.id, kind, channel, body });
      if (kind === 'message' || kind === 'follow_up') setData((d) => ({ ...d, acts: [...d.acts, act] }));
      return act;
    },
    async unlog(act) {
      await api.deleteActivity(act.id);
      setData((d) => ({ ...d, acts: d.acts.filter((a) => a.id !== act.id) }));
    },
    async setTarget(channel, daily) {
      await api.setTarget(ws.id, user.id, channel, daily);
      setData((d) => {
        const rest = d.targets.filter((t) => !(t.user_id === user.id && t.channel === channel));
        return { ...d, targets: [...rest, { user_id: user.id, channel, daily }] };
      });
    },
  }), [api, ws.id, user.id, patchLead]);

  const store = {
    api, ws, me, data, reload, nameOf, actions, say, spaces, onSwitch, onAddSpace, onSpacesChanged, onLeft,
    openLead: (id) => setSheet({ id }),
    newLead: (prefill = {}) => setSheet({ prefill }),
    goTo: setTab,
  };

  const Screen = { today: Today, pipeline: Pipeline, leads: Leads, team: Team }[tab];

  return (
    <StoreCtx.Provider value={store}>
      <div className="shell">
        <header className="topbar">
          <button type="button" className="brand" onClick={() => setTab('today')}>
            <Logo size={30} />
            <span className="brand-text">
              <b>Clawser</b>
              <small>{ws.name}</small>
            </span>
          </button>
          <nav className="tabs-top" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <button type="button" className="btn primary add-top" onClick={() => setSheet({ prefill: {} })}>
            <Icon name="plus" size={18} /> New lead
          </button>
        </header>

        {api.demo && (
          <div className="demo-bar">
            Demo team with sample leads. Changes vanish when you close the tab. <a href="/">Sign in for real</a>
          </div>
        )}

        <main className="main">
          {loadError && (
            <div className="msg err">
              Couldn’t load your team’s data: {loadError} <button className="link" onClick={reload}>Try again</button>
            </div>
          )}
          {data ? <Screen /> : !loadError && <div className="loading">Loading your pipeline</div>}
        </main>

        <button type="button" className="fab" onClick={() => setSheet({ prefill: {} })} aria-label="New lead">
          <Icon name="plus" size={26} />
        </button>

        <nav className="tabs-bottom" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {sheet && data && (
          <LeadSheet key={sheet.id || 'new'} leadId={sheet.id} prefill={sheet.prefill} onClose={() => setSheet(null)} />
        )}

        {toast && (
          <div className="toast" role="status" key={toast.key}>
            <span>{toast.text}</span>
            {toast.undo && (
              <button type="button" onClick={() => { toast.undo(); setToast(null); }}>Undo</button>
            )}
          </div>
        )}
      </div>
    </StoreCtx.Provider>
  );
}
