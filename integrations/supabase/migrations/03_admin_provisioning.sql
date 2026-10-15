-- ========================================================
-- MIGRATION 03 : Provisionnement de l'Administrateur Unique
-- Ordre d'exécution : 3 / 4
-- Mode : Non-destructif
-- ========================================================
--
-- >>> EMPLACEMENT OÙ FOURNIR VOTRE UUID ADMINISTRATEUR SUPABASE <<<
-- 1. Récupérez l'UUID de votre compte dans Supabase Dashboard > Authentication > Users.
-- 2. Remplacez ci-dessous '00000000-0000-0000-0000-000000000000' par votre véritable UUID.
--
-- Exemple :
--   auth.uid() = 'b8d5a1e2-4f3c-4e89-91a0-123456789abc'::uuid
--
-- ========================================================

-- 1. Fonction centrale de vérification administrateur
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
    -- >>> FOURNIR VOTRE UUID ADMINISTRATEUR SUPABASE CI-DESSOUS <<<
    (auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid)

    -- Autorise le rôle interne serveur Next.js pour les opérations sécurisées
    or (auth.role() = 'service_role'),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- 2. Politiques RLS pour l'administrateur connecté sur toutes les tables
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

-- 3. Politique de stockage pour l'administrateur connecté
drop policy if exists "Admin full access on storage cargo-documents" on storage.objects;
create policy "Admin full access on storage cargo-documents" on storage.objects
for all to authenticated
using (bucket_id = 'cargo-documents' and public.is_admin())
with check (bucket_id = 'cargo-documents' and public.is_admin());

-- 4. Initialisation des paramètres par défaut de l'administrateur
insert into public.settings (id, owner, maps_key, maps_id, tile_url, tile_attribution)
values ('admin', 'admin', '', '', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors')
on conflict (owner) do nothing;
