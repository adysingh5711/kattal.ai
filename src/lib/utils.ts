import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the correct base URL for the current environment
 * This function is specifically designed to fix authentication redirect issues
 * where users were being redirected to localhost:3000 instead of the production URL
 * 
 * @returns The base URL for the current environment
 */
export function getBaseUrl(): string {
  // FORCE PRODUCTION URL for authentication redirects
  // This ensures Google OAuth always works with the correct callback URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''); // Remove trailing slash
  }

  // Fallback to the known production URL
  return 'https://kattal-ai.vercel.app';
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}