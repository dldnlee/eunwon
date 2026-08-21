import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

// Public, unauthenticated by design — the marketing site's contact form is
// the app's first mutating route with neither a Supabase session nor a
// CRON_SECRET header gate (contrast app/api/ai/explain/route.ts, which
// requires a signed-in user, and app/api/cron/notify-users/route.ts, which
// requires the cron secret). Anyone can hit this, so it leans on the
// honeypot check and Zod validation below instead of auth.
export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

const contactSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요.').max(100, '이름이 너무 길어요.'),
  email: z.string().trim().email('올바른 이메일 형식이 아니에요.'),
  company: z.string().trim().max(200, '회사/사업체명이 너무 길어요.').optional(),
  inquiryType: z.string().trim().max(50).optional(),
  message: z.string().trim().min(1, '문의 내용을 입력해주세요.').max(5000, '문의 내용이 너무 길어요.'),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildContactEmailHtml(fields: {
  name: string;
  email: string;
  company?: string;
  inquiryType?: string;
  message: string;
}): string {
  const rows: [string, string][] = [
    ['이름', fields.name],
    ['이메일', fields.email],
    ['회사/사업체명', fields.company || '(입력 안 함)'],
    ['문의 유형', fields.inquiryType || '(선택 안 함)'],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:4px 12px 4px 0;color:#5f5f5f;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;color:#0a0a0a;font-size:14px;">${escapeHtml(value)}</td>` +
        `</tr>`
    )
    .join('');

  return (
    `<div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">` +
    `<h2 style="margin:0 0 16px;font-size:18px;color:#0a0a0a;">새로운 문의가 접수됐어요</h2>` +
    `<table style="border-collapse:collapse;margin-bottom:16px;">${rowsHtml}</table>` +
    `<div style="padding:12px 16px;background:#f7f8fa;border-radius:8px;color:#222222;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(fields.message)}</div>` +
    `</div>`
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 });
  }

  // Honeypot: a real form field, visually hidden from sighted users but
  // present in the DOM for bots that auto-fill every input to find. If it's
  // non-empty we quietly report success without sending mail, so the bot
  // has no signal it was caught.
  const honeypot = (body as Record<string, unknown>).website;
  if (typeof honeypot === 'string' && honeypot.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' },
      { status: 400 }
    );
  }

  const { name, email, company, inquiryType, message } = parsed.data;

  try {
    await resend.emails.send({
      from: 'eunwon AI <alerts@eunwon.com>',
      to: process.env.CONTACT_EMAIL_TO || 'daniel@eunwon.com',
      replyTo: email,
      subject: `[문의] ${name}님의 문의`,
      html: buildContactEmailHtml({ name, email, company, inquiryType, message }),
    });
  } catch (err) {
    console.error('Failed to send contact email:', err);
    return NextResponse.json(
      { error: '문의 전송에 실패했어요. 잠시 후 다시 시도해주세요.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
