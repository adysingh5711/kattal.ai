import type { NextConfig } from "next";
import { env } from "./src/lib/env";

const nextConfig: NextConfig = {

  env: {
    // Expose only public Supabase variables to client-side
    // DATABASE_URL is NOT exposed - it contains sensitive database connection string
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  },
};

export default nextConfig;
