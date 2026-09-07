import { z } from 'zod';

export const PRODUCT_EVENTS = [
  'signup_completed', 'onboarding_completed', 'dashboard_viewed', 'matches_viewed',
  'program_opened', 'program_saved', 'application_started', 'document_generated',
  'document_exported',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];
const envelope = {
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
};
const programProperties = z.object({ program_id: z.string().uuid() }).strict();

export const productEventSchema = z.discriminatedUnion('name', [
  z.object({ ...envelope, name: z.literal('signup_completed'), properties: z.object({ method: z.enum(['email', 'kakao']) }).strict() }),
  z.object({ ...envelope, name: z.literal('onboarding_completed'), properties: z.object({ entity_type: z.enum(['예비창업자', '개인사업자', '법인']) }).strict() }),
  z.object({ ...envelope, name: z.literal('dashboard_viewed'), properties: z.object({}).strict() }),
  z.object({ ...envelope, name: z.literal('matches_viewed'), properties: z.object({ result_count: z.number().int().min(0).max(10000) }).strict() }),
  z.object({ ...envelope, name: z.literal('program_opened'), properties: programProperties }),
  z.object({ ...envelope, name: z.literal('program_saved'), properties: programProperties }),
  z.object({ ...envelope, name: z.literal('application_started'), properties: programProperties }),
  z.object({ ...envelope, name: z.literal('document_generated'), properties: programProperties }),
  z.object({ ...envelope, name: z.literal('document_exported'), properties: programProperties.extend({ format: z.enum(['docx', 'hwpx']) }) }),
]);
