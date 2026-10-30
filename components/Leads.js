'use client';
import { useMemo, useState } from 'react';
import { CHANNELS, STAGES, isOpen } from '@/lib/constants';
import { daysFromToday, money, relDay, timeAgo } from '@/lib/dates';
import { useStore } from './store';
import { ChannelTag, Icon, Initials, StagePill } from './ui';

export default function Leads() {
  const { data, nameOf, openLead, newLead } = useStore();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('open');
  const [channel, setChannel] = useState('');
  const [owner, setOwner] = useState('');
  const solo = data.members.length < 2;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.leads.filter((l) => {
      if (stage === 'open' && !isOpen(l.stage)) return false;
      if (stage !== 'open' && stage !== '' && l.stage !== stage) return false;
      if (channel && l.channel !== channel) return false;
      if (owner && l.owner_id !== owner) return false;
      if (!needle) return true;
      return [l.name, l.company, l.contact, l.need, l.notes].some((f) => f && f.toLowerCase().includes(needle));
    });
  }, [data.leads, q, stage, channel, owner]);

  return (
    <div className="leads">
      <section className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="muted">{list.length} of {data.leads.length} showing</p>
        </div>
      </section>

      <div className="filters">
        <label className="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search name, business, phone, notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" />
        </label>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="open">Open leads</option>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
          <option value="">All channels</option>
          {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {!solo && (
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Assigned to">
            <option value="">Anyone</option>
            {data.members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty">
          {data.leads.length === 0 ? (
            <>
              <p>No leads yet. Add the first person you’re talking to.</p>
              <button type="button" className="btn primary" onClick={() => newLead()}>Add a lead</button>
            </>
          ) : (
            <p>No leads match these filters.</p>
          )}
        </div>
      ) : (
        <ul className="lead-list">
          {list.map((l) => {
            const fu = l.next_follow_up && isOpen(l.stage) ? daysFromToday(l.next_follow_up) : null;
            return (
              <li key={l.id}>
                <button type="button" onClick={() => openLead(l.id)}>
                  <span className="ll-main">
                    <b>{l.name}</b>
                    <span className="muted">{[l.company, l.contact].filter(Boolean).join(', ')}</span>
                  </span>
                  <span className="ll-meta">
                    <StagePill id={l.stage} />
                    <ChannelTag id={l.channel} />
                    {Number(l.value) > 0 && <span className="num">{money(l.value)}</span>}
                    {fu !== null && (
                      <span className={fu < 0 ? 'late' : 'muted'}>
                        {fu < 0 ? `Follow-up ${relDay(l.next_follow_up)}` : fu <= 1 ? `Follow up ${relDay(l.next_follow_up).toLowerCase()}` : `Follow up ${relDay(l.next_follow_up)}`}
                      </span>
                    )}
                    {!solo && l.owner_id && <Initials name={nameOf(l.owner_id)} />}
                  </span>
                  <span className="ll-time muted">{timeAgo(l.updated_at)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
