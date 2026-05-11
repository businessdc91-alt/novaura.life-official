# You.com Search API Reference (ydc-index.io)

This document serves as the primary reference for the NovAura Search Engine integration.

## API Endpoint

- **Base URL**: `https://ydc-index.io/v1/search`
- **Headers**: `X-API-Key: <YOUR_API_KEY>`

## Key Features

### 1. Livecrawl

Add `livecrawl` to any search request to get the full page content in markdown or HTML.

- **Parameters**:
  - `livecrawl`: `web`, `news`, or `all`
  - `livecrawl_formats`: `markdown` (recommended for LLMs) or `html`
  - `crawl_timeout`: 1-60 seconds (default 10)

### 2. Unified Results

The API returns both web pages and news articles based on query intent.

- **Response Structure**:

  ```json
  {
    "results": {
      "web": [ ... ],
      "news": [ ... ]
    },
    "metadata": { ... }
  }
  ```

### 3. LLM-Optimized Output

- **Snippets**: Pre-extracted relevant text excerpts.
- **Descriptions**: Clean summaries.
- **Markdown**: Clean, LLM-ready markdown content (strips navigation, ads, etc.).

## Search Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | string | Search query (supports operators like `site:`, `filetype:`, `+`, `-`) |
| `count` | integer | Max results per section (max 100) |
| `freshness` | string | `day`, `week`, `month`, `year`, or YYYY-MM-DDtoYYYY-MM-DD |
| `country` | string | ISO 3166-2 country code (e.g., US) |
| `language` | string | BCP 47 language code (e.g., EN) |
| `safesearch` | string | `off`, `moderate`, `strict` |

## NovAura Implementation Strategy

1. **Primary Provider**: You.com (ydc-index.io).
2. **AI Integration**: Use `livecrawl=all` and `livecrawl_formats=markdown` for deep research and RAG tasks.
3. **Data Mapping**: Ensure both `web` and `news` arrays are processed and presented to the user.
4. **Fallback**: Maintain DuckDuckGo (duck-duck-scrape) as a silent secondary provider.
