'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn, getAgeMonths } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { EntityType } from '@/lib/types';

const STEPS = ['사업 형태', '업종 · 지역', '규모', '추가 정보'] as const;

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: '예비창업자', label: '예비창업자 — 아직 사업자등록 전이에요' },
  { value: '개인사업자', label: '개인사업자' },
  { value: '법인', label: '법인' },
];

const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const CERTIFICATIONS = ['벤처기업', '이노비즈', '메인비즈'];
const EXTRA_TAGS = ['여성기업', '장애인기업', '사회적기업', '재창업', '청년창업'];

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
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entityType, setEntityType] = useState<EntityType>('개인사업자');
  const [industryName, setIndustryName] = useState('');
  const [region, setRegion] = useState(REGIONS[0]);
  const [foundedAt, setFoundedAt] = useState('');
  const [employeeCount, setEmployeeCount] = useState(1);
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [currentChallenges, setCurrentChallenges] = useState('');

  const isLastStep = step === STEPS.length - 1;

  function toggleFrom(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      entity_type: entityType,
      industry_name: industryName || null,
      region,
      founded_at: foundedAt || null,
      age_months: getAgeMonths(foundedAt || null),
      employee_count: employeeCount,
      annual_revenue_krw: annualRevenue ? Number(annualRevenue) : null,
      certifications,
      extra_tags: extraTags,
      current_challenges: currentChallenges || null,
      onboarding_complete: true,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-xl">
      <div>
        <div className="mb-xs flex justify-between text-body-sm text-steel">
          <span>{STEPS[step]}</span>
          <span>{step + 1} / {STEPS.length}</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      {step === 0 && (
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

      {step === 1 && (
        <div className="flex flex-col gap-xl">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="industryName">업종</Label>
            <Input
              id="industryName"
              value={industryName}
              onChange={(e) => setIndustryName(e.target.value)}
              placeholder="예: IT 서비스업, 제조업, 카페 운영 등"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="region">지역 (시/도)</Label>
            <Select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {step === 2 && (
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

      {step === 3 && (
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
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? '저장 중...' : '완료하고 매칭 결과 보기'}
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)}>다음</Button>
        )}
      </div>
    </div>
  );
}
