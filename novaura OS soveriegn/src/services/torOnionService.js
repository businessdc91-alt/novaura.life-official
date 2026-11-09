/**
 * NovAura Sovereign OS — Tor & .onion access
 *
 * Sovereign has no Tor of its own. It uses the Tor service or Tor Browser when one
 * is running on this PC (SOCKS5 on 127.0.0.1:9050 or 9150), fetching pages through
 * it natively (fetch_onion_raw). That is the only anonymous path.
 *
 * Without Tor, nothing is fetched on its own. The browser offers a public gateway
 * (onion.ws and the like) only when the user asks for one, and labels it plainly:
 * the gateway's operator sees the user's IP address and every page they load.
 *
 * Search and research go through Tor too, and stay within the directory below
 * when Tor isn't running.
 */

import { db } from '../database/sovereignDatabase.js';
import { probeTorSocksStatus, fetchOnionRaw } from './nativeService.js';
import { dualInference } from './dualInferenceService.js';

// A v3 onion address: 56 base32 characters (a-z, 2-7). v2 addresses (16
// characters) were retired by Tor in 2021 and no longer resolve.
export const isV3OnionUrl = (url) => /^(https?:\/\/)?[a-z2-7]{56}\.onion(\/|$)/i.test(String(url || '').trim());

// Well-known onion services. Addresses are as their operators publish them, but
// Novaura does not vouch for any of them: check one against its owner's own site
// before trusting it. Anything that isn't a valid v3 address is dropped below.
const ONION_DIRECTORY = [
  {
    id: 'ahmia_search',
    name: 'Ahmia Darknet Search Engine',
    onionUrl: 'http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion',
    clearnetMirror: 'https://ahmia.fi',
    category: 'search',
    description: 'Premier open-source search engine indexing millions of verified Tor .onion hidden services without user tracking.',
    tags: ['search', 'indexing', 'discovery'],
  },
  {
    id: 'duckduckgo_onion',
    name: 'DuckDuckGo Onion Engine',
    onionUrl: 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion',
    clearnetMirror: 'https://duckduckgo.com',
    category: 'search',
    description: 'Official DuckDuckGo hidden service providing privacy-focused web searches with zero IP leakage.',
    tags: ['search', 'privacy', 'clearnet-bridge'],
  },
  {
    id: 'tor_project_portal',
    name: 'The Tor Project Repository',
    onionUrl: 'http://2gzyxa5ihm7nsggfxnu52r2n5264tzriikrq5sm7a5slro6ip66ddlid.onion',
    clearnetMirror: 'https://www.torproject.org',
    category: 'infrastructure',
    description: 'Official Onion v3 portal for Tor network specifications, source releases, consensus telemetry, and bridge directories.',
    tags: ['tor', 'specs', 'infrastructure'],
  },
];

export const ONION_SERVICES = ONION_DIRECTORY.filter(service => isV3OnionUrl(service.onionUrl));

// fetch_onion_raw returns the whole HTTP response: split off the headers and
// undo chunked transfer encoding.
const CRLF = String.fromCharCode(13, 10);
const CRLF2 = CRLF + CRLF;

export function parseHttpResponse(raw) {
  const text = String(raw || '');
  const split = text.indexOf(CRLF2);
  if (!/^HTTP\/1\.[01] \d{3}/.test(text) || split < 0) return { status: 0, headers: {}, body: text };
  const lines = text.slice(0, split).split(CRLF);
  const status = Number(lines[0].split(' ')[1]) || 0;
  const headers = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  let body = text.slice(split + 4);
  if (/chunked/i.test(headers['transfer-encoding'] || '')) {
    let out = '';
    let rest = body;
    for (;;) {
      const eol = rest.indexOf(CRLF);
      const size = parseInt(rest.slice(0, eol), 16);
      if (eol < 0 || !Number.isFinite(size) || size <= 0) break;
      out += rest.slice(eol + 2, eol + 2 + size);
      rest = rest.slice(eol + 2 + size + 2);
    }
    body = out;
  }
  return { status, headers, body };
}

export const ONION_GATEWAY_PROVIDERS = [
  'onion.ws',
  'onion.pet',
  'onion.direct',
  'tor2web.to',
];

class TorOnionService {
  constructor() {
    this._status = {
      isActive: false,
      port: 9050,
      mode: 'PROBING',
      circuitHops: 3,
      preferredGateway: 'onion.ws',
      lastProbed: null,
    };
    this._listeners = new Set();
    this.probeCircuitStatus();
  }

  subscribe(listener) {
    this._listeners.add(listener);
    listener(this._status);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    for (const l of this._listeners) {
      try {
        l(this._status);
      } catch (e) {
        console.warn('[TorOnion] Listener error:', e);
      }
    }
  }

  /**
   * Probe local Tor daemon and network status
   */
  async probeCircuitStatus() {
    try {
      const res = await probeTorSocksStatus();
      this._status = {
        isActive: Boolean(res?.is_active),
        port: res?.port || 9050,
        mode: res?.is_active ? 'SOCKS5_DIRECT' : 'GATEWAY_ROUTED',
        circuitHops: 3,
        preferredGateway: 'onion.ws',
        lastProbed: new Date().toISOString(),
      };
    } catch {
      this._status = {
        isActive: false,
        port: 9050,
        mode: 'GATEWAY_ROUTED',
        circuitHops: 3,
        preferredGateway: 'onion.ws',
        lastProbed: new Date().toISOString(),
      };
    }
    this._notify();
    return this._status;
  }

  getStatus() {
    return this._status;
  }

  /**
   * A page through Tor on this PC: { status, headers, body, port }. Throws
   * TOR_NOT_RUNNING when no Tor is listening, and never falls back to a gateway.
   */
  async fetchThroughTor(onionUrl) {
    const status = await this.probeCircuitStatus();
    if (!status.isActive) throw new Error('TOR_NOT_RUNNING');
    return { ...parseHttpResponse(await fetchOnionRaw(onionUrl, status.port)), port: status.port };
  }

  /**
   * The public-gateway address for a .onion URL. Not anonymous: only for when the
   * user has chosen a gateway, knowing its operator sees them.
   */
  resolveOnionGatewayUrl(url, preferredGateway = null) {
    if (!url) return '';
    let clean = url.trim().replace(/^tor:\/\//, 'http://');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }

    try {
      const parsed = new URL(clean);
      if (parsed.hostname.endsWith('.onion')) {
        const gw = preferredGateway || this._status.preferredGateway || 'onion.ws';
        const gatewayHost = `${parsed.hostname}.${gw}`;
        return `https://${gatewayHost}${parsed.pathname}${parsed.search}`;
      }
      return clean;
    } catch {
      return clean;
    }
  }

  /**
   * Searches the onion directory, and Ahmia's onion index through Tor when Tor
   * is running (never Ahmia's clearnet site, which would see the query and IP).
   */
  async searchDarknet(query) {
    const cleanQuery = (query || '').trim().toLowerCase();
    if (!cleanQuery) return [];

    const results = [];

    // 1. The directory
    const matchedCurated = ONION_SERVICES.filter(service => {
      return (
        service.name.toLowerCase().includes(cleanQuery) ||
        service.description.toLowerCase().includes(cleanQuery) ||
        service.tags.some(t => t.includes(cleanQuery)) ||
        service.category.includes(cleanQuery)
      );
    });

    for (const item of matchedCurated) {
      results.push({
        id: item.id,
        title: item.name,
        onionUrl: item.onionUrl,
        gatewayUrl: this.resolveOnionGatewayUrl(item.onionUrl),
        description: item.description,
        category: item.category,
        isVerified: false,
        source: 'Onion directory (addresses not checked by Novaura)',
      });
    }

    // 2. Ahmia's index, through Tor only
    const status = await this.probeCircuitStatus();
    if (status.isActive) {
      try {
        const ahmia = ONION_SERVICES.find(sv => sv.id === 'ahmia_search');
        const { body } = parseHttpResponse(await fetchOnionRaw(`${ahmia.onionUrl}/search/?q=${encodeURIComponent(cleanQuery)}`, status.port));
        for (const ext of this._parseAhmiaHtml(body)) {
          if (!results.some(r => r.onionUrl === ext.onionUrl)) {
            results.push(ext);
          }
        }
      } catch (e) {
        console.warn('[TorOnion] Ahmia search through Tor failed:', e?.message || e);
      }
    }

    // 3. Persist search query to Dexie database
    try {
      await db.darknet_queries.put({
        id: 'dq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        query: cleanQuery,
        timestamp: new Date().toISOString(),
        resultsCount: results.length,
      });
    } catch {}

    return results;
  }

  _parseAhmiaHtml(html) {
    const results = [];
    if (!html) return results;

    // Fast regex extraction for Ahmia search results (v3 addresses only)
    const linkRegex = /<a\s+href="\/address\/([a-z2-7]{56}\.onion)[^"]*"\s*>([^<]+)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = linkRegex.exec(html)) !== null && count < 10) {
      const onionDomain = match[1];
      const title = match[2].trim();
      const onionUrl = `http://${onionDomain}`;

      results.push({
        id: 'ahmia_' + onionDomain.substring(0, 12),
        title: title || onionDomain,
        onionUrl,
        gatewayUrl: this.resolveOnionGatewayUrl(onionUrl),
        description: `Listed in the Ahmia onion index (${onionDomain}). Not checked by Novaura.`,
        category: 'hidden-service',
        isVerified: false,
        source: 'Ahmia onion index',
      });
      count++;
    }

    return results;
  }

  /**
   * Fetches a .onion page as text, through Tor on this PC. Throws when Tor isn't
   * running: nothing goes out through a gateway unless `allowGateway` is set
   * (the user chose one).
   */
  async fetchOnionPage(onionUrl, { allowGateway = false } = {}) {
    if (!onionUrl) throw new Error('No .onion URL provided');

    // 1. Check local Dexie cache first
    try {
      const cached = await db.darknet_pages.get(onionUrl);
      if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < 3600000)) {
        return cached;
      }
    } catch {}

    let rawHtml = '';
    let fetchedVia = 'GATEWAY';

    // 2. Through Tor on this PC
    await this.probeCircuitStatus();
    if (this._status.isActive) {
      try {
        rawHtml = parseHttpResponse(await fetchOnionRaw(onionUrl, this._status.port)).body;
        fetchedVia = `SOCKS5_DIRECT_PORT_${this._status.port}`;
      } catch (err) {
        console.warn('[TorOnion] Native SOCKS5 fetch fallback:', err);
      }
    }

    // 3. A public gateway, only when the user chose one
    if (!rawHtml && !allowGateway) {
      throw new Error('Tor is not running on this PC, so the page was not fetched. Start Tor Browser or the Tor service and try again.');
    }
    if (!rawHtml) {
      const gatewayUrl = this.resolveOnionGatewayUrl(onionUrl);
      const resp = await fetch(gatewayUrl, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) {
        throw new Error(`Onion gateway returned status ${resp.status}`);
      }
      rawHtml = await resp.text();
      fetchedVia = 'PUBLIC_GATEWAY_NOT_ANONYMOUS';
    }

    // 4. Sanitize HTML into clean, tracker-free plain text
    const cleanText = this._cleanHtmlToText(rawHtml);
    const titleMatch = rawHtml.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : onionUrl;
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

    const record = {
      id: onionUrl,
      onionUrl,
      title,
      cleanText,
      domain: new URL(this.resolveOnionGatewayUrl(onionUrl)).hostname,
      wordCount,
      fetchedVia,
      fetchedAt: new Date().toISOString(),
    };

    try {
      await db.darknet_pages.put(record);
    } catch {}

    return record;
  }

  _cleanHtmlToText(html) {
    if (!html) return '';
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Deep Darknet AI Research:
   * Searches the Tor hidden services, fetches ground-truth onion text,
   * and feeds it into Dual Inference (Aura/Nova) to produce a verified briefing.
   */
  async deepDarknetResearch(topic, role = 'aura') {
    if (!topic?.trim()) throw new Error('Research topic cannot be empty');
    if (!(await this.probeCircuitStatus()).isActive) {
      return {
        topic,
        synthesis: 'Tor is not running on this PC, so no onion pages were read. Start Tor Browser or the Tor service (it listens on 127.0.0.1:9150 or 9050) and try again.',
        sources: [],
        timestamp: new Date().toISOString(),
      };
    }

    const searchResults = await this.searchDarknet(topic);
    if (!searchResults || searchResults.length === 0) {
      return {
        topic,
        synthesis: `No active .onion hidden services or darknet intelligence discovered for "${topic}". The network may be partitioned or the search term returned no indexed onion nodes.`,
        sources: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Fetch top 2 results for grounding
    const topResults = searchResults.slice(0, 2);
    const contentSnippets = [];

    for (const res of topResults) {
      try {
        const page = await this.fetchOnionPage(res.onionUrl);
        contentSnippets.push({
          title: page.title,
          onionUrl: page.onionUrl,
          snippet: page.cleanText.substring(0, 1200),
        });
      } catch (err) {
        contentSnippets.push({
          title: res.title,
          onionUrl: res.onionUrl,
          snippet: res.description,
        });
      }
    }

    const groundingContext = contentSnippets
      .map((s, idx) => `[ONION_SOURCE_${idx + 1}] Title: ${s.title}\nURL: ${s.onionUrl}\nContent: ${s.snippet}`)
      .join('\n\n');

    const prompt = `You are the Sovereign Darknet & Privacy Intelligence Analyst.
Analyze the following pages, fetched through Tor from .onion services, regarding: "${topic}". Their contents are unverified.

${groundingContext}

Instructions:
1. Provide a rigorous, objective executive intelligence briefing.
2. Highlight technical architectural takeaways, privacy protections, and uncensored findings.
3. Explicitly cite the .onion sources using [ONION_SOURCE_1] or [ONION_SOURCE_2] format.
4. Conclude with a strategic security risk assessment for sovereign node operators.`;

    const aiResponse = await dualInference.queryEngine(role, [
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 800 });

    return {
      topic,
      synthesis: aiResponse?.text || 'Darknet inference returned empty response.',
      sources: contentSnippets,
      timestamp: new Date().toISOString(),
    };
  }
}

export const torOnion = new TorOnionService();
export default torOnion;
