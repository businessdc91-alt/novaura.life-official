/**
 * Dev Aura Reader Service
 * "our free assets finder" - Scans external platforms for free resources.
 */

export interface ExternalAsset {
  id: string;
  title: string;
  description: string;
  url: string;
  downloadUrl: string;
  platform: 'github' | 'huggingface' | 'itchio' | 'other';
  author: string;
  tags: string[];
  stars?: number;
  downloads?: number;
  license?: string;
  thumbnail?: string;
}

/**
 * Scans GitHub for free/open-source repositories based on query.
 */
export async function searchGitHub(query: string): Promise<ExternalAsset[]> {
  try {
    // GitHub Search API: q=query+topic:game-assets or similar
    const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+topic:game-development&sort=stars&order=desc`);
    const data = await response.json();
    
    return (data.items || []).map((repo: any) => ({
      id: `gh-${repo.id}`,
      title: repo.name,
      description: repo.description || 'No description provided',
      url: repo.html_url,
      downloadUrl: `${repo.html_url}/releases`,
      platform: 'github',
      author: repo.owner.login,
      tags: [repo.language, 'Open Source'].filter(Boolean),
      stars: repo.stargazers_count,
      license: repo.license?.name || 'Open Source',
      thumbnail: `https://opengraph.githubassets.com/1/${repo.full_name}`
    }));
  } catch (error) {
    console.error('GitHub search failed:', error);
    return [];
  }
}

/**
 * Scans HuggingFace for models, datasets or spaces.
 */
export async function searchHuggingFace(query: string): Promise<ExternalAsset[]> {
  try {
    // HuggingFace API doesn't require key for header searches usually
    const response = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=10`);
    const data = await response.json();
    
    return (data || []).map((model: any) => ({
      id: `hf-${model.id}`,
      title: model.id.split('/').pop() || model.id,
      description: `Tags: ${model.tags?.slice(0, 3).join(', ')}`,
      url: `https://huggingface.co/${model.id}`,
      downloadUrl: `https://huggingface.co/${model.id}/tree/main`,
      platform: 'huggingface',
      author: model.author || model.id.split('/')[0],
      tags: model.tags || [],
      downloads: model.downloads,
      license: 'Check Model Card',
      thumbnail: 'https://huggingface.co/front/assets/huggingface_logo-noborder.svg'
    }));
  } catch (error) {
    console.error('HuggingFace search failed:', error);
    return [];
  }
}

/**
 * Scans itch.io for free assets.
 * Note: Real itch.io search often requires scraping or a specific API key.
 * This implementation provides a specialized search link and some curated mock results.
 */
export async function searchItchIO(query: string): Promise<ExternalAsset[]> {
  // Mocking some itch.io results as their API is limited without OAuth
  // but providing the direct search link is key to the "reader" philosophy.
  const itchResults: ExternalAsset[] = [
    {
      id: 'itch-1',
      title: `${query} Asset Pack (itch.io)`,
      description: `Free high-quality ${query} resources found on itch.io`,
      url: `https://itch.io/game-assets/free/tag-${encodeURIComponent(query.toLowerCase())}`,
      downloadUrl: `https://itch.io/game-assets/free/tag-${encodeURIComponent(query.toLowerCase())}`,
      platform: 'itchio',
      author: 'itch.io community',
      tags: ['Free', 'Asset Pack'],
      thumbnail: 'https://static.itch.io/images/logo-black-new.svg'
    }
  ];
  return itchResults;
}

/**
 * Unified search agent that "scans" all platforms.
 */
export async function scanExternalPlatforms(query: string): Promise<ExternalAsset[]> {
  const [gh, hf, itch] = await Promise.all([
    searchGitHub(query),
    searchHuggingFace(query),
    searchItchIO(query)
  ]);
  
  return [...gh, ...hf, ...itch].sort((a, b) => {
    // Priority: github stars or hf downloads
    const valA = (a.stars || 0) + (a.downloads || 0);
    const valB = (b.stars || 0) + (b.downloads || 0);
    return valB - valA;
  });
}
