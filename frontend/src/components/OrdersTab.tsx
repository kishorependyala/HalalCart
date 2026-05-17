import { useEffect } from 'react';

import { Order } from '../api';
import { S, mutedText, sectionTitle } from '../theme';

type Props = {
  orders: Order[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
};

function statusBadge(status: Order['status']) {
  const normalized = status.toLowerCase();
  const colors =
    normalized === 'pending'
      ? { background: '#fef3c7', color: '#92400e' }
      : normalized === 'ready'
        ? { background: '#dcfce7', color: '#166534' }
        : { background: '#e5e7eb', color: '#374151' };

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

export default function OrdersTab({ orders, loading, error, onRefresh }: Props) {
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h2 style={sectionTitle}>Recent Orders</h2>
          <p style={mutedText}>Track pickup orders and current preparation status.</p>
        </div>
        <button type="button" onClick={onRefresh} style={S.outlineBtn}>Refresh Orders</button>
      </div>

      {loading ? <div>Loading orders...</div> : null}
      {error ? <div style={{ ...S.errorBox, marginBottom: '0.9rem' }}>{error}</div> : null}
      {!loading && !error && !orders.length ? <div style={{ ...S.card, background: '#fffaf0', marginBottom: 0 }}>No orders yet. Place your first pickup order from the cart tab.</div> : null}

      <div style={{ display: 'grid', gap: '0.9rem' }}>
        {orders.map((order) => (
          <div key={order.id} style={{ border: '1px solid #fed7aa', borderRadius: '0.95rem', padding: '1rem', background: '#fffbeb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#78350f' }}>Order #{order.id.slice(-8).toUpperCase()}</div>
                <p style={mutedText}>{order.customerName} · {order.phone}</p>
              </div>
              <span style={statusBadge(order.status)}>{order.status}</span>
            </div>

            <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.45rem' }}>
              {order.items.map((item) => (
                <div key={`${order.id}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: '#78350f' }}>
                  <span>{item.name} × {item.qty}</span>
                  <span>${((item.lineTotal ?? item.price * item.qty)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '0.9rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', color: '#92400e', fontWeight: 600 }}>
              <span>Pickup: {order.pickupTime}</span>
              <span>Total: ${order.total.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
