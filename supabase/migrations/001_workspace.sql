-- Run as project database owner in Supabase SQL Editor, once, in order.
begin;
create table public.organisations(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table public.organisation_members(organisation_id uuid references public.organisations on delete restrict,user_id uuid references auth.users on delete restrict,role text not null check(role in ('owner','administrator','employee')),created_at timestamptz not null default now(),primary key(organisation_id,user_id));
create function public.is_member(org uuid,admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organisation_members where organisation_id=org and user_id=auth.uid() and (not admin_only or role in ('owner','administrator')))$$;
create function public.workspace() returns uuid language plpgsql stable security definer set search_path='' as $$declare o uuid;begin select organisation_id into o from public.organisation_members where user_id=auth.uid() order by created_at limit 1;if o is null then raise exception 'Approved workspace membership required';end if;return o;end$$;
create table public.document_sequences(organisation_id uuid references public.organisations,kind text check(kind in ('C','J','Q','B','I','CN')),last_value bigint not null,primary key(organisation_id,kind));
create function public.next_number(org uuid,k text) returns text language plpgsql security definer set search_path='' as $$declare n bigint;begin
 insert into public.document_sequences values(org,k,10000+abs(hashtextextended(gen_random_uuid()::text,0)%80000)) on conflict(organisation_id,kind) do update set last_value=public.document_sequences.last_value+1 returning last_value into n;
 return 'KC-'||k||'-'||n;end$$;
create table public.customers(id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations,number text not null,data jsonb not null default '{}',archived boolean not null default false,revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organisation_id,id),unique(organisation_id,number));
create table public.jobs(id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations,customer_id uuid not null,number text not null,data jsonb not null default '{}',status text not null default 'New Lead',revision integer not null default 1,created_by uuid not null references auth.users,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organisation_id,id),unique(organisation_id,number),foreign key(organisation_id,customer_id) references public.customers(organisation_id,id) on delete restrict,check(status in ('New Lead','Quotation Prepared','Quotation Sent','Accepted','Booking Confirmed','Scheduled','In Progress','Completed','Invoiced','Partially Paid','Paid','Cancelled')));
create table public.business_settings(organisation_id uuid primary key references public.organisations,data jsonb not null default '{}',revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.documents(id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations,job_id uuid not null,source_id uuid,kind text not null check(kind in ('quote','booking','invoice')),number text not null,status text not null default 'draft' check(status in ('draft','issued','sent','accepted','cancelled','void')),body jsonb not null,totals jsonb not null,snapshot jsonb,credit_cents bigint not null default 0 check(credit_cents>=0),revision integer not null default 1,created_by uuid not null references auth.users,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),issued_at timestamptz,unique(organisation_id,id),unique(organisation_id,number),foreign key(organisation_id,job_id) references public.jobs(organisation_id,id) on delete restrict,foreign key(organisation_id,source_id) references public.documents(organisation_id,id) on delete restrict);
create unique index one_active_booking_per_job on public.documents(job_id) where kind='booking' and status not in ('cancelled','void');
create table public.document_items(id uuid primary key default gen_random_uuid(),organisation_id uuid not null,document_id uuid not null,position integer not null,data jsonb not null,created_at timestamptz not null default now(),foreign key(organisation_id,document_id) references public.documents(organisation_id,id) on delete restrict,unique(document_id,position));
create table public.payments(id uuid primary key default gen_random_uuid(),organisation_id uuid not null,job_id uuid not null,invoice_id uuid,kind text not null check(kind in ('deposit','final')),amount_cents bigint not null check(amount_cents>0 and amount_cents<=100000000000),paid_date date not null,method text not null,reference text,created_by uuid not null references auth.users,created_at timestamptz not null default now(),foreign key(organisation_id,job_id) references public.jobs(organisation_id,id) on delete restrict,foreign key(organisation_id,invoice_id) references public.documents(organisation_id,id) on delete restrict,check(kind='deposit' or invoice_id is not null));
create unique index one_deposit_per_job on public.payments(job_id) where kind='deposit';
create unique index one_final_per_invoice on public.payments(invoice_id) where kind='final';
create table public.credit_notes(id uuid primary key default gen_random_uuid(),organisation_id uuid not null,invoice_id uuid not null,number text not null,amount_cents bigint not null check(amount_cents>0),gst_cents bigint not null,reason text not null,created_by uuid not null references auth.users,created_at timestamptz not null default now(),foreign key(organisation_id,invoice_id) references public.documents(organisation_id,id) on delete restrict,unique(organisation_id,number));
create table public.audit_events(id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations,entity_id uuid,action text not null,actor_id uuid references auth.users,created_at timestamptz not null default now());
create function public.audit(org uuid,entity uuid,action_name text) returns void language sql security definer set search_path='' as $$insert into public.audit_events(organisation_id,entity_id,action,actor_id) values(org,entity,action_name,auth.uid())$$;
create index customer_org on public.customers(organisation_id);
create index job_customer on public.jobs(organisation_id,customer_id);
create index document_job on public.documents(organisation_id,job_id);
create index payment_invoice on public.payments(organisation_id,invoice_id);
create index credit_invoice on public.credit_notes(organisation_id,invoice_id);
-- No frontend table writes. Every mutation passes an authorised transactional RPC.
do $$declare t text;begin foreach t in array array['organisations','organisation_members','document_sequences','customers','jobs','business_settings','documents','document_items','payments','credit_notes','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 if t<>'document_sequences' then
 execute format('grant select on public.%I to authenticated',t);
 if t='organisations' then execute format('create policy member_read on public.%I for select to authenticated using(public.is_member(id))',t);
 elsif t='audit_events' then execute format('create policy member_read on public.%I for select to authenticated using(public.is_member(organisation_id,true))',t);
 else execute format('create policy member_read on public.%I for select to authenticated using(public.is_member(organisation_id))',t);end if;
 end if;end loop;end$$;
-- Compatibility views: shared document architecture avoids divergent financial logic.
create view public.quotations with(security_invoker=true) as select * from public.documents where kind='quote';
create view public.bookings with(security_invoker=true) as select * from public.documents where kind='booking';
create view public.invoices with(security_invoker=true) as select * from public.documents where kind='invoice';
create view public.quote_items with(security_invoker=true) as select i.* from public.document_items i join public.documents d on d.id=i.document_id where d.kind='quote';
create view public.invoice_items with(security_invoker=true) as select i.* from public.document_items i join public.documents d on d.id=i.document_id where d.kind='invoice';
revoke all on public.quotations,public.bookings,public.invoices,public.quote_items,public.invoice_items from public,anon,authenticated;
grant select on public.quotations,public.bookings,public.invoices,public.quote_items,public.invoice_items to authenticated;
commit;
