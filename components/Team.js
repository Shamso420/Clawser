'use client';
import { useState } from 'react';
import { OUTREACH, isOpen } from '@/lib/constants';
import { useStore } from './store';
import { Icon, Initials } from './ui';

export default function Team() {
  const { api, ws, me, data, say, reload, spaces, onSwitch, onAddSpace, onSpacesChanged, onLeft } = useStore();
  const isOwner = me.role === 'owner';
  const [code, setCode] = useState(ws.joinCode);
  const [teamName, setTeamName] = useState(ws.name);
  const [myName, setMyName] = useState(me.name);
  const [confirm, setConfirm] = useState(null);

  async function copyCode() {
    const text = `Join our team on Clawser: open ${window.location.origin}, create an account, then enter the code ${code}`;
    try {
      await navigator.clipboard.writeText(text);
      say('Invite copied. Paste it in WhatsApp or anywhere.');
    } catch {
      say(`Code: ${code}`);
    }
  }

  async function newCode() {
    try {
      const c = await api.resetCode(ws.id);
      setCode(c);
      say('New code made. The old one no longer works.');
    } catch (e) { say(e.message); }
  }

  async function saveTeamName() {
    const v = teamName.trim();
    if (!v || v === ws.name) return;
    try { await api.renameWorkspace(ws.id, v); await onSpacesChanged(); say('Team renamed'); } catch (e) { say(e.message); }
  }

  async function saveMyName() {
    const v = myName.trim();
    if (!v || v === me.name) return;
    try { await api.updateMyName(ws.id, me.id, v); await reload(); say('Name updated'); } catch (e) { say(e.message); }
  }

  async function remove(uid) {
    if (confirm !== uid) { setConfirm(uid); return; }
    try {
      await api.removeMember(ws.id, uid);
      setConfirm(null);
      if (uid === me.id) { onLeft(); return; }
      await reload();
      say('Removed from the team');
    } catch (e) { say(e.message); setConfirm(null); }
  }

  const today = {};
  data.acts.forEach((a) => { if (a.channel) today[a.user_id] = (today[a.user_id] || 0) + 1; });
  const goal = {};
  data.targets.forEach((t) => {
    if (OUTREACH.some((c) => c.id === t.channel)) goal[t.user_id] = (goal[t.user_id] || 0) + t.daily;
  });
  const openOwned = {};
  data.leads.forEach((l) => { if (isOpen(l.stage) && l.owner_id) openOwned[l.owner_id] = (openOwned[l.owner_id] || 0) + 1; });

  return (
    <div className="team">
      <section className="page-head">
        <div>
          <h1>Team</h1>
          <p className="muted">{data.members.length} {data.members.length === 1 ? 'person' : 'people'} sharing one pipeline</p>
        </div>
      </section>

      <div className="team-grid">
        <section className="panel invite">
          <h2>Invite teammates</h2>
          <p className="muted">They create an account, choose “I have a code” and type this in.</p>
          <div className="code" aria-label={`Team code ${code.split('').join(' ')}`}>
            {code.split('').map((ch, i) => <span key={i}>{ch}</span>)}
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={copyCode}><Icon name="copy" size={18} /> Copy invite</button>
            {isOwner && <button type="button" className="btn" onClick={newCode}>Make a new code</button>}
          </div>
        </section>

        <section className="panel">
          <h2>People</h2>
          <ul className="people">
            {data.members.map((m) => {
              const n = today[m.user_id] || 0;
              const g = goal[m.user_id] || 0;
              const self = m.user_id === me.id;
              return (
                <li key={m.user_id}>
                  <Initials name={m.display_name} />
                  <span className="p-main">
                    <b>{m.display_name}{self && ' (you)'}</b>
                    <span className="muted">
                      {m.role === 'owner' ? 'Owner' : 'Member'}, {openOwned[m.user_id] || 0} open leads
                    </span>
                  </span>
                  <span className="p-today">
                    <b className="num">{g ? `${n}/${g}` : n}</b>
                    <small>sent today</small>
                  </span>
                  {isOwner && !self && (
                    <button type="button" className={`btn ghost small danger${confirm === m.user_id ? ' armed' : ''}`} onClick={() => remove(m.user_id)}>
                      {confirm === m.user_id ? 'Confirm' : 'Remove'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel">
          <h2>Settings</h2>
          <label className="field">
            <span>Your name on this team</span>
            <div className="input-row">
              <input value={myName} maxLength={60} onChange={(e) => setMyName(e.target.value)} />
              <button type="button" className="btn" onClick={saveMyName} disabled={!myName.trim() || myName.trim() === me.name}>Save</button>
            </div>
          </label>
          {isOwner && (
            <label className="field">
              <span>Team name</span>
              <div className="input-row">
                <input value={teamName} maxLength={80} onChange={(e) => setTeamName(e.target.value)} />
                <button type="button" className="btn" onClick={saveTeamName} disabled={!teamName.trim() || teamName.trim() === ws.name}>Save</button>
              </div>
            </label>
          )}

          {spaces.length > 1 && (
            <label className="field">
              <span>Switch team</span>
              <select value={ws.id} onChange={(e) => onSwitch(e.target.value)}>
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}

          <div className="btn-row">
            <button type="button" className="btn" onClick={onAddSpace}>Start or join another team</button>
            {!isOwner && (
              <button type="button" className={`btn ghost danger${confirm === me.id ? ' armed' : ''}`} onClick={() => remove(me.id)}>
                {confirm === me.id ? 'Confirm leaving' : 'Leave this team'}
              </button>
            )}
          </div>
          <p className="muted signed-in">
            Signed in as {me.email}. <button type="button" className="link inline" onClick={() => api.signOut()}>Sign out</button>
          </p>
        </section>
      </div>
    </div>
  );
}
