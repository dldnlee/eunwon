import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FinancialHealthClient } from '@/components/FinancialHealthClient';

export const metadata: Metadata = { title: '재무·신용 관리' };

export default async function FinancialHealthPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('company_name').eq('id', user.id).maybeSingle();
  return <FinancialHealthClient companyName={profile?.company_name ?? ''} />;
}
