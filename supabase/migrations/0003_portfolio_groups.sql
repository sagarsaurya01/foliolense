-- FolioLense 0003: portfolio groups (MProfit-style). A group is a named set of portfolios in one family,
-- shown combined like Family Group but over only the chosen members, e.g. "Ajay + HUF".

create table public.portfolio_groups (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (family_id, name)
);
create index portfolio_groups_family_idx on public.portfolio_groups(family_id);
create trigger portfolio_groups_touch before update on public.portfolio_groups
  for each row execute function public.touch_updated_at();

create table public.portfolio_group_members (
  group_id      uuid not null references public.portfolio_groups(id) on delete cascade,
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  primary key (group_id, portfolio_id)
);

create or replace function public.family_of_group(g uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from portfolio_groups where id = g;
$$;

alter table public.portfolio_groups        enable row level security;
alter table public.portfolio_group_members enable row level security;

create policy portfolio_groups_select on public.portfolio_groups for select to authenticated
  using (public.can_read_family(family_id));
create policy portfolio_groups_write on public.portfolio_groups for all to authenticated
  using (public.can_write_family(family_id)) with check (public.can_write_family(family_id));

-- a member row must join a group and a portfolio of the same family
create policy group_members_select on public.portfolio_group_members for select to authenticated
  using (public.can_read_family(public.family_of_group(group_id)));
create policy group_members_write on public.portfolio_group_members for all to authenticated
  using (public.can_write_family(public.family_of_group(group_id)))
  with check (public.can_write_family(public.family_of_group(group_id))
              and public.family_of_group(group_id) = public.family_of_portfolio(portfolio_id));

revoke all on public.portfolio_groups, public.portfolio_group_members from anon;

select 'FolioLense 0003 groups applied' as result;
