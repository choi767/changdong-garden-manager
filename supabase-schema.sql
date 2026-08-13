create table if not exists public.garden_snapshots (
  id text primary key,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.garden_snapshots enable row level security;

drop policy if exists "garden_snapshots_select_authenticated" on public.garden_snapshots;
create policy "garden_snapshots_select_authenticated"
on public.garden_snapshots
for select
to authenticated
using (true);

drop policy if exists "garden_snapshots_insert_authenticated" on public.garden_snapshots;
create policy "garden_snapshots_insert_authenticated"
on public.garden_snapshots
for insert
to authenticated
with check (true);

drop policy if exists "garden_snapshots_update_authenticated" on public.garden_snapshots;
create policy "garden_snapshots_update_authenticated"
on public.garden_snapshots
for update
to authenticated
using (true)
with check (true);

create or replace function public.save_garden_snapshot(
  p_id text,
  p_data jsonb,
  p_expected_revision bigint
)
returns table(data jsonb, revision bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.garden_snapshots%rowtype;
begin
  if auth.uid() is null then
    raise exception 'GARDEN_SNAPSHOT_AUTH_REQUIRED';
  end if;

  if p_expected_revision is null then
    insert into public.garden_snapshots (id, data, revision, updated_by)
    values (p_id, p_data, 1, auth.uid())
    on conflict (id) do nothing
    returning * into v_row;

    if v_row.id is null then
      select * into v_row
      from public.garden_snapshots
      where id = p_id;
    end if;
  else
    update public.garden_snapshots
    set
      data = p_data,
      revision = revision + 1,
      updated_at = now(),
      updated_by = auth.uid()
    where id = p_id
      and revision = p_expected_revision
    returning * into v_row;

    if v_row.id is null then
      raise exception 'GARDEN_SNAPSHOT_CONFLICT';
    end if;
  end if;

  return query select v_row.data, v_row.revision;
end;
$$;

grant execute on function public.save_garden_snapshot(text, jsonb, bigint) to authenticated;
