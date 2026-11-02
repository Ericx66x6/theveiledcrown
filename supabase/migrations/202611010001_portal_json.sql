-- New tables only. Existing Storage buckets and JSONs are not overwritten.
begin;
create table if not exists public.coroa_revision (
  id integer primary key check (id=1), revision bigint not null default 0
);
insert into public.coroa_revision(id,revision) values(1,0) on conflict do nothing;
create table if not exists public.coroa_documents (
  path text primary key, document jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.coroa_revision enable row level security;
alter table public.coroa_documents enable row level security;
revoke all on public.coroa_revision, public.coroa_documents from public, anon, authenticated;
grant all on public.coroa_revision, public.coroa_documents to service_role;

create or replace function public.coroa_load_state() returns jsonb
language sql security invoker set search_path='' as $$
  select jsonb_build_object('revision',r.revision,'documents',coalesce((select jsonb_object_agg(d.path,d.document) from public.coroa_documents d),'{}'::jsonb))
  from public.coroa_revision r where r.id=1;
$$;

create or replace function public.coroa_save_state(p_expected_revision bigint,p_documents jsonb) returns bigint
language plpgsql security invoker set search_path='' as $$
declare current_revision bigint;
begin
  select revision into current_revision from public.coroa_revision where id=1 for update;
  if current_revision <> p_expected_revision then
    raise exception 'Revision conflict' using errcode='40001';
  end if;
  if jsonb_typeof(p_documents) <> 'object' or not (p_documents ? 'portal.json') or not (p_documents ? 'accounts.json') then
    raise exception 'Invalid document set' using errcode='22023';
  end if;
  insert into public.coroa_documents(path,document)
    select key,value from jsonb_each(p_documents)
    on conflict(path) do update set document=excluded.document,updated_at=now()
    where public.coroa_documents.document is distinct from excluded.document;
  delete from public.coroa_documents where not (p_documents ? path);
  update public.coroa_revision set revision=revision+1 where id=1 returning revision into current_revision;
  return current_revision;
end;
$$;
revoke all on function public.coroa_load_state() from public, anon, authenticated;
revoke all on function public.coroa_save_state(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.coroa_load_state() to service_role;
grant execute on function public.coroa_save_state(bigint,jsonb) to service_role;
commit;
