-- TRANSWORLD DELIVERY — Schéma PostgreSQL Supabase complet
-- Exécuter ce script dans le SQL Editor de Supabase pour un projet neuf.
-- Aucune donnée fictive n'est insérée.

create extension if not exists "pgcrypto";

-- 1. Table des sessions administratives (après mot de passe secret)
create table if not exists public.admin_sessions (
  id text primary key,
  owner text not null,
  expires timestamptz not null
);

-- 2. Paramètres de l'agence (Google Maps, etc.)
create table if not exists public.settings (
  id text primary key,
  owner text not null unique,
  maps_key text not null default '',
  maps_id text not null default ''
);

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

-- Fonction de suivi public expurgé (consultation anonyme par numéro de dossier sans secret ni données privées)
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
          'note', e.note,
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

-- Bucket de stockage privé pour les documents et preuves de paiement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cargo-documents', 'cargo-documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

-- Activer Row Level Security sur toutes les tables
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

-- Politiques de sécurité : le rôle service_role (côté serveur Next.js) a plein accès.
-- L'accès direct anonyme ou non autorisé est bloqué par défaut sur toutes les tables.
create policy "Service role full access on admin_sessions" on public.admin_sessions for all to service_role using (true) with check (true);
create policy "Service role full access on settings" on public.settings for all to service_role using (true) with check (true);
create policy "Service role full access on company_settings" on public.company_settings for all to service_role using (true) with check (true);
create policy "Service role full access on admin_models" on public.admin_models for all to service_role using (true) with check (true);
create policy "Service role full access on shipments" on public.shipments for all to service_role using (true) with check (true);
create policy "Service role full access on shipment_details" on public.shipment_details for all to service_role using (true) with check (true);
create policy "Service role full access on events" on public.events for all to service_role using (true) with check (true);
create policy "Service role full access on event_history" on public.event_history for all to service_role using (true) with check (true);
create policy "Service role full access on invoices" on public.invoices for all to service_role using (true) with check (true);
create policy "Service role full access on invoice_corrections" on public.invoice_corrections for all to service_role using (true) with check (true);
create policy "Service role full access on documents" on public.documents for all to service_role using (true) with check (true);
create policy "Service role full access on document_details" on public.document_details for all to service_role using (true) with check (true);
create policy "Service role full access on notifications" on public.notifications for all to service_role using (true) with check (true);
create policy "Service role full access on requests" on public.requests for all to service_role using (true) with check (true);
create policy "Service role full access on audit" on public.audit for all to service_role using (true) with check (true);

-- Politiques de stockage privé : seul le service_role ou les requêtes serveur autorisées accèdent aux objets
create policy "Service role full access on storage objects" on storage.objects for all to service_role using (bucket_id = 'cargo-documents') with check (bucket_id = 'cargo-documents');

-- Publication Supabase Realtime pour actualisation instantanée côté client
do $$
begin
  alter publication supabase_realtime add table public.events;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.shipments;
exception when others then null;
end $$;
