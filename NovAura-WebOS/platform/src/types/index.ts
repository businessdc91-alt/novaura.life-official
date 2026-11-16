export * from './user';
export * from './asset';
export * from './royalty';
export * from './community';
export * from './communication';

// Common Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// Cart Types
export interface CartItem {
  assetId: string;
  asset: any; // Using any here to avoid circularity if needed, but it should be Asset
  addedAt: string;
  customPrice?: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

// Wishlist Types
export interface WishlistItem {
  id: string;
  assetId: string;
  asset: any; // Same as above
  createdAt: string;
}
