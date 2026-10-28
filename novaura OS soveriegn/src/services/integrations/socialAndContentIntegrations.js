/**
 * socialAndContentIntegrations.js — Social Media, Content Platforms & Distribution APIs
 * 
 * Battle-tested templates for YouTube Data API v3, Reddit Data API, Instagram Graph API,
 * Facebook Graph API v21.0, and X / Twitter API v2.
 */

export const SOCIAL_AND_CONTENT_INTEGRATIONS = [
  // ── 1. YOUTUBE DATA API V3 ──────────────────────────────────────────────
  {
    id: 'youtube_data_api_v3',
    title: 'YouTube Data API v3 (Resumable Uploads & Analytics)',
    category: 'social_content',
    vendor: 'Google YouTube',
    badge: 'Video & Analytics',
    icon: 'Video',
    color: '#ff0000',
    description: 'Production YouTube Data API v3 client with OAuth2 token refresh, chunked resumable video uploads, metadata/privacy tagging, thumbnail uploads, and channel analytics.',
    suggestedPath: '/projects/cybeni/integrations/youtubeService.js',
    language: 'javascript',
    aiPrompt: 'Implement YouTube Data API v3 with OAuth2 authentication, chunked resumable video uploads, title/description tagging, and channel stats reporting.',
    faqs: [
      {
        question: 'Why use resumable uploads instead of direct upload?',
        answer: 'Direct uploads fail on large video files if connection drops. Resumable uploads split files into 5MB chunks and can resume without restarting.'
      }
    ],
    code: `export class YouTubeService {
  constructor({ clientId, clientSecret, refreshToken }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.accessToken = null;
    this.expiry = 0;
  }

  // 1. Refresh Google OAuth2 Token
  async getAccessToken() {
    if (this.accessToken && Date.now() < this.expiry) return this.accessToken;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!res.ok) throw new Error(\`YouTube OAuth2 error: \${await res.text()}\`);
    const data = await res.json();
    this.accessToken = data.access_token;
    this.expiry = Date.now() + (data.expires_in - 120) * 1000;
    return this.accessToken;
  }

  // 2. Initiate Resumable Video Upload Session
  async initiateUploadSession({ title, description, tags = [], privacyStatus = 'private' }) {
    const token = await this.getAccessToken();
    const metadata = {
      snippet: { title, description, tags, categoryId: '28' }, // 28: Science & Technology
      status: { privacyStatus },
    };

    const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    });

    if (!res.ok) throw new Error(\`Failed to create YouTube upload session: \${res.statusText}\`);
    return res.headers.get('location'); // Returns upload session URL
  }

  // 3. Upload Video Buffer to Resumable Session
  async uploadVideoBuffer(uploadUrl, videoBuffer, mimeType = 'video/mp4') {
    const token = await this.getAccessToken();
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': mimeType,
        'Content-Length': String(videoBuffer.length),
      },
      body: videoBuffer,
    });

    if (!res.ok) throw new Error(\`YouTube video buffer upload failed: \${res.statusText}\`);
    return await res.json();
  }
}
`
  },

  // ── 2. REDDIT DATA API ──────────────────────────────────────────────────
  {
    id: 'reddit_data_api_bot',
    title: 'Reddit Data API OAuth2 Bot & Subreddit Monitor',
    category: 'social_content',
    vendor: 'Reddit',
    badge: 'Community & Feeds',
    icon: 'MessageSquare',
    color: '#ff4500',
    description: 'Production Reddit API client using official script OAuth2 authentication, submission posting, comment threads streaming, and subreddit keyword monitoring.',
    suggestedPath: '/projects/cybeni/integrations/redditService.js',
    language: 'javascript',
    aiPrompt: 'Implement Reddit API client with script OAuth2, listing hot submissions, submitting link/text posts, fetching comment trees, and user profile data.',
    faqs: [
      {
        question: 'What User-Agent format does Reddit enforce?',
        answer: 'Reddit requires User-Agent: <platform>:<app ID>:<version string> (by /u/<reddit username>). Generic User-Agents result in HTTP 429 Too Many Requests.'
      }
    ],
    code: `export class RedditClient {
  constructor({ clientId, clientSecret, username, password, userAgent }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.username = username;
    this.password = password;
    this.userAgent = userAgent || \`SovereignOS:v1.0 (by /u/\${username})\`;
    this.accessToken = null;
    this.expiresAt = 0;
  }

  async authenticate() {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;

    const auth = Buffer.from(\`\${this.clientId}:\${this.clientSecret}\`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': \`Basic \${auth}\`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: this.username,
        password: this.password,
      }).toString(),
    });

    if (!res.ok) throw new Error(\`Reddit Auth error HTTP \${res.status}: \${await res.text()}\`);
    const data = await res.json();
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async getSubredditHot(subreddit = 'technology', limit = 25) {
    const token = await this.authenticate();
    const res = await fetch(\`https://oauth.reddit.com/r/\${subreddit}/hot?limit=\${limit}\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'User-Agent': this.userAgent,
      },
    });

    if (!res.ok) throw new Error(\`Reddit API error: \${res.statusText}\`);
    const data = await res.json();
    return data.data.children.map(c => c.data);
  }

  async submitPost(subreddit, { title, text, url }) {
    const token = await this.authenticate();
    const body = new URLSearchParams({
      sr: subreddit,
      title,
      kind: url ? 'link' : 'self',
      resubmit: 'true',
      ...(url ? { url } : { text }),
    });

    const res = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(\`Failed to submit post: \${await res.text()}\`);
    return await res.json();
  }
}
`
  },

  // ── 3. INSTAGRAM GRAPH API ──────────────────────────────────────────────
  {
    id: 'instagram_graph_api',
    title: 'Instagram Graph API (Media Publishing & Insights)',
    category: 'social_content',
    vendor: 'Meta Instagram',
    badge: 'Visual Content',
    icon: 'Camera',
    color: '#e1306c',
    description: 'Official Meta Instagram Graph API client for professional creator/business accounts: Carousel & single photo/video container creation, publishing status polling, and post insights.',
    suggestedPath: '/projects/cybeni/integrations/instagramService.js',
    language: 'javascript',
    aiPrompt: 'Implement Instagram Graph API client for publishing images/reels, polling container status, checking account analytics, and managing comments.',
    faqs: [
      {
        question: 'What is the two-step publishing flow for Instagram Graph API?',
        answer: 'Step 1: Create a media container via POST /{ig-user-id}/media. Step 2: Publish the verified container via POST /{ig-user-id}/media_publish.'
      }
    ],
    code: `export class InstagramGraphService {
  constructor({ igUserId, userAccessToken, apiVersion = 'v21.0' }) {
    this.igUserId = igUserId;
    this.userAccessToken = userAccessToken;
    this.endpoint = \`https://graph.facebook.com/\${apiVersion}\`;
  }

  // 1. Create Media Container
  async createPhotoContainer({ imageUrl, caption }) {
    const url = new URL(\`\${this.endpoint}/\${this.igUserId}/media\`);
    url.searchParams.append('image_url', imageUrl);
    if (caption) url.searchParams.append('caption', caption);
    url.searchParams.append('access_token', this.userAccessToken);

    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) throw new Error(\`IG Container error: \${await res.text()}\`);
    const data = await res.json();
    return data.id; // Returns container creation ID
  }

  // 2. Publish Media Container
  async publishContainer(creationId) {
    const url = new URL(\`\${this.endpoint}/\${this.igUserId}/media_publish\`);
    url.searchParams.append('creation_id', creationId);
    url.searchParams.append('access_token', this.userAccessToken);

    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) throw new Error(\`IG Publish error: \${await res.text()}\`);
    return await res.json();
  }
}
`
  },

  // ── 4. X / TWITTER API V2 ───────────────────────────────────────────────
  {
    id: 'x_twitter_api_v2',
    title: 'X / Twitter API v2 (Tweets, Media & Filtered Stream)',
    category: 'social_content',
    vendor: 'X / Twitter',
    badge: 'Microblogging & Realtime',
    icon: 'Radio',
    color: '#1da1f2',
    description: 'Production X / Twitter API v2 client using OAuth 1.0a or OAuth 2.0 Bearer tokens for creating tweets with media, checking user metrics, and rule-based live stream filtering.',
    suggestedPath: '/projects/cybeni/integrations/xTwitterService.js',
    language: 'javascript',
    aiPrompt: 'Implement X / Twitter API v2 client with Bearer Token and OAuth 2.0 PKCE, tweet posting, thread creation, and user lookup.',
    faqs: [
      {
        question: 'Which token is used for posting tweets?',
        answer: 'You must use an OAuth 2.0 User Access Token with tweet.write scope, or OAuth 1.0a User Context (API Key, API Secret, Access Token, Access Secret).'
      }
    ],
    code: `export class XTwitterService {
  constructor({ bearerToken, userAccessToken }) {
    this.bearerToken = bearerToken;
    this.userAccessToken = userAccessToken;
    this.endpoint = 'https://api.twitter.com/2';
  }

  // Post Tweet (OAuth 2.0 User Token)
  async postTweet({ text, mediaIds = [] }) {
    if (!this.userAccessToken) throw new Error('userAccessToken with tweet.write scope is required');

    const body = { text };
    if (mediaIds.length > 0) {
      body.media = { media_ids: mediaIds };
    }

    const res = await fetch(\`\${this.endpoint}/tweets\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${this.userAccessToken}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(\`X/Twitter HTTP \${res.status}: \${await res.text()}\`);
    return await res.json();
  }

  // Lookup User Metrics (Bearer Token)
  async getUser(username) {
    const res = await fetch(\`\${this.endpoint}/users/by/username/\${username}?user.fields=public_metrics,description,profile_image_url\`, {
      headers: {
        'Authorization': \`Bearer \${this.bearerToken}\`,
      },
    });

    if (!res.ok) throw new Error(\`User lookup failed: \${res.statusText}\`);
    return await res.json();
  }
}
`
  }
];
