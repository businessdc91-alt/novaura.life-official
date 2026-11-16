// Format price from cents to dollars
export const formatPrice = (cents: number): string => {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
};

// Format number with commas
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// Format date
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format relative time
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(dateString);
};

// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Truncate text
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

// Get license badge color
export const getLicenseBadgeClass = (tier: string): string => {
  switch (tier) {
    case 'art_3pct':
      return 'bg-neon-lime/20 text-neon-lime border-neon-lime/30';
    case 'music_1pct':
      return 'bg-neon-violet/20 text-neon-violet border-neon-violet/30';
    case 'integration_10pct':
      return 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30';
    case 'functional_15pct':
      return 'bg-green-500/10 text-green-400 border-green-500/50';
    case 'source_20pct':
      return 'bg-[#ff00ff]/10 text-[#ff00ff] border-[#ff00ff]/50 shadow-[0_0_10px_rgba(255,0,255,0.2)]';
    case 'opensource':
      return 'bg-white/10 text-text-secondary border-white/20';
    default:
      return 'bg-white/10 text-text-secondary border-white/20';
  }
};

// Get license display name
export const getLicenseDisplayName = (tier: string): string => {
  switch (tier) {
    case 'art_3pct':
      return 'Standard Art (3%)';
    case 'music_1pct':
      return 'Music (1%)';
    case 'integration_10pct':
      return 'Deep Integration (10%)';
    case 'functional_15pct':
      return 'Functional Game (15%)';
    case 'source_20pct':
      return 'Full Source (20%)';
    case 'opensource':
      return 'Open Source';
    default:
      return 'Unknown';
  }
};

// Get license short name
export const getLicenseShortName = (tier: string): string => {
  switch (tier) {
    case 'art_3pct':
      return '3%';
    case 'music_1pct':
      return '1%';
    case 'integration_10pct':
      return '10%';
    case 'functional_15pct':
      return '15%';
    case 'source_20pct':
      return '20%';
    case 'opensource':
      return 'OS';
    default:
      return '?';
  }
};
