-- Schéma préparé pour un projet Supabase neuf. Pas exécuté sur la base actuelle.
-- Attribuer role=admin et agency_id dans app_metadata depuis un serveur autorisé.
create table public.agencies (id uuid primary key default gen_random_uuid(), name text not null, admin_uid uuid not null unique references auth.users(id));
create function public.kc_admin(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.agencies where id=a and admin_uid=auth.uid()) and auth.jwt()->'app_metadata'->>'role'='admin' and auth.jwt()->'app_metadata'->>'agency_id'=a::text;
$$;
create table public.shipments (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id),
 ref text not null unique default ('KC-'||upper(replace(gen_random_uuid()::text,'-',''))),
 client_uid uuid references auth.users(id), client text not null, email text, contact text,
 item text not null, category text not null, origin text not null, destination text not null, container text,
 delivery text, status text not null default 'Enregistré', eta timestamptz, order_usd numeric(18,2), order_gnf numeric(20,0),
 created timestamptz not null default now(), updated timestamptz not null default now(), version integer not null default 0,
 unique(id,agency_id)
);
create function public.kc_can_read(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shipments where id=s and (public.kc_admin(agency_id) or client_uid=auth.uid()));
$$;
create table public.events (
 id uuid primary key default gen_random_uuid(), shipment_id uuid not null, agency_id uuid not null,
 type text not null, place text not null, event_date timestamptz not null, note text, source text,
 planned boolean not null default false, published boolean not null default false,
 lat double precision check(lat between -90 and 90), lng double precision check(lng between -180 and 180), mode text,
 created timestamptz not null default now(), foreign key(shipment_id,agency_id) references public.shipments(id,agency_id)
);
create table public.invoices (
 id uuid primary key default gen_random_uuid(), shipment_id uuid not null, agency_id uuid not null,
 number text not null unique, reason text not null, stage text not null, provider text not null, signer text not null,
 usd numeric(18,2) not null check(usd>0), gnf numeric(20,0) not null check(gnf>0), gnf_rate numeric not null check(gnf_rate>0),
 rate_source text not null, status text not null default 'a_regler' check(status in ('a_regler','preuve_recue','paye')),
 created timestamptz not null default now(), foreign key(shipment_id,agency_id) references public.shipments(id,agency_id)
);
-- Référence CFA et taux internes : jamais accessibles aux clients.
create table public.invoice_internal (
 invoice_id uuid primary key references public.invoices(id), agency_id uuid not null references public.agencies(id),
 base_xaf numeric not null check(base_xaf>0), usd_rate numeric not null check(usd_rate>0)
);
create table public.documents (
 id uuid primary key default gen_random_uuid(),shipment_id uuid not null,agency_id uuid not null,
 name text not null,path text not null unique,mime text not null,size bigint not null check(size between 1 and 10485760),
 shared boolean not null default false,created timestamptz not null default now(),
 foreign key(shipment_id,agency_id) references public.shipments(id,agency_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),shipment_id uuid not null,agency_id uuid not null,
 title text not null,body text not null,email_status text not null default 'non_configure',attempts integer not null default 0,
 created timestamptz not null default now(),foreign key(shipment_id,agency_id) references public.shipments(id,agency_id)
);
create table public.audit (
 id uuid primary key default gen_random_uuid(),agency_id uuid not null references public.agencies(id),
 actor uuid not null references auth.users(id),shipment_id uuid references public.shipments(id),action text not null,detail jsonb,
 created timestamptz not null default now()
);
alter table public.agencies enable row level security;
alter table public.shipments enable row level security;
alter table public.events enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_internal enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit enable row level security;
create policy agency_read on public.agencies for select to authenticated using(public.kc_admin(id));
create policy shipments_read on public.shipments for select to authenticated using(public.kc_admin(agency_id) or client_uid=auth.uid());
create policy shipments_insert on public.shipments for insert to authenticated with check(public.kc_admin(agency_id));
create policy shipments_update on public.shipments for update to authenticated using(public.kc_admin(agency_id)) with check(public.kc_admin(agency_id));
create policy events_read on public.events for select to authenticated using(public.kc_admin(agency_id) or (published and public.kc_can_read(shipment_id)));
create policy events_insert on public.events for insert to authenticated with check(public.kc_admin(agency_id));
create policy events_update on public.events for update to authenticated using(public.kc_admin(agency_id)) with check(public.kc_admin(agency_id));
create policy invoices_read on public.invoices for select to authenticated using(public.kc_can_read(shipment_id));
create policy invoices_insert on public.invoices for insert to authenticated with check(public.kc_admin(agency_id));
create policy invoices_update on public.invoices for update to authenticated using(public.kc_admin(agency_id)) with check(public.kc_admin(agency_id));
create policy costs_admin on public.invoice_internal for all to authenticated using(public.kc_admin(agency_id)) with check(public.kc_admin(agency_id) and exists(select 1 from public.invoices where id=invoice_id and agency_id=invoice_internal.agency_id));
create policy documents_read on public.documents for select to authenticated using(public.kc_admin(agency_id) or (shared and public.kc_can_read(shipment_id)));
create policy documents_insert on public.documents for insert to authenticated with check(public.kc_admin(agency_id));
create policy notifications_read on public.notifications for select to authenticated using(public.kc_can_read(shipment_id));
create policy notifications_insert on public.notifications for insert to authenticated with check(public.kc_admin(agency_id));
create policy audit_read on public.audit for select to authenticated using(public.kc_admin(agency_id));
-- Journal écrit par les opérations serveur, aucune modification autorisée depuis le client.
create index events_shipment_date on public.events(shipment_id,event_date);
create index invoices_shipment on public.invoices(shipment_id);
create index notifications_shipment_date on public.notifications(shipment_id,created);
-- Recherche anonyme par référence seulement, sans accès à la liste des dossiers.
create function public.get_public_tracking(p_ref text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('shipment',jsonb_build_object('ref',s.ref,'origin',s.origin,'destination',s.destination,'status',s.status,'eta',s.eta,'updated',s.updated),
 'events',coalesce((select jsonb_agg(jsonb_build_object('type',e.type,'place',e.place,'date',e.event_date,'note',e.note,'planned',e.planned,'lat',e.lat,'lng',e.lng,'mode',e.mode) order by e.event_date) from public.events e where e.shipment_id=s.id and e.published),'[]'::jsonb))
 from public.shipments s where s.ref=p_ref;
$$;
revoke all on function public.get_public_tracking(text) from public;
grant execute on function public.get_public_tracking(text) to anon,authenticated;
revoke all on function public.kc_can_read(uuid) from public;
grant execute on function public.kc_can_read(uuid) to authenticated;
-- Bucket de documents privé.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cargo-documents','cargo-documents',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy cargo_files_insert on storage.objects for insert to authenticated with check(bucket_id='cargo-documents' and public.kc_admin(((storage.foldername(name))[1])::uuid));
create policy cargo_files_read on storage.objects for select to authenticated using(bucket_id='cargo-documents' and (public.kc_admin(((storage.foldername(name))[1])::uuid) or exists(select 1 from public.documents d where d.path=name and d.shared and public.kc_can_read(d.shipment_id))));
-- Aucun tarif ni expédition fictive inséré.

-- Extension de préparation : modèles privés, compléments et corrections.
-- À relire et tester sur un projet neuf avant migration. Aucune connexion active.
alter table public.invoices add column metadata jsonb not null default '{}'::jsonb;
alter table public.events add column published_at timestamptz;
create table public.admin_models(id uuid primary key default gen_random_uuid(),agency_id uuid not null references public.agencies(id),kind text not null check(kind in ('country','service')),name text not null,config jsonb not null,version integer not null default 0,created timestamptz not null default now(),updated timestamptz not null default now(),unique(agency_id,kind,name));
create table public.company_settings(agency_id uuid primary key references public.agencies(id),data jsonb not null,version integer not null default 0);
create table public.shipment_details(shipment_id uuid primary key,agency_id uuid not null,data jsonb not null,updated timestamptz not null default now(),foreign key(shipment_id,agency_id) references public.shipments(id,agency_id));
create table public.invoice_corrections(id uuid primary key default gen_random_uuid(),invoice_id uuid not null unique references public.invoices(id),agency_id uuid not null references public.agencies(id),data jsonb not null,created timestamptz not null default now());
create table public.document_details(document_id uuid primary key references public.documents(id),agency_id uuid not null references public.agencies(id),kind text not null,note text not null default '');
create table public.event_history(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),agency_id uuid not null references public.agencies(id),before jsonb not null,reason text not null,created timestamptz not null default now());
alter table public.admin_models enable row level security;
alter table public.company_settings enable row level security;
alter table public.shipment_details enable row level security;
alter table public.invoice_corrections enable row level security;
alter table public.document_details enable row level security;
alter table public.event_history enable row level security;
create policy model_admin on public.admin_models for all to authenticated using(public.kc_admin(agency_id)) with check(public.kc_admin(agency_id));
create policy company_admin on public.company_settings for all to authenticated using(public.kc_admin(agency_id)) with check(public.kc_admin(agency_id));
create policy details_read on public.shipment_details for select to authenticated using(public.kc_can_read(shipment_id));
create policy details_write on public.shipment_details for all to authenticated using(public.kc_admin(agency_id)) with check(public.kc_admin(agency_id));
create policy correction_read on public.invoice_corrections for select to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and i.agency_id=invoice_corrections.agency_id and public.kc_can_read(i.shipment_id)));
create policy correction_write on public.invoice_corrections for insert to authenticated with check(public.kc_admin(agency_id) and exists(select 1 from public.invoices i where i.id=invoice_id and i.agency_id=invoice_corrections.agency_id));
create policy doc_details_read on public.document_details for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id and d.agency_id=document_details.agency_id and (public.kc_admin(d.agency_id) or (d.shared and public.kc_can_read(d.shipment_id)))));
create policy doc_details_write on public.document_details for insert to authenticated with check(public.kc_admin(agency_id) and exists(select 1 from public.documents d where d.id=document_id and d.agency_id=document_details.agency_id));
create policy history_admin on public.event_history for select to authenticated using(public.kc_admin(agency_id));
-- Historique et factures : mutations transactionnelles depuis le serveur seulement.
-- Les procédures de publication, facturation, rectification, sauvegarde et restauration
-- doivent être portées et testées pendant la migration, avant de remplacer D1/R2.
