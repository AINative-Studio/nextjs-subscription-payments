/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['jsonwebtoken', 'bcryptjs', 'pg']
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'crypto' and other Node.js modules on the client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
