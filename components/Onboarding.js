'use client';
import { useState } from 'react';
import { Logo, Segmented } from './ui';

export default function Onboarding({ api, email, onDone, canCancel, onCancel }) {
  const [mode, setMode] = useState('create');
  const [team, setTeam] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const id = mode === 'create'
        ? await api.createWorkspace(team.trim(), name.trim())
        : await api.joinWorkspace(code.trim(), name.trim());
      await onDone(id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo size={44} />
        <h1>{mode === 'create' ? 'Start a team' : 'Join your team'}</h1>
        <p className="muted">
          Everyone on a team shares one pipeline. Signed in as {email}.
        </p>

        <Segmented
          label="Start or join"
          value={mode}
          onChange={(v) => { setMode(v); setError(''); }}
          options={[{ id: 'create', label: 'Start a team' }, { id: 'join', label: 'I have a code' }]}
        />

        {mode === 'create' ? (
          <label className="field">
            <span>Team name</span>
            <input required maxLength={80} placeholder="e.g. a1nnovate sales" value={team} onChange={(e) => setTeam(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span>Team code</span>
            <input
              required
              className="code-input"
              maxLength={6}
              autoCapitalize="characters"
              placeholder="6 letters"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <small>Ask the team owner. It’s on their Team tab.</small>
          </label>
        )}

        <label className="field">
          <span>Your name, as teammates will see it</span>
          <input required maxLength={60} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {error && <p className="msg err" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'One moment' : mode === 'create' ? 'Create team' : 'Join team'}
        </button>
        {canCancel && <button type="button" className="link" onClick={onCancel}>Back to my team</button>}
        {!canCancel && <button type="button" className="link quiet" onClick={() => api.signOut()}>Use a different account</button>}
      </form>
    </div>
  );
}
