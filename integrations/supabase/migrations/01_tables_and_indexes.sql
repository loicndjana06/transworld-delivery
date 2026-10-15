-- ========================================================
-- MIGRATION 01 : Tables, Contraintes et Index
-- Ordre d'exécution : 1 / 4
-- Mode : Non-destructif (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- Aucune donnée existante n'est supprimée ou réinitialisée.
-- ========================================================

create extension if not exists "pgcrypto";

-- 1. Sessions d'administration (jetons hachés avec expiration)
create table if not exists public.admin_sessions (
  id text primary key,
  owner text not null,
  expires timestamptz not null
);

-- 2. Paramètres d'agence (serveur de tuiles Leaflet / OpenStreetMap et clés optionnelles)
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

-- 3. Identité de l'entreprise et coordonnées bancaires officielles
create table if not exists public.company_settings (
  owner text primary key,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 0
);

-- 4. Modèles de pays et catalogue de prestations
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

-- 5. Dossiers de transport et expédition
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

-- 6. Compléments du dossier (VIN, références achat/facture, date de remise souhaitée)
create table if not exists public.shipment_details (
  shipment_id text primary key references public.shipments(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now()
);

-- 7. Étapes du parcours (mouvements confirmés et prévisions géolocalisées)
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

-- 8. Historique des corrections d'étapes (traçabilité sans effacement)
create table if not exists public.event_history (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references public.events(id) on delete cascade,
  before jsonb not null,
  reason text not null,
  created timestamptz not null default now()
);

-- 9. Factures émises (taux figés lors de l'émission, montants USD/GNF publics, CFA privé)
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

-- 10. Avoirs et rectificatifs de factures
create table if not exists public.invoice_corrections (
  id text primary key default gen_random_uuid()::text,
  invoice_id text not null unique references public.invoices(id) on delete cascade,
  data jsonb not null,
  created timestamptz not null default now()
);

-- 11. Documents joints au dossier
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

-- 12. Détails des documents (nature : BL, AWB, preuve de paiement, etc.)
create table if not exists public.document_details (
  document_id text primary key references public.documents(id) on delete cascade,
  kind text not null,
  note text not null default ''
);

-- 13. Notifications internes et statut d'envoi
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

-- 14. Demandes de cotation et préparation d'envoi
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

-- Index de performance et d'accès rapide
create index if not exists idx_shipments_ref on public.shipments(ref);
create index if not exists idx_events_shipment_date on public.events(shipment_id, date);
create index if not exists idx_invoices_shipment on public.invoices(shipment_id);
create index if not exists idx_documents_shipment on public.documents(shipment_id);
create index if not exists idx_notifications_shipment on public.notifications(shipment_id, created desc);
create index if not exists idx_audit_created on public.audit(created desc);
