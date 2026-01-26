import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { env } from "./env"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the correct base URL for the current environment
 * This function is specifically designed to fix authentication redirect issues
 * 
 * @param origin - Optional origin from request headers to ensure same-environment redirects
 * @returns The base URL for the current environment
 */
export function getBaseUrl(origin?: string | null): string {
  // If origin is provided (from request headers), use it
  if (origin) {
    return origin.replace(/\/$/, ''); // Remove trailing slash
  }

  // Check if we're in development/localhost
  if (typeof window !== 'undefined') {
    // Client-side: use window.location.origin
    return window.location.origin;
  }

  // Server-side: use environment variable or fallback
  if (env.NEXT_PUBLIC_SITE_URL) {
    return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''); // Remove trailing slash
  }

  // Fallback to the known production URL
  return 'https://kaattaal.ai.in';
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}