'use client';
import { useState } from 'react';
import { STAGES, isOpen, stageById } from '@/lib/constants';
import { daysFromToday, money, relDay, startOfMonthISO } from '@/lib/dates';
import { useStore } from './store';
import { ChannelTag, Initials, Segmented } from './ui';

export default function Pipeline() {
  const { data, me, nameOf, openLead, actions, say } = useStore();
  const solo = data.members.length < 2;
  const [who, setWho] = useState('all');
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);

  const leads = data.leads.filter((l) => solo || who === 'all' || l.owner_id === me.id);
  const open = leads.filter((l) => isOpen(l.stage));
  const openValue = open.reduce((s, l) => s + Number(l.value || 0), 0);
  const monthStart = startOfMonthISO();
  const wonThisMonth = leads.filter((l) => l.stage === 'won' && l.won_at && l.won_at >= monthStart);
  const wonValue = wonThisMonth.reduce((s, l) => s + Number(l.value || 0), 0);

  async function moveTo(leadId, stage) {
    const lead = data.leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === stage) return;
    try {
      await actions.saveLead(leadId, { stage });
      await actions.log('stage', null, leadId, `Moved to ${stageById[stage].label}`);
      say(`${lead.name} moved to ${stageById[stage].label}`);
    } catch (e) {
      say(e.message);
    }
  }

  return (
    <div className="pipeline">
      <section className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">
            {money(openValue)} open across {open.length} {open.length === 1 ? 'lead' : 'leads'}.
            {' '}Won this month: {money(wonValue)} from {wonThisMonth.length}.
          </p>
        </div>
        {!solo && (
          <Segmented label="Whose leads" value={who} onChange={setWho}
            options={[{ id: 'mine', label: 'Mine' }, { id: 'all', label: 'Whole team' }]} />
        )}
      </section>

      <div className="board" role="list">
        {STAGES.map((s) => {
          const col = leads.filter((l) => l.stage === s.id);
          const sum = col.reduce((t, l) => t + Number(l.value || 0), 0);
          return (
            <section
              key={s.id}
              role="listitem"
              aria-label={`${s.label}, ${col.length} leads`}
              className={`col col-${s.id}${over === s.id ? ' over' : ''}`}
              onDragOver={(e) => { if (dragging) { e.preventDefault(); setOver(s.id); } }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (dragging) moveTo(dragging, s.id); setDragging(null); }}
            >
              <header>
                <h2>{s.label}</h2>
                <span className="col-count">{col.length}</span>
                <span className="col-sum">{money(sum)}</span>
              </header>
              <div className="cards">
                {col.length === 0 && <p className="col-empty">Nothing here</p>}
                {col.map((l) => {
                  const fu = l.next_follow_up && isOpen(l.stage) ? daysFromToday(l.next_follow_up) : null;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className="card"
                      draggable
                      onDragStart={() => setDragging(l.id)}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      onClick={() => openLead(l.id)}
                    >
                      <span className="card-top">
                        <b>{l.name}</b>
                        {Number(l.value) > 0 && <span className="card-value">{money(l.value)}</span>}
                      </span>
                      {l.need && <span className="card-need">{l.need}</span>}
                      <span className="card-meta">
                        <ChannelTag id={l.channel} />
                        {fu !== null && <span className={fu < 0 ? 'late' : fu === 0 ? 'due-today' : 'muted'}>{relDay(l.next_follow_up)}</span>}
                        {!solo && l.owner_id && <Initials name={nameOf(l.owner_id)} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="hint board-hint">Tap a lead to change its stage. On a computer you can also drag cards between columns.</p>
    </div>
  );
}
