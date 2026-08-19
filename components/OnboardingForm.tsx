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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <div className="mb-2 flex justify-between text-sm text-slate-500">
          <span>{STEPS[step]}</span>
          <span>{step + 1} / {STEPS.length}</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-3">
          {ENTITY_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEntityType(opt.value)}
              className={`rounded-lg border p-4 text-left text-sm transition-colors ${
                entityType === opt.value
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="businessType">업종</Label>
          <Select id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="region">지역 (시/도)</Label>
          <Select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <Label htmlFor="employeeCount">직원수</Label>
              <span className="text-sm text-slate-500">{employeeCount}명</span>
            </div>
            <Slider
              id="employeeCount"
              min={0}
              max={100}
              value={employeeCount}
              onChange={(e) => setEmployeeCount(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="annualRevenue">연매출 (원, 선택)</Label>
            <Input
              id="annualRevenue"
              type="number"
              min={0}
              placeholder="예: 100000000"
              value={annualRevenue}
              onChange={(e) => setAnnualRevenue(e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="foundedAt">창업일 (선택)</Label>
            <Input
              id="foundedAt"
              type="date"
              value={foundedAt}
              onChange={(e) => setFoundedAt(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isTechCompany}
              onChange={(e) => setIsTechCompany(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            기술 기반 기업이에요 (특허, R&D 등)
          </label>
          <div className="flex flex-col gap-2">
            <Label>특이사항 (해당되는 항목 선택)</Label>
            <div className="flex flex-wrap gap-2">
              {EXTRA_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    extraTags.includes(tag)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

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
