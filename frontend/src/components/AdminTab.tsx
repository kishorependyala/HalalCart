import { useCallback, useEffect, useState } from 'react';

import {
  AdminsData,
  AppSettings,
  DataFileEntry,
  MenuItem,
  addAdmin,
  addMenuItem,
  adminGetMenu,
  deleteMenuItem,
  getAdmins,
  getOrders,
  getSettings,
  listDataFiles,
  Order,
  readDataFile,
  removeAdmin,
  updateMenuItem,
  updateOrder,
  updateSettings,
  User,
} from '../api';
import { S, mutedText, sectionTitle } from '../theme';

type AdminSubTab = 'orders' | 'menu' | 'data' | 'admins';

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
  const [subTab, setSubTab] = useState<AdminSubTab>('orders');

  const subTabs: Array<{ id: AdminSubTab; label: string; emoji: string }> = [
    { id: 'orders', label: 'Orders', emoji: '📋' },
    { id: 'menu',   label: 'Menu',   emoji: '🍖' },
    { id: 'data',   label: 'Data',   emoji: '📁' },
    { id: 'admins', label: 'Admins', emoji: '🛡️' },
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={S.card}>
        <h2 style={sectionTitle}>🛡️ Admin Panel</h2>
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', borderBottom: '2px solid #fed7aa', paddingBottom: '0' }}>
          {subTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: subTab === t.id ? '3px solid #f59e0b' : '3px solid transparent',
                color: subTab === t.id ? '#92400e' : '#6b7280',
                fontWeight: subTab === t.id ? 800 : 600,
                cursor: 'pointer',
                padding: '0.55rem 0.85rem',
                marginBottom: '-2px',
                fontSize: '0.9rem',
                whiteSpace: 'nowrap',
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </section>

      {subTab === 'orders' && <OrdersPanel adminUser={adminUser} />}
      {subTab === 'menu'   && <MenuPanel   adminUser={adminUser} />}
      {subTab === 'data'   && <DataPanel   adminUser={adminUser} />}
      {subTab === 'admins' && <AdminsPanel adminUser={adminUser} />}
    </div>
  );
}

// ── Orders Panel ─────────────────────────────────────────────────────────────

function OrdersPanel({ adminUser }: { adminUser: User }) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={mutedText}>Accept orders, set prep time, and mark ready for pickup.</p>
        <button type="button" onClick={loadOrders} style={S.outlineBtn}>Refresh</button>
      </div>

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

// ── Menu Management Panel ─────────────────────────────────────────────────────

const CATEGORIES: MenuItem['category'][] = ['Goat', 'Chicken', 'Snacks'];
const DELETE_PIN = '1234567';

type NewItemDraft = { name: string; category: MenuItem['category']; price: string; unit: string; description: string };
const emptyDraft = (): NewItemDraft => ({ name: '', category: 'Chicken', price: '', unit: 'per lb', description: '' });

function MenuPanel({ adminUser }: { adminUser: User }) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<MenuItem>>({});
  const [busy, setBusy] = useState(false);

  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [priceBusy, setPriceBusy] = useState<Record<string, boolean>>({});

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletePin, setDeletePin] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newDraft, setNewDraft] = useState<NewItemDraft>(emptyDraft());
  const [addBusy, setAddBusy] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState<Partial<AppSettings>>({});
  const [settingsBusy, setSettingsBusy] = useState(false);

  useEffect(() => {
    setLoading(true); setError('');
    Promise.all([adminGetMenu(adminUser), getSettings(adminUser)])
      .then(([menuData, settingsData]) => {
        setMenu(menuData);
        setSettings(settingsData);
        setSettingsDraft({ chickenPrepMinutes: settingsData.chickenPrepMinutes, goatPrepMinutes: settingsData.goatPrepMinutes });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load menu.'))
      .finally(() => setLoading(false));
  }, [adminUser]);

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id); setDeletingId(null);
    setDraft({ name: item.name, price: item.price, unit: item.unit, description: item.description, category: item.category });
    setMsg('');
  };
  const cancelEdit = () => { setEditingId(null); setDraft({}); };
  const saveItem = async (itemId: string) => {
    setBusy(true); setMsg('');
    try {
      const updated = await updateMenuItem(itemId, draft, adminUser);
      setMenu((m) => m.map((i) => (i.id === itemId ? updated : i)));
      setEditingId(null); setDraft({});
      setMsg('Item saved.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Save failed.'); }
    finally { setBusy(false); }
  };

  const savePrice = async (item: MenuItem) => {
    const raw = priceEdits[item.id];
    const val = parseFloat(raw ?? '');
    if (raw === undefined || isNaN(val) || val < 0) return;
    setPriceBusy((b) => ({ ...b, [item.id]: true }));
    try {
      const updated = await updateMenuItem(item.id, { price: val }, adminUser);
      setMenu((m) => m.map((i) => (i.id === item.id ? updated : i)));
      setPriceEdits((e) => { const n = { ...e }; delete n[item.id]; return n; });
      setMsg('Price updated.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Price update failed.'); }
    finally { setPriceBusy((b) => ({ ...b, [item.id]: false })); }
  };

  const startDelete = (item: MenuItem) => {
    setDeletingId(item.id); setDeletePin(''); setEditingId(null); setMsg('');
  };
  const confirmDelete = async (itemId: string) => {
    if (deletePin !== DELETE_PIN) { setMsg('Incorrect PIN.'); return; }
    setDeleteBusy(true); setMsg('');
    try {
      await deleteMenuItem(itemId, adminUser);
      setMenu((m) => m.filter((i) => i.id !== itemId));
      setDeletingId(null); setDeletePin('');
      setMsg('Item deleted.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Delete failed.'); }
    finally { setDeleteBusy(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newDraft.price);
    if (!newDraft.name.trim() || isNaN(price) || price < 0) {
      setMsg('Name and a valid price are required.'); return;
    }
    setAddBusy(true); setMsg('');
    try {
      const created = await addMenuItem({ ...newDraft, price }, adminUser);
      setMenu((m) => [...m, created]);
      setNewDraft(emptyDraft()); setShowAdd(false);
      setMsg('Item added.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Add failed.'); }
    finally { setAddBusy(false); }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); setSettingsBusy(true); setMsg('');
    try {
      const updated = await updateSettings(settingsDraft, adminUser);
      setSettings(updated);
      setSettingsDraft({ chickenPrepMinutes: updated.chickenPrepMinutes, goatPrepMinutes: updated.goatPrepMinutes });
      setMsg('Settings saved.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed to save settings.'); }
    finally { setSettingsBusy(false); }
  };

  if (loading) return <div style={S.card}>Loading menu…</div>;
  if (error)   return <div style={{ ...S.card, ...S.errorBox }}>{error}</div>;

  const categories = Array.from(new Set(menu.map((i) => i.category)));

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {msg && (
        <div style={{ ...S.card, ...(msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('error') ? S.errorBox : S.successBox) }}>
          {msg}
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} style={S.card}>
          <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>
            {cat === 'Goat' ? '🐐' : cat === 'Chicken' ? '🍗' : '🍟'} {cat}
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {menu.filter((i) => i.category === cat).map((item) => {
              const priceVal = priceEdits[item.id] !== undefined ? priceEdits[item.id] : item.price.toFixed(2);
              const isPriceDirty = priceEdits[item.id] !== undefined && priceEdits[item.id] !== item.price.toFixed(2);
              return (
                <div key={item.id} style={{ border: '1px solid #fde68a', borderRadius: '0.7rem', padding: '0.75rem', background: '#fffbeb' }}>

                  {editingId === item.id ? (
                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '2 1 160px' }}>
                          <label style={S.label}>Name</label>
                          <input style={S.inp} value={draft.name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                        </div>
                        <div style={{ flex: '1 1 100px' }}>
                          <label style={S.label}>Unit</label>
                          <input style={S.inp} value={draft.unit ?? ''} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} />
                        </div>
                        <div style={{ flex: '1 1 110px' }}>
                          <label style={S.label}>Category</label>
                          <select style={S.inp} value={draft.category ?? item.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as MenuItem['category'] }))}>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={S.label}>Description</label>
                        <input style={S.inp} value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={() => saveItem(item.id)} disabled={busy} style={{ ...S.primaryBtn, opacity: busy ? 0.6 : 1 }}>
                          {busy ? 'Saving…' : '💾 Save'}
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={busy} style={S.outlineBtn}>Cancel</button>
                      </div>
                    </div>

                  ) : deletingId === item.id ? (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: '#b91c1c' }}>🗑️ Delete "{item.name}"?</div>
                      <p style={{ ...mutedText, margin: 0 }}>Enter PIN to confirm deletion.</p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="password" placeholder="PIN" maxLength={10}
                          value={deletePin}
                          onChange={(e) => setDeletePin(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmDelete(item.id)}
                          style={{ ...S.inp, width: 110 }}
                          autoFocus
                        />
                        <button type="button" onClick={() => confirmDelete(item.id)} disabled={deleteBusy}
                          style={{ ...S.dangerBtn, opacity: deleteBusy ? 0.6 : 1 }}>
                          {deleteBusy ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                        <button type="button" onClick={() => setDeletingId(null)} disabled={deleteBusy} style={S.outlineBtn}>Cancel</button>
                      </div>
                    </div>

                  ) : (
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#78350f' }}>{item.name}</span>
                          <span style={{ ...mutedText, marginLeft: '0.5rem', fontSize: '0.8rem' }}>{item.unit}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button type="button" onClick={() => startEdit(item)} style={{ ...S.outlineBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>✏️ Edit</button>
                          <button type="button" onClick={() => startDelete(item)} style={{ ...S.dangerBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>🗑️</button>
                        </div>
                      </div>
                      {item.description && <div style={{ ...mutedText, fontSize: '0.82rem' }}>{item.description}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                        <span style={{ fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Price $</span>
                        <input
                          type="number" min={0} step={0.01}
                          value={priceVal}
                          onChange={(e) => setPriceEdits((p) => ({ ...p, [item.id]: e.target.value }))}
                          onBlur={() => savePrice(item)}
                          onKeyDown={(e) => e.key === 'Enter' && savePrice(item)}
                          style={{ ...S.inp, width: 80, padding: '0.3rem 0.45rem', fontWeight: 700, color: '#16a34a' }}
                        />
                        {isPriceDirty && (
                          <button type="button" onClick={() => savePrice(item)} disabled={!!priceBusy[item.id]}
                            style={{ ...S.primaryBtn, fontSize: '0.78rem', padding: '0.28rem 0.65rem', opacity: priceBusy[item.id] ? 0.6 : 1 }}>
                            {priceBusy[item.id] ? '…' : '💾'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showAdd ? '0.75rem' : 0 }}>
          <h3 style={{ margin: 0, color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>➕ Add New Item</h3>
          <button type="button" onClick={() => { setShowAdd((v) => !v); setNewDraft(emptyDraft()); }}
            style={{ ...S.outlineBtn, fontSize: '0.82rem', padding: '0.3rem 0.75rem' }}>
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showAdd && (
          <form onSubmit={handleAdd} style={{ display: 'grid', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 160px' }}>
                <label style={S.label}>Name *</label>
                <input required style={S.inp} value={newDraft.name}
                  onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Goat Ribs" />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={S.label}>Category *</label>
                <select required style={S.inp} value={newDraft.category}
                  onChange={(e) => setNewDraft((d) => ({ ...d, category: e.target.value as MenuItem['category'] }))}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 90px' }}>
                <label style={S.label}>Price ($) *</label>
                <input required type="number" min={0} step={0.01} style={S.inp} value={newDraft.price}
                  onChange={(e) => setNewDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={S.label}>Unit</label>
                <input style={S.inp} value={newDraft.unit}
                  onChange={(e) => setNewDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="per lb" />
              </div>
            </div>
            <div>
              <label style={S.label}>Description</label>
              <input style={S.inp} value={newDraft.description}
                onChange={(e) => setNewDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Short description…" />
            </div>
            <button type="submit" disabled={addBusy} style={{ ...S.primaryBtn, opacity: addBusy ? 0.6 : 1, justifySelf: 'start' }}>
              {addBusy ? 'Adding…' : '➕ Add Item'}
            </button>
          </form>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>⏱️ Default Prep Times</h3>
        <p style={{ ...mutedText, marginBottom: '0.75rem' }}>Used when estimating prep time for new orders.</p>
        <form onSubmit={saveSettings} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label style={S.label}>🍗 Chicken (minutes)</label>
              <input type="number" min={1} style={S.inp} value={settingsDraft.chickenPrepMinutes ?? ''}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, chickenPrepMinutes: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={S.label}>🐐 Goat (minutes)</label>
              <input type="number" min={1} style={S.inp} value={settingsDraft.goatPrepMinutes ?? ''}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, goatPrepMinutes: parseInt(e.target.value, 10) || 0 }))} />
            </div>
          </div>
          <button type="submit" disabled={settingsBusy} style={{ ...S.primaryBtn, opacity: settingsBusy ? 0.6 : 1, justifySelf: 'start' }}>
            {settingsBusy ? 'Saving…' : '💾 Save Prep Times'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Data Browser Panel ────────────────────────────────────────────────────────

function FileBreadcrumb({ path }: { path: string }) {
  const parts = path.replace(/\\/g, '/').split('/');
  const allParts = ['data', ...parts];
  return (
    <span style={{ fontFamily: 'monospace', fontSize: '0.88rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.1rem' }}>
      {allParts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
          {i > 0 && <span style={{ color: '#d1d5db', margin: '0 0.2rem' }}>›</span>}
          <span style={{ color: i === allParts.length - 1 ? '#78350f' : '#9ca3af', fontWeight: i === allParts.length - 1 ? 700 : 400 }}>
            {i === 0 ? '📁 ' : ''}{part}
          </span>
        </span>
      ))}
    </span>
  );
}

function DataPanel({ adminUser }: { adminUser: User }) {
  const [files, setFiles] = useState<DataFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listDataFiles(adminUser)
      .then(setFiles)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load files.'))
      .finally(() => setLoading(false));
  }, [adminUser]);

  const openFile = async (path: string) => {
    if (selected === path) { setSelected(null); setFileContent(null); return; }
    setSelected(path); setFileLoading(true); setFileContent(null);
    try {
      const res = await readDataFile(path, adminUser);
      setFileContent(res.content);
    } catch { setFileContent('Error reading file.'); }
    finally { setFileLoading(false); }
  };

  const fmt = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`;

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <p style={mutedText}>Browse files in the data directory.</p>
      {loading && <div style={S.card}>Loading files…</div>}
      {error   && <div style={{ ...S.card, ...S.errorBox }}>{error}</div>}
      {!loading && !error && !files.length && <div style={{ ...S.card, background: '#fffaf0' }}>No files found.</div>}
      {files.map((f) => (
        <div key={f.path} style={{ border: '1px solid #fed7aa', borderRadius: '0.8rem', background: '#fffbeb', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => openFile(f.path)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', textAlign: 'left' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{selected === f.path ? '▼' : '▶'}</span>
              <FileBreadcrumb path={f.path} />
            </span>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmt(f.size)}</span>
          </button>
          {selected === f.path && (
            <div style={{ borderTop: '1px solid #fed7aa', padding: '0.75rem 1rem' }}>
              {fileLoading
                ? <span style={mutedText}>Loading…</span>
                : <pre style={{ margin: 0, fontSize: '0.78rem', color: '#374151', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 400, overflowY: 'auto' }}>{fileContent}</pre>
              }
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ── Admins Manager Panel ──────────────────────────────────────────────────────

function AdminsPanel({ adminUser }: { adminUser: User }) {
  const [data, setData] = useState<AdminsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadAdmins = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getAdmins(adminUser)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load admins.'); }
    finally { setLoading(false); }
  }, [adminUser]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim() && !newEmail.trim()) return;
    setBusy(true); setMsg('');
    try {
      const entry: { phone?: string; email?: string } = {};
      if (newPhone.trim()) entry.phone = newPhone.trim();
      if (newEmail.trim()) entry.email = newEmail.trim();
      const res = await addAdmin(entry, adminUser);
      setData((d) => d ? { ...d, phones: res.phones, emails: res.emails } : d);
      setNewPhone(''); setNewEmail('');
      setMsg('Admin added.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to add admin.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (type: 'phone' | 'email', value: string) => {
    if (!window.confirm(`Remove ${type} "${value}" from admins?`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await removeAdmin(type === 'phone' ? { phone: value } : { email: value }, adminUser);
      setData((d) => d ? { ...d, phones: res.phones, emails: res.emails } : d);
      setMsg('Admin removed.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to remove admin.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={S.card}>Loading admins…</div>;
  if (error)   return <div style={{ ...S.card, ...S.errorBox }}>{error}</div>;
  if (!data)   return null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {msg && <div style={{ ...S.card, ...(msg.includes('ailed') ? S.errorBox : S.successBox) }}>{msg}</div>}

      {/* Built-in phones */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>🔒 Built-in Admin Phones</h3>
        <p style={{ ...mutedText, marginBottom: '0.65rem' }}>These cannot be removed.</p>
        {data.builtinPhones.map((ph) => (
          <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid #fde68a' }}>
            <span style={{ flex: 1, fontFamily: 'monospace', color: '#78350f' }}>📱 {ph}</span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', background: '#f3f4f6', borderRadius: 999, padding: '0.15rem 0.5rem' }}>built-in</span>
          </div>
        ))}
      </div>

      {/* Dynamic phones */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>📱 Admin Phones</h3>
        {data.phones.length === 0
          ? <p style={mutedText}>No additional admin phones.</p>
          : data.phones.map((ph) => (
            <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid #fde68a' }}>
              <span style={{ flex: 1, fontFamily: 'monospace', color: '#78350f' }}>{ph}</span>
              <button type="button" disabled={busy} onClick={() => handleRemove('phone', ph)} style={{ ...S.dangerBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>
                Remove
              </button>
            </div>
          ))
        }
      </div>

      {/* Dynamic emails */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>✉️ Admin Emails</h3>
        {data.emails.length === 0
          ? <p style={mutedText}>No admin emails configured.</p>
          : data.emails.map((em) => (
            <div key={em} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid #fde68a' }}>
              <span style={{ flex: 1, color: '#78350f' }}>{em}</span>
              <button type="button" disabled={busy} onClick={() => handleRemove('email', em)} style={{ ...S.dangerBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>
                Remove
              </button>
            </div>
          ))
        }
      </div>

      {/* Add form */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>➕ Add Admin</h3>
        <form onSubmit={handleAdd} style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <label style={S.label}>Phone Number</label>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={S.inp} placeholder="e.g. 9179419406" type="tel" />
          </div>
          <div>
            <label style={S.label}>— or — Email</label>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={S.inp} placeholder="admin@example.com" type="email" />
          </div>
          <button type="submit" disabled={busy || (!newPhone.trim() && !newEmail.trim())} style={{ ...S.primaryBtn, opacity: busy || (!newPhone.trim() && !newEmail.trim()) ? 0.6 : 1 }}>
            {busy ? 'Saving…' : 'Add Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

