'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BusinessNumberField } from '@/components/BusinessNumberField';
import { cn, getAgeMonths } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { EntityType, Profile } from '@/lib/types';
import { toDbBusinessStatus, type BusinessStatus } from '@/lib/verification/business';

const ENTITY_TYPES: EntityType[] = ['예비창업자', '개인사업자', '법인'];
const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];
const CERTIFICATIONS = ['벤처기업', '이노비즈', '메인비즈'];
const TECH_DOMAINS = ['AI/소프트웨어', '바이오/헬스케어', '그린에너지/환경', '제조/하드웨어', '핀테크', '콘텐츠/미디어'];
const INTEREST_CATEGORIES = ['경영', '기술', '수출', '창업', '내수', '인력', '금융'];

function ChipToggle({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-full border px-md py-xs text-body-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
        selected ? 'border-ink bg-ink text-on-primary' : 'border-hairline text-steel hover:bg-surface'
      )}
    >
      {label}
    </button>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(profile.company_name ?? '');
  const [representativeName, setRepresentativeName] = useState(profile.representative_name ?? '');
  const [businessNumber, setBusinessNumber] = useState(profile.business_number ?? '');
  const [businessStatus, setBusinessStatus] = useState<BusinessStatus | null>(profile.business_status);
  const [entityType, setEntityType] = useState<EntityType>(profile.entity_type);
  const [industryName, setIndustryName] = useState(profile.industry_name ?? '');
  const [techDomains, setTechDomains] = useState<string[]>(profile.tech_domains);
  const [region, setRegion] = useState(profile.region);
  const [foundedAt, setFoundedAt] = useState(profile.founded_at ?? '');
  const [employeeCount, setEmployeeCount] = useState(String(profile.employee_count ?? ''));
  const [annualRevenue, setAnnualRevenue] = useState(String(profile.annual_revenue_krw ?? ''));
  const [certifications, setCertifications] = useState<string[]>(profile.certifications);
  const [interestCategories, setInterestCategories] = useState<string[]>(profile.interest_categories);
  const [currentChallenges, setCurrentChallenges] = useState(profile.current_challenges ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleCertification(cert: string) {
    setCertifications((prev) => (prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]));
  }

  function toggleFrom(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();

    await supabase
      .from('profiles')
      .update({
        company_name: companyName || null,
        representative_name: representativeName || null,
        business_number: businessNumber || null,
        business_verified: businessStatus != null && businessStatus !== 'not_found',
        business_status: toDbBusinessStatus(businessStatus),
        entity_type: entityType,
        industry_name: industryName || null,
        tech_domains: techDomains,
        region,
        founded_at: foundedAt || null,
        age_months: getAgeMonths(foundedAt || null),
        employee_count: employeeCount ? Number(employeeCount) : null,
        annual_revenue_krw: annualRevenue ? Number(annualRevenue) : null,
        certifications,
        interest_categories: interestCategories,
        current_challenges: currentChallenges || null,
      })
      .eq('id', profile.id);

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>사업 정보</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-md">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="companyName">사업체명</Label>
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
          onVerified={setBusinessStatus}
        />
        <div className="flex flex-col gap-xs">
          <Label htmlFor="entityType">사업 형태</Label>
          <Select id="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value as EntityType)}>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-xs">
          <Label htmlFor="industryName">업종</Label>
          <Input id="industryName" value={industryName} onChange={(e) => setIndustryName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-sm">
          <Label>기술 분야 (해당 시, 선택)</Label>
          <div className="flex flex-wrap gap-xs">
            {TECH_DOMAINS.map((domain) => (
              <ChipToggle
                key={domain}
                label={domain}
                selected={techDomains.includes(domain)}
                onClick={() => toggleFrom(techDomains, setTechDomains, domain)}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-xs">
          <Label htmlFor="region">지역</Label>
          <Select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-xs">
          <Label htmlFor="foundedAt">창업일</Label>
          <Input id="foundedAt" type="date" value={foundedAt} onChange={(e) => setFoundedAt(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="employeeCount">직원수</Label>
            <Input
              id="employeeCount"
              type="number"
              min={0}
              inputMode="numeric"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="annualRevenue">연매출 (원)</Label>
            <Input
              id="annualRevenue"
              type="number"
              min={0}
              inputMode="numeric"
              value={annualRevenue}
              onChange={(e) => setAnnualRevenue(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-sm">
          <Label>인증 현황</Label>
          <div className="flex flex-wrap gap-xs">
            {CERTIFICATIONS.map((cert) => (
              <ChipToggle
                key={cert}
                label={cert}
                selected={certifications.includes(cert)}
                onClick={() => toggleCertification(cert)}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-sm">
          <Label>관심 지원 분야 (선택)</Label>
          <div className="flex flex-wrap gap-xs">
            {INTEREST_CATEGORIES.map((category) => (
              <ChipToggle
                key={category}
                label={category}
                selected={interestCategories.includes(category)}
                onClick={() => toggleFrom(interestCategories, setInterestCategories, category)}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-xs">
          <Label htmlFor="currentChallenges">지금 가장 필요한 지원</Label>
          <Textarea
            id="currentChallenges"
            value={currentChallenges}
            onChange={(e) => setCurrentChallenges(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-sm">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '변경사항 저장'}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-body-sm text-success-text">
              <Check className="h-4 w-4" /> 저장됐어요
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
