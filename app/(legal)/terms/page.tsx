import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관',
  description: 'eunwon AI 정부지원사업 매칭 서비스 이용에 필요한 권리, 의무 및 이용 조건을 안내합니다.',
  alternates: { canonical: '/terms' },
};

const heading = 'scroll-mt-xl text-heading-sm text-ink';
const section = 'space-y-sm';
const list = 'list-disc space-y-xs pl-xl text-body-md text-charcoal marker:text-stone';

export default function TermsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 px-md py-section-sm focus:outline-none sm:px-xl sm:py-section">
      <article className="mx-auto max-w-3xl" aria-labelledby="terms-title">
        <header className="border-b border-hairline pb-xxl">
          <p className="mb-xs text-caption-bold text-steel">법적 고지</p>
          <h1 id="terms-title" className="text-heading-md text-ink sm:text-heading-lg">이용약관</h1>
          <p className="mt-md text-body-md text-slate">이 약관은 eunwon AI 정부지원사업 매칭 서비스를 이용하는 데 필요한 사항을 정합니다.</p>
          <p className="mt-sm text-caption text-steel">시행일: 2026년 8월 26일</p>
        </header>
        <div className="mt-xxl space-y-xxl">
          <section className={section} aria-labelledby="terms-purpose"><h2 id="terms-purpose" className={heading}>1. 목적 및 적용</h2><p className="text-body-md text-charcoal">이 약관은 서비스가 제공하는 정부지원사업 검색·추천, 적합도 분석, 알림, 문서 생성 및 이에 부수하는 기능의 이용 조건과 서비스 및 회원의 권리·의무를 규정합니다. 회원 가입 또는 서비스 이용 시 이 약관에 동의한 것으로 봅니다.</p></section>
          <section className={section} aria-labelledby="terms-account"><h2 id="terms-account" className={heading}>2. 회원 가입 및 계정 관리</h2><ul className={list}><li>이용자는 정확한 정보를 제공해야 하며 타인의 정보를 사용할 수 없습니다.</li><li>계정과 인증 수단의 관리 책임은 회원에게 있습니다.</li><li>계정 도용이나 무단 사용을 알게 된 경우 즉시 서비스에 알려야 합니다.</li><li>관련 법령 또는 이 약관을 위반한 경우 가입을 거절하거나 이용을 제한할 수 있습니다.</li></ul></section>
          <section className={section} aria-labelledby="terms-service"><h2 id="terms-service" className={heading}>3. 서비스의 내용과 변경</h2><p className="text-body-md text-charcoal">서비스는 이용자가 입력한 정보와 공개된 지원사업 정보를 바탕으로 맞춤 정보를 제공합니다. 운영상·기술상 필요한 경우 서비스의 전부 또는 일부를 변경하거나 일시 중단할 수 있으며, 중요한 변경은 합리적인 방법으로 사전에 안내합니다.</p></section>
          <section className={section} aria-labelledby="terms-guidance"><h2 id="terms-guidance" className={heading}>4. 지원사업 정보 및 AI 결과</h2><ul className={list}><li>지원사업 공고와 자격 요건은 주관기관의 사정으로 변경될 수 있으므로 신청 전 원문을 확인해야 합니다.</li><li>매칭 점수, 요약 및 생성 문서는 참고 정보이며 선정, 지원금 지급 또는 사업 성과를 보장하지 않습니다.</li><li>최종 신청 여부와 제출 내용에 대한 판단과 책임은 이용자에게 있습니다.</li></ul></section>
          <section className={section} aria-labelledby="terms-payment"><h2 id="terms-payment" className={heading}>5. 유료 서비스, 결제 및 해지</h2><p className="text-body-md text-charcoal">유료 서비스의 가격, 결제 주기와 제공 범위는 결제 화면에 표시합니다. 회원은 관련 법령과 결제 화면에 안내된 조건에 따라 청약철회 또는 구독 해지를 요청할 수 있습니다. 이미 제공된 디지털 콘텐츠나 사용한 서비스는 법령이 허용하는 범위에서 환불이 제한될 수 있습니다.</p></section>
          <section className={section} aria-labelledby="terms-obligations"><h2 id="terms-obligations" className={heading}>6. 이용자의 의무</h2><ul className={list}><li>법령, 이 약관, 서비스 안내 및 공지를 준수해야 합니다.</li><li>서비스의 정상 운영을 방해하거나 시스템에 무단 접근해서는 안 됩니다.</li><li>서비스의 정보나 결과를 허가 없이 복제·판매하거나 제3자의 권리를 침해해서는 안 됩니다.</li><li>허위 정보 입력, 부정 결제 또는 불법적인 목적으로 서비스를 이용해서는 안 됩니다.</li></ul></section>
          <section className={section} aria-labelledby="terms-ip"><h2 id="terms-ip" className={heading}>7. 지식재산권</h2><p className="text-body-md text-charcoal">서비스와 서비스가 제공하는 소프트웨어, 디자인 및 콘텐츠에 관한 권리는 서비스 또는 정당한 권리자에게 있습니다. 이용자가 입력한 자료에 대한 권리는 이용자에게 있으며, 서비스는 기능 제공에 필요한 범위에서만 해당 자료를 처리합니다.</p></section>
          <section className={section} aria-labelledby="terms-liability"><h2 id="terms-liability" className={heading}>8. 책임의 제한</h2><p className="text-body-md text-charcoal">천재지변, 통신 장애, 주관기관의 공고 변경 등 합리적으로 통제하기 어려운 사유로 서비스를 제공할 수 없는 경우 관련 법령이 허용하는 범위에서 책임이 제한됩니다. 서비스는 고의 또는 중대한 과실이 없는 한 이용자의 판단이나 이용자 간 거래로 발생한 손해를 책임지지 않습니다.</p></section>
          <section className={section} aria-labelledby="terms-end"><h2 id="terms-end" className={heading}>9. 탈퇴 및 이용 제한</h2><p className="text-body-md text-charcoal">회원은 언제든지 계정 탈퇴를 요청할 수 있습니다. 서비스는 약관 위반이나 부정 이용이 확인된 경우 사전 통지 후 이용을 제한하거나 계약을 해지할 수 있습니다. 긴급한 보안 위험이 있는 경우 먼저 제한한 뒤 안내할 수 있습니다.</p></section>
          <section className={section} aria-labelledby="terms-law"><h2 id="terms-law" className={heading}>10. 준거법 및 분쟁 해결</h2><p className="text-body-md text-charcoal">이 약관은 대한민국 법률을 따릅니다. 분쟁이 발생하면 당사자 간 협의를 통해 해결하도록 노력하며, 해결되지 않는 경우 민사소송법에 따른 관할 법원에서 해결합니다. 약관 관련 문의는 <a href="mailto:hello@eunwon.com" className="rounded-xs font-medium text-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep">hello@eunwon.com</a>으로 보내주세요.</p></section>
        </div>
      </article>
    </main>
  );
}
