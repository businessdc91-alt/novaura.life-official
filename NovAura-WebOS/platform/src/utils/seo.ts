/**
 * SEO Utilities
 * Helper functions for generating SEO metadata
 */

import type { Asset, User } from '@/types';
import {
  DEFAULT_SEO,
  CATEGORY_KEYWORDS,
  ENGINE_KEYWORDS,
  COMPLEXITY_KEYWORDS,
  META_LIMITS,
} from '@/constants/seo';

export interface SEOMetaProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product' | 'profile';
  author?: string;
  publishedAt?: string;
  modifiedAt?: string;
  noindex?: boolean;
  canonical?: string;
  locale?: string;
  siteName?: string;
  twitterHandle?: string;
  structuredData?: Record<string, any>;
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateDescription(text: string, length: number = META_LIMITS.descriptionMaxLength): string {
  if (text.length <= length) return text;
  return text.substring(0, length - 3).trim() + '...';
}

/**
 * Convert text to URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate full canonical URL from path
 */
export function generateCanonicalUrl(path: string): string {
  const baseUrl = DEFAULT_SEO.siteUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Generate keywords array from asset data
 */
export function generateKeywordsFromAsset(asset: Asset): string[] {
  const keywords: string[] = [
    'game assets',
    'digital assets',
    'creator marketplace',
  ];

  // Add category keywords
  if (asset.category && CATEGORY_KEYWORDS[asset.category]) {
    keywords.push(...CATEGORY_KEYWORDS[asset.category]);
  }

  // Add engine keywords
  if (asset.engineType && ENGINE_KEYWORDS[asset.engineType]) {
    keywords.push(...ENGINE_KEYWORDS[asset.engineType]);
  }

  // Add complexity keywords
  if (asset.complexity && COMPLEXITY_KEYWORDS[asset.complexity]) {
    keywords.push(...COMPLEXITY_KEYWORDS[asset.complexity]);
  }

  // Add asset tags
  if (asset.tags && asset.tags.length > 0) {
    keywords.push(...asset.tags.slice(0, 5));
  }

  // Add asset type
  if (asset.assetType) {
    keywords.push(asset.assetType.replace('_', ' '));
  }

  // Remove duplicates and limit count
  return [...new Set(keywords)].slice(0, META_LIMITS.keywordsMaxCount);
}

/**
 * Generate SEO metadata for an asset
 */
export function generateAssetMeta(asset: Asset): SEOMetaProps {
  const title = `${asset.title} - NovAura`;
  const description = asset.shortDescription || truncateDescription(asset.description);
  const keywords = generateKeywordsFromAsset(asset);
  const image = asset.thumbnailUrl || DEFAULT_SEO.defaultImage;
  const url = generateCanonicalUrl(`/asset/${asset.slug}`);
  
  // Generate structured data for Product
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: asset.title,
    image: [asset.thumbnailUrl, ...asset.screenshotUrls].filter(Boolean).slice(0, 5),
    description: asset.description,
    sku: asset.id,
    brand: {
      '@type': 'Brand',
      name: asset.creator?.username || 'NovAura Creator',
    },
    offers: {
      '@type': 'Offer',
      url: url,
      priceCurrency: 'USD',
      price: asset.salePrice?.toString() || asset.price.toString(),
      availability: asset.status === 'approved' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Person',
        name: asset.creator?.username || 'NovAura Creator',
      },
    },
    aggregateRating: asset.ratingCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: asset.ratingAverage.toString(),
      reviewCount: asset.ratingCount.toString(),
    } : undefined,
    datePublished: asset.publishedAt || asset.createdAt,
    dateModified: asset.updatedAt,
  };

  return {
    title,
    description,
    keywords,
    image,
    url,
    type: 'product',
    author: asset.creator?.username,
    publishedAt: asset.publishedAt || asset.createdAt,
    modifiedAt: asset.updatedAt,
    canonical: url,
    structuredData,
  };
}

/**
 * Generate SEO metadata for a creator profile
 */
export function generateCreatorMeta(creator: User): SEOMetaProps {
  const title = `${creator.username} - Creator Profile | NovAura`;
  const description = truncateDescription(
    creator.bio || `${creator.username} is a creator on NovAura, sharing game assets, 3D models, and digital creations with the community.`
  );
  const keywords = [
    creator.username,
    'game developer',
    '3D artist',
    'game creator',
    'indie developer',
    'digital artist',
    'asset creator',
    ...(creator.skills || []),
  ].filter(Boolean).slice(0, META_LIMITS.keywordsMaxCount);
  
  const image = creator.avatar || DEFAULT_SEO.defaultImage;
  const url = generateCanonicalUrl(`/creator/${creator.username}`);

  // Generate structured data for ProfilePage
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: creator.username,
      description: creator.bio,
      image: creator.avatar,
      url: url,
      sameAs: [
        creator.twitter && `https://twitter.com/${creator.twitter}`,
        creator.github && `https://github.com/${creator.github}`,
        creator.website,
      ].filter(Boolean),
      jobTitle: creator.skills?.[0] || 'Creator',
      worksFor: {
        '@type': 'Organization',
        name: 'NovAura',
      },
    },
    datePublished: creator.createdAt,
    dateModified: creator.updatedAt,
  };

  return {
    title,
    description,
    keywords,
    image,
    url,
    type: 'profile',
    author: creator.username,
    publishedAt: creator.createdAt,
    modifiedAt: creator.updatedAt,
    canonical: url,
    structuredData,
  };
}

/**
 * Generate SEO metadata for a category page
 */
export function generateCategoryMeta(categorySlug: string): SEOMetaProps {
  const categoryName = categorySlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const keywords = CATEGORY_KEYWORDS[categorySlug] || [
    'game assets',
    'digital marketplace',
    'creator economy',
  ];

  const title = `${categoryName} - Browse Assets | NovAura`;
  const description = `Discover the best ${categoryName.toLowerCase()} on NovAura. Browse thousands of high-quality game assets, 3D models, and digital creations from talented creators worldwide.`;
  const url = generateCanonicalUrl(`/category/${categorySlug}`);

  // Generate structured data for CollectionPage
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: categoryName,
    description: description,
    url: url,
    isPartOf: {
      '@type': 'WebSite',
      name: DEFAULT_SEO.siteName,
      url: DEFAULT_SEO.siteUrl,
    },
  };

  return {
    title,
    description,
    keywords: keywords.slice(0, META_LIMITS.keywordsMaxCount),
    image: DEFAULT_SEO.defaultImage,
    url,
    type: 'website',
    canonical: url,
    structuredData,
  };
}

/**
 * Generate SEO metadata for search results page
 */
export function generateSearchMeta(query: string, resultCount?: number): SEOMetaProps {
  const title = query 
    ? `"${query}" - Search Results | NovAura`
    : 'Search - NovAura';
  
  const description = query
    ? `Find "${query}" and more on NovAura. Browse ${resultCount || 'thousands of'} game assets, 3D models, and digital creations.`
    : 'Search for game assets, 3D models, software, and digital creations on NovAura. Discover content from talented creators worldwide.';

  const url = generateCanonicalUrl(query ? `/browse?q=${encodeURIComponent(query)}` : '/browse');

  return {
    title,
    description,
    keywords: [query, 'search', 'game assets', '3D models', 'marketplace'].filter(Boolean),
    image: DEFAULT_SEO.defaultImage,
    url,
    type: 'website',
    canonical: url,
    // Search pages should typically not be indexed
    noindex: true,
  };
}

/**
 * Generate SEO metadata for the homepage
 */
export function generateHomeMeta(): SEOMetaProps {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEFAULT_SEO.siteName,
    url: DEFAULT_SEO.siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${DEFAULT_SEO.siteUrl}/browse?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return {
    title: DEFAULT_SEO.defaultTitle,
    description: DEFAULT_SEO.defaultDescription,
    keywords: [
      'game assets',
      '3D models',
      'marketplace',
      'creator economy',
      'indie game development',
      'digital assets',
      'game development resources',
    ],
    image: DEFAULT_SEO.defaultImage,
    url: DEFAULT_SEO.siteUrl,
    type: 'website',
    canonical: DEFAULT_SEO.siteUrl,
    structuredData,
  };
}

/**
 * Merge user-provided SEO props with defaults
 */
export function mergeSEOMeta(userMeta: Partial<SEOMetaProps> = {}): SEOMetaProps {
  const defaults = generateHomeMeta();
  
  return {
    ...defaults,
    ...userMeta,
    // Merge keywords arrays
    keywords: [
      ...(defaults.keywords || []),
      ...(userMeta.keywords || []),
    ],
    // Override structured data if provided
    structuredData: userMeta.structuredData || defaults.structuredData,
  };
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbStructuredData(
  items: Array<{ name: string; url: string }>
): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: generateCanonicalUrl(item.url),
    })),
  };
}

/**
 * Generate organization structured data
 */
export function generateOrganizationStructuredData(): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: DEFAULT_SEO.siteName,
    url: DEFAULT_SEO.siteUrl,
    logo: `${DEFAULT_SEO.siteUrl}/logo.png`,
    sameAs: [
      'https://twitter.com/novaura',
      'https://github.com/novaura',
      'https://discord.gg/novaura',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${DEFAULT_SEO.siteUrl}/contact`,
    },
  };
}
