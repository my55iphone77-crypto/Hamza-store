const crypto = require('crypto');

const baseUrl = String(process.env.SHOP2TOPUP_BASE_URL || '').trim().replace(/\/+$/, '');
const apiKey = String(process.env.SHOP2TOPUP_API_KEY || '').trim();

function assertConfigured() {
  if (!baseUrl || !apiKey) throw new Error('Shop2Topup integration is not configured.');
}

async function request(path, options = {}) {
  assertConfigured();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data?.error?.message || data?.message || `Shop2Topup request failed (${response.status})`);
    error.status = response.status;
    error.provider = data;
    throw error;
  }
  return data;
}

function uuid() {
  return crypto.randomUUID();
}

module.exports = {
  configured: () => Boolean(baseUrl && apiKey),
  listBigCategories: (forUi = true) => request(`/catalog/big-categories?for_ui=${forUi ? 'true' : 'false'}`),
  listCategories: ({ bigCategoryId, forUi = true } = {}) => {
    const query = new URLSearchParams();
    if (bigCategoryId !== undefined && bigCategoryId !== '') query.set('bigCategoryId', String(bigCategoryId));
    query.set('for_ui', forUi ? 'true' : 'false');
    return request(`/catalog/categories?${query.toString()}`);
  },
  listSubcategories: ({ categoryId } = {}) => {
    const query = new URLSearchParams();
    if (categoryId !== undefined && categoryId !== '') query.set('categoryId', String(categoryId));
    return request(`/catalog/subcategories${query.toString() ? `?${query}` : ''}`);
  },
  getPrice: (itemId) => request(`/catalog/subcategory/${encodeURIComponent(String(itemId))}/price`),
  getItemAvailability: async ({ itemId, categoryId } = {}) => {
    const catalog = await request(`/catalog/subcategories?categoryId=${encodeURIComponent(String(categoryId || ''))}`);
    const list = catalog?.subcategories || catalog?.data || [];
    const item = Array.isArray(list) ? list.find(entry => Number(entry?.item_id ?? entry?.id) === Number(itemId)) : null;
    if (!item) return { success: true, item_id: Number(itemId), available: false, status: 'out_of_stock' };
    const explicitAvailability = item.available ?? item.is_available ?? item.in_stock ?? item.inStock;
    const numericStock = item.stock ?? item.inventory ?? item.quantity;
    const statusText = String(item.status || item.availability || '').toLowerCase();
    const unavailable = explicitAvailability === false || Number(numericStock) <= 0 || /out[\s_-]*of[\s_-]*stock|sold[\s_-]*out|unavailable|inactive/i.test(statusText);
    return { success: true, item_id: Number(itemId), available: !unavailable, status: unavailable ? 'out_of_stock' : 'available', item };
  },
  getRequirements: (categoryId) => request(`/catalog/category/${encodeURIComponent(String(categoryId))}/requirements`),
  validatePlayer: (payload) => request('/player/validate', { method: 'POST', body: JSON.stringify(payload) }),
  createOrder: ({ orderId = uuid(), subCategoryId, quantity, requirements, expectedUnitPrice }) => request('/orders/create', {
    method: 'POST',
    body: JSON.stringify({
      order_id: orderId,
      sub_category_id: Number(subCategoryId),
      quantity: Number(quantity),
      requirements,
      ...(expectedUnitPrice !== undefined ? { expected_unit_price: String(expectedUnitPrice) } : {})
    })
  })
};
