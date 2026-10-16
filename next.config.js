const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pg-native');
    }
    return config;
  },
  async rewrites() {
    // When deploying frontend on Vercel with dedicated Render backend API:
    const backendApiUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (backendApiUrl && backendApiUrl.startsWith('http')) {
      console.log(`[ShopSync Proxy] Forwarding /api/* requests to Render backend: ${backendApiUrl.replace(/\/$/, '')}`);
      return [
        {
          source: '/api/:path*',
          destination: `${backendApiUrl.replace(/\/$/, '')}/api/:path*`,
        },
      ];
    }
    if (process.env.VERCEL === '1') {
      console.warn('⚠️ [Vercel Deployment Alert] BACKEND_API_URL is not configured in Vercel environment variables.');
      console.warn('   Ensure BACKEND_API_URL=https://shopsync-api.onrender.com is added to your Vercel Project Settings.');
    }
    return [];
  },
  async headers() {
    const frontendUrl = process.env.FRONTEND_URL || '*';
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: frontendUrl },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Idempotency-Key, x-idempotency-key' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
