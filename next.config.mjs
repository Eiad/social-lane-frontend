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
  },
};

export default nextConfig;
