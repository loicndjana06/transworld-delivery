# Migrations et Configuration Supabase — TRANSWORLD DELIVERY

Ce guide détaille la mise en place exacte et l'ordre d'exécution des migrations Supabase pour le code actuel de l'application.

---

## 1. Emplacement des fichiers et ordre d'exécution

Deux options d'exécution sont disponibles, toutes deux **strictement non-destructives** (aucun `DROP TABLE` ni suppression de données existantes) :

### Option A : Exécution séquentielle (recommandée pour migrations modulaires)

| Étape | Fichier | Rôle & Contenu |
| :--- | :--- | :--- |
| **1** | `integrations/supabase/migrations/01_tables_and_indexes.sql` | Création des 15 tables (`shipments`, `events`, `invoices`, `settings` avec tuiles cartographiques, `documents`, etc.), contraintes d'intégrité, clés étrangères en cascade, et index d'optimisation. |
| **2** | `integrations/supabase/migrations/02_security_rls_and_storage.sql` | Activation du Row Level Security (RLS) sur toutes les tables, politiques complètes pour le rôle `service_role` (serveur Next.js), et création du bucket privé `cargo-documents` (10 Mo, PDF/JPEG/PNG). |
| **3** | `integrations/supabase/migrations/03_admin_provisioning.sql` | Provisionnement de l'administrateur unique, fonction `is_admin()`, politiques RLS pour l'administrateur connecté, et droits de stockage. |
| **4** | `integrations/supabase/migrations/04_realtime_and_rpc.sql` | Activation de Supabase Realtime (`events`, `shipments`) avec `replica identity full`, et procédure stockée `get_public_tracking(p_ref)` pour le suivi public expurgé. |

### Option B : Script Master All-in-One (exécution en une seule passe)

- **Fichier** : `integrations/supabase/schema.sql`
- Contient l'intégralité des 4 étapes ci-dessus dans un script unique, 100% idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- Idéal pour coller directement dans le **SQL Editor** de Supabase.

---

## 2. Où renseigner votre UUID administrateur Supabase

### Localisation dans le code SQL :
- Dans **`integrations/supabase/migrations/03_admin_provisioning.sql`** (ligne 23)
- Ou dans le script all-in-one **`integrations/supabase/schema.sql`** (ligne 268)

### Procédure :
1. Connectez-vous à votre [Dashboard Supabase](https://supabase.com/dashboard).
2. Rendez-vous dans **Authentication** > **Users**.
3. Copiez l'**UUID** de votre compte administrateur (ex: `e4b3c2a1-5d6e-7f8a-9b0c-123456789abc`).
4. Dans le script SQL, remplacez la chaîne `'00000000-0000-0000-0000-000000000000'` :

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- >>> VOTRE UUID ADMINISTRATEUR ICI (RESTRICTION STRICTE) <<<
    (auth.uid() = 'VOTRE_UUID_ADMIN_ICI'::uuid)

    -- Autorise le rôle interne technique serveur Next.js
    or (auth.role() = 'service_role'),
    false
  );
$$;
```

> **Sécurité renforcée :** L'alternative `app_metadata` a été supprimée pour garantir que seul cet UUID unique peut administrer la base de données.
> **Isolation stricte :** Toutes les tables et fichiers sont privés (`anon` n'a aucun droit de lecture directe). Le suivi public passe exclusivement par la fonction expurgée `get_public_tracking(p_ref)` (qui masque les montants internes et les notes en texte libre). Les flux en direct client fonctionnent via le lien privé autorisé ou la publication Realtime sans jamais accorder de droits de lecture publics sur les tables.

---

## 3. Cartographie Leaflet & OpenStreetMap

- Google Maps a été remplacé par **Leaflet** et **OpenStreetMap**.
- Aucune clé `GOOGLE_MAPS_API_KEY` ni `GOOGLE_MAPS_MAP_ID` n'est requise.
- L'URL standard du serveur de tuiles est : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- L'attribution légale OpenStreetMap est affichée et configurable via `tile_attribution`.
- Les requêtes de tuiles respectent scrupuleusement la politique d'utilisation OSM (aucun préchargement ni téléchargement massif).
- Les flux Realtime Supabase et le repli périodique autorisé mettent à jour instantanément la position du véhicule et les étapes sur la carte.

---

## 4. Variables d'environnement de l'application

Dans votre fichier `.env` ou les paramètres de votre hébergement :

```env
NEXT_PUBLIC_SUPABASE_URL=https://<votre-projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
ADMIN_TEST_PASSWORD=votre-mot-de-passe-secret-admin
```
