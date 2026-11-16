import type { Category, CreatorStats, Review, Order, Royalty } from '@/types';

export const platformCategories: Category[] = [
  { id: '1', name: 'Avatars & Characters', slug: 'avatars-characters', icon: 'User', description: 'VRM models, rigged characters, and modular humans', sortOrder: 1, assetCount: 0 },
  { id: '2', name: 'Armor & Gear', slug: 'armor-gear', icon: 'Shirt', description: 'Wearable items, tactical gear, and accessories', sortOrder: 2, assetCount: 0 },
  { id: '3', name: 'Weapons', slug: 'weapons', icon: 'Sword', description: 'Melee, ranged, and magical weaponry', sortOrder: 3, assetCount: 0 },
  { id: '4', name: 'Spells & VFX', slug: 'spells-vfx', icon: 'Zap', description: 'Magic effects, particles, and combat visuals', sortOrder: 4, assetCount: 0 },
  { id: '5', name: 'Environments & Nature', slug: 'environments-nature', icon: 'TreePine', description: 'Biomes, plants, and atmospheric assets', sortOrder: 5, assetCount: 0 },
  { id: '6', name: 'Architecture & Props', slug: 'architecture-props', icon: 'Home', description: 'Buildings, furniture, and interior items', sortOrder: 6, assetCount: 0 },
  { id: '7', name: 'Animations', slug: 'animations', icon: 'Move', description: 'Mocap data, combat loops, and emotes', sortOrder: 7, assetCount: 0 },
  { id: '8', name: 'Music & Audio', slug: 'music-audio', icon: 'Music', description: 'Soundtracks, SFX, and voice packs', sortOrder: 8, assetCount: 0 },
  { id: '9', name: 'Scripts & AI', slug: 'scripts-ai', icon: 'Code', description: 'C# / Blueprints, behavior trees, and logic', sortOrder: 9, assetCount: 0 },
  { id: '10', name: 'UI & HUD', slug: 'ui-hud', icon: 'Layout', description: 'Interfaces, icons, and menu systems', sortOrder: 10, assetCount: 0 },
  { id: '11', name: 'Materials & Shaders', slug: 'materials-shaders', icon: 'Layers', description: 'Advanced PBR materials and visual shaders', sortOrder: 11, assetCount: 0 },
  { id: '12', name: 'Full Games & Source', slug: 'full-games', icon: 'Gamepad2', description: 'Project templates and completed logic', sortOrder: 12, assetCount: 0 },
];

export const platformCreatorStats: CreatorStats = {
  totalAssets: 0,
  totalSales: 0,
  totalDownloads: 0,
  totalEarnings: 0,
  pendingRoyalties: 0,
  availableRoyalties: 0,
  lifetimeRoyalties: 0
};

export const platformReviews: Review[] = [];
export const platformOrders: Order[] = [];
export const platformRoyalties: Royalty[] = [];
