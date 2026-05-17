const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

export type MenuItem = {
  id: string;
  category: 'Goat' | 'Chicken' | 'Snacks';
  name: string;
  price: number;
  unit: string;
  description: string;
};

export type OrderItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
  lineTotal?: number;
};

export type Order = {
  id: string;
  customerName: string;
  phone: string;
  pickupTime: string;
  items: OrderItem[];
  total: number;
  status: 'Pending' | 'Ready' | 'Completed';
  createdAt: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

export const getMenu = () => fetch(`${BASE}/api/menu`).then((response) => parseResponse<MenuItem[]>(response));
export const getOrders = () => fetch(`${BASE}/api/orders`).then((response) => parseResponse<Order[]>(response));
export const placeOrder = (order: {
  customerName: string;
  phone: string;
  pickupTime: string;
  items: OrderItem[];
}) =>
  fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  }).then((response) => parseResponse<Order>(response));
