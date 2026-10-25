begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-assets','business-assets',false,2097152,array['image/png','image/jpeg']) on conflict(id) do nothing;
create policy asset_read on storage.objects for select to authenticated using(bucket_id='business-assets' and exists(select 1 from public.organisation_members m where m.user_id=auth.uid() and m.organisation_id::text=(storage.foldername(name))[1]));
create policy asset_insert on storage.objects for insert to authenticated with check(bucket_id='business-assets' and exists(select 1 from public.organisation_members m where m.user_id=auth.uid() and m.role in ('owner','administrator') and m.organisation_id::text=(storage.foldername(name))[1]));
-- Assets are immutable: new uploads use new UUID paths so old issue snapshots stay valid.
commit;
