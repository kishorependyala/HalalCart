import { useEffect, useMemo, useState } from 'react';

import { Order, OrderItem, StoreLocation, getLocations, placeOrder, User } from '../api';
import { S, mutedText, sectionTitle } from '../theme';

export type CartItem = OrderItem & {
  unit: string;
  description: string;
};

type Props = {
  user: User | null;
  cartItems: CartItem[];
  onUpdateQty: (itemId: string, nextQty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onOrderPlaced: (order: Order) => void;
  onLoginRequest: () => void;
  prepMinutes?: number;
};

/**
 * Round a Date up to the next full hour
 */
function roundUpToNextHour(date: Date): Date {
  const result = new Date(date);
  if (result.getMinutes() > 0 || result.getSeconds() > 0) {
    result.setHours(result.getHours() + 1, 0, 0, 0);
  } else {
    result.setMinutes(0, 0, 0);
  }
  return result;
}

/** Round a Date up to the nearest N-minute boundary */
function roundUpMinutes(date: Date, step = 15): Date {
  const ms = step * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/** Format HH:MM string (e.g. "10:00") as local time label */
function fmtHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Next hourly delivery slot: now + prepMins rounded up to next full hour, within location hours.
 */
function getNextHourlySlot(loc: StoreLocation, prepMins: number): { date: Date; label: string } | null {
  const earliest = roundUpToNextHour(new Date(Date.now() + prepMins * 60_000));

  for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
    const candidate = new Date(earliest);
    candidate.setDate(earliest.getDate() + daysAhead);
    if (daysAhead > 0) candidate.setHours(0, 0, 0, 0);

    const dayKey = String(candidate.getDay());
    const dayHours = loc.hours[dayKey];
    if (!dayHours) continue;

    const [openH, openM] = (dayHours as { open: string; close: string }).open.split(':').map(Number);
    const [closeH, closeM] = (dayHours as { open: string; close: string }).close.split(':').map(Number);

    const openTime = new Date(candidate); openTime.setHours(openH, openM, 0, 0);
    const closeTime = new Date(candidate); closeTime.setHours(closeH, closeM, 0, 0);

    let slotTime: Date;
    if (daysAhead === 0) {
      if (candidate >= closeTime) continue;
      slotTime = candidate < openTime ? openTime : candidate;
    } else {
      slotTime = openTime;
    }
    // Snap to next full hour if not on the hour
    if (slotTime.getMinutes() !== 0) slotTime = roundUpToNextHour(slotTime);
    if (slotTime >= closeTime) continue;

    const isToday = slotTime.toDateString() === new Date().toDateString();
    const dateLabel = isToday ? 'today' : fmtDateShort(slotTime);
    const timeLabel = slotTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return { date: slotTime, label: `~${timeLabel} ${dateLabel}` };
  }
  return null;
}

/**
 * Given a location and prep minutes, return the next tentative pickup slot.
 * Returns null if the store has no open days in the next 7 days.
 */
function getNextPickupSlot(loc: StoreLocation, prepMins: number): { date: Date; label: string } | null {
  const earliest = roundUpMinutes(new Date(Date.now() + prepMins * 60_000));

  for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
    const candidate = new Date(earliest);
    candidate.setDate(earliest.getDate() + daysAhead);
    if (daysAhead > 0) candidate.setHours(0, 0, 0, 0);

    const dayKey = String(candidate.getDay());
    const dayHours = loc.hours[dayKey];
    if (!dayHours) continue; // closed

    const [openH, openM] = (dayHours as { open: string; close: string }).open.split(':').map(Number);
    const [closeH, closeM] = (dayHours as { open: string; close: string }).close.split(':').map(Number);

    const openTime = new Date(candidate);
    openTime.setHours(openH, openM, 0, 0);
    const closeTime = new Date(candidate);
    closeTime.setHours(closeH, closeM, 0, 0);

    let slotTime: Date;
    if (daysAhead === 0) {
      if (candidate >= closeTime) continue; // already past close
      slotTime = candidate < openTime ? openTime : candidate;
    } else {
      slotTime = openTime;
    }

    const isToday = slotTime.toDateString() === new Date().toDateString();
    const dateLabel = isToday ? 'today' : fmtDateShort(slotTime);
    const timeLabel = slotTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return { date: slotTime, label: `~${timeLabel} ${dateLabel}` };
  }
  return null;
}

function buildPickupSlots(dateValue: string, loc: StoreLocation | null): string[] {
  if (!loc) return [];
  const selectedDate = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const dayKey = String(selectedDate.getDay());
  const dayHours = loc.hours[dayKey];
  if (!dayHours) return [];
  const [openH] = (dayHours as { open: string; close: string }).open.split(':').map(Number);
  const [closeH] = (dayHours as { open: string; close: string }).close.split(':').map(Number);
  const isHourly = loc.deliveryMode === 'hourly_delivery';
  const slots: string[] = [];
  for (let hour = openH; hour <= closeH; hour++) {
    slots.push(fmtHHMM(`${String(hour).padStart(2, '0')}:00`));
    // Only add :30 slots for pickup locations
    if (!isHourly && hour !== closeH) slots.push(fmtHHMM(`${String(hour).padStart(2, '0')}:30`));
  }
  return slots;
}

export default function CartTab({ user, cartItems, onUpdateQty, onRemoveItem, onOrderPlaced, onLoginRequest, prepMinutes = 20 }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [selectedLocId, setSelectedLocId] = useState<string>('');

  useEffect(() => {
    getLocations().then((locs) => {
      setLocations(locs);
      if (locs.length > 0 && !selectedLocId) setSelectedLocId(locs[0].id);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) { setCustomerName(user.name); setPhone(user.phone); }
  }, [user]);

  const selectedLoc = useMemo(() => locations.find((l) => l.id === selectedLocId) ?? null, [locations, selectedLocId]);

  const isDelivery = selectedLoc?.deliveryMode === 'hourly_delivery';

  const tentativeSlot = useMemo(
    () => {
      if (!selectedLoc) return null;
      return isDelivery
        ? getNextHourlySlot(selectedLoc, prepMinutes)
        : getNextPickupSlot(selectedLoc, prepMinutes);
    },
    [selectedLoc, prepMinutes, isDelivery]
  );

  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0), [cartItems]);
  const pickupSlots = useMemo(() => buildPickupSlots(pickupDate, selectedLoc), [pickupDate, selectedLoc]);

  useEffect(() => {
    if (pickupTime && !pickupSlots.includes(pickupTime)) setPickupTime('');
  }, [pickupSlots, pickupTime]);

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); setSuccess('');
    if (!cartItems.length) { setError('Add at least one item before placing an order.'); return; }
    if (!customerName.trim() || !phone.trim() || !pickupDate || !pickupTime) {
      setError('Complete all pickup details before placing your order.'); return;
    }
    setSubmitting(true);
    try {
      const order = await placeOrder({
        customerName: customerName.trim(),
        phone: phone.trim(),
        pickupTime: `${pickupDate} ${pickupTime}`,
        locationId: selectedLocId,
        locationName: selectedLoc?.name ?? '',
        isDelivery,
        items: cartItems.map(({ id, name, qty, price }) => ({ id, name, qty, price })),
      });
      onOrderPlaced(order);
      setPickupDate(''); setPickupTime('');
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
            <p style={mutedText}>Pickup only · choose your location below.</p>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#78350f' }}>Subtotal: ${subtotal.toFixed(2)}</div>
        </div>

        {!cartItems.length ? (
          <div style={{ ...S.card, marginTop: '1rem', background: '#fffaf0' }}>Your cart is empty. Add items from the menu tab.</div>
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
                    <button type="button" onClick={() => onUpdateQty(item.id, item.qty - 1)} style={{ ...S.outlineBtn, padding: '0.45rem 0.8rem' }}>−</button>
                    <div style={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>{item.qty}</div>
                    <button type="button" onClick={() => onUpdateQty(item.id, item.qty + 1)} style={{ ...S.outlineBtn, padding: '0.45rem 0.8rem' }}>+</button>
                    <button type="button" onClick={() => onRemoveItem(item.id)} style={S.dangerBtn}>Remove</button>
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

        {/* Location selector */}
        {locations.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ ...S.label, marginBottom: '0.5rem' }}>📍 Pick-up Location</p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {locations.map((loc) => {
                const selected = selectedLocId === loc.id;
                const dayKey = String(new Date().getDay());
                const todayHours = loc.hours[dayKey];
                const hoursLabel = todayHours
                  ? `Today: ${fmtHHMM((todayHours as { open: string; close: string }).open)} – ${fmtHHMM((todayHours as { open: string; close: string }).close)}`
                  : 'Closed today';
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedLocId(loc.id)}
                    style={{
                      background: selected ? '#fef3c7' : '#fff',
                      border: `2px solid ${selected ? '#f59e0b' : '#e5e7eb'}`,
                      borderRadius: '0.75rem',
                      padding: '0.65rem 0.9rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#78350f', fontSize: '0.92rem' }}>{loc.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.1rem' }}>{loc.address}</div>
                      {loc.phone && <div style={{ fontSize: '0.78rem', color: '#92400e' }}>{loc.phone}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {selected && <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.8rem' }}>✓ Selected</div>}
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>{hoursLabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tentative time banner */}
        {selectedLoc && tentativeSlot && (
          <div style={{ background: isDelivery ? '#f0fdf4' : '#dbeafe', border: `1px solid ${isDelivery ? '#86efac' : '#93c5fd'}`, borderRadius: '0.65rem', padding: '0.6rem 0.9rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.1rem' }}>{isDelivery ? '🚗' : '⏱'}</span>
            <div>
              <span style={{ fontWeight: 800, color: isDelivery ? '#16a34a' : '#1e40af' }}>
                Next {isDelivery ? 'delivery' : 'available'}: {tentativeSlot.label}
              </span>
              <span style={{ color: isDelivery ? '#15803d' : '#3b82f6', fontSize: '0.8rem', display: 'block' }}>
                {isDelivery
                  ? 'Hourly delivery slot — store will confirm exact time'
                  : 'Tentative — confirmed once store accepts your order'}
              </span>
            </div>
          </div>
        )}
        {selectedLoc && !tentativeSlot && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '0.65rem', padding: '0.6rem 0.9rem', marginBottom: '1rem', color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>
            🚫 This location appears to be closed for the next 7 days. Please call to arrange pickup.
          </div>
        )}

        {!user ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ ...mutedText, marginBottom: '1rem' }}>Sign in to place an order and receive pickup notifications.</p>
            <button type="button" onClick={onLoginRequest} style={S.primaryBtn}>🔑 Sign In to Order</button>
          </div>
        ) : (
          <>
            {error ? <div style={{ ...S.errorBox, marginBottom: '0.9rem' }}>{error}</div> : null}
            {success ? <div style={{ ...S.successBox, marginBottom: '0.9rem' }}>{success}</div> : null}

            <form onSubmit={submitOrder} style={{ display: 'grid', gap: '0.9rem' }}>
              <div>
                <label htmlFor="customerName" style={S.label}>Customer Name</label>
                <input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={S.inp} placeholder="Your full name" />
              </div>
              <div>
                <label htmlFor="phone" style={S.label}>Phone</label>
                <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...S.inp, background: '#f9fafb' }} readOnly placeholder="(609) 555-1234" />
              </div>

              <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div>
                  <label htmlFor="pickupDate" style={S.label}>{isDelivery ? 'Delivery Date' : 'Pickup Date'}</label>
                  <input id="pickupDate" type="date" value={pickupDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setPickupDate(e.target.value)} style={S.inp} />
                </div>
                <div>
                  <label htmlFor="pickupTime" style={S.label}>{isDelivery ? 'Delivery Slot' : 'Pickup Time'}</label>
                  <select id="pickupTime" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} style={S.inp}>
                    <option value="">Select {isDelivery ? 'a delivery slot' : 'a time'}</option>
                    {pickupSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={submitting} style={{ ...S.primaryBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Placing Order...' : isDelivery ? '🚗 Place Delivery Order' : 'Place Order'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
