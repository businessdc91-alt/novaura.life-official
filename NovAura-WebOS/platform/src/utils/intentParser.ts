import type { AssetFilters } from '../types';

/**
 * A client-side intent parser that extracts structured filters from a natural language query.
 * This is a foundational step before a full LLM backend is integrated.
 */
export function parseIntent(query: string): Partial<AssetFilters> & { cleanQuery: string } {
  const lowercaseQuery = query.toLowerCase();
  const result: Partial<AssetFilters> = {};
  let cleanQuery = query;

  // 1. Extract Price Constraints ("under $15", "less than 20", "max $5")
  const priceRegex = /(?:under|less than|max|cheaper than|below)\s*\$?(\d+)/i;
  const priceMatch = lowercaseQuery.match(priceRegex);
  if (priceMatch && priceMatch[1]) {
    result.priceMax = parseInt(priceMatch[1], 10) * 100; // Convert to cents
    // Remove the price part from the clean query
    cleanQuery = cleanQuery.replace(priceRegex, '').trim();
  }

  // 2. Extract Royalty/License Tiers
  if (lowercaseQuery.includes('3%') || lowercaseQuery.includes('standard')) {
    result.licenseTier = 'art_3pct';
  } else if (lowercaseQuery.includes('10%') || lowercaseQuery.includes('integration')) {
    result.licenseTier = 'integration_10pct';
  } else if (lowercaseQuery.includes('15%') || lowercaseQuery.includes('functional')) {
    result.licenseTier = 'functional_15pct';
  } else if (lowercaseQuery.includes('20%') || lowercaseQuery.includes('source code')) {
    result.licenseTier = 'source_20pct';
  } else if (lowercaseQuery.includes('open source') || lowercaseQuery.includes('free')) {
    result.licenseTier = 'opensource';
  }

  // 3. Extract Engine
  if (lowercaseQuery.includes('unity')) result.engineType = 'unity';
  else if (lowercaseQuery.includes('unreal')) result.engineType = 'unreal';
  else if (lowercaseQuery.includes('godot')) result.engineType = 'godot';
  else if (lowercaseQuery.includes('web')) result.engineType = 'web';

  // 4. Extract Category (Basic mappings)
  if (lowercaseQuery.includes('2d')) result.category = '2d';
  else if (lowercaseQuery.includes('3d')) result.category = '3d';
  else if (lowercaseQuery.includes('audio') || lowercaseQuery.includes('music') || lowercaseQuery.includes('sound')) result.category = 'audio';
  else if (lowercaseQuery.includes('ui') || lowercaseQuery.includes('gui')) result.category = 'ui';
  else if (lowercaseQuery.includes('script') || lowercaseQuery.includes('code')) result.category = 'scripts';

  // 5. Extract Details
  if (lowercaseQuery.includes('nsfw') || lowercaseQuery.includes('adult')) result.contentRating = 'nsfw';
  else if (lowercaseQuery.includes('sfw') || lowercaseQuery.includes('safe')) result.contentRating = 'sfw';

  if (lowercaseQuery.includes('beginner') || lowercaseQuery.includes('easy')) result.complexity = 'beginner';
  else if (lowercaseQuery.includes('advanced') || lowercaseQuery.includes('pro')) result.complexity = 'advanced';
  else if (lowercaseQuery.includes('intermediate')) result.complexity = 'intermediate';

  // Cleanup extra spaces in the query that might have been left over
  cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();

  return {
    ...result,
    cleanQuery
  };
}
