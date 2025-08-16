import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow build to succeed even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  env: {
    // Expose only public Supabase variables to client-side
    // DATABASE_URL is NOT exposed - it contains sensitive database connection string
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
};

export default nextConfig;
