/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Orígenes permitidos en dev (local + Dev Tunnels / VS Code tunnels)
  // Sin esto, /_next/static devuelve HTML y el browser se queja de MIME type
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    '1jvp0mqv-3000.use.devtunnels.ms',
    '*.use.devtunnels.ms',
    '*.devtunnels.ms',
  ],
};

module.exports = nextConfig;
