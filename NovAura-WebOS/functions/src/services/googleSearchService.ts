import { google } from 'googleapis';
import { secretService } from './secretService';

/**
 * GoogleSearchService
 * Provides unified access to Google Custom Search and YouTube Data APIs.
 * Supports Web, Images, Videos, and YouTube-specific searches.
 */
export class GoogleSearchService {
  private static instance: GoogleSearchService;
  
  private constructor() {}

  public static getInstance(): GoogleSearchService {
    if (!GoogleSearchService.instance) {
      GoogleSearchService.instance = new GoogleSearchService();
    }
    return GoogleSearchService.instance;
  }

  /**
   * General Web Search (Labeled "Google")
   */
  async searchWeb(query: string) {
    const apiKey = await secretService.getSecret('GOOGLE_API_KEY');
    const cx = await secretService.getSecret('GOOGLE_SEARCH_CX');

    if (!apiKey || !cx) {
      throw new Error('Google Search API not configured');
    }

    const customsearch = google.customsearch('v1');
    const res = await customsearch.cse.list({
      auth: apiKey,
      cx: cx,
      q: query,
    });

    return (res.data.items || []).map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      displayUrl: item.displayLink
    }));
  }

  /**
   * Image Search
   */
  async searchImages(query: string) {
    const apiKey = await secretService.getSecret('GOOGLE_API_KEY');
    const cx = await secretService.getSecret('GOOGLE_SEARCH_CX');

    if (!apiKey || !cx) {
      throw new Error('Google Image Search API not configured');
    }

    const customsearch = google.customsearch('v1');
    const res = await customsearch.cse.list({
      auth: apiKey,
      cx: cx,
      q: query,
      searchType: 'image',
    });

    return (res.data.items || []).map(item => ({
      title: item.title,
      url: item.link,
      thumbnail: item.image?.thumbnailLink || item.link,
      source: item.image?.contextLink || item.link,
      dimensions: `${item.image?.width}x${item.image?.height}`
    }));
  }

  /**
   * General Video Search (Non-YouTube specific or broad)
   */
  async searchVideos(query: string) {
    const apiKey = await secretService.getSecret('GOOGLE_API_KEY');
    const cx = await secretService.getSecret('GOOGLE_SEARCH_CX');

    if (!apiKey || !cx) {
      throw new Error('Google Video Search API not configured');
    }

    // Google Custom Search doesn't have a direct 'video' type like images,
    // so we search for video content across the web.
    const customsearch = google.customsearch('v1');
    const res = await customsearch.cse.list({
      auth: apiKey,
      cx: cx,
      q: `${query} filetype:mp4 OR site:vimeo.com OR site:dailymotion.com`,
    });

    return (res.data.items || []).map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      displayUrl: item.displayLink,
      thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.videoobject?.[0]?.thumbnailurl
    }));
  }

  /**
   * YouTube Specialized Search
   */
  async searchYouTube(query: string) {
    const apiKey = await secretService.getSecret('GOOGLE_API_KEY');
    
    if (!apiKey) {
      throw new Error('YouTube API not configured');
    }

    const youtube = google.youtube('v3');
    const res = await youtube.search.list({
      auth: apiKey,
      part: ['snippet'],
      q: query,
      type: ['video'],
      maxResults: 12,
      relevanceLanguage: 'en'
    });

    return (res.data.items || []).map(item => ({
      id: item.id?.videoId,
      title: item.snippet?.title,
      description: item.snippet?.description,
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
      channelTitle: item.snippet?.channelTitle,
      channelId: item.snippet?.channelId,
      publishedAt: item.snippet?.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`
    }));
  }
}

export const googleSearchService = GoogleSearchService.getInstance();
