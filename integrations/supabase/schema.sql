-- TRANSWORLD DELIVERY : installation Supabase personnalisee
-- Administrateur Auth : 1d932391-a77a-4527-9b6d-1d7d4e884b4e
-- Base : schema.sql fourni par l'utilisateur le 15 octobre 2026.
-- Adaptations : UUID, verification de son existence, privileges limites au projet,
-- conservation des parametres initiaux du code fourni, transaction complete.
-- Executer tout ce fichier dans SQL Editor de votre projet Supabase.
-- L'utilisateur Auth doit deja exister. En cas d'erreur, la transaction est annulee.
-- Ne supprime aucune table ni ligne; modifie les politiques nommees et droits du projet.
-- Ne valide pas a lui seul le fonctionnement du serveur, des liens prives ou de Realtime client.

begin;
do $check_admin$
begin
  if not exists (select 1 from auth.users where id = '1d932391-a77a-4527-9b6d-1d7d4e884b4e'::uuid) then
    raise exception 'Utilisateur administrateur absent de ce projet Supabase. Verifiez Authentication > Users.';
  end if;
end
$check_admin$;

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
-- Remplacez '1d932391-a77a-4527-9b6d-1d7d4e884b4e' par votre véritable UUID auth.users
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
    (auth.uid() = '1d932391-a77a-4527-9b6d-1d7d4e884b4e'::uuid)

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

-- Droits limités aux 15 tables de TRANSWORLD DELIVERY.
-- Ne modifie pas les privilèges des autres applications du schema public.
grant usage on schema public to anon, authenticated, service_role;
revoke all privileges on table public.admin_sessions, public.settings, public.company_settings, public.admin_models, public.shipments, public.shipment_details, public.events, public.event_history, public.invoices, public.invoice_corrections, public.documents, public.document_details, public.notifications, public.requests, public.audit from public, anon;
grant select, insert, update, delete on table public.admin_sessions, public.settings, public.company_settings, public.admin_models, public.shipments, public.shipment_details, public.events, public.event_history, public.invoices, public.invoice_corrections, public.documents, public.document_details, public.notifications, public.requests, public.audit to authenticated;
grant all privileges on table public.admin_sessions, public.settings, public.company_settings, public.admin_models, public.shipments, public.shipment_details, public.events, public.event_history, public.invoices, public.invoice_corrections, public.documents, public.document_details, public.notifications, public.requests, public.audit to service_role;
-- Fonctions de ce projet uniquement : aucune modification globale des routines.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

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

revoke all on function public.get_public_tracking(text) from public, anon, authenticated;
grant execute on function public.get_public_tracking(text) to anon, authenticated, service_role;

-- --------------------------------------------------------
-- 7. CONFIGURATION SUPABASE REALTIME
-- --------------------------------------------------------
alter table public.events replica identity full;
alter table public.shipments replica identity full;

-- Remplacement des exceptions masquées par une vérification explicite des doublons dans pg_publication_tables
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Publication supabase_realtime absente. Verifiez la configuration Realtime du projet.';
  end if;

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

commit;

-- Controle de l'installation : 15 tables attendues avec RLS actif.
select count(*) as tables_attendues_15, bool_and(c.relrowsecurity) as rls_actif
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('admin_sessions', 'settings', 'company_settings', 'admin_models', 'shipments', 'shipment_details', 'events', 'event_history', 'invoices', 'invoice_corrections', 'documents', 'document_details', 'notifications', 'requests', 'audit');
select id, public as bucket_public_doit_etre_false, file_size_limit
from storage.buckets where id = 'cargo-documents';

-- TRANSWORLD DELIVERY: run once after the installed schema.sql.
begin;
create or replace function public.cargo_execute(statements jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public
as $cargo$
declare
  command jsonb; query_text text; rows_json jsonb;
  affected bigint := 0; output jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(statements) <> 'array' or jsonb_array_length(statements) > 7000 then
    raise exception 'Invalid transaction';
  end if;
  perform pg_advisory_xact_lock(41026, 15001);
  foreach command in array array(select jsonb_array_elements(statements)) loop
    query_text := command #>> '{}';
    if query_text ~* '^\s*select\s' then
      execute 'select coalesce(jsonb_agg(to_jsonb(cargo_row)), ''[]''::jsonb) from (' || query_text || ') cargo_row'
        into rows_json using affected;
      affected := 0;
    elsif query_text ~* '^\s*(insert\s+into|update|delete\s+from)\s' then
      execute query_text using affected;
      get diagnostics affected = row_count;
      rows_json := '[]'::jsonb;
    else
      raise exception 'Unsupported business statement';
    end if;
    output := output || jsonb_build_array(jsonb_build_object('rows', rows_json, 'changes', affected));
  end loop;
  return output;
end
$cargo$;
revoke all on function public.cargo_execute(jsonb) from public, anon, authenticated;
grant execute on function public.cargo_execute(jsonb) to service_role;
create table if not exists public.cargo_rate_limits (
  id text primary key, attempts integer not null, expires timestamptz not null
);
alter table public.cargo_rate_limits enable row level security;
revoke all on public.cargo_rate_limits from public, anon, authenticated;
grant all on public.cargo_rate_limits to service_role;
create or replace function public.cargo_throttle(p_key text, p_limit integer default 10)
returns boolean language plpgsql security invoker
set search_path = pg_catalog, public
as $throttle$
declare hits integer;
begin
  insert into public.cargo_rate_limits(id, attempts, expires)
  values(p_key, 1, now() + interval '15 minutes')
  on conflict(id) do update
    set attempts = case when cargo_rate_limits.expires < now() then 1 else cargo_rate_limits.attempts + 1 end,
        expires = case when cargo_rate_limits.expires < now() then now() + interval '15 minutes' else cargo_rate_limits.expires end
  returning attempts into hits;
  return hits <= p_limit;
end
$throttle$;
revoke all on function public.cargo_throttle(text,integer) from public, anon, authenticated;
grant execute on function public.cargo_throttle(text,integer) to service_role;
notify pgrst, 'reload schema';
commit;

-- Ajouts sans suppression : imports directs prives et prestations conditionnelles.
begin;
create table if not exists public.cargo_uploads (
  id text primary key,
  shipment_id text not null references public.shipments(id) on delete cascade,
  invoice_id text references public.invoices(id) on delete cascade,
  object_key text not null unique,
  name text not null,
  mime text not null check (mime in ('application/pdf','image/jpeg','image/png')),
  size integer not null check (size > 0 and size <= 10485760),
  kind text not null,
  shared integer not null default 0 check (shared in (0,1)),
  expires timestamptz not null,
  completed_at timestamptz
);
create index if not exists cargo_uploads_shipment_idx on public.cargo_uploads(shipment_id);
create table if not exists public.service_tasks (
  id text primary key,
  shipment_id text not null references public.shipments(id) on delete cascade,
  invoice_id text not null unique references public.invoices(id) on delete cascade,
  action text not null,
  requires_payment integer not null default 1 check (requires_payment in (0,1)),
  status text not null default 'pending' check (status in ('pending','confirmed')),
  source text not null default '',
  confirmed_at timestamptz,
  version integer not null default 0,
  updated timestamptz not null default now()
);
create index if not exists service_tasks_shipment_idx on public.service_tasks(shipment_id);
alter table public.cargo_uploads enable row level security;
alter table public.service_tasks enable row level security;
revoke all on public.cargo_uploads, public.service_tasks from public, anon, authenticated;
grant all on public.cargo_uploads, public.service_tasks to service_role;
notify pgrst, 'reload schema';
commit;
