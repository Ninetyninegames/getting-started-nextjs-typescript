/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
        port: '',
        pathname: '/pbxt/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/predictions", // Update this route as per your needs
        headers: [
          {
            key: "x-csrf-token",
            value: "", // Ensures the CSRF token isn't required
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
