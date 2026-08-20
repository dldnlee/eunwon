'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { EntityType } from '@/lib/types';

const STEPS = ['사업 형태', '업종', '지역', '규모', '추가 정보'] as const;

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: '예비창업자', label: '예비창업자 — 아직 사업자등록 전이에요' },
  { value: '개인사업자', label: '개인사업자' },
  { value: '법인', label: '법인' },
];

// A starter subset of 한국표준산업분류 대분류 — swap for a searchable full KSIC list later.
const BUSINESS_TYPES = [
  '제조업', 'IT/소프트웨어', '도소매업', '음식점/카페', '서비스업',
  '건설업', '농림수산업', '교육서비스업', '전문/과학/기술서비스업', '기타',
];

const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const EXTRA_TAGS = ['여성기업', '장애인기업', '사회적기업', '재창업', '청년창업'];

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entityType, setEntityType] = useState<EntityType>('개인사업자');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [region, setRegion] = useState(REGIONS[0]);
  const [employeeCount, setEmployeeCount] = useState(1);
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [foundedAt, setFoundedAt] = useState('');
  const [isTechCompany, setIsTechCompany] = useState(false);
  const [extraTags, setExtraTags] = useState<string[]>([]);

  const isLastStep = step === STEPS.length - 1;

  function toggleTag(tag: string) {
    setExtraTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      entity_type: entityType,
      business_type: businessType,
      region,
      employee_count: employeeCount,
      annual_revenue: annualRevenue ? Number(annualRevenue) : null,
      founded_at: foundedAt || null,
      is_tech_company: isTechCompany,
      extra_tags: extraTags,
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
        <div className="flex flex-col gap-xs">
          <Label htmlFor="businessType">업종</Label>
          <Select id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-xs">
          <Label htmlFor="region">지역 (시/도)</Label>
          <Select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-xl">
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

      {step === 4 && (
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
          <label className="flex min-h-11 cursor-pointer items-center gap-sm text-body-sm text-charcoal">
            <input
              type="checkbox"
              checked={isTechCompany}
              onChange={(e) => setIsTechCompany(e.target.checked)}
              className="h-4 w-4 rounded border-hairline accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
            />
            기술 기반 기업이에요 (특허, R&D 등)
          </label>
          <div className="flex flex-col gap-sm">
            <Label>특이사항 (해당되는 항목 선택)</Label>
            <div className="flex flex-wrap gap-xs">
              {EXTRA_TAGS.map((tag) => {
                const selected = extraTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'rounded-full border px-md py-xs text-body-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
                      selected
                        ? 'border-ink bg-ink text-on-primary'
                        : 'border-hairline text-steel hover:bg-surface'
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
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
