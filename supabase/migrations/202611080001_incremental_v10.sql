-- Additive migration: preserve all current documents, accounts, buckets and images.
begin;
alter table public.coroa_documents add column if not exists revision bigint not null default 0;
create index if not exists coroa_documents_revision_idx on public.coroa_documents(revision);
create table if not exists public.coroa_deleted_documents(path text primary key,revision bigint not null);
create index if not exists coroa_deleted_revision_idx on public.coroa_deleted_documents(revision);
alter table public.coroa_deleted_documents enable row level security;
revoke all on public.coroa_deleted_documents from public,anon,authenticated;
grant all on public.coroa_deleted_documents to service_role;

create or replace function public.coroa_poll_state(p_known_revision bigint default -1) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object(
  'revision',r.revision,
  'full',p_known_revision<0 or p_known_revision>r.revision,
  'documents',coalesce((select jsonb_object_agg(d.path,d.document) from public.coroa_documents d where p_known_revision<0 or p_known_revision>r.revision or d.revision>p_known_revision),'{}'::jsonb),
  'deleted',case when p_known_revision<0 or p_known_revision>r.revision then '[]'::jsonb else coalesce((select jsonb_agg(d.path) from public.coroa_deleted_documents d where d.revision>p_known_revision),'[]'::jsonb) end)
 from public.coroa_revision r where r.id=1;
$$;

create or replace function public.coroa_commit_documents(p_expected_revision bigint,p_upserts jsonb,p_deleted_paths jsonb default '[]'::jsonb) returns bigint
language plpgsql security invoker set search_path='' as $$
declare current_revision bigint; next_revision bigint;
begin
 select revision into current_revision from public.coroa_revision where id=1 for update;
 if current_revision<>p_expected_revision then raise exception 'Revision conflict' using errcode='40001';end if;
 if jsonb_typeof(p_upserts)<>'object' or jsonb_typeof(p_deleted_paths)<>'array' then raise exception 'Invalid document patch' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_deleted_paths) p where jsonb_typeof(p)<>'string') then raise exception 'Invalid deletion paths' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements_text(p_deleted_paths) p where p='portal.json' or p='accounts.json' or p_upserts ? p) then raise exception 'Invalid deletion paths' using errcode='22023';end if;
 if not (p_upserts ? 'portal.json') and not exists(select 1 from public.coroa_documents where path='portal.json') then raise exception 'Missing portal' using errcode='22023';end if;
 next_revision:=current_revision+1;
 insert into public.coroa_documents(path,document,revision)
 select key,value,next_revision from jsonb_each(p_upserts)
 on conflict(path) do update set document=excluded.document,revision=excluded.revision,updated_at=now()
 where public.coroa_documents.document is distinct from excluded.document;
 insert into public.coroa_deleted_documents(path,revision)
 select d.path,next_revision from public.coroa_documents d where d.path in(select jsonb_array_elements_text(p_deleted_paths))
 on conflict(path) do update set revision=excluded.revision;
 delete from public.coroa_documents where path in(select jsonb_array_elements_text(p_deleted_paths));
 delete from public.coroa_deleted_documents where p_upserts ? path;
 update public.coroa_revision set revision=next_revision where id=1;
 return next_revision;
end;
$$;

-- Retain the legacy full-write RPC for backup recovery/explicit rollback tools.
-- It also marks changed rows, so v10 instances can observe a legacy transaction.
create or replace function public.coroa_save_state(p_expected_revision bigint,p_documents jsonb) returns bigint
language plpgsql security invoker set search_path='' as $$
declare removed jsonb;
begin
 if jsonb_typeof(p_documents)<>'object' or not(p_documents ? 'portal.json') or not(p_documents ? 'accounts.json') then raise exception 'Invalid document set' using errcode='22023';end if;
 select coalesce(jsonb_agg(path),'[]'::jsonb) into removed from public.coroa_documents where not(p_documents ? path);
 return public.coroa_commit_documents(p_expected_revision,p_documents,removed);
end;
$$;
revoke all on function public.coroa_poll_state(bigint) from public,anon,authenticated;
revoke all on function public.coroa_commit_documents(bigint,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.coroa_save_state(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.coroa_poll_state(bigint) to service_role;
grant execute on function public.coroa_commit_documents(bigint,jsonb,jsonb) to service_role;
grant execute on function public.coroa_save_state(bigint,jsonb) to service_role;
commit;

notify pgrst, 'reload schema';
