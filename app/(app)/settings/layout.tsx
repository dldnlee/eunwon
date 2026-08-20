import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-lg text-heading-sm text-ink">설정</h1>
      <SettingsNav />
      <div className="mt-xl">{children}</div>
    </div>
  );
}
