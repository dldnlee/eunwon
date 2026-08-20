import { FileStack } from 'lucide-react';

export default function DocumentSettingsPage() {
  return (
    <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-hairline p-xxl text-center">
      <FileStack className="h-8 w-8 text-stone" aria-hidden="true" />
      <p className="text-body-sm text-steel">
        문서 보관함은 준비 중이에요. 사업자등록증, 재무제표 등을 한 번만 업로드해두면
        신청서 생성 시 자동으로 활용할 수 있게 될 예정이에요.
      </p>
    </div>
  );
}
