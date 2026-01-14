import type { NextConfig } from "next";
import { loadEnvConfig } from '@next/env';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

console.log("Next Config Env Check:", {
    API: process.env.NEXT_PUBLIC_API_URL,
    WS: process.env.NEXT_PUBLIC_WS_URL
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
};

export default nextConfig;
