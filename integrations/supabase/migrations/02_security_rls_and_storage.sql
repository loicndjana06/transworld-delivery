-- ========================================================
-- MIGRATION 02 : Sécurité RLS et Stockage Privé
-- Ordre d'exécution : 2 / 4
-- Mode : Non-destructif (DROP POLICY IF EXISTS puis CREATE POLICY)
-- Active Row Level Security sur toutes les tables et configure le bucket privé
-- ========================================================

-- 1. Activation de Row Level Security (RLS) sur les 15 tables
alter table public.admin_sessions enable row level security;
alter table public.settings enable row level security;
alter table public.company_settings enable row level security;
alter table public.admin_models enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_details enable row level security;
alter table public.events enable row level security;
alter table public.event_history enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_corrections enable row level security;
alter table public.documents enable row level security;
alter table public.document_details enable row level security;
alter table public.notifications enable row level security;
alter table public.requests enable row level security;
alter table public.audit enable row level security;

-- 2. Politiques pour le rôle service_role (côté serveur Next.js sécurisé)
-- Le serveur dispose d'un accès total garanti pour les opérations de gestion et de synchronisation
drop policy if exists "Service role full access on admin_sessions" on public.admin_sessions;
create policy "Service role full access on admin_sessions" on public.admin_sessions for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on settings" on public.settings;
create policy "Service role full access on settings" on public.settings for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on company_settings" on public.company_settings;
create policy "Service role full access on company_settings" on public.company_settings for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on admin_models" on public.admin_models;
create policy "Service role full access on admin_models" on public.admin_models for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on shipments" on public.shipments;
create policy "Service role full access on shipments" on public.shipments for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on shipment_details" on public.shipment_details;
create policy "Service role full access on shipment_details" on public.shipment_details for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on events" on public.events;
create policy "Service role full access on events" on public.events for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on event_history" on public.event_history;
create policy "Service role full access on event_history" on public.event_history for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on invoices" on public.invoices;
create policy "Service role full access on invoices" on public.invoices for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on invoice_corrections" on public.invoice_corrections;
create policy "Service role full access on invoice_corrections" on public.invoice_corrections for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on documents" on public.documents;
create policy "Service role full access on documents" on public.documents for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on document_details" on public.document_details;
create policy "Service role full access on document_details" on public.document_details for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on notifications" on public.notifications;
create policy "Service role full access on notifications" on public.notifications for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on requests" on public.requests;
create policy "Service role full access on requests" on public.requests for all to service_role using (true) with check (true);

drop policy if exists "Service role full access on audit" on public.audit;
create policy "Service role full access on audit" on public.audit for all to service_role using (true) with check (true);

-- 3. Bucket de stockage privé pour les documents confidentiels et preuves de paiement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cargo-documents', 'cargo-documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

-- 4. Politique de stockage pour le service_role
drop policy if exists "Service role full access on storage objects" on storage.objects;
create policy "Service role full access on storage objects" on storage.objects for all to service_role using (bucket_id = 'cargo-documents') with check (bucket_id = 'cargo-documents');

-- 5. Attribution explicite des privilèges requis (Grants & Isolation stricte)
-- Autorise l'usage du schéma public
grant usage on schema public to anon, authenticated, service_role;

-- Tables et fichiers privés : AUCUN accès direct par défaut pour le rôle anonyme (anon)
revoke all on table public.admin_sessions, public.settings, public.company_settings, public.admin_models, public.shipments, public.shipment_details, public.events, public.event_history, public.invoices, public.invoice_corrections, public.documents, public.document_details, public.notifications, public.requests, public.audit from anon;



-- Privilèges pour le rôle authentifié (l'accès réel est conditionné par RLS et public.is_admin())
grant select, insert, update, delete on table public.admin_sessions, public.settings, public.company_settings, public.admin_models, public.shipments, public.shipment_details, public.events, public.event_history, public.invoices, public.invoice_corrections, public.documents, public.document_details, public.notifications, public.requests, public.audit to authenticated;


-- Privilèges complets pour le rôle serveur technique service_role
grant all on table public.admin_sessions, public.settings, public.company_settings, public.admin_models, public.shipments, public.shipment_details, public.events, public.event_history, public.invoices, public.invoice_corrections, public.documents, public.document_details, public.notifications, public.requests, public.audit to service_role;


