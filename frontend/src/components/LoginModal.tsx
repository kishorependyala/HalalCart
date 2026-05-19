import { useAuth0 } from '@auth0/auth0-react';
import { useState } from 'react';

import { loginUser, User } from '../api';
import { S } from '../theme';

type Props = {
  onLogin: (user: User) => void;
  onClose: () => void;
  adminEmail?: string;
};

// Social provider button configs
const SOCIAL_PROVIDERS: Array<{
  connection: string;
  label: string;
  icon: string;
  bg: string;
  color: string;
  border: string;
}> = [
  { connection: 'google-oauth2', label: 'Google',    icon: '🔵', bg: '#fff',     color: '#3c4043', border: '#dadce0' },
  { connection: 'apple',         label: 'Apple',     icon: '🍎', bg: '#000',     color: '#fff',    border: '#000' },
  { connection: 'facebook',      label: 'Facebook',  icon: '📘', bg: '#1877f2',  color: '#fff',    border: '#1877f2' },
  { connection: 'discord',       label: 'Discord',   icon: '🎮', bg: '#5865f2',  color: '#fff',    border: '#5865f2' },
  { connection: 'twitter',       label: 'Twitter / X', icon: '🐦', bg: '#000',   color: '#fff',    border: '#000' },
  { connection: 'snap',          label: 'Snapchat',  icon: '👻', bg: '#fffc00',  color: '#000',    border: '#fffc00' },
  { connection: 'windowslive',   label: 'Microsoft', icon: '🎮', bg: '#00a4ef',  color: '#fff',    border: '#00a4ef' },
];

export default function LoginModal({ onLogin, onClose }: Props) {
  const { loginWithPopup, user: auth0User, isAuthenticated } = useAuth0();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState<string | null>(null); // stores which provider is loading
  const [error, setError] = useState('');
  const [showPhoneForm, setShowPhoneForm] = useState(false);

  const handleSocial = async (connection: string) => {
    setError('');
    setLoading(connection);
    try {
      await loginWithPopup({ authorizationParams: { connection } });
      // auth0User is updated after loginWithPopup resolves
      // We read it fresh from the hook on next render via useEffect in App, but
      // here we call onLogin directly once Auth0 confirms success.
    } catch (err: any) {
      if (err?.error !== 'popup_closed_by_user') {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(null);
    }
  };

  // After a successful social login, auth0User will be populated — close modal
  if (isAuthenticated && auth0User) {
    // Let App.tsx handle mapping via useEffect; just close
    onClose();
    return null;
  }

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.');
      return;
    }
    setLoading('phone');
    try {
      const user = await loginUser(name.trim(), phone.trim());
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      onLogin({ ...user, authMethod: 'phone' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '1.2rem', padding: '2rem', width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(120,53,15,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 0.25rem', color: '#78350f', fontWeight: 900, fontSize: '1.3rem' }}>
          🥩 Sign In
        </h2>
        <p style={{ margin: '0 0 1.4rem', color: '#92400e', fontSize: '0.88rem' }}>
          Sign in to place orders and get pickup notifications.
        </p>

        {error ? <div style={{ ...S.errorBox, marginBottom: '1rem' }}>{error}</div> : null}

        {/* Social login buttons */}
        <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {SOCIAL_PROVIDERS.map(({ connection, label, icon, bg, color, border }) => (
            <button
              key={connection}
              type="button"
              disabled={loading !== null}
              onClick={() => handleSocial(connection)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                background: bg, color, border: `1.5px solid ${border}`,
                borderRadius: '0.75rem', padding: '0.65rem 1rem', fontSize: '0.92rem', fontWeight: 600,
                cursor: loading !== null ? 'not-allowed' : 'pointer',
                opacity: loading !== null && loading !== connection ? 0.55 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <span>{icon}</span>
              <span>{loading === connection ? 'Signing in…' : `Continue with ${label}`}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.1rem' }}>
          <div style={{ flex: 1, height: 1, background: '#fde68a' }} />
          <span style={{ color: '#92400e', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            or use phone number
          </span>
          <div style={{ flex: 1, height: 1, background: '#fde68a' }} />
        </div>

        {/* Phone form (collapsible) */}
        {showPhoneForm ? (
          <form onSubmit={submitPhone} style={{ display: 'grid', gap: '0.9rem' }}>
            <div>
              <label htmlFor="login-name" style={S.label}>Your Name</label>
              <input id="login-name" value={name} onChange={(e) => setName(e.target.value)} style={S.inp} placeholder="Full name" autoFocus />
            </div>
            <div>
              <label htmlFor="login-phone" style={S.label}>Phone Number</label>
              <input id="login-phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={S.inp} placeholder="e.g. 7321234567" type="tel" />
            </div>
            <button type="submit" disabled={loading === 'phone'} style={{ ...S.primaryBtn, opacity: loading === 'phone' ? 0.7 : 1 }}>
              {loading === 'phone' ? 'Signing in…' : 'Sign In with Phone'}
            </button>
            <button type="button" onClick={() => setShowPhoneForm(false)} style={{ ...S.outlineBtn, textAlign: 'center' }}>
              ← Back
            </button>
          </form>
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <button type="button" onClick={() => setShowPhoneForm(true)} style={{ ...S.outlineBtn, textAlign: 'center' }}>
              📱 Continue with Phone Number
            </button>
            <button type="button" onClick={onClose} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.4rem' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
