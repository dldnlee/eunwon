import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkBusinessStatus, toDbBusinessStatus } from '@/lib/verification/business';

const bodySchema = z.object({
  businessNumber: z.string().regex(/^\d{3}-?\d{2}-?\d{5}$/, '사업자등록번호 형식이 올바르지 않습니다'),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' }, { status: 400 });
  }

  try {
    const status = await checkBusinessStatus(parsed.data.businessNumber);

    await supabase
      .from('profiles')
      .update({
        business_verified: status !== 'not_found',
        business_status: toDbBusinessStatus(status),
        business_verified_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({ status });
  } catch (err) {
    console.error('checkBusinessStatus failed:', err);
    return NextResponse.json({ error: '사업자 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
