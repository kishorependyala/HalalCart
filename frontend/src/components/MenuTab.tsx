import { useEffect, useMemo, useRef, useState } from 'react';

import { getMenu, MenuItem } from '../api';
import { S, mutedText, sectionTitle } from '../theme';

type Props = {
  onAddToCart: (item: MenuItem, qty: number) => void;
};

const categories: Array<MenuItem['category']> = ['Goat', 'Chicken', 'Snacks'];

export default function MenuTab({ onAddToCart }: Props) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [flashItemId, setFlashItemId] = useState('');
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    const loadMenu = async () => {
      setLoading(true);
      setError('');
      try {
        const items = await getMenu();
        setMenu(items);
        setQuantities(items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.id]: 1 }), {}));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the menu.');
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
    return () => {
      if (flashTimer.current) {
        window.clearTimeout(flashTimer.current);
      }
    };
  }, []);

  const groupedMenu = useMemo(() => {
    return categories.map((category) => ({
      category,
      items: menu.filter((item) => item.category === category),
    }));
  }, [menu]);

  const changeQty = (itemId: string, delta: number) => {
    setQuantities((current) => ({
      ...current,
      [itemId]: Math.max(1, (current[itemId] || 1) + delta),
    }));
  };

  const addItem = (item: MenuItem) => {
    const qty = quantities[item.id] || 1;
    onAddToCart(item, qty);
    setFlashItemId(item.id);
    if (flashTimer.current) {
      window.clearTimeout(flashTimer.current);
    }
    flashTimer.current = window.setTimeout(() => setFlashItemId(''), 1800);
  };

  if (loading) {
    return <div style={S.card}>Loading today&apos;s halal selections...</div>;
  }

  if (error) {
    return <div style={{ ...S.card, ...S.errorBox }}>{error}</div>;
  }

  return (
    <div>
      {groupedMenu.map(({ category, items }) => (
        <section key={category} style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <h2 style={sectionTitle}>{category}</h2>
            <p style={mutedText}>Fresh halal cuts and favorites prepared for pickup.</p>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {items.map((item) => (
              <div key={item.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 280px' }}>
                    <h3 style={{ margin: '0 0 0.35rem', color: '#78350f' }}>{item.name}</h3>
                    <p style={{ ...mutedText, marginBottom: '0.6rem' }}>{item.description}</p>
                    <div style={{ fontWeight: 700, color: '#92400e' }}>
                      ${item.price.toFixed(2)} <span style={{ fontWeight: 500 }}>/{item.unit}</span>
                    </div>
                  </div>
                  <div style={{ minWidth: 220, display: 'grid', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => changeQty(item.id, -1)} style={{ ...S.outlineBtn, padding: '0.45rem 0.8rem' }}>
                        −
                      </button>
                      <div style={{ minWidth: 36, textAlign: 'center', fontWeight: 700, color: '#78350f' }}>{quantities[item.id] || 1}</div>
                      <button type="button" onClick={() => changeQty(item.id, 1)} style={{ ...S.outlineBtn, padding: '0.45rem 0.8rem' }}>
                        +
                      </button>
                    </div>
                    <button type="button" onClick={() => addItem(item)} style={S.primaryBtn}>
                      Add to Cart
                    </button>
                    {flashItemId === item.id ? <div style={S.successBox}>Added to cart.</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
