'use client';
import { useEffect, useState } from 'react';
import { CHANNELS, LEAD_FIELDS, STAGES, stageById } from '@/lib/constants';
import { addDays, relDay, timeAgo, todayStr } from '@/lib/dates';
import { useStore } from './store';
import { ChannelTag, Sheet } from './ui';

const blank = (me) => ({
  name: '', company: '', channel: 'instagram', contact: '', need: '', value: '',
  stage: 'new', owner_id: me.id, next_follow_up: todayStr(), notes: '',
});

const toForm = (l) => ({
  ...Object.fromEntries(LEAD_FIELDS.map((k) => [k, l[k] ?? ''])),
  value: l.value ? String(Number(l.value)) : '',
});

export default function LeadSheet({ leadId, prefill, onClose }) {
  const { data, me, actions, say, api } = useStore();
  const lead = leadId ? data.leads.find((l) => l.id === leadId) : null;
  const isNew = !leadId;
  const [form, setForm] = useState(() => (lead ? toForm(lead) : { ...blank(me), ...prefill }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    api.leadActivities(leadId).then(setHistory).catch(() => setHistory([]));
  }, [api, leadId]);

  if (leadId && !lead) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const original = lead ? toForm(lead) : null;
  const dirty = isNew || LEAD_FIELDS.some((k) => String(form[k] ?? '') !== String(original[k] ?? ''));
  const canDelete = lead && (lead.created_by === me.id || me.role === 'owner');

  function payload() {
    return {
      name: form.name.trim(),
      company: form.company.trim() || null,
      channel: form.channel,
      contact: form.contact.trim() || null,
      need: form.need.trim() || null,
      value: Math.max(0, Number(String(form.value).replace(/[^0-9.]/g, '')) || 0),
      stage: form.stage,
      owner_id: form.owner_id || null,
      next_follow_up: form.next_follow_up || null,
      notes: form.notes.trim() || null,
    };
  }

  async function save(e) {
    e?.preventDefault();
    if (!form.name.trim()) { setError('Give the lead a name.'); return; }
    setBusy(true);
    setError('');
    try {
      if (isNew) {
        const created = await actions.createLead(payload());
        say(`${created.name} added`);
        onClose();
      } else {
        const p = payload();
        const changed = Object.fromEntries(Object.entries(p).filter(([k, v]) => String(v ?? '') !== String(lead[k] ?? '')));
        if (k(changed).length) await actions.saveLead(lead.id, changed);
        if (changed.stage) await actions.log('stage', null, lead.id, `Moved to ${stageById[changed.stage].label}`);
        say('Saved');
        onClose();
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function logMessage() {
    try {
      const act = await actions.log('message', lead.channel, lead.id, 'Sent a message');
      setHistory((h) => [act, ...(h || [])]);
      say('Message logged');
    } catch (err) { say(err.message); }
  }

  async function addNote() {
    if (!note.trim()) return;
    try {
      const act = await actions.log('note', null, lead.id, note.trim());
      setHistory((h) => [act, ...(h || [])]);
      setNote('');
    } catch (err) { say(err.message); }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await actions.removeLead(lead.id);
      say(`${lead.name} deleted`);
      onClose();
    } catch (err) { setError(err.message); setConfirmDelete(false); }
  }

  const followChoices = [
    ['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7],
  ];

  const details = (
    <>
        <div className="row2">
          <label className="field">
            <span>Name</span>
            <input autoFocus={isNew} required maxLength={120} placeholder="Person or business" value={form.name} onChange={set('name')} />
          </label>
          <label className="field">
            <span>Business or area</span>
            <input maxLength={120} value={form.company} onChange={set('company')} />
          </label>
        </div>

        <fieldset className="field">
          <legend>Where they came from</legend>
          <div className="chips">
            {CHANNELS.map((c) => (
              <button type="button" key={c.id} className={form.channel === c.id ? 'on' : ''} aria-pressed={form.channel === c.id} onClick={() => set('channel')(c.id)}>
                <i className="dot" style={{ background: c.color }} />{c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="row2">
          <label className="field">
            <span>Contact</span>
            <input maxLength={200} placeholder="Handle, phone or email" value={form.contact} onChange={set('contact')} />
          </label>
          <label className="field">
            <span>Deal value in USD</span>
            <input inputMode="decimal" placeholder="0" value={form.value} onChange={set('value')} />
          </label>
        </div>

        <label className="field">
          <span>What they want</span>
          <textarea rows={2} maxLength={500} value={form.need} onChange={set('need')} />
        </label>
    </>
  );

  const status = (
    <>
        <fieldset className="field">
          <legend>Stage</legend>
          <div className="chips stages">
            {STAGES.map((s) => (
              <button type="button" key={s.id} className={`st-${s.id}${form.stage === s.id ? ' on' : ''}`} aria-pressed={form.stage === s.id} onClick={() => set('stage')(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="row2">
          <fieldset className="field">
            <legend>Next follow-up</legend>
            <div className="chips">
              {followChoices.map(([label, d]) => {
                const v = addDays(todayStr(), d);
                return (
                  <button type="button" key={label} className={form.next_follow_up === v ? 'on' : ''} onClick={() => set('next_follow_up')(v)}>
                    {label}
                  </button>
                );
              })}
              <button type="button" className={!form.next_follow_up ? 'on' : ''} onClick={() => set('next_follow_up')('')}>None</button>
            </div>
            <input type="date" aria-label="Pick a date" value={form.next_follow_up || ''} onChange={set('next_follow_up')} />
            {form.next_follow_up && <small>{relDay(form.next_follow_up)}</small>}
          </fieldset>
          {data.members.length > 1 && (
            <label className="field">
              <span>Assigned to</span>
              <select value={form.owner_id || ''} onChange={set('owner_id')}>
                <option value="">Nobody yet</option>
                {data.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.user_id === me.id ? `${m.display_name} (you)` : m.display_name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
    </>
  );

  return (
    <Sheet
      open
      wide
      title={isNew ? 'New lead' : lead.name}
      onClose={onClose}
      footer={
        <div className="foot-row">
          {canDelete && (
            <button type="button" className={`btn ghost danger${confirmDelete ? ' armed' : ''}`} onClick={remove}>
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          <button type="submit" form="lead-form" className="btn primary" disabled={busy || !dirty}>
            {busy ? 'Saving' : isNew ? 'Add lead' : 'Save changes'}
          </button>
        </div>
      }
    >
      {!isNew && (
        <div className="quick">
          <span className="quick-contact">
            <ChannelTag id={lead.channel} />
            {lead.contact && (contactHref(lead) ? <a href={contactHref(lead)} target="_blank" rel="noreferrer">{lead.contact}</a> : <span>{lead.contact}</span>)}
          </span>
          <button type="button" className="btn small" onClick={logMessage}>Log a message sent</button>
        </div>
      )}
      <form id="lead-form" className="lead-form" onSubmit={save}>
        {isNew ? (
          <>
            {details}
            {status}
          </>
        ) : (
          <>
            {status}
            {details}
          </>
        )}
        <label className="field">
          <span>Notes</span>
          <textarea rows={3} maxLength={4000} value={form.notes} onChange={set('notes')} />
        </label>

        {error && <p className="msg err" role="alert">{error}</p>}
      </form>

      {!isNew && (
        <section className="history" aria-label="History">
          <div className="history-head">
            <h3>History</h3>
          </div>
          <div className="note-add">
            <input placeholder="Add a note, e.g. asked for the price list" value={note} maxLength={1000}
              onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNote())} />
            <button type="button" className="btn small" onClick={addNote} disabled={!note.trim()}>Add</button>
          </div>
          {history === null ? (
            <p className="muted">Loading</p>
          ) : history.length === 0 ? (
            <p className="muted">Nothing logged yet.</p>
          ) : (
            <ol className="timeline">
              {history.map((a) => (
                <li key={a.id} className={`tl-${a.kind}`}>
                  <span className="tl-body">{a.body || (a.kind === 'message' ? 'Sent a message' : a.kind)}</span>
                  <span className="tl-meta">{who(data, a.user_id, me)} {timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </Sheet>
  );
}

const k = Object.keys;

function who(data, uid, me) {
  if (uid === me.id) return 'You,';
  const m = data.members.find((x) => x.user_id === uid);
  return `${m ? m.display_name : 'Former teammate'},`;
}

function contactHref(lead) {
  const c = (lead.contact || '').trim();
  if (/^\S+@\S+\.\S+$/.test(c)) return `mailto:${c}`;
  const digits = c.replace(/[^0-9+]/g, '');
  if (/^\+?[0-9]{7,15}$/.test(digits) && digits.replace('+', '').length >= 7) {
    return lead.channel === 'whatsapp' ? `https://wa.me/${digits.replace('+', '')}` : `tel:${digits}`;
  }
  if (lead.channel === 'instagram' && /^@?[A-Za-z0-9._]{2,30}$/.test(c)) return `https://instagram.com/${c.replace('@', '')}`;
  if (/^(https?:\/\/|linkedin\.com|www\.)/i.test(c)) return c.startsWith('http') ? c : `https://${c}`;
  return null;
}
