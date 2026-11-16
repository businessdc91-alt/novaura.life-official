export type SearchEngine = 'google' | 'mojeek' | 'bing' | 'shopping' | 'youcom';

export interface SearchEngineConfig {
  id: SearchEngine;
  name: string;
  searchUrl: string;
  color: string;
  apiEndpoint?: string;
}

export const SEARCH_ENGINES: SearchEngineConfig[] = [
  { id: 'youcom', name: 'You.com', searchUrl: 'https://you.com/search?q=', color: 'neon-violet' },
  { id: 'google', name: 'Google', searchUrl: 'https://www.google.com/search?q=', color: 'neon-cyan' },
  { id: 'shopping', name: 'Shopping', searchUrl: 'https://www.google.com/search?tbm=shop&q=', color: 'neon-lime' },
  { id: 'mojeek', name: 'Mojeek', searchUrl: 'https://www.mojeek.com/search?q=', color: 'neon-magenta' },
  { id: 'bing', name: 'Bing', searchUrl: 'https://www.bing.com/search?q=', color: 'neon-violet' },
];

/** Phase 1: Open search results via URL redirect */
export function executeWebSearch(query: string, engine: SearchEngine): void {
  const config = SEARCH_ENGINES.find(e => e.id === engine);
  if (!config || !query.trim()) return;
  
  const targetUrl = `${config.searchUrl}${encodeURIComponent(query.trim())}`;
  
  try {
    const newWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    
    // Fallback if the browser's popup blocker intercepts the new tab
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = targetUrl;
    }
  } catch (err) {
    // If window.open throws an error, fallback immediately
    window.location.href = targetUrl;
  }
}

/** Phase 2 stub: API-based in-page search results (requires API keys) */
export async function searchViaAPI(
  query: string,
  engine: SearchEngine,
  apiKey: string
): Promise<{ title: string; url: string; snippet: string }[]> {
  // Will be implemented when API keys are provided
  // Google: Custom Search JSON API
  // Mojeek: Mojeek Search API
  // Bing: Bing Web Search API v7
  void query; void engine; void apiKey;
  return [];
}
