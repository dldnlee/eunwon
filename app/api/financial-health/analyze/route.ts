import { createClient } from '@/lib/supabase/server';
import { handleAnalyzeRequest } from '@/lib/financial-health/requests';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAnalyzeRequest(request, {
    authorize: async () => {
      const { data: { user }, error } = await createClient().auth.getUser();
      return error ? null : user?.id ?? null;
    },
  });
}
