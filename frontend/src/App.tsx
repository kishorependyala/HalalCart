import { useCallback, useMemo, useState } from 'react';

import { getOrders, MenuItem, Order } from './api';
import CartTab, { CartItem } from './components/CartTab';
import MenuTab from './components/MenuTab';
import OrdersTab from './components/OrdersTab';
import { S } from './theme';

type TabId = 'menu' | 'cart' | 'orders';

const tabs: Array<{ id: TabId; label: string; emoji: string }> = [
  { id: 'menu', label: 'Menu', emoji: '🍖' },
  { id: 'cart', label: 'Cart', emoji: '🛒' },
  { id: 'orders', label: 'Orders', emoji: '📋' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('menu');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.qty, 0), [cartItems]);

  const addToCart = (item: MenuItem, qty: number) => {
    setCartItems((current) => {
      const existing = current.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, qty: cartItem.qty + qty } : cartItem
        );
      }
      return [...current, { ...item, qty }];
    });
  };

  const updateQty = (itemId: string, nextQty: number) => {
    setCartItems((current) =>
      nextQty <= 0 ? current.filter((item) => item.id !== itemId) : current.map((item) => (item.id === itemId ? { ...item, qty: nextQty } : item))
    );
  };

  const removeItem = (itemId: string) => {
    setCartItems((current) => current.filter((item) => item.id !== itemId));
  };

  const refreshOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const nextOrders = await getOrders();
      setOrders(nextOrders);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const handleOrderPlaced = (order: Order) => {
    setCartItems([]);
    setOrders((current) => [order, ...current.filter((existing) => existing.id !== order.id)]);
  };

  return (
    <div style={S.page}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '2px solid #fed7aa', boxShadow: '0 2px 8px rgba(120,53,15,0.08)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#78350f' }}>🥩 Halal Meat Market</div>
            <div style={{ color: '#92400e', fontSize: '0.88rem' }}>Pickup only · 355 Applegarth Rd, Monroe Township, NJ</div>
          </div>
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 999, padding: '0.35rem 0.75rem', color: '#92400e', fontWeight: 800 }}>
            Cart {cartCount}
          </div>
        </div>
      </header>

      <div style={{ position: 'sticky', top: '72px', zIndex: 90, background: '#fff', borderBottom: '2px solid #fed7aa' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #f59e0b' : '3px solid transparent',
                color: activeTab === tab.id ? '#92400e' : '#6b7280',
                fontWeight: activeTab === tab.id ? 800 : 600,
                cursor: 'pointer',
                padding: '0.85rem 1rem',
                marginBottom: '-2px',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.emoji} {tab.label}
              {tab.id === 'cart' && cartCount ? (
                <span style={{ marginLeft: '0.45rem', background: '#f59e0b', color: '#fff', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.75rem' }}>
                  {cartCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '1rem' }}>
        <section style={S.card}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={{ color: '#78350f', fontSize: '1.15rem', fontWeight: 800 }}>Fresh halal meats and Indian-style snacks</div>
            <div style={{ color: '#6b7280' }}>
              Call <a href="tel:+16092359158" style={{ color: '#d97706', fontWeight: 700 }}>(609) 235-9158</a> · Sun–Sat pickup hours: 10 AM – 8 PM (Mon–Sat), 10 AM – 6 PM (Sun)
            </div>
          </div>
        </section>

        {activeTab === 'menu' ? <MenuTab onAddToCart={addToCart} /> : null}
        {activeTab === 'cart' ? (
          <CartTab cartItems={cartItems} onUpdateQty={updateQty} onRemoveItem={removeItem} onOrderPlaced={handleOrderPlaced} />
        ) : null}
        {activeTab === 'orders' ? (
          <OrdersTab orders={orders} loading={ordersLoading} error={ordersError} onRefresh={refreshOrders} />
        ) : null}
      </main>
    </div>
  );
}

export default App;
