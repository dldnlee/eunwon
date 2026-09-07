import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: 'eunwon AI 정부지원사업 매칭 서비스의 개인정보 수집, 이용, 보관 및 이용자 권리를 안내합니다.',
  alternates: { canonical: '/privacy' },
};

const heading = 'scroll-mt-xl text-heading-sm text-ink';
const section = 'space-y-sm';
const list = 'list-disc space-y-xs pl-xl text-body-md text-charcoal marker:text-stone';

export default function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 px-md py-section-sm focus:outline-none sm:px-xl sm:py-section">
      <article className="mx-auto max-w-3xl" aria-labelledby="privacy-title">
        <header className="border-b border-hairline pb-xxl">
          <p className="mb-xs text-caption-bold text-steel">법적 고지</p>
          <h1 id="privacy-title" className="text-heading-md text-ink sm:text-heading-lg">개인정보처리방침</h1>
          <p className="mt-md text-body-md text-slate">eunwon AI(이하 “서비스”)는 이용자의 개인정보를 소중히 여기며 관련 법령을 준수합니다.</p>
          <p className="mt-sm text-caption text-steel">시행일: 2026년 8월 26일</p>
        </header>
        <div className="mt-xxl space-y-xxl">
          <section className={section} aria-labelledby="privacy-purpose">
            <h2 id="privacy-purpose" className={heading}>1. 개인정보의 처리 목적</h2>
            <ul className={list}><li>회원 가입, 본인 확인, 계정 관리 및 서비스 제공</li><li>사업자 정보에 기반한 정부지원사업 검색, 추천 및 적합도 분석</li><li>저장한 지원사업, 알림 및 문서 생성 기능 제공</li><li>선택 동의한 이용자에게 신규 지원사업, 혜택 및 서비스 업데이트 안내</li><li>문의 처리, 서비스 품질 개선, 부정 이용 방지 및 법적 의무 이행</li></ul>
          </section>
          <section className={section} aria-labelledby="privacy-items">
            <h2 id="privacy-items" className={heading}>2. 처리하는 개인정보 항목</h2>
            <ul className={list}><li><strong>필수 정보:</strong> 이름, 이메일 주소, 인증 정보, 개인정보 동의 일시 및 서비스 이용 기록</li><li><strong>선택 정보:</strong> 회사명, 마케팅 정보 수신 동의 여부 및 변경 일시</li><li><strong>사업 정보:</strong> 기업명, 사업자등록번호, 소재지, 업종, 기업 형태, 설립일, 매출·고용 및 인증 정보 등 이용자가 입력한 정보</li><li><strong>결제 정보:</strong> 결제 승인 내역, 상품 및 구독 상태. 카드번호 등 원천 결제정보는 결제대행사가 처리합니다.</li><li><strong>자동 생성 정보:</strong> 접속 IP, 쿠키, 접속 일시, 기기 및 브라우저 정보, 이용 기록</li><li><strong>문의 정보:</strong> 이름, 이메일 주소, 회사명, 문의 내용</li></ul>
          </section>
          <section className={section} aria-labelledby="privacy-retention">
            <h2 id="privacy-retention" className={heading}>3. 보유 및 이용 기간</h2>
            <p className="text-body-md text-charcoal">개인정보는 회원 탈퇴 시까지 보유하며, 수집 목적이 달성되거나 동의를 철회하면 지체 없이 파기합니다. 마케팅 수신 동의는 언제든 철회할 수 있습니다. 다만 관계 법령에 따라 보존할 의무가 있는 정보는 해당 기간 동안 별도로 보관합니다.</p>
            <ul className={list}><li>계약 또는 청약철회, 대금결제 및 재화 공급 기록: 5년</li><li>소비자 불만 또는 분쟁 처리 기록: 3년</li><li>접속 기록: 3개월</li></ul>
          </section>
          <section className={section} aria-labelledby="privacy-third-party">
            <h2 id="privacy-third-party" className={heading}>4. 제3자 제공 및 처리 위탁</h2>
            <p className="text-body-md text-charcoal">서비스는 원칙적으로 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 원활한 운영을 위해 클라우드·인증, AI 분석, 결제, 이메일 발송 사업자에게 필요한 범위의 처리를 위탁할 수 있으며, 위탁사를 변경할 경우 이 방침을 통해 공개합니다.</p>
          </section>
          <section className={section} aria-labelledby="privacy-rights">
            <h2 id="privacy-rights" className={heading}>5. 이용자의 권리와 행사 방법</h2>
            <p className="text-body-md text-charcoal">이용자는 언제든지 자신의 개인정보를 조회·수정하거나 처리 정지 및 삭제를 요청할 수 있습니다. 계정 설정에서 직접 처리하거나 아래 문의처로 요청할 수 있으며, 법정대리인도 관련 법령에 따라 권리를 행사할 수 있습니다.</p>
          </section>
          <section className={section} aria-labelledby="privacy-destroy">
            <h2 id="privacy-destroy" className={heading}>6. 개인정보의 파기</h2>
            <p className="text-body-md text-charcoal">보유 기간이 지난 전자적 파일은 복구할 수 없는 방식으로 삭제하고, 종이 문서는 분쇄하거나 소각합니다. 법령에 따라 보존하는 정보는 다른 개인정보와 분리하여 보관합니다.</p>
          </section>
          <section className={section} aria-labelledby="privacy-safety">
            <h2 id="privacy-safety" className={heading}>7. 안전성 확보 조치</h2>
            <p className="text-body-md text-charcoal">서비스는 접근 권한 관리, 전송 구간 암호화, 접속 기록 보관, 보안 업데이트 등 개인정보 보호에 필요한 기술적·관리적 조치를 시행합니다.</p>
          </section>
          <section className={section} aria-labelledby="privacy-contact">
            <h2 id="privacy-contact" className={heading}>8. 개인정보 보호 문의</h2>
            <p className="text-body-md text-charcoal">개인정보 처리와 관련한 문의, 불만 또는 권리 행사는 <a href="mailto:hello@eunwon.com" className="rounded-xs font-medium text-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep">hello@eunwon.com</a>으로 보내주세요. 확인 후 지체 없이 답변하겠습니다.</p>
          </section>
          <section className={section} aria-labelledby="privacy-change">
            <h2 id="privacy-change" className={heading}>9. 방침의 변경</h2>
            <p className="text-body-md text-charcoal">이 방침이 변경되는 경우 시행 전에 서비스 내 공지를 통해 안내합니다. 이용자 권리에 중대한 변경이 있으면 충분한 사전 안내 기간을 두겠습니다.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
