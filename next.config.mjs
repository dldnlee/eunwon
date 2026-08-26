/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/saved-programs/*/summary.pdf': ['./assets/fonts/NanumGothic-Regular.ttf'],
      '/api/ai/generate-document/hwpx': ['./assets/templates/hwpx/**'],
    },
  },
};

export default nextConfig;
