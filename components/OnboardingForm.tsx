'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { BusinessNumberField } from '@/components/BusinessNumberField';
import { OnboardingMascot } from '@/components/OnboardingMascot';
import { cn, getAgeMonths } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { EntityType } from '@/lib/types';
import { toDbBusinessStatus, type BusinessStatus } from '@/lib/verification/business';

// '사업자 정보' is only included for entity types that actually have a
// registration number — 예비창업자 skip straight from '사업 형태' to '업종 · 지역'.
const ALL_STEPS = ['사업 형태', '사업자 정보', '업종 · 지역', '사업 아이템', '규모', '추가 정보'] as const;
type Step = (typeof ALL_STEPS)[number];

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: '예비창업자', label: '예비창업자 — 아직 사업자등록 전이에요' },
  { value: '개인사업자', label: '개인사업자' },
  { value: '법인', label: '법인' },
];

const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const INDUSTRY_CATEGORIES = [
  '제조업', '도소매/유통업', '음식점/숙박업', 'IT/소프트웨어', '건설업', '운수/물류업',
  '부동산업', '금융/보험업', '교육서비스업', '보건/의료/복지업', '농업/임업/어업',
  '전문/과학/기술서비스업', '예술/스포츠/여가서비스업', '수리/개인서비스업', '전기/가스/수도업', '기타',
];

const CERTIFICATIONS = ['벤처기업', '이노비즈', '메인비즈'];
const EXTRA_TAGS = ['여성기업', '장애인기업', '사회적기업', '재창업', '청년창업'];
const TECH_DOMAINS = ['AI/소프트웨어', '바이오/헬스케어', '그린에너지/환경', '제조/하드웨어', '핀테크', '콘텐츠/미디어'];
const INTEREST_CATEGORIES = ['경영', '기술', '수출', '창업', '내수', '인력', '금융'];
const BUSINESS_TRAITS = ['B2B', 'B2C', 'B2G', '수출기업', '수출준비중', '채용 확대 예정'];
const RND_CAPABILITY = ['기업부설연구소 보유', '전담부서 보유', '특허/지식재산권 보유'];
const INVESTMENT_STAGES = ['없음', '시드투자 유치', '시리즈A 이상 투자유치'];

// Cycled on the post-submit transition screen to keep the wait feeling alive.
const LOADING_PHRASES = [
  '사업 정보 확인 중...',
  '맞춤 지원사업 매칭 중...',
  '거의 다 됐어요...',
];

// Short, step-specific guidance shown next to the mascot in the wizard header.
const STEP_GUIDANCE: Record<Step, string> = {
  '사업 형태': '사업자 등록을 하셨나요? 지금 상황에 맞는 걸 골라주세요.',
  '사업자 정보': '상호명, 대표자명, 사업자등록번호를 확인할게요.',
  '업종 · 지역': '업종과 지역에 따라 받을 수 있는 지원사업이 달라져요.',
  '사업 아이템': '어떤 사업을 하시는지 알려주시면 매칭 정확도가 올라가요.',
  '규모': '창업일, 직원 수, 매출 규모로 딱 맞는 조건을 찾아드려요.',
  '추가 정보': '인증이나 특이사항까지 챙기면 놓치는 지원사업이 줄어들어요.',
};

// The transition screen never shows for less than this, so a fast save
// never flashes — see handleSubmit.
const MIN_LOADING_MS = 2000;

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-sm">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-xs">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(opt)}
              className={cn(
                'rounded-full border px-md py-xs text-body-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
                isSelected
                  ? 'border-ink bg-ink text-on-primary'
                  : 'border-hairline text-steel hover:bg-surface'
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const [entityType, setEntityType] = useState<EntityType>('개인사업자');
  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [businessStatus, setBusinessStatus] = useState<BusinessStatus | null>(null);
  const [businessTaxType, setBusinessTaxType] = useState<string | null>(null);
  const [businessClosedAt, setBusinessClosedAt] = useState<string | null>(null);
  const [industryName, setIndustryName] = useState(INDUSTRY_CATEGORIES[0]);
  const [techDomains, setTechDomains] = useState<string[]>([]);
  const [region, setRegion] = useState(REGIONS[0]);
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessTraits, setBusinessTraits] = useState<string[]>([]);
  const [foundedAt, setFoundedAt] = useState('');
  const [employeeCount, setEmployeeCount] = useState(1);
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [interestCategories, setInterestCategories] = useState<string[]>([]);
  const [rndCapability, setRndCapability] = useState<string[]>([]);
  const [investmentStage, setInvestmentStage] = useState(INVESTMENT_STAGES[0]);
  const [currentChallenges, setCurrentChallenges] = useState('');

  // 예비창업자 have no registration number yet, so they never see that step.
  const steps: Step[] = entityType === '예비창업자'
    ? ALL_STEPS.filter((s) => s !== '사업자 정보')
    : [...ALL_STEPS];
  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  function toggleFrom(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  // Cycle the transition-screen phrases while a save is in flight.
  useEffect(() => {
    if (!saving) {
      setPhraseIndex(0);
      return;
    }
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
    }, 900);
    return () => clearInterval(id);
  }, [saving]);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const startedAt = Date.now();

    const isRegistered = entityType !== '예비창업자';
    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      entity_type: entityType,
      company_name: isRegistered ? companyName || null : null,
      representative_name: isRegistered ? representativeName || null : null,
      business_number: isRegistered ? businessNumber || null : null,
      // The verify call already tried to persist this directly, but that
      // update no-ops if this profile row doesn't exist yet — carry the
      // locally-tracked result forward so it isn't lost on first save.
      business_verified: isRegistered && businessStatus != null && businessStatus !== 'not_found',
      business_status: isRegistered ? toDbBusinessStatus(businessStatus) : null,
      business_verified_at: isRegistered && businessStatus != null ? new Date().toISOString() : null,
      business_tax_type: isRegistered ? businessTaxType : null,
      business_closed_at: isRegistered ? businessClosedAt : null,
      industry_name: industryName || null,
      tech_domains: techDomains,
      region,
      business_description: businessDescription || null,
      business_traits: businessTraits,
      founded_at: foundedAt || null,
      age_months: getAgeMonths(foundedAt || null),
      employee_count: employeeCount,
      annual_revenue_krw: annualRevenue ? Number(annualRevenue) : null,
      certifications,
      extra_tags: extraTags,
      interest_categories: interestCategories,
      rnd_capability: rndCapability,
      investment_stage: investmentStage,
      current_challenges: currentChallenges || null,
      onboarding_complete: true,
    });

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    // Keep the transition screen up for at least MIN_LOADING_MS total so a
    // fast save doesn't flash it — if the save itself took longer, this is a
    // no-op and we move on immediately.
    const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    router.push('/dashboard');
    router.refresh();
  }

  if (showWelcome) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-xl px-md py-xl text-center">
        <OnboardingMascot pose="wave" className="h-24 w-24 animate-scale-in" />
        <div className="flex flex-col gap-sm animate-fade-in-up-delay">
          <h2 className="text-heading-sm text-ink">안녕하세요! 반가워요</h2>
          <p className="text-body-md text-charcoal">
            몇 가지만 알려주시면 지금 조건에 딱 맞는 정부지원사업을 찾아드릴게요.
          </p>
          <p className="text-body-sm text-steel">사업 형태부터 규모까지, 2분이면 충분해요.</p>
        </div>
        <Button size="lg" className="animate-fade-in-up-delay" onClick={() => setShowWelcome(false)}>
          시작하기
        </Button>
      </div>
    );
  }

  if (saving) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-lg bg-canvas px-md text-center animate-fade-in-up"
      >
        <div className="relative">
          <OnboardingMascot pose="thinking" animate={false} className="h-28 w-28" />
          <span className="absolute -bottom-1 left-1/2 h-2 w-16 -translate-x-1/2 animate-pulse rounded-full bg-hairline" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-xs">
          <p key={phraseIndex} className="text-subtitle text-ink animate-fade-in-up">
            {LOADING_PHRASES[phraseIndex]}
          </p>
          <p className="text-body-sm text-steel">
            정보를 취합해 최적의 지원사업을 찾고 있어요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-xl">
      <div className="flex flex-col gap-md">
        <div className="flex items-start gap-sm">
          <OnboardingMascot pose="point" animate={false} className="h-14 w-14" />
          <div
            key={currentStep}
            className="relative flex-1 animate-fade-in-up rounded-lg border border-hairline bg-surface px-md py-xs text-body-sm text-charcoal before:absolute before:left-[-6px] before:top-3 before:h-3 before:w-3 before:rotate-45 before:border-b before:border-l before:border-hairline before:bg-surface"
          >
            {STEP_GUIDANCE[currentStep]}
          </div>
        </div>
        <div>
          <div className="mb-xs flex justify-between text-body-sm text-steel">
            <span>{currentStep}</span>
            <span>{step + 1} / {steps.length}</span>
          </div>
          <Progress value={((step + 1) / steps.length) * 100} />
        </div>
      </div>

      {currentStep === '사업 형태' && (
        <div className="flex flex-col gap-sm" role="radiogroup" aria-label="사업 형태">
          {ENTITY_TYPES.map((opt) => {
            const selected = entityType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setEntityType(opt.value)}
                className={cn(
                  'flex items-center justify-between gap-md rounded-lg border p-md text-left text-body-sm transition-colors max-sm:min-h-11',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
                  selected
                    ? 'border-ink bg-surface font-medium text-ink'
                    : 'border-hairline text-charcoal hover:bg-surface'
                )}
              >
                {opt.label}
                {selected && <Check className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}

      {currentStep === '사업자 정보' && (
        <div className="flex flex-col gap-xl">
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <div className="flex flex-col gap-xs">
              <Label htmlFor="companyName">상호명</Label>
              <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="representativeName">대표자명</Label>
              <Input
                id="representativeName"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
              />
            </div>
          </div>
          <BusinessNumberField
            value={businessNumber}
            onChange={setBusinessNumber}
            initialStatus={businessStatus}
            onVerified={(result) => {
              setBusinessStatus(result.status);
              setBusinessTaxType(result.taxType);
              setBusinessClosedAt(result.closedAt);
            }}
          />
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="self-start text-body-sm text-steel underline-offset-2 hover:underline"
          >
            나중에 입력할게요
          </button>
        </div>
      )}

      {currentStep === '업종 · 지역' && (
        <div className="flex flex-col gap-xl">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="industryName">업종</Label>
            <Select id="industryName" value={industryName} onChange={(e) => setIndustryName(e.target.value)}>
              {INDUSTRY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="region">지역 (시/도)</Label>
            <Select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
          <ChipGroup
            label="기술 분야 (해당 시, 선택)"
            options={TECH_DOMAINS}
            selected={techDomains}
            onToggle={(v) => toggleFrom(techDomains, setTechDomains, v)}
          />
        </div>
      )}

      {currentStep === '사업 아이템' && (
        <div className="flex flex-col gap-xl">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="businessDescription">사업 아이템 소개 (선택)</Label>
            <Textarea
              id="businessDescription"
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder="예: AI 기반 스마트팜 센서를 제조해 중소 농가에 판매하고 있어요. 기존 대비 30% 저렴한 가격이 강점이에요."
            />
          </div>
          <ChipGroup
            label="사업 특성 (해당 시, 선택)"
            options={BUSINESS_TRAITS}
            selected={businessTraits}
            onToggle={(v) => toggleFrom(businessTraits, setBusinessTraits, v)}
          />
        </div>
      )}

      {currentStep === '규모' && (
        <div className="flex flex-col gap-xl">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="foundedAt">창업일 (선택)</Label>
            <Input
              id="foundedAt"
              type="date"
              value={foundedAt}
              onChange={(e) => setFoundedAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-xs">
            <div className="flex justify-between">
              <Label htmlFor="employeeCount">직원수</Label>
              <span className="text-body-sm text-steel">{employeeCount}명</span>
            </div>
            <Slider
              id="employeeCount"
              min={0}
              max={100}
              value={employeeCount}
              onChange={(e) => setEmployeeCount(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="annualRevenue">연매출 (원, 선택)</Label>
            <Input
              id="annualRevenue"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="예: 100000000"
              value={annualRevenue}
              onChange={(e) => setAnnualRevenue(e.target.value)}
            />
          </div>
        </div>
      )}

      {currentStep === '추가 정보' && (
        <div className="flex flex-col gap-xl">
          <ChipGroup
            label="인증 현황 (해당되는 항목 선택)"
            options={CERTIFICATIONS}
            selected={certifications}
            onToggle={(v) => toggleFrom(certifications, setCertifications, v)}
          />
          <ChipGroup
            label="특이사항 (해당되는 항목 선택)"
            options={EXTRA_TAGS}
            selected={extraTags}
            onToggle={(v) => toggleFrom(extraTags, setExtraTags, v)}
          />
          <ChipGroup
            label="관심 지원 분야 (선택)"
            options={INTEREST_CATEGORIES}
            selected={interestCategories}
            onToggle={(v) => toggleFrom(interestCategories, setInterestCategories, v)}
          />
          <ChipGroup
            label="연구개발 역량 (해당 시, 선택)"
            options={RND_CAPABILITY}
            selected={rndCapability}
            onToggle={(v) => toggleFrom(rndCapability, setRndCapability, v)}
          />
          <div className="flex flex-col gap-xs">
            <Label htmlFor="investmentStage">투자유치 현황 (선택)</Label>
            <Select id="investmentStage" value={investmentStage} onChange={(e) => setInvestmentStage(e.target.value)}>
              {INVESTMENT_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="currentChallenges">지금 가장 필요한 지원은 무엇인가요? (선택)</Label>
            <Textarea
              id="currentChallenges"
              value={currentChallenges}
              onChange={(e) => setCurrentChallenges(e.target.value)}
              placeholder="예: 신제품 개발 자금이 필요해요, 해외 진출을 준비 중이에요 등"
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          이전
        </Button>
        {isLastStep ? (
          <Button onClick={handleSubmit}>완료하고 매칭 결과 보기</Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)}>다음</Button>
        )}
      </div>
    </div>
  );
}
