import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merge conditional class names with Tailwind conflict resolution.
// Standard shadcn/ui helper — imported as `cn` across src/components/ui/*.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
