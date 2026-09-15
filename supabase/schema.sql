-- Shared portfolio data: everyone can read it, and only the seeded owner can edit it.
-- Before running this script, replace OWNER_EMAIL_HERE with the email used to create
-- the portfolio's Supabase Auth owner account.

create table if not exists public.portfolio_projects_shared (
  id smallint primary key default 1 check (id = 1),
  owner_id uuid not null references auth.users (id) on delete restrict,
  projects jsonb not null default '[]'::jsonb,
  initialized boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_projects_shared enable row level security;

drop policy if exists "Anyone can view the shared portfolio" on public.portfolio_projects_shared;
create policy "Anyone can view the shared portfolio"
  on public.portfolio_projects_shared for select to anon, authenticated
  using (true);

drop policy if exists "Only the portfolio owner can edit" on public.portfolio_projects_shared;
create policy "Only the portfolio owner can edit"
  on public.portfolio_projects_shared for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Remove any legacy/default privileges first, then grant only the operations used
-- by the public portfolio viewer and the authenticated portfolio owner.
revoke all privileges on table public.portfolio_projects_shared from anon, authenticated;
grant select on public.portfolio_projects_shared to anon, authenticated;
grant update on public.portfolio_projects_shared to authenticated;

do $$
declare
  configured_owner uuid;
  legacy_projects jsonb;
begin
  select id into configured_owner
  from auth.users
  where lower(email) = lower('OWNER_EMAIL_HERE')
  order by created_at
  limit 1;

  if configured_owner is null then
    raise exception 'No Supabase Auth user found for OWNER_EMAIL_HERE. Create the owner account first and replace the placeholder email.';
  end if;

  -- Preserve this owner's list if the older per-account table was already used.
  if to_regclass('public.portfolio_projects') is not null then
    execute 'select projects from public.portfolio_projects where user_id = $1 order by updated_at desc limit 1'
      into legacy_projects using configured_owner;
  end if;

  insert into public.portfolio_projects_shared (id, owner_id, projects, initialized)
  values (1, configured_owner, coalesce(legacy_projects, '[]'::jsonb), legacy_projects is not null)
  on conflict (id) do nothing;
end;
$$;
