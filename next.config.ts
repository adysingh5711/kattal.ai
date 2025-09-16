import type { NextConfig } from "next";
import { env } from "./src/lib/env";

const nextConfig: NextConfig = {
  eslint: {
    // Allow build to succeed even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  env: {
    // Expose only public Supabase variables to client-side
    // DATABASE_URL is NOT exposed - it contains sensitive database connection string
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
};

export default nextConfig;
