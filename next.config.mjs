/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    // Cho phép load ảnh từ Flask server và ngrok
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost',       port: '5000' },
      { protocol: 'https', hostname: '*.ngrok-free.app' },
      { protocol: 'https', hostname: '*.ngrok.io'       },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/flask/:path*',
        destination: 'http://127.0.0.1:5000/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5000/api/:path*',
      },
      {
        source: '/video_feed',
        destination: 'http://127.0.0.1:5000/video_feed',
      },
      {
        // WebSocket proxy
        source: '/ws-api',
        destination: 'http://127.0.0.1:8765',
      }
    ]
  },
  // Cho phép cross-origin requests từ ngrok tunnel
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
        ],
      },
    ]
  },

}

export default nextConfig
