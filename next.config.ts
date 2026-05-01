import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ws is a Node.js-only native module; bundling it with webpack breaks server routes.
  serverExternalPackages: ["ws"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.scdn.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.evbuc.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.evbuc.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s1.ticketm.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.ticketm.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "boletia.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.boletia.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.sk-static.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.sk-static.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
