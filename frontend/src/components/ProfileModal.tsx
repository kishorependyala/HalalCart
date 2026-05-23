import { useState } from 'react';

import { User } from '../api';
import { S } from '../theme';

type Props = {
  user: User;
  onUpdate: (updated: User) => void;
  onClose: () => void;
};

export default function ProfileModal({ user, onUpdate, onClose }: Props) {
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onUpdate({ ...user, name: name.trim() });
    setSaved(true);
    setTimeout(onClose, 800);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '1.2rem', padding: '2rem', width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(120,53,15,0.18)' }}>
        <h2 style={{ margin: '0 0 1.25rem', color: '#78350f', fontWeight: 900, fontSize: '1.2rem' }}>
          {user.isAdmin ? '🛡️' : '👤'} My Profile
        </h2>

        {saved ? (
          <div style={{ ...S.successBox, marginBottom: '1rem' }}>Profile updated!</div>
        ) : null}

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <label style={S.label}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={S.inp}
              placeholder="Your name"
              autoFocus
            />
          </div>

          <div>
            <label style={S.label}>Phone / ID</label>
            <div style={{ ...S.inp, background: '#f3f4f6', color: '#6b7280', cursor: 'default' }}>
              {user.phone}
            </div>
          </div>

          {user.email && user.email !== user.phone && (
            <div>
              <label style={S.label}>Email</label>
              <div style={{ ...S.inp, background: '#f3f4f6', color: '#6b7280', cursor: 'default' }}>
                {user.email}
              </div>
            </div>
          )}

          {user.isAdmin && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.6rem', padding: '0.6rem 0.8rem', color: '#92400e', fontSize: '0.85rem', fontWeight: 600 }}>
              🛡️ Admin account
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
            <button type="submit" disabled={!name.trim() || saved} style={{ ...S.primaryBtn, flex: 1, opacity: !name.trim() || saved ? 0.6 : 1 }}>
              Save
            </button>
            <button type="button" onClick={onClose} style={{ ...S.outlineBtn, flex: 1 }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
