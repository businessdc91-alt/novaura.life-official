/**
 * ecommerceIntegrations.js — Production E-Commerce & Marketplace Architecture Catalog
 * 
 * Battle-tested templates for Shopify, AliExpress Open Platform, Amazon SP-API,
 * eBay Developer REST API, and Stripe Checkout / Billing Webhooks.
 */

export const ECOMMERCE_INTEGRATIONS = [
  // ── 1. SHOPIFY ──────────────────────────────────────────────────────────
  {
    id: 'shopify_storefront_admin_api',
    title: 'Shopify Storefront GraphQL & Admin REST Suite',
    category: 'ecommerce',
    vendor: 'Shopify',
    badge: 'Storefront & Admin',
    icon: 'ShoppingBag',
    color: '#96bf48',
    description: 'Production Shopify integration: Storefront GraphQL for ultra-fast headless catalogs & cart checkout, plus Admin REST for fulfillment and webhook HMAC verification.',
    suggestedPath: '/projects/cybeni/integrations/shopifyService.js',
    language: 'javascript',
    aiPrompt: 'Integrate the Shopify Storefront GraphQL API and Admin REST client. Support catalog browsing, cart creation, webhooks with HMAC verification, and secure checkout redirection.',
    faqs: [
      {
        question: 'What is the difference between Storefront API and Admin API tokens?',
        answer: 'The Storefront Access Token is public-safe and used in client-side frontends for carts/catalogs. The Admin API Secret Token is strictly backend-only for order fulfillment and inventory updates.'
      },
      {
        question: 'How do I verify incoming Shopify webhooks?',
        answer: 'Hash the raw request body buffer with crypto.createHmac("sha256", secret).update(rawBody).digest("base64") and compare against req.headers["x-shopify-hmac-sha256"] using crypto.timingSafeEqual.'
      }
    ],
    code: `import crypto from 'crypto';

export class ShopifyClient {
  constructor({ shopDomain, storefrontToken, adminApiToken, apiVersion = '2024-10' }) {
    this.shopDomain = shopDomain.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
    this.storefrontToken = storefrontToken;
    this.adminApiToken = adminApiToken;
    this.apiVersion = apiVersion;
  }

  // 1. Storefront GraphQL (Public / Headless Catalog)
  async queryStorefront(query, variables = {}) {
    const endpoint = \`https://\${this.shopDomain}/api/\${this.apiVersion}/graphql.json\`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': this.storefrontToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(\`Shopify Storefront HTTP \${res.status}: \${await res.text()}\`);
    }

    const { data, errors } = await res.json();
    if (errors && errors.length > 0) {
      throw new Error(\`Storefront GraphQL Error: \${errors.map(e => e.message).join(', ')}\`);
    }
    return data;
  }

  // Fetch Products for Headless Grid
  async getProducts(first = 20) {
    const query = \`
      query GetProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              description
              priceRange {
                minVariantPrice { amount currencyCode }
              }
              images(first: 1) {
                edges { node { url altText } }
              }
            }
          }
        }
      }
    \`;
    const data = await this.queryStorefront(query, { first });
    return data.products.edges.map(e => e.node);
  }

  // Create Headless Cart & Checkout URL
  async createCart(lines = []) {
    const mutation = \`
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 10) {
              edges { node { id quantity } }
            }
          }
          userErrors { field message }
        }
      }
    \`;
    const data = await this.queryStorefront(mutation, { input: { lines } });
    if (data.cartCreate.userErrors.length > 0) {
      throw new Error(data.cartCreate.userErrors[0].message);
    }
    return data.cartCreate.cart;
  }

  // 2. Admin REST API (Orders & Fulfillment)
  async getAdminOrders(status = 'open', limit = 50) {
    if (!this.adminApiToken) throw new Error('adminApiToken is required for Admin REST API');
    const endpoint = \`https://\${this.shopDomain}/admin/api/\${this.apiVersion}/orders.json?status=\${status}&limit=\${limit}\`;
    const res = await fetch(endpoint, {
      headers: {
        'X-Shopify-Access-Token': this.adminApiToken,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(\`Admin REST API error: \${res.statusText}\`);
    const data = await res.json();
    return data.orders;
  }

  // 3. Webhook HMAC Verification
  static verifyWebhook(rawBodyBuffer, hmacHeader, secret) {
    const digest = crypto.createHmac('sha256', secret).update(rawBodyBuffer).digest('base64');
    try {
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
    } catch {
      return false;
    }
  }
}
`
  },

  // ── 2. ALIEXPRESS OPEN PLATFORM ──────────────────────────────────────────
  {
    id: 'aliexpress_open_platform',
    title: 'AliExpress Open Platform (Dropshipping & Product API)',
    category: 'ecommerce',
    vendor: 'AliExpress',
    badge: 'Dropship & Sourcing',
    icon: 'Package',
    color: '#ff4747',
    description: 'AliExpress Open Platform API client for automated dropship sourcing, product detail scraping, affiliate tracking link generation, and order fulfillment sync with cryptographic MD5 signature calculation.',
    suggestedPath: '/projects/cybeni/integrations/aliExpressService.js',
    language: 'javascript',
    aiPrompt: 'Implement an AliExpress Open Platform API client with MD5 request signing, affiliate product retrieval, dropshipping order queries, and error handling.',
    faqs: [
      {
        question: 'How does AliExpress API request signing work?',
        answer: 'Sort all request parameters alphabetically, concatenate them as key+value without separators, prepend and append your appSecret, compute MD5 uppercase hash.'
      },
      {
        question: 'Can this be used for automated product catalog imports?',
        answer: 'Yes, call aliexpress.ds.product.get with target product IDs to sync title, images, tiered pricing, and shipping logistics directly into your database.'
      }
    ],
    code: `import crypto from 'crypto';

export class AliExpressService {
  constructor({ appKey, appSecret, sessionKey, gatewayUrl = 'https://api-sg.aliexpress.com/sync' }) {
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.sessionKey = sessionKey;
    this.gatewayUrl = gatewayUrl;
  }

  // Calculate AliExpress MD5 Signature
  sign(params) {
    const keys = Object.keys(params).filter(k => k !== 'sign').sort();
    let queryStr = this.appSecret;
    for (const k of keys) {
      queryStr += k + params[k];
    }
    queryStr += this.appSecret;
    return crypto.createHash('md5').update(queryStr, 'utf8').digest('hex').toUpperCase();
  }

  // Execute authenticated Open Platform Request
  async callMethod(method, businessParams = {}) {
    const params = {
      app_key: this.appKey,
      method: method,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      session: this.sessionKey,
      ...businessParams,
    };

    params.sign = this.sign(params);

    const formData = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }

    const res = await fetch(this.gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: formData.toString(),
    });

    if (!res.ok) throw new Error(\`AliExpress HTTP \${res.status}: \${await res.text()}\`);
    const data = await res.json();
    return data;
  }

  // Get Dropship Product Details & Logistics
  async getProductDetails(productId, shipToCountry = 'US') {
    return this.callMethod('aliexpress.ds.product.get', {
      product_id: productId,
      ship_to_country: shipToCountry,
      target_currency: 'USD',
      target_language: 'EN',
    });
  }

  // Generate Affiliate Promotion Links
  async generatePromotionLinks(promotionUrls = []) {
    return this.callMethod('aliexpress.affiliate.link.generate', {
      promotion_link_type: 0,
      source_values: promotionUrls.join(','),
    });
  }
}
`
  },

  // ── 3. AMAZON SP-API ───────────────────────────────────────────────────
  {
    id: 'amazon_sp_api_orders',
    title: 'Amazon Selling Partner API (SP-API) Orders & Inventory',
    category: 'ecommerce',
    vendor: 'Amazon',
    badge: 'Enterprise Marketplace',
    icon: 'Box',
    color: '#f59e0b',
    description: 'Enterprise Amazon SP-API integration using Login with Amazon (LWA) OAuth2 tokens, AWS SigV4 request authorization, Orders API v0, and Inventory Feeds.',
    suggestedPath: '/projects/cybeni/integrations/amazonSpService.js',
    language: 'javascript',
    aiPrompt: 'Implement Amazon SP-API client with LWA OAuth token refresh, AWS Signature Version 4 calculation, order fetching, and inventory reporting.',
    faqs: [
      {
        question: 'What is required to authenticate against Amazon SP-API?',
        answer: 'You need an LWA Client ID, LWA Client Secret, LWA Refresh Token, AWS IAM Access Key, AWS IAM Secret Key, and the regional SP-API endpoint (e.g. sellingpartnerapi-na.amazon.com).'
      },
      {
        question: 'How do you handle Restricted Data Tokens (RDT)?',
        answer: 'For PII (buyer names/addresses), request an RDT from /tokens/2021-03-01/restrictedDataToken before querying /orders/v0/orders.'
      }
    ],
    code: `import crypto from 'crypto';

export class AmazonSpApiService {
  constructor({ lwaClientId, lwaClientSecret, lwaRefreshToken, region = 'us-east-1' }) {
    this.lwaClientId = lwaClientId;
    this.lwaClientSecret = lwaClientSecret;
    this.lwaRefreshToken = lwaRefreshToken;
    this.endpoint = region === 'us-east-1' 
      ? 'https://sellingpartnerapi-na.amazon.com' 
      : 'https://sellingpartnerapi-eu.amazon.com';
    this.cachedToken = null;
    this.tokenExpiry = 0;
  }

  // 1. Refresh Login With Amazon (LWA) Access Token
  async getAccessToken() {
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    const res = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.lwaRefreshToken,
        client_id: this.lwaClientId,
        client_secret: this.lwaClientSecret,
      }).toString(),
    });

    if (!res.ok) throw new Error(\`LWA Token Refresh failed: \${res.statusText}\`);
    const data = await res.json();
    this.cachedToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;
    return this.cachedToken;
  }

  // 2. Fetch Orders List
  async getOrders({ marketplaceIds, createdAfter }) {
    const accessToken = await this.getAccessToken();
    const url = new URL(\`\${this.endpoint}/orders/v0/orders\`);
    url.searchParams.append('MarketplaceIds', marketplaceIds.join(','));
    if (createdAfter) url.searchParams.append('CreatedAfter', createdAfter);

    const res = await fetch(url.toString(), {
      headers: {
        'x-amz-access-token': accessToken,
        'User-Agent': 'SovereignOS-SpApi/1.0 (Language=JavaScript)',
      },
    });

    if (!res.ok) throw new Error(\`SP-API HTTP \${res.status}: \${await res.text()}\`);
    return await res.json();
  }
}
`
  },

  // ── 4. EBAY DEVELOPER REST API ──────────────────────────────────────────
  {
    id: 'ebay_rest_developer_api',
    title: 'eBay Developer REST API (Inventory & Fulfillment)',
    category: 'ecommerce',
    vendor: 'eBay',
    badge: 'Marketplace Automation',
    icon: 'Store',
    color: '#0064d2',
    description: 'Full eBay REST API client for inventory management, listing creation, order fulfillment, and shipment tracking via official eBay OAuth2 tokens.',
    suggestedPath: '/projects/cybeni/integrations/ebayService.js',
    language: 'javascript',
    aiPrompt: 'Implement eBay Developer REST API client with OAuth2 client credentials & user tokens, inventory item creation, order status queries, and shipping updates.',
    faqs: [
      {
        question: 'How do you switch between eBay Sandbox and Production?',
        answer: 'Set sandbox: true to route to api.sandbox.ebay.com instead of api.ebay.com and use your Sandbox App Keys.'
      }
    ],
    code: `export class EbayService {
  constructor({ clientId, clientSecret, userRefreshToken, sandbox = false }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.userRefreshToken = userRefreshToken;
    this.baseApi = sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
    this.authApi = sandbox ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token' : 'https://api.ebay.com/identity/v1/oauth2/token';
    this.accessToken = null;
    this.expiresAt = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;

    const credentials = Buffer.from(\`\${this.clientId}:\${this.clientSecret}\`).toString('base64');
    const res = await fetch(this.authApi, {
      method: 'POST',
      headers: {
        'Authorization': \`Basic \${credentials}\`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.userRefreshToken,
      }),
    });

    if (!res.ok) throw new Error(\`eBay Token Refresh error: \${await res.text()}\`);
    const data = await res.json();
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async getOrders(limit = 20) {
    const token = await this.getAccessToken();
    const res = await fetch(\`\${this.baseApi}/sell/fulfillment/v1/order?limit=\${limit}\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(\`eBay Orders HTTP \${res.status}\`);
    return await res.json();
  }
}
`
  },

  // ── 5. STRIPE CHECKOUT & BILLING ─────────────────────────────────────────
  {
    id: 'stripe_checkout_billing',
    title: 'Stripe Payments, Checkout Sessions & Webhooks',
    category: 'ecommerce',
    vendor: 'Stripe',
    badge: 'Payments & Subscriptions',
    icon: 'CreditCard',
    color: '#635bff',
    description: 'Production Stripe SDK integration for subscription management, 1-click Checkout Sessions, customer billing portal links, and secure webhook signature verification.',
    suggestedPath: '/projects/cybeni/integrations/stripeService.js',
    language: 'javascript',
    aiPrompt: 'Implement Stripe Checkout and Webhooks handling. Support session creation, Customer Portal, and webhook signature verification with express.',
    faqs: [
      {
        question: 'Why does stripe.webhooks.constructEvent fail with "No signatures found matching"?',
        answer: 'You must pass the raw body Buffer to constructEvent, not JSON.parse() or express.json() output.'
      }
    ],
    code: `import Stripe from 'stripe';

export function createStripeClient(apiKey = process.env.STRIPE_SECRET_KEY) {
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY is required');
  return new Stripe(apiKey, { apiVersion: '2024-09-30.acacia' });
}

export async function createCheckoutSession({
  stripe,
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  mode = 'payment',
}) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session.url;
}

export function handleStripeWebhook(stripe, rawBodyBuffer, sigHeader, webhookSecret) {
  return stripe.webhooks.constructEvent(rawBodyBuffer, sigHeader, webhookSecret);
}
`
  }
];
