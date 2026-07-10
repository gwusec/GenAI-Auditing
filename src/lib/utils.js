import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// cn — merge conditional class names, with later Tailwind utilities winning over
// earlier conflicting ones (the shadcn/ui convention).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
