const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getAdminToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('granjita_admin_token');
  }
  return null;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  const res = await fetch(url, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Error en la solicitud');
  }

  return data;
}

async function adminRequest(endpoint, options = {}) {
  const token = getAdminToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  return request(endpoint, { ...options, headers });
}

export async function loginAdmin(password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  return data.data;
}

export async function fetchProducts(category = null) {
  const params = category ? `?category=${encodeURIComponent(category)}` : '';
  const data = await request(`/products${params}`);
  return data.data;
}

export async function fetchProductById(id) {
  const data = await request(`/products/${id}`);
  return data.data;
}

export async function createOrder(orderData) {
  const data = await request('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
  return data.data;
}

export async function getOrderById(id) {
  const data = await request(`/orders/${id}`);
  return data.data;
}

export async function updateOrderStatus(id, statusData) {
  const data = await adminRequest(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(statusData),
  });
  return data.data;
}

export async function updateOrderItems(id, items) {
  const data = await adminRequest(`/orders/${id}/items`, {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  });
  return data.data;
}

export async function fetchAdminStats(date = null) {
  const params = date ? `?date=${date}` : '';
  const data = await adminRequest(`/orders/admin/stats${params}`);
  return data.data;
}

export async function fetchAllOrders({ status, date, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (date) params.set('date', date);
  params.set('page', page);
  params.set('limit', limit);
  const data = await adminRequest(`/orders/admin?${params.toString()}`);
  return data;
}

export async function fetchAdminProducts(category = null) {
  const params = category ? `?category=${encodeURIComponent(category)}` : '';
  const data = await adminRequest(`/products/admin${params}`);
  return data.data;
}

export async function createProduct(productData) {
  const data = await adminRequest('/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  });
  return data.data;
}

export async function updateProduct(id, productData) {
  const data = await adminRequest(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(productData),
  });
  return data.data;
}

export async function deleteProduct(id) {
  const data = await adminRequest(`/products/${id}`, {
    method: 'DELETE',
  });
  return data;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const token = getAdminToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Error al subir imagen');
  }
  return data.data;
}

export function getImageUrl(image) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  return `${base.replace('/api', '')}${image}`;
}

/* ------------------------------------------------------------------ *
 * Funciones que las páginas del admin ya usan pero faltaban acá.
 * (tienda/horarios, categorías, WhatsApp admin, facturas, stock,
 * alertas y formato de moneda). Usan los helpers request/adminRequest
 * de arriba. Token: granjita_admin_token.
 * ------------------------------------------------------------------ */

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/* ---- Tienda / horarios ---- */
export async function fetchStoreStatus() {
  const data = await request('/store/status');
  return data.data;
}

export async function fetchAdminStoreSettings() {
  const data = await adminRequest('/store/admin');
  return data.data;
}

export async function setStoreClosed(closed, reason = '') {
  const data = await adminRequest('/store/admin/closed', {
    method: 'PUT',
    body: JSON.stringify({ closed, reason }),
  });
  return data.data;
}

export async function setStoreMinOrder(minOrder) {
  const data = await adminRequest('/store/admin/min-order', {
    method: 'PUT',
    body: JSON.stringify({ minOrder }),
  });
  return data.data;
}

export async function toggleStoreDay(date, reason = '') {
  const data = await adminRequest('/store/admin/day/toggle', {
    method: 'POST',
    body: JSON.stringify({ date, reason }),
  });
  return data.data;
}

/* ---- Categorías ---- */
export async function fetchAdminCategories() {
  const data = await adminRequest('/categories/admin');
  return data.data;
}

export async function createCategory(payload) {
  const data = await adminRequest('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.data;
}

export async function updateCategory(id, payload) {
  const data = await adminRequest(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.data;
}

export async function deleteCategory(id) {
  const data = await adminRequest(`/categories/${id}`, {
    method: 'DELETE',
  });
  return data;
}

/* ---- WhatsApp (admin) ---- */
export async function fetchWhatsAppAdminStatus() {
  const data = await adminRequest('/whatsapp/admin/status');
  return data.data;
}

export async function fetchWhatsAppQr() {
  const data = await adminRequest('/whatsapp/admin/qr');
  return data;
}

export async function requestWhatsAppPairingCode(phone) {
  const data = await adminRequest('/whatsapp/admin/pairing-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  return data;
}

export async function logoutWhatsApp(deleteSession = false) {
  const data = await adminRequest('/whatsapp/admin/logout', {
    method: 'POST',
    body: JSON.stringify({ deleteSession }),
  });
  return data;
}

export async function testWhatsAppAdmin(phone) {
  const data = await adminRequest('/whatsapp/admin/test', {
    method: 'POST',
    body: JSON.stringify(phone ? { phone } : {}),
  });
  return data;
}

/* ---- Facturas ---- */
export async function fetchInvoices({ date, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  params.set('page', String(page));
  params.set('limit', String(limit));
  const data = await adminRequest(`/orders/admin/invoices?${params.toString()}`);
  return data;
}

export function getInvoicePdfUrl(orderId) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  let token = '';
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('granjita_admin_token') || '';
  }
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${base}/orders/${orderId}/invoice.pdf${q}`;
}

export async function resendOrderWhatsApp(orderId) {
  const data = await request(`/orders/${orderId}/resend-whatsapp`, {
    method: 'POST',
  });
  return data;
}

/* ---- Stock / alertas ---- */
export async function fetchStockOverview() {
  const data = await adminRequest('/products/admin/stock');
  return data.data;
}

export async function adjustProductStock(id, payload) {
  const data = await adminRequest(`/products/admin/stock/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.data;
}

export async function fetchAdminAlerts() {
  const data = await adminRequest('/products/admin/alerts');
  return data.data;
}

export async function markAdminAlertsRead(ids) {
  const data = await adminRequest('/products/admin/alerts/read', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
  return data;
}
