import { useState } from 'react';

import { loginUser, User } from '../api';
import { S } from '../theme';

type Props = {
  onLogin: (user: User) => void;
  onClose: () => void;
};

export default function LoginModal({ onLogin, onClose }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.');
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(name.trim(), phone.trim());
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '1.2rem', padding: '2rem', width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(120,53,15,0.18)' }}>
        <h2 style={{ margin: '0 0 0.35rem', color: '#78350f', fontWeight: 900, fontSize: '1.3rem' }}>
          🥩 Sign In
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: '#92400e', fontSize: '0.9rem' }}>
          Sign in with your name and phone number to place orders and get pickup notifications.
        </p>

        {error ? <div style={{ ...S.errorBox, marginBottom: '1rem' }}>{error}</div> : null}

        <form onSubmit={submit} style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <label htmlFor="login-name" style={S.label}>Your Name</label>
            <input
              id="login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={S.inp}
              placeholder="Full name"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="login-phone" style={S.label}>Phone Number</label>
            <input
              id="login-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={S.inp}
              placeholder="e.g. 7321234567"
              type="tel"
            />
          </div>
          <button type="submit" disabled={loading} style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1, marginTop: '0.3rem' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <button type="button" onClick={onClose} style={{ ...S.outlineBtn, textAlign: 'center' }}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
