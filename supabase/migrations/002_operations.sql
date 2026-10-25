begin;
create function public.calculate_document(b jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare i jsonb;items jsonb:='[]';amount bigint;rate bigint;qty numeric;labour bigint:=0;materials bigint:=0;additional bigint:=0;variation bigint:=0;direct bigint;base bigint;fee bigint:=0;discount bigint;gst bigint:=0;total bigint;deposit bigint;fixed bigint;markup numeric;
begin
 if coalesce(jsonb_typeof(b->'items'),'')<>'array' or jsonb_array_length(b->'items')>1000 then raise exception 'Provide up to 1000 cost rows';end if;
 if coalesce(b->>'quote_type','') not in ('fixed','hourly','cost-plus') then raise exception 'Invalid quotation type';end if;
 if coalesce(b->>'tax','') not in ('taxable','gst-free','other') or coalesce(b->>'price_mode','') not in ('inclusive','exclusive') then raise exception 'Invalid tax treatment';end if;
 for i in select value from jsonb_array_elements(b->'items') loop
 if coalesce(i->>'quantity','') !~ '^\d+(\.\d{1,4})?$' then raise exception 'Quantity must be nonnegative with up to four decimal places';end if;
 qty:=(i->>'quantity')::numeric;rate:=(i->>'rate_cents')::bigint;
 if qty>10000000000 or rate is null or rate<0 or rate>100000000000 then raise exception 'Invalid quantity or price';end if;
 amount:=round(qty*rate);
 case i->>'category' when 'labour' then labour:=labour+amount;when 'materials' then materials:=materials+amount;when 'additional' then additional:=additional+amount;when 'variation' then variation:=variation+amount;else raise exception 'Invalid cost category';end case;
 items:=items||jsonb_build_array(i||jsonb_build_object('amount_cents',amount));end loop;
 direct:=labour+materials+additional+variation;base:=direct;
 if b->>'quote_type'='fixed' and b->>'fixed_cents' is not null then base:=(b->>'fixed_cents')::bigint;if base<0 then raise exception 'Invalid fixed price';end if;end if;fixed:=base-direct;
 if b->>'quote_type'='cost-plus' then
 if b->>'fee_method'='fixed' then fee:=coalesce((b->>'fee_cents')::bigint,0);
 elsif b->>'fee_method'='percentage' then markup:=coalesce((b->>'markup_percent')::numeric,0);if markup<0 or markup>10000 or scale(markup)>4 then raise exception 'Invalid markup';end if;fee:=round(base*markup/100);
 else raise exception 'Choose cost-plus fee method';end if;
 if fee<0 then raise exception 'Invalid management fee';end if;base:=base+fee;end if;
 discount:=coalesce((b->>'discount_cents')::bigint,0);if discount<0 or discount>base then raise exception 'Discount exceeds charges';end if;base:=base-discount;
 if b->>'tax'='taxable' then gst:=round(base::numeric/case when b->>'price_mode'='inclusive' then 11 else 10 end);end if;
 total:=base+case when b->>'tax'='taxable' and b->>'price_mode'='exclusive' then gst else 0 end;
 deposit:=coalesce((b->>'deposit_cents')::bigint,0);if deposit<0 or deposit>total or total>100000000000 then raise exception 'Invalid deposit or total';end if;
 return jsonb_build_object('items',items,'labour',labour,'materials',materials,'additional',additional,'variation',variation,'direct_cents',direct,'adjustment_cents',fixed,'fee_cents',fee,'discount_cents',discount,'net_cents',total-gst,'gst_cents',gst,'total_cents',total,'deposit_cents',deposit);
end$$;
create function public.save_customer(p_id uuid,p_data jsonb,p_revision integer default 0) returns uuid language plpgsql security definer set search_path='' as $$declare org uuid:=public.workspace();r uuid;begin
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>50000 then raise exception 'Invalid customer data';end if;
 if p_id is null then insert into public.customers(organisation_id,number,data) values(org,public.next_number(org,'C'),p_data) returning id into r;
 else update public.customers set data=p_data,revision=revision+1,updated_at=now() where id=p_id and organisation_id=org and revision=p_revision returning id into r;if r is null then raise exception 'Record changed or unavailable. Reload before saving.';end if;end if;
 perform public.audit(org,r,'customer_saved');return r;end$$;
create function public.save_job(p_id uuid,p_customer uuid,p_data jsonb,p_status text,p_revision integer default 0) returns uuid language plpgsql security definer set search_path='' as $$declare org uuid:=public.workspace();r uuid;begin
 if not exists(select 1 from public.customers where id=p_customer and organisation_id=org and not archived) then raise exception 'Select an active customer';end if;
 if nullif(p_data->>'end_date','')::date<nullif(p_data->>'start_date','')::date then raise exception 'Completion cannot precede start';end if;
 if p_id is null then insert into public.jobs(organisation_id,customer_id,number,data,status,created_by) values(org,p_customer,public.next_number(org,'J'),p_data,p_status,auth.uid()) returning id into r;
 else update public.jobs set data=p_data,status=p_status,revision=revision+1,updated_at=now() where id=p_id and organisation_id=org and customer_id=p_customer and revision=p_revision returning id into r;if r is null then raise exception 'Record changed or unavailable. Reload before saving.';end if;end if;
 perform public.audit(org,r,'job_saved');return r;end$$;
create function public.save_document(p_id uuid,p_kind text,p_job uuid,p_source uuid,p_body jsonb,p_revision integer default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid:=public.workspace();r uuid;old public.documents;tot jsonb;i jsonb;pos integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if not exists(select 1 from public.jobs where id=p_job and organisation_id=org) then raise exception 'Select a job in your workspace';end if;
 if p_source is not null and not exists(select 1 from public.documents where id=p_source and organisation_id=org and job_id=p_job and status not in ('void','cancelled')) then raise exception 'Source must belong to this job';end if;
 if octet_length(p_body::text)>1000000 then raise exception 'Document is too large';end if;
 if nullif(p_body->>'due_date','')::date<nullif(p_body->>'date','')::date or nullif(p_body->>'expiry_date','')::date<nullif(p_body->>'date','')::date or nullif(p_body->>'end_date','')::date<nullif(p_body->>'start_date','')::date then raise exception 'Check document dates';end if;
 tot:=public.calculate_document(p_body);
 if p_id is null then insert into public.documents(organisation_id,job_id,source_id,kind,number,body,totals,created_by) values(org,p_job,p_source,p_kind,public.next_number(org,case p_kind when 'quote' then 'Q' when 'booking' then 'B' when 'invoice' then 'I' end),p_body,tot,auth.uid()) returning id into r;
 else select * into old from public.documents where id=p_id and organisation_id=org for update;
 if old.id is null or old.revision<>p_revision then raise exception 'Document changed or unavailable. Reload before saving.';end if;
 if old.kind<>p_kind or old.job_id<>p_job then raise exception 'Document kind and job cannot be changed';end if;
 if old.kind in ('invoice','booking') and old.status<>'draft' then raise exception 'Issued documents are locked. Void and reissue a corrected document.';end if;
 update public.documents set body=p_body,totals=tot,revision=revision+1,updated_at=now() where id=p_id;r:=p_id;
 end if;
 delete from public.document_items where document_id=r;
 for i in select value from jsonb_array_elements(tot->'items') loop insert into public.document_items(organisation_id,document_id,position,data) values(org,r,pos,i);pos:=pos+1;end loop;
 perform public.audit(org,r,'document_saved');return r;
end$$;
create function public.issue_document(p_id uuid,p_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare org uuid:=public.workspace();d public.documents;j public.jobs;c public.customers;s jsonb;paid bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));select * into d from public.documents where id=p_id and organisation_id=org for update;
 if d.id is null or d.revision<>p_revision then raise exception 'Document changed or unavailable';end if;
 if d.status in ('void','cancelled') or (d.kind in ('invoice','booking') and d.status<>'draft') then raise exception 'This document cannot be issued';end if;
 select * into j from public.jobs where id=d.job_id;select * into c from public.customers where id=j.customer_id;select data into s from public.business_settings where organisation_id=org;
 if coalesce(s->>'business_name','')='' or coalesce(s->>'abn','')='' or coalesce(s->>'identity_approved','false')<>'true' then raise exception 'Approve your business identity and ABN in Settings before issuing';end if;
 if coalesce(s->>'terms_approved','false')<>'true' then raise exception 'Review and approve the proposed terms in Settings';end if;
 if coalesce(d.body->>'date','')='' then raise exception 'Issue date is required';end if;
 perform (d.body->>'date')::date;
 if coalesce(d.body->>'title','')='' or jsonb_array_length(d.body->'items')=0 then raise exception 'Add a job title and cost breakdown before issuing';end if;
 if exists(select 1 from jsonb_array_elements(d.body->'items') i where coalesce(i->>'description','')='') then raise exception 'Describe every cost row';end if;
 if d.body->>'tax'<>'taxable' and coalesce(d.body->>'tax_reason','')='' then raise exception 'Record the approved basis for nonstandard GST treatment';end if;
 if d.body->>'tax'='taxable' and coalesce(s->>'gst_registered','false')<>'true' then raise exception 'Taxable supply requires confirmed GST registration';end if;
 if d.kind='invoice' and (d.totals->>'total_cents')::bigint>=100000 and coalesce(c.data->>'name','')='' and coalesce(c.data->>'company','')='' and coalesce(c.data->>'abn','')='' then raise exception 'Buyer identity or ABN is required for invoices of $1,000 or more';end if;
 if d.body->>'contract_context'='nsw-residential' and (d.totals->>'deposit_cents')::bigint*10>(d.totals->>'total_cents')::bigint then raise exception 'Review NSW residential deposit: maximum 10%% of contract price';end if;
 if coalesce(d.body->>'contract_context','')='' then raise exception 'Choose the job contract context';end if;
 if (d.body->>'use_signature')::boolean and (coalesce(s->>'signature_path','')='' or coalesce(s->>'signature_approved','false')<>'true') then raise exception 'Upload and approve the genuine signature';end if;
 if (d.body->>'use_stamp')::boolean and coalesce(s->>'stamp_approved','false')<>'true' then raise exception 'Approve the company artwork before issue';end if;
 if d.kind='invoice' then
 select coalesce(sum(amount_cents),0) into paid from public.payments where job_id=d.job_id and kind='deposit' and invoice_id is null;
 if paid>(d.totals->>'total_cents')::bigint then raise exception 'Unallocated deposit exceeds this invoice. Review allocation before issuing.';end if;
 update public.payments set invoice_id=d.id where job_id=d.job_id and kind='deposit' and invoice_id is null;
 end if;
 update public.documents set status='issued',issued_at=now(),revision=revision+1,updated_at=now(),snapshot=jsonb_build_object('customer',to_jsonb(c),'job',to_jsonb(j),'settings',s) where id=d.id;
 perform public.audit(org,d.id,'document_issued');end$$;
create function public.set_document_status(p_id uuid,p_status text,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$declare org uuid:=public.workspace();d public.documents;begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));select * into d from public.documents where id=p_id and organisation_id=org for update;if d.id is null then raise exception 'Unavailable document';end if;
 if p_status='void' then
 if not public.is_member(org,true) or length(trim(p_reason))<5 then raise exception 'Administrator and correction reason required';end if;
 if exists(select 1 from public.payments where invoice_id=d.id) or d.credit_cents>0 then raise exception 'This invoice has financial entries. Preserve it and use credit notes/accountant review.';end if;
 elsif d.kind='quote' and p_status in ('sent','accepted','cancelled') and d.status in ('issued','sent','accepted') then null;
 elsif d.kind='booking' and p_status='cancelled' then null;
 else raise exception 'Invalid status change';end if;
 update public.documents set status=p_status,revision=revision+1,updated_at=now(),body=case when p_status='void' then body||jsonb_build_object('void_reason',p_reason) else body end where id=d.id;
 perform public.audit(org,d.id,'document_'||p_status);end$$;
create function public.record_payment(p_job uuid,p_invoice uuid,p_kind text,p_amount bigint,p_date date,p_method text,p_reference text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid:=public.workspace();d public.documents;paid bigint;r uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if not exists(select 1 from public.jobs where id=p_job and organisation_id=org) then raise exception 'Unavailable job';end if;
 if p_date is null or p_date>(now() at time zone 'Australia/Sydney')::date or length(trim(p_method))=0 then raise exception 'Enter an actual receipt date and payment method';end if;
 if p_invoice is not null then select * into d from public.documents where id=p_invoice and organisation_id=org and job_id=p_job and kind='invoice' for update;
 if d.id is null or d.status not in ('issued','sent') then raise exception 'Select an issued invoice';end if;
 select coalesce(sum(amount_cents),0) into paid from public.payments where invoice_id=d.id;
 if p_amount+paid+d.credit_cents>(d.totals->>'total_cents')::bigint then raise exception 'Overpayment detected. Review the receipt; refunds/credit balances require accountant handling.';end if;
 elsif p_kind<>'deposit' then raise exception 'Final payment requires an invoice';
 elsif exists(select 1 from public.documents where job_id=p_job and kind='invoice' and status not in ('draft','void')) then raise exception 'Allocate this deposit to an issued invoice';end if;
 insert into public.payments(organisation_id,job_id,invoice_id,kind,amount_cents,paid_date,method,reference,created_by) values(org,p_job,p_invoice,p_kind,p_amount,p_date,p_method,p_reference,auth.uid()) returning id into r;
 perform public.audit(org,r,'payment_recorded');return r;end$$;
create function public.create_credit(p_invoice uuid,p_amount bigint,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$declare org uuid:=public.workspace();d public.documents;paid bigint;r uuid;g bigint;begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));if not public.is_member(org,true) then raise exception 'Administrator required';end if;
 select * into d from public.documents where id=p_invoice and organisation_id=org and kind='invoice' for update;
 if d.id is null or d.status<>'issued' or p_amount<=0 or length(trim(p_reason))<5 then raise exception 'Enter an issued invoice, positive credit and reason';end if;
 select coalesce(sum(amount_cents),0) into paid from public.payments where invoice_id=d.id;
 if paid+d.credit_cents+p_amount>(d.totals->>'total_cents')::bigint then raise exception 'Credit exceeds unpaid balance; refund processing requires accountant review';end if;
 g:=case when d.body->>'tax'='taxable' then round(p_amount::numeric/11) else 0 end;
 insert into public.credit_notes(organisation_id,invoice_id,number,amount_cents,gst_cents,reason,created_by) values(org,d.id,public.next_number(org,'CN'),p_amount,g,p_reason,auth.uid()) returning id into r;
 update public.documents set credit_cents=credit_cents+p_amount,revision=revision+1 where id=d.id;perform public.audit(org,r,'credit_issued');return r;end$$;
create function public.customer_impact(p_id uuid) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('jobs',(select count(*) from public.jobs where customer_id=c.id),'documents',(select count(*) from public.documents d join public.jobs j on j.id=d.job_id where j.customer_id=c.id),'issued',(select count(*) from public.documents d join public.jobs j on j.id=d.job_id where j.customer_id=c.id and d.issued_at is not null),'payments',(select count(*) from public.payments p join public.jobs j on j.id=p.job_id where j.customer_id=c.id)) from public.customers c where c.id=p_id and c.organisation_id=public.workspace()$$;
create function public.remove_customer(p_id uuid,p_confirmation text,p_archive boolean default false) returns void language plpgsql security definer set search_path='' as $$declare org uuid:=public.workspace();c public.customers;begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));if not public.is_member(org,true) then raise exception 'Administrator required';end if;
 select * into c from public.customers where id=p_id and organisation_id=org for update;if c.id is null or p_confirmation<>c.number then raise exception 'Type the exact customer ID to confirm';end if;
 if p_archive then update public.customers set archived=true,revision=revision+1 where id=c.id;perform public.audit(org,c.id,'customer_archived');return;end if;
 if exists(select 1 from public.jobs where customer_id=c.id) then raise exception 'Linked jobs must be retained. Archive this customer instead; no financial records were deleted.';end if;
 delete from public.customers where id=c.id;perform public.audit(org,c.id,'customer_deleted');end$$;
create function public.save_settings(p_data jsonb,p_revision integer default 0) returns void language plpgsql security definer set search_path='' as $$declare org uuid:=public.workspace();r integer;begin
 if not public.is_member(org,true) then raise exception 'Only owner/administrator can change financial settings';end if;
 if octet_length(p_data::text)>100000 then raise exception 'Upload artwork through private storage';end if;
 if p_data->>'bsb'<>'' and coalesce(p_data->>'bsb','')!~ '^\d{3}-?\d{3}$' then raise exception 'BSB must contain six digits';end if;
 if p_revision=0 then insert into public.business_settings(organisation_id,data) values(org,p_data);
 else update public.business_settings set data=p_data,revision=revision+1,updated_at=now() where organisation_id=org and revision=p_revision returning revision into r;if r is null then raise exception 'Settings changed. Reload before saving.';end if;end if;
 perform public.audit(org,org,'settings_saved');end$$;
-- Revoke implicit PUBLIC execution, including internal numbering and audit helpers.
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_member','workspace','next_number','audit','calculate_document','save_customer','save_job','save_document','issue_document','set_document_status','record_payment','create_credit','customer_impact','remove_customer','save_settings') loop execute 'revoke all on function '||f.signature||' from public, anon, authenticated';end loop;end$$;
grant execute on function public.is_member(uuid,boolean),public.workspace(),public.save_customer(uuid,jsonb,integer),public.save_job(uuid,uuid,jsonb,text,integer),public.save_document(uuid,text,uuid,uuid,jsonb,integer),public.issue_document(uuid,integer),public.set_document_status(uuid,text,text),public.record_payment(uuid,uuid,text,bigint,date,text,text),public.create_credit(uuid,bigint,text),public.customer_impact(uuid),public.remove_customer(uuid,text,boolean),public.save_settings(jsonb,integer) to authenticated;
commit;
