/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth'],
    serverActions: {
      bodySizeLimit: '5mb'
    }
  }
}

export default nextConfig
