-- Apply after 001–003. Optional job-status update and booking issue are one transaction.
begin;
create function public.confirm_booking(p_id uuid,p_revision integer,p_update_job boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare org uuid:=public.workspace();d public.documents;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into d from public.documents where id=p_id and organisation_id=org and kind='booking' for update;
 if d.id is null then raise exception 'Select a booking in your workspace';end if;
 perform public.issue_document(p_id,p_revision);
 if p_update_job then
   update public.jobs set status='Booking Confirmed',revision=revision+1,updated_at=now() where id=d.job_id and organisation_id=org;
   perform public.audit(org,d.job_id,'job_booking_confirmed');
 end if;
end$$;
revoke all on function public.confirm_booking(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.confirm_booking(uuid,integer,boolean) to authenticated;
commit;
