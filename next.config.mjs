/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    includePaths: ['./styles'],
  },
  // Increase the maximum payload size for API routes
  api: {
    bodyParser: {
      sizeLimit: '500mb',
    },
    responseLimit: '500mb',
  },
  // Increase timeout for API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // Disable static optimization for API routes to prevent timeouts
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 120 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },
  // Add websocket configuration for HMR
  webpack: (config, { isServer, dev }) => {
    // Only apply in development mode
    if (dev && !isServer) {
      // Improve WebSocket reconnection handling
      config.watchOptions = {
        ...config.watchOptions,
        // Poll for changes every 1000ms
        poll: 1000,
        // Ignore node_modules
        ignored: /node_modules/
      };
    }
    return config;
  },
  // Configure webpackDevMiddleware for better HMR performance
  webpackDevMiddleware: config => {
    return {
      ...config,
      // Wait longer before timing out
      watchOptions: {
        ...config.watchOptions,
        aggregateTimeout: 300,
        poll: 1000,
      }
    };
  },
};

export default nextConfig;
