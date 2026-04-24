/**
 * Search API Routes
 * Uses DuckDuckGo for web and image search (free, no API key needed)
 */

import { Router } from 'express';
import * as admin from 'firebase-admin';
import { search, SafeSearchType } from 'duck-duck-scrape';

const router = Router();

function webFallbackResponse(query: string, reason = 'Search provider unavailable') {
  return {
    query,
    results: [
      {
        title: `NovAura is more than search — explore the platform`,
        url: '/feed',
        snippet: 'Search is temporarily degraded. Jump into the platform feed, creation tools, and app ecosystem while services recover.',
        displayUrl: 'novaura.life'
      },
      {
        title: `Search query captured: "${query}"`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: 'External search fallback. Open this query directly on DuckDuckGo.',
        displayUrl: 'duckduckgo.com'
      }
    ],
    fallback: true,
    message: reason,
  };
}

function imageFallbackResponse(query: string, reason = 'Image search provider unavailable') {
  return {
    query,
    images: [],
    fallback: true,
    message: reason,
    externalSearchUrl: `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
  };
}

/**
 * Web Search using You.com (Primary) with DuckDuckGo Fallback
 * GET /search?q=query&type=web|news|all&freshness=day|week|month|year
 */
router.get('/', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const freshness = typeof req.query.freshness === 'string' ? req.query.freshness : undefined;
  const count = parseInt(typeof req.query.count === 'string' ? req.query.count : '20');
  const livecrawl = typeof req.query.livecrawl === 'string' ? req.query.livecrawl : undefined; // 'web', 'news', or 'all'

  
  try {
    if (!query) {
      res.status(400).json({ error: 'Query required' });
      return;
    }

    const youcomKey = process.env.YOUCOM_API_KEY;
    
    if (youcomKey) {
      try {
        const searchUrl = new URL('https://ydc-index.io/v1/search');
        searchUrl.searchParams.append('query', query);
        if (freshness) searchUrl.searchParams.append('freshness', freshness);
        if (count) searchUrl.searchParams.append('count', Math.min(100, count).toString());
        if (livecrawl) {
          searchUrl.searchParams.append('livecrawl', livecrawl);
          searchUrl.searchParams.append('livecrawl_formats', 'markdown');
        }
        
        console.log(`[Search] Querying You.com for: "${query}" (count: ${count}, livecrawl: ${livecrawl || 'off'})`);
        const response = await fetch(searchUrl.toString(), {
          headers: { 'X-API-Key': youcomKey }
        });

        if (response.ok) {
          const data = await response.json();
          
          // You.com returns unified results in results.web and results.news
          const webResults = data.results?.web || [];
          const newsResults = data.results?.news || [];
          
          // Combine and mark types
          const combined = [
            ...webResults.map((item: any) => ({
              title: item.title,
              url: item.url,
              snippet: item.description || (item.snippets && item.snippets[0]) || '',
              displayUrl: new URL(item.url).hostname.replace('www.', ''),
              type: 'web',
              thumbnail: item.thumbnail_url,
              content: item.content // Populated if livecrawl is on
            })),
            ...newsResults.map((item: any) => ({
              title: item.title,
              url: item.url,
              snippet: item.description || '',
              displayUrl: new URL(item.url).hostname.replace('www.', ''),
              type: 'news',
              thumbnail: item.thumbnail_url,
              age: item.page_age
            }))
          ];
          
          res.json({
            query,
            results: combined,
            totalResults: combined.length,
            provider: 'youcom',
            metadata: data.metadata
          });
          return;
        }
        console.warn(`[Search] You.com API returned ${response.status}. Falling back to DuckDuckGo.`);
      } catch (youcomErr) {
        console.error('[Search] You.com request failed:', youcomErr);
      }
    }

    // Fallback to DuckDuckGo search (no API key needed)
    const searchResults = await search(query, {
      safeSearch: SafeSearchType.OFF,
    });

    res.json({
      query,
      results: searchResults.results.map((item: any) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
        displayUrl: item.hostname || new URL(item.url).hostname.replace('www.', ''),
        type: 'web'
      })),
      totalResults: searchResults.results.length,
      provider: 'duckduckgo',
      fallback: true
    });

  } catch (err: any) {
    console.error('Search error:', err);
    res.json(webFallbackResponse(query, `Search temporarily unavailable: ${err.message || 'unknown error'}`));
  }
});

/**
 * Image Search using DuckDuckGo
 * GET /search/images?q=query
 */
router.get('/images', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Query required' });
      return;
    }

    res.json({
      query: q,
      images: [],
      fallback: true,
      message: 'Image search via DuckDuckGo - click below to view',
      externalSearchUrl: `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`,
    });
    return;

  } catch (err: any) {
    console.error('Image search error:', err);
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    res.json(imageFallbackResponse(query, `Image search temporarily unavailable: ${err.message || 'unknown error'}`));
  }
});

/**
 * AI Deep Research (Powered by You.com Agentic Research API)
 * POST /search/deep-research
 */
router.post('/deep-research', async (req, res) => {
  try {
    const { query, effort = 'standard' } = req.body;
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!query) {
      res.status(400).json({ error: 'Query required' });
      return;
    }

    // Verify auth
    if (token) {
      try {
        await admin.auth().verifyIdToken(token);
      } catch {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
    }

    const youcomKey = process.env.YOUCOM_API_KEY;

    if (!youcomKey) {
      res.status(503).json({ error: 'Research service not configured' });
      return;
    }

    console.log(`[Research] Starting agentic research for: "${query}" (effort: ${effort})`);
    const response = await fetch('https://api.you.com/v1/research', {
      method: 'POST',
      headers: {
        'X-API-Key': youcomKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: query,
        research_effort: effort
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Research API error: ${response.status}`);
    }

    const data = await response.json();
    const output = data.output || {};

    res.json({
      query,
      analysis: output.content || '',
      sources: output.sources || [],
      type: 'deep_research',
      timestamp: new Date().toISOString(),
      sourceCount: output.sources?.length || 0,
      provider: 'youcom_agent'
    });
  } catch (err: any) {
    console.error('Deep research error:', err);
    res.status(500).json({ error: 'Research failed', detail: err.message });
  }
});

/**
 * URL Content Crawler (Powered by You.com Contents API)
 * POST /search/crawl
 */
router.post('/crawl', async (req, res) => {
  try {
    const { urls, formats = ['markdown'], timeout = 10 } = req.body;
    const youcomKey = process.env.YOUCOM_API_KEY;

    if (!urls || !Array.isArray(urls)) {
      res.status(400).json({ error: 'Array of URLs required' });
      return;
    }

    if (!youcomKey) {
      res.status(503).json({ error: 'Crawler service not configured' });
      return;
    }

    console.log(`[Crawler] Crawling ${urls.length} URLs...`);
    const response = await fetch('https://ydc-index.io/v1/contents', {
      method: 'POST',
      headers: {
        'X-API-Key': youcomKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        urls,
        formats,
        crawl_timeout: timeout
      })
    });

    if (!response.ok) {
      throw new Error(`Contents API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('Crawl error:', err);
    res.status(500).json({ error: 'Crawl failed', detail: err.message });
  }
});

export default router;
