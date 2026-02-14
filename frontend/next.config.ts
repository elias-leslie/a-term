import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@agent-hub/passport-client'],
  output: 'standalone',
  // Proxy /api/* and /ws/* to backend server-to-server to avoid CORS issues with CF Access
  // In production: browser requests terminal.summitflow.dev/api/* (same-origin)
  // Next.js rewrites proxy to localhost:8002 (server-to-server, no CORS)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8002/api/:path*',
      },
      // WebSocket paths - same-origin routing for CF Access compatibility
      {
        source: '/ws/:path*',
        destination: 'http://localhost:8002/ws/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

export default nextConfig
