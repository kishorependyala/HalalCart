import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getOrders, MenuItem, Order, User } from './api';
import AdminTab from './components/AdminTab';
import CartTab, { CartItem } from './components/CartTab';
import LoginModal from './components/LoginModal';
import MenuTab from './components/MenuTab';
import OrdersTab from './components/OrdersTab';
import ProfileModal from './components/ProfileModal';
import { S } from './theme';

type TabId = 'menu' | 'cart' | 'orders' | 'admin';

const customerTabs: Array<{ id: TabId; label: string; emoji: string }> = [
  { id: 'menu', label: 'Menu', emoji: '🍖' },
  { id: 'cart', label: 'Cart', emoji: '🛒' },
  { id: 'orders', label: 'My Orders', emoji: '📋' },
];

const STORAGE_KEY = 'halalcart_user';

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL || '';

function App() {
  const { user: auth0User, isAuthenticated, logout: auth0Logout } = useAuth0();
  const [activeTab, setActiveTab] = useState<TabId>('menu');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [user, setUser] = useState<User | null>(loadStoredUser);
  const [showLogin, setShowLogin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.qty, 0), [cartItems]);

  const tabs = useMemo(() => {
    const base = [...customerTabs];
    if (user?.isAdmin) base.push({ id: 'admin' as TabId, label: 'Admin', emoji: '🛡️' });
    return base;
  }, [user]);

  const handleLogin = (u: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setShowLogin(false);
    if (u.isAdmin) setActiveTab('admin');
  };

  const handleProfileUpdate = (updated: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setUser(updated);
    setShowProfile(false);
  };

  // Sync Auth0 social login → our User state
  useEffect(() => {
    if (isAuthenticated && auth0User) {
      const email = auth0User.email || '';
      const name = auth0User.name || auth0User.nickname || email.split('@')[0] || 'User';
      const isAdmin = !!ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const socialUser: User = {
        name,
        phone: email,   // use email as the order identifier for social users
        email,
        picture: auth0User.picture,
        isAdmin,
        authMethod: 'social',
      };
      // Only update if this social user isn't already stored
      const stored = localStorage.getItem(STORAGE_KEY);
      const current = stored ? JSON.parse(stored) as User : null;
      if (!current || current.authMethod === 'social' || current.phone !== socialUser.phone) {
        handleLogin(socialUser);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, auth0User]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setOrders([]);
    setActiveTab('menu');
    if (isAuthenticated) {
      auth0Logout({ logoutParams: { returnTo: window.location.origin } });
    }
  };

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
    if (!user) return;
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const nextOrders = await getOrders(user.phone);
      setOrders(nextOrders);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !user.isAdmin) refreshOrders();
  }, [user, refreshOrders]);

  const handleOrderPlaced = (order: Order) => {
    setCartItems([]);
    setOrders((current) => [order, ...current.filter((existing) => existing.id !== order.id)]);
    setActiveTab('orders');
  };

  return (
    <div style={S.page}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '2px solid #fed7aa', boxShadow: '0 2px 8px rgba(120,53,15,0.08)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#78350f' }}>🥩 Halal Meat Market</div>
            <div style={{ color: '#92400e', fontSize: '0.88rem' }}>Pickup only · 355 Applegarth Rd, Monroe Township, NJ</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 999, padding: '0.35rem 0.75rem', color: '#92400e', fontWeight: 800 }}>
              Cart {cartCount}
            </div>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowProfile(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.4rem', borderRadius: '0.5rem' }}
                  title="View / edit profile"
                >
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fcd34d' }} />
                  ) : (
                    <span style={{ color: '#78350f', fontSize: '1rem' }}>{user.isAdmin ? '🛡️' : '👤'}</span>
                  )}
                  <span style={{ color: '#78350f', fontWeight: 700, fontSize: '0.88rem' }}>
                    {user.name}
                  </span>
                </button>
                <button type="button" onClick={handleLogout} style={{ ...S.outlineBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>
                  Sign Out
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowLogin(true)} style={{ ...S.primaryBtn, fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
                Sign In
              </button>
            )}
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
          <CartTab
            user={user}
            cartItems={cartItems}
            onUpdateQty={updateQty}
            onRemoveItem={removeItem}
            onOrderPlaced={handleOrderPlaced}
            onLoginRequest={() => setShowLogin(true)}
          />
        ) : null}
        {activeTab === 'orders' ? (
          <OrdersTab
            user={user}
            orders={orders}
            loading={ordersLoading}
            error={ordersError}
            onRefresh={refreshOrders}
            onOrdersUpdate={setOrders}
          />
        ) : null}
        {activeTab === 'admin' && user?.isAdmin ? (
          <AdminTab adminUser={user} />
        ) : null}
      </main>

      {showLogin ? <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} /> : null}
      {showProfile && user ? <ProfileModal user={user} onUpdate={handleProfileUpdate} onClose={() => setShowProfile(false)} /> : null}
    </div>
  );
}

export default App;
