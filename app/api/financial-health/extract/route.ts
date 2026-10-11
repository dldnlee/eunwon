import { createClient } from '@/lib/supabase/server';
import { handleExtractRequest } from '@/lib/financial-health/requests';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  return handleExtractRequest(request, {
    authorize: async () => {
      const { data: { user }, error } = await createClient().auth.getUser();
      return error ? null : user?.id ?? null;
    },
  });
}
