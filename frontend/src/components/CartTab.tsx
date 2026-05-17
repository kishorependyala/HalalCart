import { useEffect, useMemo, useState } from 'react';

import { Order, OrderItem, placeOrder } from '../api';
import { S, mutedText, sectionTitle } from '../theme';

export type CartItem = OrderItem & {
  unit: string;
  description: string;
};

type Props = {
  cartItems: CartItem[];
  onUpdateQty: (itemId: string, nextQty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onOrderPlaced: (order: Order) => void;
};

function formatPickupValue(date: string, time: string) {
  return `${date} ${time}`;
}

function formatTimeLabel(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function buildPickupSlots(dateValue: string) {
  const selectedDate = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const closingHour = selectedDate.getDay() === 0 ? 18 : 20;
  const slots: string[] = [];

  for (let hour = 10; hour <= closingHour; hour += 1) {
    slots.push(formatTimeLabel(hour, 0));
    if (hour !== closingHour) {
      slots.push(formatTimeLabel(hour, 30));
    }
  }

  return slots;
}

export default function CartTab({ cartItems, onUpdateQty, onRemoveItem, onOrderPlaced }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cartItems]
  );
  const pickupSlots = useMemo(() => buildPickupSlots(pickupDate), [pickupDate]);

  useEffect(() => {
    if (pickupTime && !pickupSlots.includes(pickupTime)) {
      setPickupTime('');
    }
  }, [pickupSlots, pickupTime]);

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!cartItems.length) {
      setError('Add at least one item before placing an order.');
      return;
    }
    if (!customerName.trim() || !phone.trim() || !pickupDate || !pickupTime) {
      setError('Complete all pickup details before placing your order.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await placeOrder({
        customerName: customerName.trim(),
        phone: phone.trim(),
        pickupTime: formatPickupValue(pickupDate, pickupTime),
        items: cartItems.map(({ id, name, qty, price }) => ({ id, name, qty, price })),
      });
      onOrderPlaced(order);
      setCustomerName('');
      setPhone('');
      setPickupDate('');
      setPickupTime('');
      setSuccess(`Order placed! Confirmation #${order.id.slice(-8).toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place the order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 style={sectionTitle}>Your Cart</h2>
            <p style={mutedText}>Pickup only at Halal Meat Market.</p>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#78350f' }}>Subtotal: ${subtotal.toFixed(2)}</div>
        </div>

        {!cartItems.length ? (
          <div style={{ ...S.card, marginTop: '1rem', background: '#fffaf0' }}>Your cart is empty. Add meats or snacks from the menu tab.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '1rem' }}>
            {cartItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid #fed7aa', borderRadius: '0.85rem', padding: '0.9rem', background: '#fffbeb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#78350f' }}>{item.name}</div>
                    <p style={{ ...mutedText, marginBottom: '0.4rem' }}>{item.description}</p>
                    <div style={{ color: '#92400e', fontWeight: 600 }}>${item.price.toFixed(2)} / {item.unit}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button type="button" onClick={() => onUpdateQty(item.id, item.qty - 1)} style={{ ...S.outlineBtn, padding: '0.45rem 0.8rem' }}>
                      −
                    </button>
                    <div style={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>{item.qty}</div>
                    <button type="button" onClick={() => onUpdateQty(item.id, item.qty + 1)} style={{ ...S.outlineBtn, padding: '0.45rem 0.8rem' }}>
                      +
                    </button>
                    <button type="button" onClick={() => onRemoveItem(item.id)} style={S.dangerBtn}>
                      Remove
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', fontWeight: 700, color: '#78350f' }}>
                  Line total: ${(item.price * item.qty).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={S.card}>
        <h2 style={sectionTitle}>Place Order</h2>
        <p style={{ ...mutedText, marginBottom: '1rem' }}>Open daily for pickup: 10 AM – 8 PM (Mon–Sat), 10 AM – 6 PM (Sun).</p>

        {error ? <div style={{ ...S.errorBox, marginBottom: '0.9rem' }}>{error}</div> : null}
        {success ? <div style={{ ...S.successBox, marginBottom: '0.9rem' }}>{success}</div> : null}

        <form onSubmit={submitOrder} style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <label htmlFor="customerName" style={S.label}>Customer Name</label>
            <input id="customerName" value={customerName} onChange={(event) => setCustomerName(event.target.value)} style={S.inp} placeholder="Your full name" />
          </div>

          <div>
            <label htmlFor="phone" style={S.label}>Phone</label>
            <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} style={S.inp} placeholder="(609) 555-1234" />
          </div>

          <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <label htmlFor="pickupDate" style={S.label}>Pickup Date</label>
              <input id="pickupDate" type="date" value={pickupDate} min={new Date().toISOString().split('T')[0]} onChange={(event) => setPickupDate(event.target.value)} style={S.inp} />
            </div>
            <div>
              <label htmlFor="pickupTime" style={S.label}>Pickup Time</label>
              <select id="pickupTime" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} style={S.inp}>
                <option value="">Select a pickup time</option>
                {pickupSlots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={submitting} style={{ ...S.primaryBtn, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </form>
      </section>
    </div>
  );
}
