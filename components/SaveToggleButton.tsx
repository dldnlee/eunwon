'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';
import { trackProductEvent } from '@/lib/telemetry/client';

export function SaveToggleButton({
  userId,
  programId,
  initialSaved,
}: {
  userId: string;
  programId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();

    let error;
    if (saved) {
      ({ error } = await supabase.from('saved_programs').delete().eq('user_id', userId).eq('program_id', programId));
    } else {
      ({ error } = await supabase.from('saved_programs').insert({ user_id: userId, program_id: programId }));
    }

    if (!error) {
      setSaved(!saved);
      if (!saved) trackProductEvent('program_saved', { program_id: programId });
    }
    setLoading(false);
    // Bust Next's client-side Router Cache so 저장한 사업 (and the dashboard) re-fetch from the
    // DB on the next visit instead of serving a payload cached before this mutation.
    router.refresh();
  }

  return (
    <Button variant={saved ? 'success' : 'outline'} onClick={toggle} disabled={loading}>
      <Bookmark className={saved ? 'h-4 w-4 fill-success-text' : 'h-4 w-4'} />
      {saved ? '저장됨' : '저장하기'}
    </Button>
  );
}
