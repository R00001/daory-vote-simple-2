import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "aurorians.cdn.aurory.io",
        pathname: "/aurorians-v2/**",
      },
    ],
  },
};

export default nextConfig;
