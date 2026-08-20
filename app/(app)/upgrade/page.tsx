import { redirect } from 'next/navigation';
import { TOSS_ENABLED } from '@/lib/payments';
import { UpgradeForm } from '@/components/UpgradeForm';

export default function UpgradePage() {
  // No approved 토스페이먼츠 business account yet (requires 사업자등록증) — don't let
  // anyone reach a checkout flow that can't actually complete.
  if (!TOSS_ENABLED) redirect('/settings/billing');

  return <UpgradeForm />;
}
