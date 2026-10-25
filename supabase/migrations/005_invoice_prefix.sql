-- Keep the invoice counter, while using the requested KC-INV presentation prefix.
begin;
create or replace function public.next_number(org uuid,k text) returns text language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
 insert into public.document_sequences values(org,k,10000+abs(hashtextextended(gen_random_uuid()::text,0)%80000))
 on conflict(organisation_id,kind) do update set last_value=public.document_sequences.last_value+1 returning last_value into n;
 return 'KC-'||case when k='I' then 'INV' else k end||'-'||n;
end$$;
revoke all on function public.next_number(uuid,text) from public,anon,authenticated;
commit;
