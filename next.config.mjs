/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Sub-path for GitHub Pages: https://girishlade111.github.io/simple-mind-map-app/
  // Remove basePath when deploying to a root domain or Vercel.
  basePath: '/simple-mind-map-app',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig