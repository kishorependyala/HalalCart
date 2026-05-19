import { useCallback, useEffect, useState } from 'react';

import { getOrders, Order, updateOrder, User } from '../api';
import { S, mutedText, sectionTitle } from '../theme';

type Props = {
  adminUser: User;
};

function statusBadge(status: Order['status']) {
  const map: Record<string, { background: string; color: string }> = {
    pending:   { background: '#fef3c7', color: '#92400e' },
    accepted:  { background: '#dbeafe', color: '#1e40af' },
    ready:     { background: '#dcfce7', color: '#166534' },
    completed: { background: '#e5e7eb', color: '#374151' },
  };
  const colors = map[status.toLowerCase()] ?? map.pending;
  return {
    ...colors,
    borderRadius: 999,
    padding: '0.25rem 0.7rem',
    fontSize: '0.74rem',
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  };
}

export default function AdminTab({ adminUser }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prepEdits, setPrepEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await getOrders();
      setOrders(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15_000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const patchOrder = async (id: string, updates: { status?: Order['status']; prepMinutes?: number }) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const updated = await updateOrder(id, updates, adminUser);
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const savePrepTime = (order: Order) => {
    const raw = prepEdits[order.id];
    const val = parseInt(raw ?? '', 10);
    if (!raw || isNaN(val) || val < 1) return;
    patchOrder(order.id, { prepMinutes: val });
    setPrepEdits((e) => { const next = { ...e }; delete next[order.id]; return next; });
  };

  const activeOrders = orders.filter((o) => o.status !== 'Completed');
  const completedOrders = orders.filter((o) => o.status === 'Completed');

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={sectionTitle}>🛡️ Admin — All Orders</h2>
            <p style={mutedText}>Accept orders, set prep time, and mark ready for pickup.</p>
          </div>
          <button type="button" onClick={loadOrders} style={S.outlineBtn}>Refresh</button>
        </div>
      </section>

      {loading && !orders.length ? <div style={S.card}>Loading orders…</div> : null}
      {error ? <div style={{ ...S.card, ...S.errorBox }}>{error}</div> : null}
      {!loading && !error && !orders.length ? (
        <div style={{ ...S.card, background: '#fffaf0' }}>No orders yet.</div>
      ) : null}

      {activeOrders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          isBusy={!!busy[order.id]}
          prepEdit={prepEdits[order.id] ?? ''}
          onPrepEditChange={(v) => setPrepEdits((e) => ({ ...e, [order.id]: v }))}
          onSavePrepTime={() => savePrepTime(order)}
          onAccept={() => patchOrder(order.id, { status: 'Accepted' })}
          onMarkReady={() => patchOrder(order.id, { status: 'Ready' })}
          onComplete={() => patchOrder(order.id, { status: 'Completed' })}
        />
      ))}

      {completedOrders.length > 0 && (
        <details style={S.card}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#78350f' }}>
            Completed Orders ({completedOrders.length})
          </summary>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
            {completedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isBusy={!!busy[order.id]}
                prepEdit={prepEdits[order.id] ?? ''}
                onPrepEditChange={(v) => setPrepEdits((e) => ({ ...e, [order.id]: v }))}
                onSavePrepTime={() => savePrepTime(order)}
                onAccept={() => patchOrder(order.id, { status: 'Accepted' })}
                onMarkReady={() => patchOrder(order.id, { status: 'Ready' })}
                onComplete={() => patchOrder(order.id, { status: 'Completed' })}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

type CardProps = {
  order: Order;
  isBusy: boolean;
  prepEdit: string;
  onPrepEditChange: (v: string) => void;
  onSavePrepTime: () => void;
  onAccept: () => void;
  onMarkReady: () => void;
  onComplete: () => void;
};

function OrderCard({ order, isBusy, prepEdit, onPrepEditChange, onSavePrepTime, onAccept, onMarkReady, onComplete }: CardProps) {
  const displayPrep = prepEdit !== '' ? prepEdit : String(order.prepMinutes ?? '');

  return (
    <div style={{ border: '1px solid #fed7aa', borderRadius: '0.95rem', padding: '1rem', background: '#fffbeb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, color: '#78350f' }}>Order #{order.id.slice(-8).toUpperCase()}</div>
          <p style={mutedText}>{order.customerName} · {order.phone}</p>
          <p style={{ ...mutedText, marginTop: '0.2rem' }}>Pickup: {order.pickupTime}</p>
        </div>
        <span style={statusBadge(order.status)}>{order.status}</span>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.35rem' }}>
        {order.items.map((item) => (
          <div key={`${order.id}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: '#78350f' }}>
            <span>{item.name} × {item.qty}</span>
            <span>${(item.lineTotal ?? item.price * item.qty).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '1 1 180px' }}>
          <label style={{ ...S.label, margin: 0, whiteSpace: 'nowrap' }}>Prep (min):</label>
          <input
            type="number"
            min={1}
            value={displayPrep}
            onChange={(e) => onPrepEditChange(e.target.value)}
            onBlur={onSavePrepTime}
            onKeyDown={(e) => e.key === 'Enter' && onSavePrepTime()}
            style={{ ...S.inp, width: 70, padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {order.status === 'Pending' && (
            <button type="button" onClick={onAccept} disabled={isBusy} style={{ ...S.primaryBtn, opacity: isBusy ? 0.6 : 1 }}>
              ✅ Accept
            </button>
          )}
          {order.status === 'Accepted' && (
            <button type="button" onClick={onMarkReady} disabled={isBusy} style={{ ...S.primaryBtn, opacity: isBusy ? 0.6 : 1, background: '#16a34a' }}>
              🔔 Mark Ready
            </button>
          )}
          {order.status === 'Ready' && (
            <button type="button" onClick={onComplete} disabled={isBusy} style={{ ...S.outlineBtn, opacity: isBusy ? 0.6 : 1 }}>
              ✔ Complete
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: '0.5rem', color: '#92400e', fontWeight: 700, fontSize: '0.9rem' }}>
        Total: ${order.total.toFixed(2)}
      </div>
    </div>
  );
}
