create table if not exists public.public_report_links (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  access_count integer not null default 0 check (access_count >= 0)
);

alter table public.public_report_links enable row level security;

create policy "Users can view own public report links"
  on public.public_report_links
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own public report links"
  on public.public_report_links
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.analyses
      where analyses.id = analysis_id
        and analyses.user_id = (select auth.uid())
    )
  );

create policy "Users can revoke own public report links"
  on public.public_report_links
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.public_report_links from anon;
grant select, insert on public.public_report_links to authenticated;
grant update (revoked_at) on public.public_report_links to authenticated;
grant select, update (last_accessed_at, access_count) on public.public_report_links to service_role;
