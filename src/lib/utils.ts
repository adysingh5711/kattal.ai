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
 * @param request - The incoming request object (optional)
 * @returns The base URL for the current environment
 */
export function getBaseUrl(request?: Request): string {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  // In production, use the configured site URL or fallback to request headers
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // Fallback to request headers if available
  if (request) {
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
    if (host) {
      return `https://${host}`;
    }
  }

  // Final fallback to the known production URL
  return 'https://kaattal-ai.vercel.app';
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}