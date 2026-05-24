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
  category: 'Goat' | 'Chicken' | 'Fish';
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

// ── Admin management ─────────────────────────────────────────────────────────

export type AdminUser = {
  name: string;
  phone: string;
  orderCount: number;
  lastOrderAt: string;
  totalSpent: number;
};

export const getAdminUsers = (adminUser: { phone: string; email?: string; authMethod?: string }) =>
  fetch(`${BASE}/api/admin/users`, { headers: adminHeaders(adminUser) }).then((r) => parseResponse<AdminUser[]>(r));

export type AdminsData = {
  builtinPhones: string[];
  phones: string[];
  emails: string[];
};

export const getAdmins = (adminUser: { phone: string; email?: string; authMethod?: string }) =>
  fetch(`${BASE}/api/admin/admins`, { headers: adminHeaders(adminUser) }).then((r) => parseResponse<AdminsData>(r));

export const addAdmin = (
  entry: { phone?: string; email?: string },
  adminUser: { phone: string; email?: string; authMethod?: string }
) =>
  fetch(`${BASE}/api/admin/admins`, {
    method: 'POST',
    headers: adminHeaders(adminUser),
    body: JSON.stringify(entry),
  }).then((r) => parseResponse<{ ok: boolean; phones: string[]; emails: string[] }>(r));

export const removeAdmin = (
  entry: { phone?: string; email?: string },
  adminUser: { phone: string; email?: string; authMethod?: string }
) =>
  fetch(`${BASE}/api/admin/admins`, {
    method: 'DELETE',
    headers: adminHeaders(adminUser),
    body: JSON.stringify(entry),
  }).then((r) => parseResponse<{ ok: boolean; phones: string[]; emails: string[] }>(r));

// ── Data browser ─────────────────────────────────────────────────────────────

export type DataFileEntry = { path: string; size: number };

export const listDataFiles = (adminUser: { phone: string; email?: string; authMethod?: string }) =>
  fetch(`${BASE}/api/admin/data`, { headers: adminHeaders(adminUser) }).then((r) => parseResponse<DataFileEntry[]>(r));

export const readDataFile = (
  path: string,
  adminUser: { phone: string; email?: string; authMethod?: string }
) =>
  fetch(`${BASE}/api/admin/data/file?path=${encodeURIComponent(path)}`, { headers: adminHeaders(adminUser) }).then(
    (r) => parseResponse<{ path: string; content: string }>(r)
  );

// ── Menu management ───────────────────────────────────────────────────────────

export const adminGetMenu = (adminUser: { phone: string; email?: string; authMethod?: string }) =>
  fetch(`${BASE}/api/admin/menu`, { headers: adminHeaders(adminUser) }).then((r) => parseResponse<MenuItem[]>(r));

export const addMenuItem = (
  item: Pick<MenuItem, 'name' | 'category' | 'price' | 'unit' | 'description'>,
  adminUser: { phone: string; email?: string; authMethod?: string }
) =>
  fetch(`${BASE}/api/admin/menu`, {
    method: 'POST',
    headers: adminHeaders(adminUser),
    body: JSON.stringify(item),
  }).then((r) => parseResponse<MenuItem>(r));

export const updateMenuItem = (
  itemId: string,
  updates: Partial<Pick<MenuItem, 'name' | 'price' | 'unit' | 'description' | 'category'>>,
  adminUser: { phone: string; email?: string; authMethod?: string }
) =>
  fetch(`${BASE}/api/admin/menu/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: adminHeaders(adminUser),
    body: JSON.stringify(updates),
  }).then((r) => parseResponse<MenuItem>(r));

export const deleteMenuItem = (
  itemId: string,
  adminUser: { phone: string; email?: string; authMethod?: string }
) =>
  fetch(`${BASE}/api/admin/menu/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    headers: adminHeaders(adminUser),
  }).then((r) => parseResponse<{ ok: boolean }>(r));

// ── Settings management ───────────────────────────────────────────────────────

export type AppSettings = {
  chickenPrepMinutes: number;
  goatPrepMinutes: number;
};

export const getSettings = (adminUser: { phone: string; email?: string; authMethod?: string }) =>
  fetch(`${BASE}/api/admin/settings`, { headers: adminHeaders(adminUser) }).then((r) => parseResponse<AppSettings>(r));

export const updateSettings = (
  updates: Partial<AppSettings>,
  adminUser: { phone: string; email?: string; authMethod?: string }
) =>
  fetch(`${BASE}/api/admin/settings`, {
    method: 'PATCH',
    headers: adminHeaders(adminUser),
    body: JSON.stringify(updates),
  }).then((r) => parseResponse<AppSettings>(r));
