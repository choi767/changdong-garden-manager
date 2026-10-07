-- Apply after supabase-schema.sql, before deploying the Storage-enabled client.
begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('garden-images', 'garden-images', false, 20971520)
on conflict (id) do nothing;

drop policy if exists garden_images_read on storage.objects;
create policy garden_images_read on storage.objects for select to authenticated
using (bucket_id = 'garden-images');
drop policy if exists garden_images_insert on storage.objects;
create policy garden_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'garden-images');

create or replace function public.save_garden_changes_v3(
  p_id text, p_changes jsonb, p_expected_revision bigint
)
returns table(revision bigint)
language plpgsql security invoker set search_path = public
as $$
declare
  v_data jsonb;
  v_revision bigint;
  v_key text;
  v_change jsonb;
  v_rows jsonb;
  v_keys text[] := array['zones','beds','managementGroups','memberships','plants',
    'managementSheets','sheetPlants','workLogs','harvestRecords','photos',
    'scheduleReminders','observationMemos','pestRecords','materialUsages',
    'sheetEvaluations','statusHistories','appSettings','backgroundImages'];
begin
  if auth.uid() is null then raise exception 'GARDEN_SNAPSHOT_AUTH_REQUIRED'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'GARDEN_INVALID_CHANGES';
  end if;

  if p_expected_revision is null then
    insert into public.garden_snapshots(id, data, revision, updated_by)
    values (p_id, '{}'::jsonb, 0, auth.uid()) on conflict (id) do nothing;
  end if;
  select gs.data, gs.revision into v_data, v_revision
  from public.garden_snapshots gs where gs.id = p_id for update;
  if not found or v_revision <> coalesce(p_expected_revision, 0) then
    raise exception 'GARDEN_SNAPSHOT_CONFLICT';
  end if;

  for v_key, v_change in select key, value from jsonb_each(p_changes) loop
    if not (v_key = any(v_keys)) or jsonb_typeof(v_change) <> 'object'
      or jsonb_typeof(v_change->'upserts') is distinct from 'array'
      or jsonb_typeof(v_change->'deleteIds') is distinct from 'array' then
      raise exception 'GARDEN_INVALID_CHANGES';
    end if;
    if exists (select 1 from jsonb_array_elements(v_change->'upserts') r
      where jsonb_typeof(r) <> 'object' or jsonb_typeof(r->'id') is distinct from 'string')
      or exists (select 1 from jsonb_array_elements(v_change->'deleteIds') d where jsonb_typeof(d) <> 'string')
      or (select count(*) from jsonb_array_elements(v_change->'upserts')) <>
         (select count(distinct r->>'id') from jsonb_array_elements(v_change->'upserts') r) then
      raise exception 'GARDEN_INVALID_CHANGES';
    end if;
    select coalesce(jsonb_agg(r.value order by r.ordinality), '[]'::jsonb) into v_rows
    from jsonb_array_elements(coalesce(v_data->v_key, '[]'::jsonb)) with ordinality r
    where not exists (select 1 from jsonb_array_elements(v_change->'upserts') u where u->>'id'=r.value->>'id')
      and not exists (select 1 from jsonb_array_elements_text(v_change->'deleteIds') d where d=r.value->>'id');
    v_data := jsonb_set(v_data, array[v_key], v_rows || (v_change->'upserts'), true);
  end loop;
  foreach v_key in array v_keys loop
    if not (v_data ? v_key) then v_data := jsonb_set(v_data, array[v_key], '[]'::jsonb, true); end if;
  end loop;
  -- Never commit a partially migrated snapshot that would still rewrite embedded photos.
  if exists (select 1 from jsonb_array_elements(v_data->'photos') p
    where coalesce(p->>'imageBlobDataUrl','') <> '' or coalesce(p->>'thumbnailBlobDataUrl','') <> ''
      or coalesce(p->>'imagePath','') = '' or coalesce(p->>'thumbnailPath','') = '')
    or exists (select 1 from jsonb_array_elements(v_data->'backgroundImages') p
      where coalesce(p->>'imageBlobDataUrl','') <> '' or coalesce(p->>'thumbnailBlobDataUrl','') <> '')
    or exists (select 1 from jsonb_array_elements(v_data->'plants') p where coalesce(p->>'imageDataUrl','') <> '') then
    raise exception 'GARDEN_IMAGES_NOT_MIGRATED';
  end if;
  v_data := jsonb_set(v_data, '{_cloudStorageVersion}', '3'::jsonb, true);
  update public.garden_snapshots gs set data=v_data, revision=gs.revision+1,
    updated_at=now(), updated_by=auth.uid()
  where gs.id=p_id returning gs.revision into v_revision;
  return query select v_revision;
end;
$$;
revoke all on function public.save_garden_changes_v3(text,jsonb,bigint) from public;
grant execute on function public.save_garden_changes_v3(text,jsonb,bigint) to authenticated;

create or replace function public.protect_garden_storage_snapshot()
returns trigger language plpgsql set search_path = public
as $$
begin
  if old.data->>'_cloudStorageVersion' = '3'
    and new.data->>'_cloudStorageVersion' is distinct from '3' then
    raise exception '앱을 새로고침한 뒤 다시 저장해 주세요. 사진 저장 방식이 업데이트되었습니다.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_garden_storage_snapshot on public.garden_snapshots;
create trigger protect_garden_storage_snapshot before update on public.garden_snapshots
for each row execute function public.protect_garden_storage_snapshot();
notify pgrst, 'reload schema';
commit;
