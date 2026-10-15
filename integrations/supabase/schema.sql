-- ========================================================
-- TRANSWORLD DELIVERY — Schéma PostgreSQL Supabase Complet (Master Idempotent)
-- Fichier : integrations/supabase/schema.sql
--
-- Instructions d'exécution :
-- 1. Ouvrez l'éditeur SQL de votre projet Supabase (Dashboard > SQL Editor).
-- 2. Localisez la section 'PROVISIONNEMENT DE L'ADMINISTRATEUR UNIQUE' ci-dessous (ligne 268).
-- 3. Remplacez '00000000-0000-0000-0000-000000000000' par votre véritable UUID d'administrateur Supabase (Authentication > Users).
-- 4. Exécutez le script ("Run").
--
-- Ce script est 100% idempotent et non-destructif :
-- - Utilise CREATE TABLE IF NOT EXISTS et ADD COLUMN IF NOT EXISTS
-- - Ne supprime ni n'écrase aucune donnée existante (aucun DROP TABLE / DROP SCHEMA)
-- ========================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------
-- 1. TABLES ET STRUCTURE DE DONNÉES
-- --------------------------------------------------------

-- 1. Table des sessions administratives (après mot de passe secret)
create table if not exists public.admin_sessions (
  id text primary key,
  owner text not null,
  expires timestamptz not null
);

-- 2. Paramètres cartographiques (Leaflet / OpenStreetMap et configuration des tuiles)
create table if not exists public.settings (
  id text primary key,
  owner text not null unique,
  maps_key text not null default '',
  maps_id text not null default '',
  tile_url text not null default '',
  tile_attribution text not null default ''
);
alter table public.settings add column if not exists tile_url text not null default '';
alter table public.settings add column if not exists tile_attribution text not null default '';
alter table public.settings add column if not exists maps_key text not null default '';
alter table public.settings add column if not exists maps_id text not null default '';

-- 3. Identité réelle de l'entreprise et instructions bancaires
create table if not exists public.company_settings (
  owner text primary key,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 0
);

-- 4. Modèles de pays et catalogue de prestations réelles
create table if not exists public.admin_models (
  id text primary key default gen_random_uuid()::text,
  owner text not null default 'admin',
  kind text not null check(kind in ('country', 'service')),
  name text not null,
  config jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  created timestamptz not null default now(),
  updated timestamptz not null default now(),
  unique(owner, kind, name)
);

-- 5. Dossiers d'expédition
create table if not exists public.shipments (
  id text primary key default gen_random_uuid()::text,
  owner text not null default 'admin',
  ref text not null unique,
  client text not null,
  contact text not null,
  email text not null default '',
  item text not null,
  category text not null,
  origin text not null,
  destination text not null,
  container text not null default '',
  delivery text not null default '',
  eta text not null default '',
  status text not null default 'Enregistré',
  token_hash text not null default '',
  token_expiry text not null default '',
  vehicle_xaf double precision,
  order_usd double precision,
  order_gnf double precision,
  created timestamptz not null default now(),
  updated timestamptz not null default now(),
  version integer not null default 0
);

-- 6. Détails du dossier (VIN, références achat/facture, créneau, confirmation)
create table if not exists public.shipment_details (
  shipment_id text primary key references public.shipments(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now()
);

-- 7. Étapes du parcours (mouvements confirmés et prévisions)
create table if not exists public.events (
  id text primary key default gen_random_uuid()::text,
  shipment_id text not null references public.shipments(id) on delete cascade,
  type text not null,
  place text not null,
  date timestamptz not null,
  note text not null default '',
  source text not null default 'Agence',
  planned integer not null default 0,
  published integer not null default 1,
  created timestamptz not null default now(),
  author text not null default 'admin',
  published_at timestamptz,
  lat double precision check(lat is null or (lat between -90 and 90)),
  lng double precision check(lng is null or (lng between -180 and 180)),
  mode text not null default 'Maritime'
);

-- 8. Historique des corrections d'étapes
create table if not exists public.event_history (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references public.events(id) on delete cascade,
  before jsonb not null,
  reason text not null,
  created timestamptz not null default now()
);

-- 9. Factures émises (taux figés lors de l'émission, montants USD/GNF publics, CFA interne privé)
create table if not exists public.invoices (
  id text primary key default gen_random_uuid()::text,
  shipment_id text not null references public.shipments(id) on delete cascade,
  number text not null unique,
  reason text not null,
  stage text not null,
  provider text not null,
  signer text not null,
  base_xaf double precision not null,
  usd_rate double precision not null,
  gnf_rate double precision not null,
  rate_source text not null,
  metadata jsonb not null default '{}'::jsonb,
  usd double precision not null,
  gnf double precision not null,
  status text not null default 'a_regler' check(status in ('a_regler', 'preuve_recue', 'paye')),
  created timestamptz not null default now()
);

-- 10. Documents rectificatifs (avoir intégral ou facture rectificative)
create table if not exists public.invoice_corrections (
  id text primary key default gen_random_uuid()::text,
  invoice_id text not null unique references public.invoices(id) on delete cascade,
  data jsonb not null,
  created timestamptz not null default now()
);

-- 11. Documents attachés au dossier
create table if not exists public.documents (
  id text primary key default gen_random_uuid()::text,
  shipment_id text not null references public.shipments(id) on delete cascade,
  name text not null,
  key text not null,
  mime text not null,
  size bigint not null check(size between 1 and 10485760),
  shared integer not null default 0,
  created timestamptz not null default now()
);

-- 12. Détails des documents (nature : BL, AWB, etc.)
create table if not exists public.document_details (
  document_id text primary key references public.documents(id) on delete cascade,
  kind text not null,
  note text not null default ''
);

-- 13. Notifications internes et statut d'envoi courriel
create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  owner text not null default 'admin',
  shipment_id text not null references public.shipments(id) on delete cascade,
  title text not null,
  body text not null,
  created timestamptz not null default now(),
  email_status text not null default 'non_configure',
  attempts integer not null default 0
);

-- 14. Demandes de cotation / préparation d'expédition
create table if not exists public.requests (
  id text primary key default gen_random_uuid()::text,
  owner text not null default 'admin',
  name text not null,
  contact text not null,
  origin text not null,
  destination text not null,
  category text not null,
  note text not null,
  created timestamptz not null default now()
);

-- 15. Journal d'audit complet
create table if not exists public.audit (
  id text primary key default gen_random_uuid()::text,
  owner text not null default 'admin',
  shipment_id text references public.shipments(id) on delete set null,
  action text not null,
  detail text not null default '',
  created timestamptz not null default now()
);

-- Index de performance
create index if not exists idx_shipments_ref on public.shipments(ref);
create index if not exists idx_events_shipment_date on public.events(shipment_id, date);
create index if not exists idx_invoices_shipment on public.invoices(shipment_id);
create index if not exists idx_documents_shipment on public.documents(shipment_id);
create index if not exists idx_notifications_shipment on public.notifications(shipment_id, created desc);
create index if not exists idx_audit_created on public.audit(created desc);

-- --------------------------------------------------------
-- 2. STOCKAGE PRIVÉ (BUCKET CARGO-DOCUMENTS)
-- --------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cargo-documents', 'cargo-documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

-- --------------------------------------------------------
-- 3. ACTIVATION DE ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- 4. POLITIQUES SERVICE_ROLE (ACCÈS COMPLET CÔTÉ SERVEUR)
-- --------------------------------------------------------
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

drop policy if exists "Service role full access on storage objects" on storage.objects;
create policy "Service role full access on storage objects" on storage.objects for all to service_role using (bucket_id = 'cargo-documents') with check (bucket_id = 'cargo-documents');

-- --------------------------------------------------------
-- --------------------------------------------------------
-- 5. PROVISIONNEMENT DE L'ADMINISTRATEUR UNIQUE (AUTHENTICATED)
-- --------------------------------------------------------
-- >>> FOURNISSEZ VOTRE UUID D'ADMINISTRATEUR SUPABASE CI-DESSOUS <<<
-- Remplacez '00000000-0000-0000-0000-000000000000' par votre véritable UUID auth.users
-- RESTRICTION STRICTE : seul l'UUID authentifié explicitement configuré est reconnu comme administrateur.
-- L'alternative app_metadata a été supprimée pour garantir une étanchéité absolue.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- 1. UUID de l'administrateur Supabase Auth (REMPLACEZ CETTE VALEUR) :
    (auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid)

    -- 2. Ou accès via le rôle technique serveur service_role
    or (auth.role() = 'service_role'),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Politiques RLS pour l'administrateur authentifié
drop policy if exists "Admin full access on admin_sessions" on public.admin_sessions;
create policy "Admin full access on admin_sessions" on public.admin_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on settings" on public.settings;
create policy "Admin full access on settings" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on company_settings" on public.company_settings;
create policy "Admin full access on company_settings" on public.company_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on admin_models" on public.admin_models;
create policy "Admin full access on admin_models" on public.admin_models for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on shipments" on public.shipments;
create policy "Admin full access on shipments" on public.shipments for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on shipment_details" on public.shipment_details;
create policy "Admin full access on shipment_details" on public.shipment_details for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on events" on public.events;
create policy "Admin full access on events" on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on event_history" on public.event_history;
create policy "Admin full access on event_history" on public.event_history for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on invoices" on public.invoices;
create policy "Admin full access on invoices" on public.invoices for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on invoice_corrections" on public.invoice_corrections;
create policy "Admin full access on invoice_corrections" on public.invoice_corrections for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on documents" on public.documents;
create policy "Admin full access on documents" on public.documents for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on document_details" on public.document_details;
create policy "Admin full access on document_details" on public.document_details for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on notifications" on public.notifications;
create policy "Admin full access on notifications" on public.notifications for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on requests" on public.requests;
create policy "Admin full access on requests" on public.requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on audit" on public.audit;
create policy "Admin full access on audit" on public.audit for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access on storage cargo-documents" on storage.objects;
create policy "Admin full access on storage cargo-documents" on storage.objects
for all to authenticated
using (bucket_id = 'cargo-documents' and public.is_admin())
with check (bucket_id = 'cargo-documents' and public.is_admin());

-- Attribution explicite des privilèges requis (Grants & Isolation stricte)
grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- Paramètres initiaux
insert into public.settings (id, owner, maps_key, maps_id, tile_url, tile_attribution)
values ('admin', 'admin', '', '', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors')
on conflict (owner) do nothing;

-- --------------------------------------------------------
-- 6. RPC DE SUIVI PUBLIC EXPURGÉ (ANONYME & SÉCURISÉ)
-- --------------------------------------------------------
-- Renvoie uniquement les étapes publiées (avec lat/lng pour Leaflet).
-- SÉCURITÉ : Les notes internes en texte libre sont retirées des réponses de suivi anonyme.
create or replace function public.get_public_tracking(p_ref text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'shipment', jsonb_build_object(
      'ref', s.ref,
      'origin', s.origin,
      'destination', s.destination,
      'status', s.status,
      'eta', s.eta,
      'updated', s.updated
    ),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'type', e.type,
          'place', e.place,
          'date', e.date,
          'planned', e.planned,
          'lat', e.lat,
          'lng', e.lng,
          'mode', e.mode
        ) order by e.date, e.created
      )
      from public.events e
      where e.shipment_id = s.id and e.published = 1
    ), '[]'::jsonb)
  )
  from public.shipments s
  where s.ref = upper(trim(p_ref));
$$;

revoke all on function public.get_public_tracking(text) from public;
grant execute on function public.get_public_tracking(text) to anon, authenticated, service_role;

-- --------------------------------------------------------
-- 7. CONFIGURATION SUPABASE REALTIME
-- --------------------------------------------------------
alter table public.events replica identity full;
alter table public.shipments replica identity full;

-- Remplacement des exceptions masquées par une vérification explicite des doublons dans pg_publication_tables
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shipments'
  ) then
    alter publication supabase_realtime add table public.shipments;
  end if;
end $$;
