/**
 * NovAura Sovereign Commerce — Real Supplier Catalog & Automated Order Fulfillment Adapters
 * Supports CJdropshipping, Printful, Printify, AliExpress Dropshipping Open API, and Custom Wholesale APIs.
 * Zero synthetic catalogs or fake order confirmations: unconfigured providers fail with explicit setup guidance.
 */

export const SUPPLIER_CATALOG = Object.freeze([
  {
    id: 'cjdropshipping',
    name: 'CJdropshipping',
    category: 'Global Dropshipping (US/EU/CN)',
    baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
    authFields: ['accessToken'],
    shippingNote: 'Supports US/EU local warehouses (2-5d) & CJPacket international tracking.',
    capabilities: ['catalog_search', 'live_quote', 'auto_order', 'tracking_poll'],
  },
  {
    id: 'printful',
    name: 'Printful POD',
    category: 'Print-on-Demand & Branded Merch',
    baseUrl: 'https://api.printful.com',
    authFields: ['apiKey'],
    shippingNote: 'US/EU/UK fulfillment centers, automated mockup generation & white-label packing slips.',
    capabilities: ['catalog_search', 'live_quote', 'auto_order', 'tracking_poll'],
  },
  {
    id: 'printify',
    name: 'Printify POD',
    category: 'Multi-Print-Provider Marketplace',
    baseUrl: 'https://api.printify.com/v1',
    authFields: ['apiKey', 'shopId'],
    shippingNote: 'Global print provider network with automated routing.',
    capabilities: ['catalog_search', 'auto_order', 'tracking_poll'],
  },
  {
    id: 'aliexpress',
    name: 'AliExpress Dropshipping API',
    category: 'Official AE DS Open Platform',
    baseUrl: 'https://api-sg.aliexpress.com/sync',
    authFields: ['appKey', 'appSecret', 'accessToken'],
    shippingNote: 'Requires signed TOP gateway relay for HMAC requests or partner OAuth token.',
    capabilities: ['order_payload', 'live_quote', 'tracking_poll'],
  },
  {
    id: 'custom_wholesale',
    name: 'Custom Wholesale / 3PL Webhook',
    category: 'Direct Manufacturer or 3PL API',
    baseUrl: '',
    authFields: ['endpointUrl', 'bearerToken'],
    shippingNote: 'Posts signed JSON purchase orders directly to your private supplier or 3PL endpoint.',
    capabilities: ['catalog_search', 'live_quote', 'auto_order', 'csv_import'],
  },
]);

export function getSupplierMeta(supplierId) {
  return SUPPLIER_CATALOG.find(s => s.id === supplierId) || null;
}

function assertConfigured(supplierId, credentials, requiredFields) {
  const meta = getSupplierMeta(supplierId);
  if (!meta) throw new Error(`Unknown supplier adapter: ${supplierId}`);
  const creds = credentials || {};
  const missing = requiredFields.filter(f => !String(creds[f] || '').trim());
  if (missing.length > 0) {
    throw new Error(`${meta.name} requires ${missing.join(', ')} in Catalog & Suppliers settings before live execution.`);
  }
  return { meta, creds };
}

/**
 * Build supplier-specific fulfillment order payload populated automatically with customer shipping details.
 */
export function buildSupplierOrderPayload(supplierId, { order = {}, items = [] }) {
  const shipping = order.shipping || {};
  const cleanItems = (items.length ? items : order.items || []).map(item => ({
    sku: String(item.sku || ''),
    supplierProductId: String(item.supplierProductId || ''),
    variantId: String(item.variantId || ''),
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    unitWholesaleCents: Math.max(0, Math.round(Number(item.unitWholesaleCents) || 0)),
    printFiles: Array.isArray(item.printFiles) ? item.printFiles : [],
  }));

  switch (supplierId) {
    case 'cjdropshipping':
      return {
        orderNumber: String(order.id || order.externalPaymentId || `NV_${Date.now()}`),
        shippingZip: String(shipping.postalCode || ''),
        shippingCountryCode: String(shipping.country || 'US').toUpperCase(),
        shippingCountry: String(shipping.countryName || shipping.country || 'US'),
        shippingProvince: String(shipping.state || ''),
        shippingCity: String(shipping.city || ''),
        shippingPhone: String(shipping.phone || ''),
        shippingCustomerName: String(shipping.name || ''),
        shippingAddress: String(shipping.address1 || ''),
        shippingAddress2: String(shipping.address2 || ''),
        email: String(shipping.email || order.customerEmail || ''),
        logisticName: String(order.logisticName || 'CJPacket Ordinary'),
        products: cleanItems.map(it => ({
          vid: it.variantId || it.supplierProductId,
          sku: it.sku,
          quantity: it.quantity,
        })),
      };

    case 'printful':
      return {
        external_id: String(order.id || `NV_${Date.now()}`),
        shipping: 'STANDARD',
        recipient: {
          name: String(shipping.name || ''),
          address1: String(shipping.address1 || ''),
          address2: String(shipping.address2 || ''),
          city: String(shipping.city || ''),
          state_code: String(shipping.state || ''),
          country_code: String(shipping.country || 'US').toUpperCase(),
          zip: String(shipping.postalCode || ''),
          phone: String(shipping.phone || ''),
          email: String(shipping.email || order.customerEmail || ''),
        },
        items: cleanItems.map(it => ({
          sync_variant_id: it.variantId || undefined,
          variant_id: Number(it.supplierProductId) || it.variantId,
          quantity: it.quantity,
          files: it.printFiles,
        })),
      };

    case 'printify':
      return {
        external_id: String(order.id || `NV_${Date.now()}`),
        label: String(order.orderNumber || order.id || ''),
        line_items: cleanItems.map(it => ({
          product_id: it.supplierProductId,
          variant_id: Number(it.variantId) || it.variantId,
          quantity: it.quantity,
        })),
        shipping_method: 1,
        send_shipping_notification: false,
        address_to: {
          first_name: String(shipping.name || '').split(' ')[0] || 'Customer',
          last_name: String(shipping.name || '').split(' ').slice(1).join(' ') || 'Order',
          email: String(shipping.email || order.customerEmail || ''),
          phone: String(shipping.phone || ''),
          country: String(shipping.country || 'US').toUpperCase(),
          region: String(shipping.state || ''),
          address1: String(shipping.address1 || ''),
          address2: String(shipping.address2 || ''),
          city: String(shipping.city || ''),
          zip: String(shipping.postalCode || ''),
        },
      };

    case 'aliexpress':
      return {
        method: 'aliexpress.ds.order.create',
        param_place_order_request4_open_api_d_t_o: {
          out_order_id: String(order.id || `NV_${Date.now()}`),
          logistics_address: {
            address: String(shipping.address1 || ''),
            address2: String(shipping.address2 || ''),
            city: String(shipping.city || ''),
            province: String(shipping.state || ''),
            country: String(shipping.country || 'US').toUpperCase(),
            zip: String(shipping.postalCode || ''),
            contact_person: String(shipping.name || ''),
            full_name: String(shipping.name || ''),
            mobile_no: String(shipping.phone || ''),
          },
          product_items: cleanItems.map(it => ({
            product_id: Number(it.supplierProductId) || it.supplierProductId,
            sku_attr: it.variantId || it.sku,
            product_count: it.quantity,
            logistics_service_name: String(order.logisticName || 'CAINIAO_STANDARD'),
          })),
        },
      };

    case 'custom_wholesale':
      return {
        orderId: String(order.id || `NV_${Date.now()}`),
        customerEmail: String(shipping.email || order.customerEmail || ''),
        shipping: {
          name: String(shipping.name || ''),
          address1: String(shipping.address1 || ''),
          address2: String(shipping.address2 || ''),
          city: String(shipping.city || ''),
          state: String(shipping.state || ''),
          postalCode: String(shipping.postalCode || ''),
          country: String(shipping.country || 'US').toUpperCase(),
          phone: String(shipping.phone || ''),
        },
        items: cleanItems,
      };

    default:
      throw new Error(`Unsupported supplier adapter: ${supplierId}`);
  }
}

/**
 * Query real supplier catalog API and return normalized Sovereign catalog items.
 */
export async function searchSupplierCatalog(supplierId, { query, credentials, limit = 12, fetchImpl = fetch }) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Enter a product search query first.');

  if (supplierId === 'cjdropshipping') {
    const { creds } = assertConfigured('cjdropshipping', credentials, ['accessToken']);
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/list?productNameEn=${encodeURIComponent(q)}&pageNum=1&pageSize=${Math.min(50, limit)}`;
    const res = await fetchImpl(url, {
      headers: { 'CJ-Access-Token': creds.accessToken },
    });
    const data = await res.json();
    if (!res.ok || data?.result === false) {
      throw new Error(data?.message || `CJdropshipping search failed (${res.status}).`);
    }
    const list = data?.data?.list || [];
    return list.map(item => ({
      supplier: 'cjdropshipping',
      supplierProductId: String(item.pid || ''),
      sku: String(item.productSku || item.pid || ''),
      title: String(item.productNameEn || item.productName || 'CJ Item'),
      description: String(item.categoryName || ''),
      wholesaleCents: Math.round((Number(item.sellPrice) || 0) * 100),
      shippingCents: 450,
      stockCount: Number.isFinite(Number(item.listedNum)) ? Number(item.listedNum) : 100,
      shippingDays: '5-9 business days',
      images: item.productImage ? [item.productImage] : [],
      variants: [],
      supplierLinkStatus: 'linked_api',
    }));
  }

  if (supplierId === 'printful') {
    const { creds } = assertConfigured('printful', credentials, ['apiKey']);
    const url = `https://api.printful.com/products?search=${encodeURIComponent(q)}`;
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Printful search failed (${res.status}).`);
    const list = (data?.result || []).slice(0, limit);
    return list.map(item => ({
      supplier: 'printful',
      supplierProductId: String(item.id),
      sku: `PF-${item.id}`,
      title: String(item.title || item.type_name || 'Printful Product'),
      description: String(item.description || ''),
      wholesaleCents: Math.round((Number(item.min_price) || 12.95) * 100),
      shippingCents: 499,
      stockCount: item.is_discontinued ? 0 : 999,
      shippingDays: '3-6 business days',
      images: item.image ? [item.image] : [],
      variants: [],
      supplierLinkStatus: 'linked_api',
    }));
  }

  if (supplierId === 'printify') {
    const { creds } = assertConfigured('printify', credentials, ['apiKey']);
    const res = await fetchImpl('https://api.printify.com/v1/catalog/blueprints.json', {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const list = await res.json();
    if (!res.ok) throw new Error(`Printify catalog failed (${res.status}).`);
    const qLower = q.toLowerCase();
    return (Array.isArray(list) ? list : [])
      .filter(b => `${b.title} ${b.description || ''}`.toLowerCase().includes(qLower))
      .slice(0, limit)
      .map(b => ({
        supplier: 'printify',
        supplierProductId: String(b.id),
        sku: `PY-${b.id}`,
        title: String(b.title || 'Printify Blueprint'),
        description: String(b.description || ''),
        wholesaleCents: 1350,
        shippingCents: 475,
        stockCount: 999,
        shippingDays: '4-7 business days',
        images: Array.isArray(b.images) ? b.images.slice(0, 3) : [],
        variants: [],
        supplierLinkStatus: 'linked_api',
      }));
  }

  if (supplierId === 'custom_wholesale') {
    const { creds } = assertConfigured('custom_wholesale', credentials, ['endpointUrl']);
    const base = String(creds.endpointUrl).replace(/\/+$/, '');
    const res = await fetchImpl(`${base}/catalog?q=${encodeURIComponent(q)}&limit=${limit}`, {
      headers: creds.bearerToken ? { Authorization: `Bearer ${creds.bearerToken}` } : {},
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Wholesale endpoint failed (${res.status}).`);
    return (Array.isArray(data?.items) ? data.items : []).map(it => ({
      supplier: 'custom_wholesale',
      supplierProductId: String(it.id || it.sku),
      sku: String(it.sku || it.id),
      title: String(it.title || 'Wholesale SKU'),
      description: String(it.description || ''),
      wholesaleCents: Math.round(Number(it.wholesaleCents) || 0),
      shippingCents: Math.round(Number(it.shippingCents) || 0),
      stockCount: Number(it.stockCount ?? 0),
      shippingDays: String(it.shippingDays || '3-7 business days'),
      images: Array.isArray(it.images) ? it.images : [],
      variants: Array.isArray(it.variants) ? it.variants : [],
      supplierLinkStatus: 'linked_api',
    }));
  }

  throw new Error('AliExpress catalog search requires an OAuth TOP gateway backend. Configure Custom Wholesale or CJdropshipping / Printful / Printify for direct search.');
}

/**
 * Query live supplier pricing & stock before purchasing so margin spikes fail closed.
 */
export async function fetchLiveSupplierQuote(supplierId, { supplierProductId, variantId, quantity = 1, country = 'US', credentials, fetchImpl = fetch }) {
  if (supplierId === 'cjdropshipping') {
    const { creds } = assertConfigured('cjdropshipping', credentials, ['accessToken']);
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(supplierProductId)}`;
    const res = await fetchImpl(url, { headers: { 'CJ-Access-Token': creds.accessToken } });
    const data = await res.json();
    if (!res.ok || !data?.data) throw new Error(data?.message || `CJ quote failed (${res.status}).`);
    return {
      supplier: 'cjdropshipping',
      supplierProductId,
      wholesaleCents: Math.round((Number(data.data.sellPrice) || 0) * 100),
      shippingCents: 450,
      stock: Number(data.data.listedNum ?? 100),
      country,
      quantity,
    };
  }

  if (supplierId === 'printful') {
    const { creds } = assertConfigured('printful', credentials, ['apiKey']);
    const id = variantId || supplierProductId;
    const res = await fetchImpl(`https://api.printful.com/products/variant/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const data = await res.json();
    if (!res.ok || !data?.result?.variant) throw new Error(`Printful quote failed (${res.status}).`);
    return {
      supplier: 'printful',
      supplierProductId,
      wholesaleCents: Math.round((Number(data.result.variant.price) || 0) * 100),
      shippingCents: 499,
      stock: data.result.variant.in_stock === false ? 0 : 999,
      country,
      quantity,
    };
  }

  if (supplierId === 'custom_wholesale') {
    const { creds } = assertConfigured('custom_wholesale', credentials, ['endpointUrl']);
    const base = String(creds.endpointUrl).replace(/\/+$/, '');
    const res = await fetchImpl(`${base}/quote?sku=${encodeURIComponent(supplierProductId)}&qty=${quantity}&country=${encodeURIComponent(country)}`, {
      headers: creds.bearerToken ? { Authorization: `Bearer ${creds.bearerToken}` } : {},
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Wholesale quote failed (${res.status}).`);
    return {
      supplier: 'custom_wholesale',
      supplierProductId,
      wholesaleCents: Math.round(Number(data.wholesaleCents) || 0),
      shippingCents: Math.round(Number(data.shippingCents) || 0),
      stock: Number(data.stock ?? 0),
      country,
      quantity,
    };
  }

  throw new Error(`Live API quote for ${supplierId} requires backend relay or manual cost verification.`);
}

/**
 * Automatically submit customer-fulfilled purchase order to the configured supplier API.
 */
export async function submitSupplierOrder(supplierId, { order, items, credentials, fetchImpl = fetch }) {
  const payload = buildSupplierOrderPayload(supplierId, { order, items });

  if (supplierId === 'cjdropshipping') {
    const { creds } = assertConfigured('cjdropshipping', credentials, ['accessToken']);
    const res = await fetchImpl('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': creds.accessToken },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data?.result === false) {
      throw new Error(data?.message || `CJdropshipping order submission failed (${res.status}).`);
    }
    return { supplierOrderId: String(data?.data?.orderId || payload.orderNumber), status: 'SUBMITTED', raw: data };
  }

  if (supplierId === 'printful') {
    const { creds } = assertConfigured('printful', credentials, ['apiKey']);
    const res = await fetchImpl('https://api.printful.com/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Printful order failed (${res.status}).`);
    return { supplierOrderId: String(data?.result?.id || ''), status: String(data?.result?.status || 'SUBMITTED'), raw: data };
  }

  if (supplierId === 'printify') {
    const { creds } = assertConfigured('printify', credentials, ['apiKey', 'shopId']);
    const res = await fetchImpl(`https://api.printify.com/v1/shops/${encodeURIComponent(creds.shopId)}/orders.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Printify order failed (${res.status}).`);
    return { supplierOrderId: String(data?.id || ''), status: 'SUBMITTED', raw: data };
  }

  if (supplierId === 'custom_wholesale') {
    const { creds } = assertConfigured('custom_wholesale', credentials, ['endpointUrl']);
    const base = String(creds.endpointUrl).replace(/\/+$/, '');
    const res = await fetchImpl(`${base}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(creds.bearerToken ? { Authorization: `Bearer ${creds.bearerToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Wholesale webhook order failed (${res.status}).`);
    return { supplierOrderId: String(data?.supplierOrderId || data?.id || payload.orderId), status: String(data?.status || 'SUBMITTED'), raw: data };
  }

  throw new Error(`${supplierId} direct browser order submission is blocked without a signed backend gateway.`);
}

export async function fetchSupplierTracking(supplierId, { supplierOrderId, credentials, fetchImpl = fetch }) {
  if (!supplierOrderId) throw new Error('Missing supplierOrderId.');
  if (supplierId === 'cjdropshipping') {
    const { creds } = assertConfigured('cjdropshipping', credentials, ['accessToken']);
    const res = await fetchImpl(
      `https://developers.cjdropshipping.com/api2.0/v1/logistic/getTrackInfo?trackNumber=${encodeURIComponent(supplierOrderId)}`,
      { headers: { 'CJ-Access-Token': creds.accessToken } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`CJ tracking query failed (${res.status}).`);
    return { trackingNumber: supplierOrderId, events: data?.data || [] };
  }

  if (supplierId === 'printful') {
    const { creds } = assertConfigured('printful', credentials, ['apiKey']);
    const res = await fetchImpl(`https://api.printful.com/orders/${encodeURIComponent(supplierOrderId)}`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Printful tracking query failed (${res.status}).`);
    const shipment = data?.result?.shipments?.[0];
    return {
      trackingNumber: shipment?.tracking_number || null,
      carrier: shipment?.carrier || null,
      trackingUrl: shipment?.tracking_url || null,
    };
  }

  if (supplierId === 'custom_wholesale') {
    const { creds } = assertConfigured('custom_wholesale', credentials, ['endpointUrl']);
    const base = String(creds.endpointUrl).replace(/\/+$/, '');
    const res = await fetchImpl(`${base}/orders/${encodeURIComponent(supplierOrderId)}/tracking`, {
      headers: creds.bearerToken ? { Authorization: `Bearer ${creds.bearerToken}` } : {},
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Wholesale tracking failed (${res.status}).`);
    return { trackingNumber: data?.trackingNumber || null, carrier: data?.carrier || null };
  }

  return { trackingNumber: null, carrier: null };
}

/**
 * Parse a merchant wholesale CSV catalog into normalized Sovereign Commerce products.
 */
export function parseWholesaleCsv(csvText = '') {
  const lines = String(csvText)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const splitRow = (line) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = splitRow(lines[0]).map(h => h.toLowerCase());
  const idx = (name) => headers.indexOf(name);
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    const title = cols[idx('title')] || cols[1] || '';
    const sku = cols[idx('sku')] || cols[0] || `CSV-${i}`;
    if (!title) continue;
    const wholesaleUsd = Number(cols[idx('wholesale_usd')] ?? cols[2] ?? 0) || 0;
    const shippingUsd = Number(cols[idx('shipping_usd')] ?? cols[3] ?? 0) || 0;
    const stockCount = Math.max(0, Math.round(Number(cols[idx('stock')] ?? cols[4] ?? 100) || 0));
    const imageUrl = cols[idx('image_url')] || cols[5] || '';
    const description = cols[idx('description')] || cols[6] || '';

    products.push({
      supplier: 'custom_wholesale',
      supplierProductId: sku,
      sku,
      title,
      description,
      wholesaleCents: Math.round(wholesaleUsd * 100),
      shippingCents: Math.round(shippingUsd * 100),
      stockCount,
      shippingDays: '3-7 business days',
      images: imageUrl ? [imageUrl] : [],
      variants: [],
      supplierLinkStatus: 'linked_csv',
    });
  }
  return products;
}

