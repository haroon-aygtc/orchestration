/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages for server components
  serverExternalPackages: [
    '@fast-csv/parse',
    'pdf-parse',
    'nodemailer',
    '@prisma/client',
    'sqlite3',
    'pg'
  ],
  
  // Webpack configuration for Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve these modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        pg: false,
        'pg-native': false,
        dns: false,
        child_process: false,
        nodemailer: false,
        '@slack/web-api': false,
      };
    }
    
    // Handle ES modules and Node.js modules
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };
    
    // Handle node: protocol
    config.resolve.alias = {
      ...config.resolve.alias,
      'node:fs': false,
      'node:path': false,
      'node:os': false,
      'node:crypto': false,
      'node:stream': false,
      'node:util': false,
      'node:url': false,
      'node:querystring': false,
      'node:buffer': false,
      'node:events': false,
    };
    
    return config;
  },
  
  // Environment variables
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  
  // Disable strict mode for better compatibility
  reactStrictMode: false,
};

module.exports = nextConfig;
