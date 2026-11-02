-- New private bucket. Existing image/character buckets are preserved.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('coroa-imagens','coroa-imagens',false,47185920,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='coroa-imagens' and public) then
  raise exception 'The coroa-imagens bucket must be private';
 end if;
end $$;
-- Protect this bucket even if older project policies allow other buckets broadly.
drop policy if exists coroa_images_server_only on storage.objects;
create policy coroa_images_server_only on storage.objects as restrictive for all
to anon,authenticated
using(bucket_id <> 'coroa-imagens')
with check(bucket_id <> 'coroa-imagens');
commit;
