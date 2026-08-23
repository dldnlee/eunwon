-- Follow-up discovered by the post-011 performance advisor.
-- This FK is used when rendering source citations for extracted requirements.

create index program_eligibility_requirements_source_document_idx
  on public.program_eligibility_requirements (source_document_id)
  where source_document_id is not null;
