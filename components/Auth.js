'use client';
import { useState } from 'react';
import { Logo } from './ui';

export default function Auth({ api }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'in') {
        await api.signIn(email.trim(), password);
      } else {
        const { needsConfirm } = await api.signUp(email.trim(), password);
        if (needsConfirm) {
          setInfo(`We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`);
          setMode('in');
        }
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'That email and password don’t match an account.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo size={44} />
        <h1>{mode === 'in' ? 'Sign in to Clawser' : 'Create your account'}</h1>
        <p className="muted">Your team’s leads and follow-ups, in one place.</p>

        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="msg err" role="alert">{error}</p>}
        {info && <p className="msg ok" role="status">{info}</p>}

        <button className="btn primary block" disabled={busy}>
          {busy ? 'One moment' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); }}>
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        <a className="link quiet" href="/demo">Look around the demo first</a>
      </form>
    </div>
  );
}
