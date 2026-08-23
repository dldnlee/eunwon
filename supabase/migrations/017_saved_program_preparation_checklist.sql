-- User-owned preparation checklist backed by durable eligibility evidence snapshots.

create table public.saved_program_checklist_items (
  id                    uuid primary key default gen_random_uuid(),
  saved_program_id      uuid not null references public.saved_programs(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  source_requirement_id uuid references public.program_eligibility_requirements(id) on delete set null,
  label                 text not null check (char_length(label) between 1 and 500),
  verification          text not null check (verification in ('verified', 'inferred', 'user')),
  confidence            numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_quote        text check (evidence_quote is null or char_length(evidence_quote) <= 2000),
  source_title          text check (source_title is null or char_length(source_title) <= 500),
  source_url            text,
  completed             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (saved_program_id, source_requirement_id),
  check (
    (verification = 'user' and source_requirement_id is null)
    or (verification in ('verified', 'inferred') and source_requirement_id is not null)
  ),
  check (verification <> 'verified' or evidence_quote is not null)
);

create index saved_program_checklist_items_user_idx
  on public.saved_program_checklist_items (user_id);
create index saved_program_checklist_items_saved_idx
  on public.saved_program_checklist_items (saved_program_id, completed, created_at);
create index saved_program_checklist_items_requirement_idx
  on public.saved_program_checklist_items (source_requirement_id)
  where source_requirement_id is not null;

alter table public.saved_program_checklist_items enable row level security;

create policy "users can read own preparation checklist"
  on public.saved_program_checklist_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can add own preparation checklist"
  on public.saved_program_checklist_items for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.saved_programs sp
      where sp.id = saved_program_id and sp.user_id = (select auth.uid())
    )
    and (
      (verification = 'user' and source_requirement_id is null
        and confidence is null and evidence_quote is null
        and source_title is null and source_url is null)
      or exists (
        select 1
        from public.program_eligibility_requirements requirement
        left join public.program_source_documents source
          on source.id = requirement.source_document_id
        join public.saved_programs sp on sp.program_id = requirement.program_id
        where requirement.id = saved_program_checklist_items.source_requirement_id
          and sp.id = saved_program_checklist_items.saved_program_id
          and sp.user_id = (select auth.uid())
          and saved_program_checklist_items.verification = requirement.verification
          and saved_program_checklist_items.confidence is not distinct from requirement.confidence
          and saved_program_checklist_items.evidence_quote is not distinct from requirement.evidence_quote
          and saved_program_checklist_items.source_title is not distinct from source.title
          and saved_program_checklist_items.source_url is not distinct from source.source_url
      )
    )
  );

create policy "users can update own preparation checklist"
  on public.saved_program_checklist_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can delete own preparation checklist"
  on public.saved_program_checklist_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);
