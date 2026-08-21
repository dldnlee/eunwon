import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mirrors the glass-panel treatment from app/page.tsx (`GLASS` there) so this
// section reads as part of the same family as the nav, feature cards, and
// pricing cards — translucent canvas + blur + a soft light border.
const GLASS = 'border-white/60 bg-canvas/50 backdrop-blur-xl';

const FAQS: { question: string; answer: string }[] = [
  {
    question: '어떻게 나에게 맞는 지원사업을 찾아주나요?',
    answer:
      '업종, 지역, 업력, 매출, 인증 현황 같은 사업 정보를 바탕으로 신청 자격을 충족하는 지원사업만 걸러서 보여드려요. Pro 요금제에서는 왜 이 사업이 나에게 맞는지까지 AI가 설명해드립니다.',
  },
  {
    question: '지원사업 정보는 어디서 가져오나요?',
    answer:
      '기업마당(bizinfo), 정부 공공데이터포털 등 정부 공공데이터를 기반으로 수집해요. 새로운 공고와 마감 여부가 주기적으로 자동 갱신되어 항상 최신 상태를 유지합니다.',
  },
  {
    question: '무료 요금제와 Pro 요금제는 무엇이 다른가요?',
    answer:
      '무료는 매칭 결과 5건, 기본 AI 요약, 북마크 기능을 제공해요. Pro(월 39,000원)는 무제한 매칭, "왜 나에게 맞나요?" AI 설명, 사업계획서 생성 도우미, 신규 매칭·마감 임박 이메일 알림, 중복수혜 제한 확인까지 모두 이용할 수 있어요.',
  },
  {
    question: '입력한 사업 정보는 안전하게 보관되나요?',
    answer:
      '입력하신 사업 정보는 지원사업 매칭 목적으로만 사용되며, 제3자에게 판매되거나 공유되지 않아요. 모든 데이터는 암호화된 환경에 안전하게 저장됩니다.',
  },
  {
    question: '지원사업 목록은 얼마나 자주 업데이트되나요?',
    answer:
      '새로운 공고 수집과 마감된 공고 정리가 매일 자동으로 이루어져요. 그래서 대시보드에서 보시는 목록은 항상 최신 상태를 유지합니다.',
  },
  {
    question: 'Pro 구독은 어떻게 해지하나요?',
    answer:
      '아직 설정 화면에 자체 해지 기능은 준비 중이에요. 문의하기로 요청해주시면 빠르게 처리해드릴게요.',
  },
];

/**
 * Server Component — no client JS needed. `<details>`/`<summary>` is the
 * native accordion primitive (free aria-expanded + keyboard handling), so
 * this ships as plain HTML with the disclosure state owned by the browser.
 */
export function FaqSection() {
  return (
    <section className="relative mx-auto max-w-4xl px-xl py-section">
      <h2 className="text-center text-heading-md text-ink">자주 묻는 질문</h2>
      <div
        className={cn(
          'mt-xxl overflow-hidden rounded-xl border shadow-[0_8px_32px_rgba(0,0,0,0.06)]',
          GLASS
        )}
      >
        {FAQS.map((faq, index) => (
          <details key={faq.question} className={cn('group', index > 0 && 'border-t border-hairline-soft')}>
            <summary
              className={cn(
                'flex cursor-pointer list-none items-center justify-between gap-md px-lg py-lg text-body-md text-ink transition-colors sm:px-xl',
                'font-medium [&::-webkit-details-marker]:hidden',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2'
              )}
            >
              {faq.question}
              <ChevronDown
                className="h-5 w-5 shrink-0 text-steel transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="px-lg pb-lg text-body-sm text-charcoal sm:px-xl">{faq.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
