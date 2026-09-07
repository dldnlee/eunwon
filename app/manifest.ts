import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'eunwon AI 정부지원사업 매칭',
    short_name: 'eunwon AI',
    description: '소상공인·스타트업·중소기업을 위한 정부지원사업 AI 맞춤 매칭 서비스',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0a0a0a',
    lang: 'ko-KR',
    icons: [{ src: '/icon.png', sizes: '512x512', type: 'image/png' }],
  };
}
