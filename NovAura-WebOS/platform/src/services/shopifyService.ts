// Shopify Storefront API service for Catalyst's Corner integration

const SHOPIFY_DOMAIN = 'catalysts-corner.myshopify.com';
const STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN || '';

const STOREFRONT_URL = `https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`;

interface ShopifyImage {
  url: string;
  altText: string | null;
}

interface ShopifyPrice {
  amount: string;
  currencyCode: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  featuredImage: ShopifyImage | null;
  priceRange: {
    minVariantPrice: ShopifyPrice;
    maxVariantPrice: ShopifyPrice;
  };
  productType: string;
  tags: string[];
  availableForSale: boolean;
  onlineStoreUrl: string | null;
}

async function storefrontFetch(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(STOREFRONT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify Storefront API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'Shopify GraphQL error');
  }
  return json.data;
}

export async function fetchProducts(first = 20): Promise<ShopifyProduct[]> {
  const query = `
    query GetProducts($first: Int!) {
      products(first: $first, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            description
            handle
            productType
            tags
            availableForSale
            onlineStoreUrl
            featuredImage {
              url
              altText
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const data = await storefrontFetch(query, { first });
  return data.products.edges.map((edge: { node: ShopifyProduct }) => edge.node);
}

export async function fetchProductsByType(type: string, first = 20): Promise<ShopifyProduct[]> {
  const query = `
    query GetProductsByType($first: Int!, $query: String!) {
      products(first: $first, query: $query, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            description
            handle
            productType
            tags
            availableForSale
            onlineStoreUrl
            featuredImage {
              url
              altText
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const data = await storefrontFetch(query, { first, query: `product_type:${type}` });
  return data.products.edges.map((edge: { node: ShopifyProduct }) => edge.node);
}

export function getCheckoutUrl(handle: string): string {
  return `https://${SHOPIFY_DOMAIN}/products/${handle}`;
}

export function getStoreUrl(): string {
  return `https://${SHOPIFY_DOMAIN}`;
}
