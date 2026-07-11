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
