import { useMemo, useState, useEffect } from 'react';
import type { Asset, EngineType, Complexity, ContentRating } from '@/types';
import { getAssets } from './marketService';
import { kernelStorage } from '@/kernel/kernelStorage.js';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface SearchFilters {
  /** Text search query - searches title, description, and tags */
  query?: string;
  /** Category slug filter */
  category?: string;
  /** Subcategory filter */
  subcategory?: string;
  /** Minimum price filter */
  minPrice?: number;
  /** Maximum price filter */
  maxPrice?: number;
  /** Game engine filter */
  engine?: 'Unity' | 'Unreal' | 'Godot' | 'Web' | 'Other';
  /** Complexity level filter */
  complexity?: 'Beginner' | 'Intermediate' | 'Advanced';
  /** Minimum rating filter (0-5) */
  rating?: number;
  /** License tier filter */
  licenseTier?: string;
  /** Tags filter - asset must have all specified tags */
  tags?: string[];
  /** Sort order for results */
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'popular';
  /** Content rating filter */
  contentRating?: 'SFW' | 'NSFW';
}

export interface SearchResult {
  results: Asset[];
  resultCount: number;
  isSearching: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEYS = {
  recentSearches: 'novaura_recent_searches',
};

const MAX_RECENT_SEARCHES = 10;

/** Static list of popular search terms */
const POPULAR_SEARCHES: string[] = [
  'Unity',
  'Unreal Engine',
  'Godot',
  '2D sprites',
  '3D models',
  'UI kit',
  'RPG',
  'FPS',
  'Platformer',
  'Music',
  'Sound effects',
  'Framework',
  'Free assets',
  'Low poly',
  'Pixel art',
  'Voxel',
  'Anime',
  'Realistic',
  'Fantasy',
  'Sci-fi',
];

/** All available tags in the platform for suggestions */
const AVAILABLE_TAGS: string[] = [
  'ambient',
  'cybernetic',
  'genesis',
  'steampunk',
  'electronic',
  'novaura',
  'industrial',
  'bass',
  'baremetal',
  'percussion',
  'rhythmic',
  'clockwork',
  'orchestral',
  'epic',
  'ide',
  'monaco',
  'ai-orchestration',
  'framework',
  '2d',
  '3d',
  'ui',
  'hud',
  'sprites',
  'textures',
  'models',
  'avatars',
  'audio',
  'music',
  'sfx',
  'tools',
  'plugins',
  'templates',
  'free',
  'open-source',
  'paid',
  'premium',
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Maps SearchFilters engine type to Asset engineType
 */
const mapEngineFilter = (engine: SearchFilters['engine']): EngineType | undefined => {
  if (!engine) return undefined;
  const mapping: Record<string, EngineType> = {
    'Unity': 'unity',
    'Unreal': 'unreal',
    'Godot': 'godot',
    'Web': 'web',
    'Other': 'other',
  };
  return mapping[engine];
};

/**
 * Maps SearchFilters complexity to Asset complexity
 */
const mapComplexityFilter = (complexity: SearchFilters['complexity']): Complexity | undefined => {
  if (!complexity) return undefined;
  const mapping: Record<string, Complexity> = {
    'Beginner': 'beginner',
    'Intermediate': 'intermediate',
    'Advanced': 'advanced',
  };
  return mapping[complexity];
};

/**
 * Maps SearchFilters content rating to Asset contentRating
 */
const mapContentRatingFilter = (rating: SearchFilters['contentRating']): ContentRating | undefined => {
  if (!rating) return undefined;
  return rating.toLowerCase() as ContentRating;
};

/**
 * Calculates relevance score for an asset based on the search query
 * Higher score = more relevant
 */
const calculateRelevanceScore = (asset: Asset, query: string): number => {
  const normalizedQuery = query.toLowerCase().trim();
  const terms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
  
  if (terms.length === 0) return 0;
  
  let score = 0;
  const title = asset.title.toLowerCase();
  const description = asset.description.toLowerCase();
  const tags = asset.tags.map(t => t.toLowerCase());
  
  for (const term of terms) {
    // Title matches are highest priority
    if (title === term) {
      score += 100;
    } else if (title.startsWith(term)) {
      score += 80;
    } else if (title.includes(term)) {
      score += 60;
    }
    
    // Tag matches are second priority
    if (tags.includes(term)) {
      score += 40;
    } else if (tags.some(tag => tag.includes(term))) {
      score += 20;
    }
    
    // Description matches are lowest priority
    if (description.includes(term)) {
      score += 10;
    }
  }
  
  // Bonus for matching all terms
  const allTermsInTitle = terms.every(t => title.includes(t));
  const allTermsInTags = terms.every(t => tags.some(tag => tag.includes(t)));
  
  if (allTermsInTitle) score += 50;
  if (allTermsInTags) score += 30;
  
  return score;
};

/**
 * Performs full-text search on assets
 */
const performFullTextSearch = (assets: Asset[], query?: string): Asset[] => {
  if (!query || query.trim() === '') {
    return assets;
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  
  return assets.filter(asset => {
    const title = asset.title.toLowerCase();
    const description = asset.description.toLowerCase();
    const tags = asset.tags.map(t => t.toLowerCase());
    const category = asset.category.toLowerCase();
    
    // Check if query matches title, description, tags, or category
    const matchesTitle = title.includes(normalizedQuery);
    const matchesDescription = description.includes(normalizedQuery);
    const matchesTags = tags.some(tag => tag.includes(normalizedQuery));
    const matchesCategory = category.includes(normalizedQuery);
    
    // Also support multi-term search (AND logic)
    const terms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
    const matchesAllTerms = terms.every(term => 
      title.includes(term) ||
      description.includes(term) ||
      tags.some(tag => tag.includes(term)) ||
      category.includes(term)
    );
    
    return matchesTitle || matchesDescription || matchesTags || matchesCategory || matchesAllTerms;
  });
};

/**
 * Sorts assets based on the specified sort criteria
 */
const sortAssets = (assets: Asset[], sortBy: SearchFilters['sortBy'], query?: string): Asset[] => {
  const sorted = [...assets];
  
  switch (sortBy) {
    case 'price_asc':
      return sorted.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
      
    case 'price_desc':
      return sorted.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
      
    case 'newest':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.publishedAt || a.createdAt).getTime();
        const dateB = new Date(b.publishedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
      
    case 'rating':
      return sorted.sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0));
      
    case 'popular':
      return sorted.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
      
    case 'relevance':
    default:
      // If there's a search query, sort by relevance score
      if (query && query.trim() !== '') {
        return sorted.sort((a, b) => {
          const scoreA = calculateRelevanceScore(a, query);
          const scoreB = calculateRelevanceScore(b, query);
          return scoreB - scoreA;
        });
      }
      // Default to popularity if no query
      return sorted.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
  }
};

// =============================================================================
// Main Search Function
// =============================================================================

/**
 * Searches and filters assets based on the provided filters
 * 
 * @param filters - Search filters to apply
 * @returns Filtered and sorted array of assets
 * 
 * @example
 * ```typescript
 * const results = await searchAssets({
 *   query: 'rpg framework',
 *   engine: 'Unity',
 *   minPrice: 0,
 *   maxPrice: 50,
 *   sortBy: 'rating'
 * });
 * ```
 */
export const searchAssets = async (filters: SearchFilters): Promise<Asset[]> => {
  // Get all approved assets
  const allAssets = await getAssets();
  let results = allAssets.filter(asset => asset.status === 'approved');
  
  // Full-text search on title, description, tags, category
  if (filters.query && filters.query.trim() !== '') {
    results = performFullTextSearch(results, filters.query);
  }
  
  // Category filter
  if (filters.category) {
    results = results.filter(asset => asset.category === filters.category);
  }
  
  // Subcategory filter
  if (filters.subcategory) {
    results = results.filter(asset => asset.subcategory === filters.subcategory);
  }
  
  // Price range filter
  if (filters.minPrice !== undefined && filters.minPrice !== null) {
    results = results.filter(asset => (asset.salePrice ?? asset.price) >= filters.minPrice!);
  }
  
  if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
    results = results.filter(asset => (asset.salePrice ?? asset.price) <= filters.maxPrice!);
  }
  
  // Engine filter
  if (filters.engine) {
    const mappedEngine = mapEngineFilter(filters.engine);
    if (mappedEngine) {
      results = results.filter(asset => asset.engineType === mappedEngine);
    }
  }
  
  // Complexity filter
  if (filters.complexity) {
    const mappedComplexity = mapComplexityFilter(filters.complexity);
    if (mappedComplexity) {
      results = results.filter(asset => asset.complexity === mappedComplexity);
    }
  }
  
  // Rating filter (minimum rating)
  if (filters.rating !== undefined && filters.rating !== null) {
    results = results.filter(asset => (asset.ratingAverage || 0) >= filters.rating!);
  }
  
  // License tier filter
  if (filters.licenseTier) {
    results = results.filter(asset => asset.licenseTier === filters.licenseTier);
  }
  
  // Tags filter (asset must have ALL specified tags)
  if (filters.tags && filters.tags.length > 0) {
    results = results.filter(asset => 
      filters.tags!.every(tag => 
        asset.tags.some(assetTag => assetTag.toLowerCase() === tag.toLowerCase())
      )
    );
  }
  
  // Content rating filter
  if (filters.contentRating) {
    const mappedRating = mapContentRatingFilter(filters.contentRating);
    if (mappedRating) {
      results = results.filter(asset => asset.contentRating === mappedRating);
    }
  }
  
  // Sort results
  results = sortAssets(results, filters.sortBy, filters.query);
  
  return results;
};

// =============================================================================
// Search Suggestions
// =============================================================================

/**
 * Gets search suggestions based on a partial query
 * Returns matching asset titles and popular tags
 * 
 * @param query - Partial search query
 * @param limit - Maximum number of suggestions (default: 8)
 * @returns Array of suggestion strings
 * 
 * @example
 * ```typescript
 * const suggestions = getSearchSuggestions('uni');
 * // Returns: ['Unity RPG Framework', 'Unity 2D Platformer', 'universal', ...]
 * ```
 */
export const getSearchSuggestions = async (query: string, limit: number = 8): Promise<string[]> => {
  if (!query || query.trim() === '') {
    return [];
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  const suggestions: string[] = [];
  const seen = new Set<string>();
  
  // Get matching asset titles
  const allAssets = await getAssets();
  const assets = allAssets.filter(asset => asset.status === 'approved');
  for (const asset of assets) {
    if (asset.title.toLowerCase().includes(normalizedQuery)) {
      if (!seen.has(asset.title)) {
        suggestions.push(asset.title);
        seen.add(asset.title);
      }
    }
    
    // Add matching tags from assets
    for (const tag of asset.tags) {
      if (tag.toLowerCase().includes(normalizedQuery) && !seen.has(tag)) {
        suggestions.push(tag);
        seen.add(tag);
      }
    }
    
    if (suggestions.length >= limit) break;
  }
  
  // Add matching popular tags
  if (suggestions.length < limit) {
    for (const tag of AVAILABLE_TAGS) {
      if (tag.toLowerCase().includes(normalizedQuery) && !seen.has(tag)) {
        suggestions.push(tag);
        seen.add(tag);
      }
      if (suggestions.length >= limit) break;
    }
  }
  
  return suggestions.slice(0, limit);
};

// =============================================================================
// Recent Searches (localStorage)
// =============================================================================

/**
 * Saves a search query to recent searches
 * Uses localStorage for persistence
 * 
 * @param query - Search query to save
 * 
 * @example
 * ```typescript
 * saveRecentSearch('Unity RPG framework');
 * ```
 */
export const saveRecentSearch = (query: string): void => {
  if (!query || query.trim() === '') return;
  
  try {
    const normalizedQuery = query.trim();
    const existing = getRecentSearches();
    
    // Remove if already exists (to move to front)
    const filtered = existing.filter(s => s.toLowerCase() !== normalizedQuery.toLowerCase());
    
    // Add to front
    const updated = [normalizedQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    
    kernelStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save recent search:', error);
  }
};

/**
 * Gets the list of recent searches
 * Returns most recent first
 * 
 * @returns Array of recent search queries
 * 
 * @example
 * ```typescript
 * const recent = getRecentSearches();
 * // Returns: ['Unity assets', 'free 3D models', 'RPG framework']
 * ```
 */
export const getRecentSearches = (): string[] => {
  try {
    const data = kernelStorage.getItem(STORAGE_KEYS.recentSearches);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get recent searches:', error);
    return [];
  }
};

/**
 * Clears all recent searches from localStorage
 * 
 * @example
 * ```typescript
 * clearRecentSearches();
 * ```
 */
export const clearRecentSearches = (): void => {
  try {
    kernelStorage.removeItem(STORAGE_KEYS.recentSearches);
  } catch (error) {
    console.error('Failed to clear recent searches:', error);
  }
};

// =============================================================================
// Popular Searches
// =============================================================================

/**
 * Gets a list of popular search terms
 * Returns a static curated list of common searches
 * 
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of popular search terms
 * 
 * @example
 * ```typescript
 * const popular = getPopularSearches(5);
 * // Returns: ['Unity', '3D models', 'RPG', 'Free', 'UI kit']
 * ```
 */
export const getPopularSearches = (limit: number = 10): string[] => {
  return POPULAR_SEARCHES.slice(0, limit);
};

// =============================================================================
// React Hook
// =============================================================================

/**
 * React hook for asset search with memoization
 * Provides optimized search results with performance considerations
 * 
 * @param filters - Search filters
 * @returns SearchResult object with results, count, and loading state
 * 
 * @example
 * ```typescript
 * const MyComponent = () => {
 *   const [filters, setFilters] = useState<SearchFilters>({ query: 'RPG' });
 *   const { results, resultCount, isSearching } = useAssetSearch(filters);
 *   
 *   return (
 *     <div>
 *       <p>Found {resultCount} results</p>
 *       {results.map(asset => <AssetCard key={asset.id} asset={asset} />)}
 *     </div>
 *   );
 * };
 * ```
 * 
 * @debounce_note
 * To implement debouncing for filter changes, wrap your filter state updates:
 * 
 * ```typescript
 * // Using a custom debounce hook
 * const useDebounce = <T>(value: T, delay: number): T => {
 *   const [debouncedValue, setDebouncedValue] = useState<T>(value);
 *   
 *   useEffect(() => {
 *     const handler = setTimeout(() => setDebouncedValue(value), delay);
 *     return () => clearTimeout(handler);
 *   }, [value, delay]);
 *   
 *   return debouncedValue;
 * };
 * 
 * // Usage
 * const [filters, setFilters] = useState<SearchFilters>({});
 * const debouncedFilters = useDebounce(filters, 300); // 300ms debounce
 * const { results, resultCount } = useAssetSearch(debouncedFilters);
 * ```
 */
export const useAssetSearch = (filters: SearchFilters): SearchResult & { isSearching: boolean } => {
  const [results, setResults] = useState<Asset[]>([]);
  const [isSearching, setIsSearching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    const performSearch = async () => {
      setIsSearching(true);
      try {
        const searchResults = await searchAssets(filters);
        if (!cancelled) {
          setResults(searchResults);
        }
      } catch (error) {
        console.error('Search failed:', error);
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    };
    
    performSearch();
    
    return () => {
      cancelled = true;
    };
  }, [
    filters.query,
    filters.category,
    filters.subcategory,
    filters.minPrice,
    filters.maxPrice,
    filters.engine,
    filters.complexity,
    filters.rating,
    filters.licenseTier,
    filters.tags?.join(','), // Convert array to string for comparison
    filters.sortBy,
    filters.contentRating,
  ]);
  
  // Memoize the count
  const resultCount = useMemo(() => results.length, [results]);
  
  return {
    results,
    resultCount,
    isSearching,
  };
};

// =============================================================================
// Advanced Search Utilities
// =============================================================================

/**
 * Builds a search query string from filters
 * Useful for URL serialization
 * 
 * @param filters - Search filters
 * @returns URL query string
 */
export const buildSearchQueryString = (filters: SearchFilters): string => {
  const params = new URLSearchParams();
  
  if (filters.query) params.set('q', filters.query);
  if (filters.category) params.set('category', filters.category);
  if (filters.subcategory) params.set('subcategory', filters.subcategory);
  if (filters.minPrice !== undefined) params.set('minPrice', filters.minPrice.toString());
  if (filters.maxPrice !== undefined) params.set('maxPrice', filters.maxPrice.toString());
  if (filters.engine) params.set('engine', filters.engine);
  if (filters.complexity) params.set('complexity', filters.complexity);
  if (filters.rating !== undefined) params.set('rating', filters.rating.toString());
  if (filters.licenseTier) params.set('licenseTier', filters.licenseTier);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.contentRating) params.set('contentRating', filters.contentRating);
  if (filters.tags && filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','));
  }
  
  return params.toString();
};

/**
 * Parses a URL query string into SearchFilters
 * 
 * @param queryString - URL query string
 * @returns SearchFilters object
 */
export const parseSearchQueryString = (queryString: string): SearchFilters => {
  const params = new URLSearchParams(queryString);
  
  const filters: SearchFilters = {};
  
  if (params.has('q')) filters.query = params.get('q')!;
  if (params.has('category')) filters.category = params.get('category')!;
  if (params.has('subcategory')) filters.subcategory = params.get('subcategory')!;
  if (params.has('minPrice')) filters.minPrice = parseFloat(params.get('minPrice')!);
  if (params.has('maxPrice')) filters.maxPrice = parseFloat(params.get('maxPrice')!);
  if (params.has('engine')) filters.engine = params.get('engine') as SearchFilters['engine'];
  if (params.has('complexity')) filters.complexity = params.get('complexity') as SearchFilters['complexity'];
  if (params.has('rating')) filters.rating = parseFloat(params.get('rating')!);
  if (params.has('licenseTier')) filters.licenseTier = params.get('licenseTier')!;
  if (params.has('sortBy')) filters.sortBy = params.get('sortBy') as SearchFilters['sortBy'];
  if (params.has('contentRating')) filters.contentRating = params.get('contentRating') as SearchFilters['contentRating'];
  if (params.has('tags')) {
    filters.tags = params.get('tags')!.split(',').filter(Boolean);
  }
  
  return filters;
};

/**
 * Validates and sanitizes search filters
 * 
 * @param filters - Raw filters object
 * @returns Sanitized SearchFilters
 */
export const sanitizeSearchFilters = (filters: Partial<SearchFilters>): SearchFilters => {
  const sanitized: SearchFilters = {};
  
  if (filters.query) sanitized.query = filters.query.trim().slice(0, 100);
  if (filters.category) sanitized.category = filters.category.trim();
  if (filters.subcategory) sanitized.subcategory = filters.subcategory.trim();
  if (filters.minPrice !== undefined && !isNaN(filters.minPrice)) {
    sanitized.minPrice = Math.max(0, filters.minPrice);
  }
  if (filters.maxPrice !== undefined && !isNaN(filters.maxPrice)) {
    sanitized.maxPrice = Math.max(0, filters.maxPrice);
  }
  if (filters.engine && ['Unity', 'Unreal', 'Godot', 'Web', 'Other'].includes(filters.engine)) {
    sanitized.engine = filters.engine;
  }
  if (filters.complexity && ['Beginner', 'Intermediate', 'Advanced'].includes(filters.complexity)) {
    sanitized.complexity = filters.complexity;
  }
  if (filters.rating !== undefined && !isNaN(filters.rating)) {
    sanitized.rating = Math.min(5, Math.max(0, filters.rating));
  }
  if (filters.licenseTier) sanitized.licenseTier = filters.licenseTier.trim();
  if (filters.tags && Array.isArray(filters.tags)) {
    sanitized.tags = filters.tags.filter(t => typeof t === 'string').map(t => t.trim()).slice(0, 10);
  }
  if (filters.sortBy && ['relevance', 'price_asc', 'price_desc', 'newest', 'rating', 'popular'].includes(filters.sortBy)) {
    sanitized.sortBy = filters.sortBy;
  }
  if (filters.contentRating && ['SFW', 'NSFW'].includes(filters.contentRating)) {
    sanitized.contentRating = filters.contentRating;
  }
  
  return sanitized;
};

export default {
  searchAssets,
  getSearchSuggestions,
  saveRecentSearch,
  getRecentSearches,
  clearRecentSearches,
  getPopularSearches,
  useAssetSearch,
  buildSearchQueryString,
  parseSearchQueryString,
  sanitizeSearchFilters,
};
