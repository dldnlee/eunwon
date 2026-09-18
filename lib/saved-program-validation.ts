import { z } from 'zod';

const invalidDateMessage = '날짜 형식이 올바르지 않습니다.';
const optionalDate = z.union([
  z.literal(''),
  // PostgreSQL dates have no year zero, even though ISO 8601 permits it.
  z.iso.date({ error: invalidDateMessage })
    .refine((value) => !value.startsWith('0000-'), { error: invalidDateMessage }),
  z.null(),
], { error: invalidDateMessage });

export const savedProgramUpdateSchema = z.object({
  notes: z.string().max(5000).optional(),
  outcome: z.string().max(2000).nullable().optional(),
  receivedAt: optionalDate.optional(),
  amountKrw: z.number().int().min(0).max(2147483647).nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
  nextActionDueAt: optionalDate.optional(),
}).refine((value) => Object.keys(value).length > 0, '변경할 내용이 없습니다.');
