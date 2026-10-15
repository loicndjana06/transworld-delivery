-- ========================================================
-- MIGRATION 04 : Supabase Realtime et Procédure RPC de Suivi Public
-- Ordre d'exécution : 4 / 4
-- Mode : Non-destructif
-- Active les flux en temps réel pour l'application client et le RPC expurgé
-- ========================================================

-- 1. Configuration de l'identité de réplication pour Realtime
-- REPLICA IDENTITY FULL garantit que tous les champs modifiés sont inclus dans l'événement Realtime
alter table public.events replica identity full;
alter table public.shipments replica identity full;

-- 2. Ajout des tables à la publication Realtime Supabase
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

-- 3. Procédure stockée RPC pour le suivi public anonyme expurgé
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
