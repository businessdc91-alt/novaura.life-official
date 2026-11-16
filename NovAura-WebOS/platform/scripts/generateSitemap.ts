/**
 * Sitemap Generator Script
 * Generates sitemap.xml for NovAura including static and dynamic routes
 * 
 * Usage: npx ts-node scripts/generateSitemap.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_SEO, STATIC_ROUTES, DYNAMIC_ROUTE_PATTERNS } from '../src/constants/seo';

// Types
interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

interface AssetForSitemap {
  slug: string;
  updatedAt: string;
}

interface CreatorForSitemap {
  username: string;
  updatedAt: string;
}

interface CategoryForSitemap {
  slug: string;
}

// Mock data for dynamic routes - Replace with actual data fetching in production
const mockAssets: AssetForSitemap[] = [
  { slug: 'fantasy-character-pack', updatedAt: '2026-03-15T10:00:00Z' },
  { slug: 'sci-fi-weapon-bundle', updatedAt: '2026-03-14T15:30:00Z' },
  { slug: 'low-poly-nature-set', updatedAt: '2026-03-13T09:00:00Z' },
  { slug: 'ui-icon-pack-gaming', updatedAt: '2026-03-12T14:00:00Z' },
  { slug: 'orchestral-music-loop', updatedAt: '2026-03-11T11:00:00Z' },
];

const mockCreators: CreatorForSitemap[] = [
  { username: 'pixelmaster', updatedAt: '2026-03-15T08:00:00Z' },
  { username: '3dartist_pro', updatedAt: '2026-03-14T16:00:00Z' },
  { username: 'indiedev_studio', updatedAt: '2026-03-13T12:00:00Z' },
  { username: 'sound_designer', updatedAt: '2026-03-12T10:00:00Z' },
];

const mockCategories: CategoryForSitemap[] = [
  { slug: 'game-assets' },
  { slug: '3d-models' },
  { slug: '2d-art' },
  { slug: 'animations' },
  { slug: 'audio' },
  { slug: 'tools' },
  { slug: 'templates' },
  { slug: 'vr-ar' },
  { slug: 'software' },
  { slug: 'games' },
];

/**
 * Format date to W3C datetime format
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

/**
 * Escape special XML characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate URL entry for sitemap
 */
function generateUrlEntry(url: SitemapUrl): string {
  return `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority.toFixed(1)}</priority>
  </url>`;
}

/**
 * Generate static route URLs
 */
function generateStaticUrls(): SitemapUrl[] {
  const baseUrl = DEFAULT_SEO.siteUrl;
  const now = new Date();

  return STATIC_ROUTES.map(route => ({
    loc: `${baseUrl}${route.path}`,
    lastmod: formatDate(now),
    changefreq: route.changefreq,
    priority: route.priority,
  }));
}

/**
 * Generate asset detail page URLs
 */
function generateAssetUrls(assets: AssetForSitemap[]): SitemapUrl[] {
  const baseUrl = DEFAULT_SEO.siteUrl;
  const pattern = DYNAMIC_ROUTE_PATTERNS.find(p => p.pattern === '/asset/:slug');

  return assets.map(asset => ({
    loc: `${baseUrl}/asset/${asset.slug}`,
    lastmod: formatDate(asset.updatedAt),
    changefreq: pattern?.changefreq || 'weekly',
    priority: pattern?.priority || 0.8,
  }));
}

/**
 * Generate creator profile page URLs
 */
function generateCreatorUrls(creators: CreatorForSitemap[]): SitemapUrl[] {
  const baseUrl = DEFAULT_SEO.siteUrl;
  const pattern = DYNAMIC_ROUTE_PATTERNS.find(p => p.pattern === '/creator/:username');

  return creators.map(creator => ({
    loc: `${baseUrl}/creator/${creator.username}`,
    lastmod: formatDate(creator.updatedAt),
    changefreq: pattern?.changefreq || 'daily',
    priority: pattern?.priority || 0.7,
  }));
}

/**
 * Generate category page URLs
 */
function generateCategoryUrls(categories: CategoryForSitemap[]): SitemapUrl[] {
  const baseUrl = DEFAULT_SEO.siteUrl;
  const now = new Date();
  const pattern = DYNAMIC_ROUTE_PATTERNS.find(p => p.pattern === '/category/:slug');

  return categories.map(category => ({
    loc: `${baseUrl}/category/${category.slug}`,
    lastmod: formatDate(now),
    changefreq: pattern?.changefreq || 'weekly',
    priority: pattern?.priority || 0.8,
  }));
}

/**
 * Generate the complete sitemap XML
 */
function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlEntries = urls.map(generateUrlEntry).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;
}

/**
 * Fetch dynamic data from API or database
 * Replace mock data with actual data fetching in production
 */
async function fetchDynamicData(): Promise<{
  assets: AssetForSitemap[];
  creators: CreatorForSitemap[];
  categories: CategoryForSitemap[];
}> {
  // TODO: Replace with actual API calls
  // Example:
  // const assetsResponse = await fetch(`${API_URL}/assets?limit=1000`);
  // const assets = await assetsResponse.json();
  
  // For now, use mock data
  return {
    assets: mockAssets,
    creators: mockCreators,
    categories: mockCategories,
  };
}

/**
 * Main function to generate sitemap
 */
async function generateSitemap(): Promise<void> {
  try {
    console.log('🚀 Generating sitemap...');

    // Fetch dynamic data
    const { assets, creators, categories } = await fetchDynamicData();

    // Generate all URLs
    const staticUrls = generateStaticUrls();
    const assetUrls = generateAssetUrls(assets);
    const creatorUrls = generateCreatorUrls(creators);
    const categoryUrls = generateCategoryUrls(categories);

    // Combine all URLs
    const allUrls = [
      ...staticUrls,
      ...assetUrls,
      ...creatorUrls,
      ...categoryUrls,
    ];

    // Sort by priority (highest first)
    allUrls.sort((a, b) => b.priority - a.priority);

    // Generate XML
    const sitemapXml = generateSitemapXml(allUrls);

    // Determine output path
    const publicDir = path.resolve(__dirname, '../public');
    const outputPath = path.join(publicDir, 'sitemap.xml');

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write sitemap file
    fs.writeFileSync(outputPath, sitemapXml, 'utf8');

    console.log(`✅ Sitemap generated successfully!`);
    console.log(`📄 Location: ${outputPath}`);
    console.log(`📊 Total URLs: ${allUrls.length}`);
    console.log(`   - Static routes: ${staticUrls.length}`);
    console.log(`   - Asset pages: ${assetUrls.length}`);
    console.log(`   - Creator profiles: ${creatorUrls.length}`);
    console.log(`   - Category pages: ${categoryUrls.length}`);

    // Generate sitemap index if there are many URLs (optional)
    if (allUrls.length > 50000) {
      console.log('⚠️  Warning: URL count exceeds 50,000. Consider using sitemap index.');
    }

  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
}

/**
 * Generate robots.txt file
 */
function generateRobotsTxt(): void {
  const content = `# robots.txt for NovAura
# Generated on ${new Date().toISOString()}

User-agent: *
Allow: /

# Sitemap
Sitemap: ${DEFAULT_SEO.siteUrl}/sitemap.xml

# Disallow private/admin routes
Disallow: /admin/
Disallow: /dashboard/
Disallow: /settings/
Disallow: /cart/
Disallow: /checkout/
Disallow: /api/
Disallow: /internal/

# Disallow search pages (to avoid duplicate content)
Disallow: /browse?q=*
Disallow: /search

# Crawl delay for polite bots
Crawl-delay: 1

# Special rules for specific bots
User-agent: Googlebot
Allow: /
Crawl-delay: 0.5

User-agent: Bingbot
Allow: /
Crawl-delay: 1
`;

  const publicDir = path.resolve(__dirname, '../public');
  const outputPath = path.join(publicDir, 'robots.txt');

  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`🤖 robots.txt generated: ${outputPath}`);
}

// Run the generator if this file is executed directly
if (require.main === module) {
  generateSitemap().then(() => {
    generateRobotsTxt();
    console.log('\n🎉 SEO files generated successfully!');
  });
}

export {
  generateSitemap,
  generateRobotsTxt,
  generateSitemapXml,
  generateStaticUrls,
  generateAssetUrls,
  generateCreatorUrls,
  generateCategoryUrls,
};

export type {
  SitemapUrl,
  AssetForSitemap,
  CreatorForSitemap,
  CategoryForSitemap,
};
