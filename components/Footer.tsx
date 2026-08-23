import Link from 'next/link';
import { Logo } from '@/components/Logo';

// Placeholder company-registration details for eunwon — swap in the real business
// registration number, address, and contact info once they're issued.
const COMPANY = {
  name: '주식회사 eunwon',
  ceo: '이은원',
  bizRegNo: '123-45-67890',
  mailOrderNo: '제2026-서울강남-01234호',
  address: '서울특별시 강남구 테헤란로 123, 4층',
  phone: '02-1234-5678',
  email: 'hello@eunwon.com',
};

const LINK_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: '서비스',
    links: [
      { label: '무료로 시작하기', href: '/signup' },
      { label: '로그인', href: '/login' },
      { label: '요금제', href: '/#pricing' },
    ],
  },
  {
    heading: '고객지원',
    links: [{ label: '문의하기', href: '/contact' }],
  },
];

export function Footer() {
  return (
    <footer className="relative bg-footer-bg px-xl py-section text-on-dark">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-xxl sm:flex-row sm:justify-between">
          <div className="flex max-w-xs flex-col gap-sm">
            <span className="flex items-center gap-xs text-card-title text-on-dark">
              <Logo className="h-6 w-auto" />
              eunwon AI
            </span>
            <p className="text-body-sm text-muted">
              자영업자와 스타트업을 위한 정부지원사업 매칭 서비스예요. 놓치기 쉬운 지원사업을
              가장 먼저 찾아드립니다.
            </p>
          </div>

          <div className="flex gap-xxl">
            {LINK_COLUMNS.map((col) => (
              <div key={col.heading} className="flex flex-col gap-sm">
                <h3 className="text-body-sm-medium text-on-dark">{col.heading}</h3>
                <ul className="flex flex-col gap-xxs">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-block rounded-sm py-xxs text-body-sm text-muted transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 focus-visible:ring-offset-footer-bg"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-xxl flex flex-col gap-sm border-t border-white/10 pt-xl text-micro text-muted sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-xxs">
            <p>
              {COMPANY.name} · 대표 {COMPANY.ceo} · 사업자등록번호 {COMPANY.bizRegNo} · 통신판매업신고{' '}
              {COMPANY.mailOrderNo}
            </p>
            <p>
              {COMPANY.address} · 대표전화 {COMPANY.phone} · 이메일 {COMPANY.email}
            </p>
          </div>
          <p>© {new Date().getFullYear()} eunwon AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
