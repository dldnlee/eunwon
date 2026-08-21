'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/Logo';

const INQUIRY_TYPES = ['일반 문의', '제휴 문의', '버그 신고', '기타'];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [message, setMessage] = useState('');
  // Honeypot — real (not type="hidden") input, visually hidden but never
  // labeled. Legit users never see or fill it; bots that auto-fill every
  // field trip it. Checked server-side in app/api/contact/route.ts.
  const [website, setWebsite] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, inquiryType, message, website }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '문의 전송에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }

      setSent(true);
    } catch {
      setError('문의 전송에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-lg bg-surface p-md">
      <Logo className="h-8 w-auto" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>문의하기</CardTitle>
          <CardDescription>궁금한 점이나 제휴, 버그 제보를 남겨주시면 빠르게 답변드릴게요</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-start gap-xs rounded-md bg-success-bg px-md py-sm">
              <p className="text-body-sm text-success-text">
                문의가 접수됐어요. 빠른 시간 내에 답변드릴게요.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
              {/* Honeypot field — kept in normal tab/DOM order but pushed off-screen so
                  only automated fillers (not sighted or screen-reader users) reach it. */}
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute -left-[9999px]"
                aria-hidden="true"
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="flex flex-col gap-xs">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  error={!!error}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  error={!!error}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <Label htmlFor="company">회사/사업체명 (선택)</Label>
                <Input
                  id="company"
                  type="text"
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="예: 은원 주식회사"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <Label htmlFor="inquiryType">문의 유형 (선택)</Label>
                <Select
                  id="inquiryType"
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  {INQUIRY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-xs">
                <Label htmlFor="message">문의 내용</Label>
                <Textarea
                  id="message"
                  required
                  error={!!error}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="궁금한 점이나 전달하고 싶은 내용을 자유롭게 남겨주세요"
                  rows={5}
                />
              </div>
              {error && (
                <p role="alert" className="text-body-sm text-error">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? '전송 중...' : '문의 보내기'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
