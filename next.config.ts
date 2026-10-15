import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;

// Em `next dev`, expõe os bindings do wrangler.jsonc (D1 local em .wrangler/state)
initOpenNextCloudflareForDev();
