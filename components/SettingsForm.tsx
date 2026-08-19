'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TOSS_ENABLED } from '@/lib/payments';
import type { EntityType, Profile } from '@/lib/types';

const ENTITY_TYPES: EntityType[] = ['예비창업자', '개인사업자', '법인'];
const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(profile.business_name ?? '');
  const [entityType, setEntityType] = useState<EntityType>(profile.entity_type);
  const [region, setRegion] = useState(profile.region);
  const [employeeCount, setEmployeeCount] = useState(String(profile.employee_count ?? ''));
  const [annualRevenue, setAnnualRevenue] = useState(String(profile.annual_revenue ?? ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();

    await supabase
      .from('profiles')
      .update({
        business_name: businessName || null,
        entity_type: entityType,
        region,
        employee_count: employeeCount ? Number(employeeCount) : null,
        annual_revenue: annualRevenue ? Number(annualRevenue) : null,
      })
      .eq('id', profile.id);

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  function handleUpgrade() {
    router.push('/upgrade');
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>사업 정보</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName">사업체명</Label>
            <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entityType">사업 형태</Label>
            <Select id="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value as EntityType)}>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="region">지역</Label>
            <Select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employeeCount">직원수</Label>
            <Input
              id="employeeCount"
              type="number"
              min={0}
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="annualRevenue">연매출 (원)</Label>
            <Input
              id="annualRevenue"
              type="number"
              min={0}
              value={annualRevenue}
              onChange={(e) => setAnnualRevenue(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '변경사항 저장'}
            </Button>
            {saved && <span className="text-sm text-emerald-600">저장됐어요</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>구독</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">
              현재 플랜: {profile.subscription === 'pro' ? 'Pro' : '무료'}
            </p>
            <p className="text-sm text-slate-500">
              {profile.subscription === 'pro'
                ? '무제한 매칭과 AI 기능을 이용 중이에요.'
                : TOSS_ENABLED
                  ? '업그레이드하면 무제한 매칭과 AI 설명, 신청서 초안 기능을 이용할 수 있어요.'
                  : 'Pro 플랜은 결제 연동 준비 중이에요. 지금은 무료 플랜으로 이용해주세요.'}
            </p>
          </div>
          {profile.subscription !== 'pro' && TOSS_ENABLED && (
            <Button onClick={handleUpgrade}>Pro로 업그레이드</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
