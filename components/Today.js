'use client';
import { useMemo, useState } from 'react';
import { OUTREACH, channelById, isOpen, stageById } from '@/lib/constants';
import { addDays, daysFromToday, longToday, relDay, todayStr } from '@/lib/dates';
import { useStore } from './store';
import { ChannelTag, Icon, Initials, Segmented, Sheet, StagePill } from './ui';

export default function Today() {
  const { data, me } = useStore();
  const solo = data.members.length < 2;
  const [who, setWho] = useState('mine');
  const mine = (l) => solo || who === 'all' || l.owner_id === me.id;

  const due = useMemo(
    () => data.leads
      .filter((l) => isOpen(l.stage) && l.next_follow_up && daysFromToday(l.next_follow_up) <= 0 && mine(l))
      .sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.leads, who, me.id, solo],
  );

  const upcoming = useMemo(
    () => data.leads
      .filter((l) => isOpen(l.stage) && l.next_follow_up && daysFromToday(l.next_follow_up) > 0 && daysFromToday(l.next_follow_up) <= 7 && mine(l))
      .sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up))
      .slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.leads, who, me.id, solo],
  );

  const late = due.filter((l) => daysFromToday(l.next_follow_up) < 0).length;

  return (
    <div className="today">
      <section className="today-head">
        <p className="date">{longToday()}</p>
        <h1>
          {due.length === 0 ? 'No follow-ups due' : due.length === 1 ? '1 follow-up due' : `${due.length} follow-ups due`}
        </h1>
        <p className="muted">
          {due.length === 0
            ? 'You’re clear. Good time to reach out to someone new.'
            : late > 0
              ? `${late} ${late === 1 ? 'is' : 'are'} past the date you set. Start with those.`
              : 'All of them are for today.'}
        </p>
        {!solo && (
          <Segmented label="Whose follow-ups" value={who} onChange={setWho}
            options={[{ id: 'mine', label: 'Mine' }, { id: 'all', label: 'Whole team' }]} />
        )}
      </section>

      <div className="today-grid">
        <DueList leads={due} showOwner={!solo && who === 'all'} />
        <aside className="today-side">
          <Outreach />
          {upcoming.length > 0 && <Upcoming leads={upcoming} />}
        </aside>
      </div>
    </div>
  );
}

function DueList({ leads, showOwner }) {
  const { actions, openLead, say, nameOf, newLead } = useStore();
  const [sent, setSent] = useState({}); // leadId -> lead snapshot waiting for a next date
  const [busy, setBusy] = useState(null);

  const rows = [...leads];
  Object.values(sent).forEach((l) => { if (!rows.some((r) => r.id === l.id)) rows.push(l); });

  async function markSent(lead) {
    setBusy(lead.id);
    try {
      await actions.log('follow_up', lead.channel, lead.id, 'Sent a follow-up');
      let snapshot = lead;
      if (lead.stage === 'new') {
        snapshot = await actions.saveLead(lead.id, { stage: 'contacted' });
        await actions.log('stage', null, lead.id, 'Moved to Contacted');
      }
      setSent((s) => ({ ...s, [lead.id]: snapshot }));
    } catch (e) {
      say(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function setNext(lead, days) {
    const next = days === null ? null : addDays(todayStr(), days);
    try {
      await actions.saveLead(lead.id, { next_follow_up: next });
      setSent((s) => { const c = { ...s }; delete c[lead.id]; return c; });
      say(next ? `Next follow-up with ${lead.name}: ${relDay(next).toLowerCase()}` : `No more follow-ups set for ${lead.name}`);
    } catch (e) {
      say(e.message);
    }
  }

  if (rows.length === 0) {
    return (
      <section className="due empty-due">
        <p>When you set a follow-up date on a lead, it shows up here on that day.</p>
        <button type="button" className="btn" onClick={() => newLead()}>Add a lead</button>
      </section>
    );
  }

  return (
    <section className="due" aria-label="Follow-ups due">
      <ul>
        {rows.map((l) => {
          const waiting = !!sent[l.id];
          const lateBy = daysFromToday(l.next_follow_up || todayStr());
          return (
            <li key={l.id} className={`due-row${waiting ? ' waiting' : ''}`}>
              <button type="button" className="due-main" onClick={() => openLead(l.id)}>
                <span className="due-name">
                  <b>{l.name}</b>
                  {l.company && <span className="muted"> {l.company}</span>}
                </span>
                <span className="due-meta">
                  <ChannelTag id={l.channel} />
                  <StagePill id={l.stage} />
                  {!waiting && <span className={lateBy < 0 ? 'late' : 'muted'}>{relDay(l.next_follow_up)}</span>}
                  {showOwner && l.owner_id && <Initials name={nameOf(l.owner_id)} />}
                </span>
                {l.contact && !waiting && <span className="due-contact">{l.contact}</span>}
              </button>
              {waiting ? (
                <div className="next-pick" role="group" aria-label={`Next follow-up for ${l.name}`}>
                  <span>Sent. Follow up again</span>
                  <div className="chips">
                    <button type="button" onClick={() => setNext(l, 1)}>Tomorrow</button>
                    <button type="button" onClick={() => setNext(l, 3)}>In 3 days</button>
                    <button type="button" onClick={() => setNext(l, 7)}>Next week</button>
                    <button type="button" onClick={() => setNext(l, null)}>Stop</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn sent-btn" disabled={busy === l.id} onClick={() => markSent(l)}>
                  <Icon name="check" size={18} /> Mark sent
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Outreach() {
  const { data, me, actions, say } = useStore();
  const [editing, setEditing] = useState(false);

  const counts = {};
  data.acts.forEach((a) => {
    if (a.user_id === me.id && a.channel) counts[a.channel] = (counts[a.channel] || 0) + 1;
  });
  const targets = {};
  data.targets.forEach((t) => { if (t.user_id === me.id) targets[t.channel] = t.daily; });

  const totalDone = OUTREACH.reduce((s, c) => s + (counts[c.id] || 0), 0);
  const totalGoal = OUTREACH.reduce((s, c) => s + (targets[c.id] || 0), 0);

  async function plusOne(c) {
    try {
      const act = await actions.log('message', c.id);
      say(`Logged 1 ${c.id === 'call' ? 'call' : `${c.label} message`}`, () => actions.unlog(act));
    } catch (e) {
      say(e.message);
    }
  }

  return (
    <section className="outreach" aria-label="Today’s outreach">
      <div className="outreach-head">
        <div>
          <h2>Your outreach today</h2>
          <p className="tally">
            <b>{totalDone}</b>
            {totalGoal > 0 && <span> of {totalGoal}</span>}
          </p>
        </div>
        <button type="button" className="link" onClick={() => setEditing(true)}>
          {totalGoal ? 'Edit targets' : 'Set targets'}
        </button>
      </div>
      <ul className="bars">
        {OUTREACH.map((c) => {
          const n = counts[c.id] || 0;
          const goal = targets[c.id] || 0;
          const pct = goal ? Math.min(1, n / goal) : 0;
          const done = goal > 0 && n >= goal;
          return (
            <li key={c.id} className={done ? 'done' : ''}>
              <div className="bar-label">
                <span>{c.label}</span>
                <span className="num">{goal ? `${n} / ${goal}` : n}</span>
              </div>
              <div className="bar-row">
                <div className="bar" role="progressbar" aria-label={`${c.label} outreach`}
                  aria-valuemin={0} aria-valuemax={goal || 0} aria-valuenow={n}>
                  <span style={{ width: `${pct * 100}%`, background: done ? 'var(--green)' : c.color }} />
                </div>
                <button type="button" className="plus" onClick={() => plusOne(c)} aria-label={`Log one ${c.label} message`}>
                  +1
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hint">Tap +1 each time you send a cold message. Follow-ups you mark sent count too.</p>
      {editing && <TargetsSheet targets={targets} onClose={() => setEditing(false)} />}
    </section>
  );
}

function TargetsSheet({ targets, onClose }) {
  const { actions, say } = useStore();
  const [vals, setVals] = useState(() => Object.fromEntries(OUTREACH.map((c) => [c.id, targets[c.id] ?? 0])));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      for (const c of OUTREACH) {
        const v = Math.max(0, Math.min(500, parseInt(vals[c.id], 10) || 0));
        if (v !== (targets[c.id] ?? 0)) await actions.setTarget(c.id, v);
      }
      say('Targets saved');
      onClose();
    } catch (e) {
      say(e.message);
      setBusy(false);
    }
  }

  return (
    <Sheet open title="Daily outreach targets" onClose={onClose}
      footer={<button type="button" className="btn primary block" disabled={busy} onClick={save}>Save targets</button>}>
      <p className="muted">How many messages or calls you aim to send each day. Set 0 for channels you don’t use.</p>
      <div className="target-grid">
        {OUTREACH.map((c) => (
          <label key={c.id} className="field inline">
            <span><i className="dot" style={{ background: c.color }} />{c.label}</span>
            <input type="number" inputMode="numeric" min={0} max={500} value={vals[c.id]}
              onChange={(e) => setVals((v) => ({ ...v, [c.id]: e.target.value }))} />
          </label>
        ))}
      </div>
    </Sheet>
  );
}

function Upcoming({ leads }) {
  const { openLead } = useStore();
  return (
    <section className="upcoming" aria-label="Coming up this week">
      <h2>Coming up this week</h2>
      <ul>
        {leads.map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => openLead(l.id)}>
              <span className="up-day">{relDay(l.next_follow_up)}</span>
              <span className="up-name">{l.name}</span>
              <span className="up-stage"><i className="dot" style={{ background: channelById[l.channel]?.color }} />{stageById[l.stage].label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
