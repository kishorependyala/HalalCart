const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

export type User = {
  name: string;
  phone: string;        // phone number OR email (used as order identifier)
  email?: string;       // set for social-login users
  picture?: string;     // avatar URL from social provider
  isAdmin: boolean;
  authMethod?: 'phone' | 'social';
};

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
  status: 'Pending' | 'Accepted' | 'Ready' | 'Completed';
  createdAt: string;
  prepMinutes?: number;
  acceptedAt?: string | null;
  readyAt?: string | null;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Unexpected response from server (HTTP ${response.status}). Is the backend running?`);
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

function adminHeaders(user: { phone: string; email?: string; authMethod?: string }): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user.authMethod === 'social' && user.email) {
    headers['X-Admin-Email'] = user.email;
  } else {
    headers['X-Admin-Phone'] = user.phone;
  }
  return headers;
}

export const loginUser = (name: string, phone: string) =>
  fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone }),
  }).then((r) => parseResponse<User>(r));

export const getMenu = () => fetch(`${BASE}/api/menu`).then((r) => parseResponse<MenuItem[]>(r));

export const getOrders = (phone?: string) => {
  const url = phone ? `${BASE}/api/orders?phone=${encodeURIComponent(phone)}` : `${BASE}/api/orders`;
  return fetch(url).then((r) => parseResponse<Order[]>(r));
};

export const getOrder = (id: string) =>
  fetch(`${BASE}/api/orders/${id}`).then((r) => parseResponse<Order>(r));

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
  }).then((r) => parseResponse<Order>(r));

export const updateOrder = (
  id: string,
  updates: { status?: Order['status']; prepMinutes?: number },
  adminUser: { phone: string; email?: string; authMethod?: string }
) =>
  fetch(`${BASE}/api/orders/${id}`, {
    method: 'PATCH',
    headers: adminHeaders(adminUser),
    body: JSON.stringify(updates),
  }).then((r) => parseResponse<Order>(r));
