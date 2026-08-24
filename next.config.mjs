/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/saved-programs/*/summary.pdf': ['./assets/fonts/NanumGothic-Regular.ttf'],
    },
  },
};

export default nextConfig;
