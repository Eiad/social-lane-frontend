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
  }
};

export default nextConfig;
