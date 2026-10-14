# TRANSWORLD DELIVERY

Plateforme moderne de suivi et de gestion des dossiers de transport de fret maritime et terrestre, construite sur Next.js 16 (App Router) et hébergeable sur Vercel avec Supabase (PostgreSQL, Authentification et Stockage privé).

---

## 1. Architecture cible

- **Framework** : Next.js 16 standard (App Router, Turbopack, Tailwind CSS).
- **Hébergement** : Vercel (ou tout hébergeur Node.js standard).
- **Base de données & Auth** : Supabase PostgreSQL avec Row Level Security (RLS) et Realtime.
- **Stockage privé** : Bucket Supabase Storage privé `cargo-documents` pour les justificatifs, factures d'achat et preuves de paiement (limite 10 Mo, signatures de fichiers PDF/JPG/PNG vérifiées).
- **Sécurité** : Aucun secret ou clé sensible dans le navigateur. Seule la clé publique (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) est exposée côté client pour Supabase Realtime. Toutes les opérations administratives et d'accès privé sont autorisées côté serveur via `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. État sans configuration (Mode Sécurisé par Défaut)

En l'absence de variables d'environnement Supabase :
- L'application affiche un **état de configuration clair et explicite** sur la page d'accueil avec les étapes requises.
- **Aucune donnée fictive** ni dossier de démonstration n'est inventé.
- **Aucun contournement d'authentification** n'est actif. Les routes de l'API retournent un code 503 explicite.
- Google Maps et le service d'envoi de courriels restent **strictement non configurés** tant que leurs clés respectives n'ont pas été renseignées.

---

## 3. Guide de mise en place Supabase

### Étape 1 : Création du projet
1. Créez un projet sur [Supabase](https://supabase.com).
2. Rendez-vous dans le menu **SQL Editor**.
3. Ouvrez le fichier `integrations/supabase/schema.sql` de ce dépôt, copiez son contenu et exécutez-le.
   - Ce script crée les tables (`shipments`, `events`, `invoices`, `documents`, `audit`, etc.), les index, la fonction RPC `get_public_tracking`, active le RLS sur toutes les tables et configure la publication Supabase Realtime sur `events` et `shipments`.

### Étape 2 : Stockage privé
1. Dans le tableau de bord Supabase, allez dans **Storage**.
2. Vérifiez que le bucket privé `cargo-documents` existe (créé par le script SQL). Si non, créez un bucket nommé `cargo-documents` en vous assurant que l'option **Public Bucket** est **désactivée**.
3. Les politiques de stockage du script SQL autorisent le `service_role` à stocker et récupérer les documents.

### Étape 3 : Récupération des clés API
Dans **Project Settings > API** :
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` (à garder strictement confidentiel)

---

## 4. Déploiement sur Vercel

1. Importez votre dépôt GitHub sur [Vercel](https://vercel.com).
2. Framework Preset : **Next.js**.
3. Dans **Environment Variables**, configurez les variables suivantes :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_publique
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role_secrete

# Administration
ADMIN_TEST_PASSWORD=votre_mot_de_passe_secret_admin

# Optionnel : Google Maps (si utilisé)
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID

# Optionnel : Courriels Resend (si utilisé)
EMAIL_API_KEY=
EMAIL_FROM=
```

4. Cliquez sur **Deploy**. Le build Next.js standard (`npm run build`) compile et déploie le projet de façon autonome.

---

## 5. Règles métier fondamentales

1. **Administration unique & Accès discret 10 s** :
   - Le panneau d'administration s'ouvre discrètement en maintenant enfoncé le logo TRANSWORLD DELIVERY pendant 10 secondes (ou via les touches Entrée/Espace).
   - Tout déplacement du doigt supérieur à 12 pixels, relâchement prématuré ou perte de focus annule le compte à rebours.
   - L'accès nécessite la saisie du mot de passe administrateur et crée un cookie de session HttpOnly `kc_admin` de 4 heures avec hachage SHA-256 côté serveur.

2. **Preuve de paiement ≠ Fonds reçus (Levée du blocage financier)** :
   - Lorsqu'un client téléverse un justificatif, la facture passe au statut `preuve_recue`.
   - **Seule la validation manuelle par l'administrateur** (`verified: true`) après vérification effective des fonds sur le compte bancaire passe la facture au statut `paye` et lève le blocage financier.

3. **Mouvements confirmés & Supabase Realtime** :
   - Seules les étapes réellement confirmées par l'agence déclenchent une mise à jour visible par le client via Supabase Realtime (`events` avec `published = 1` et `shipments`).
   - Un mécanisme de repli (polling automatique toutes les 5 secondes lorsque l'onglet est actif et reprise après reconnexion) garantit que les clients reçoivent les mises à jour même en cas de coupure réseau transitoire.
   - Aucun mouvement n'est déduit du paiement ou du temps écoulé ; les dates d'arrivée sont explicitement libellées comme des estimations.

4. **Devises USD / GNF et confidentialité du CFA** :
   - Les devises visibles par les clients sont exclusivement l'USD et le GNF.
   - Le montant de référence interne en CFA reste strictement confidentiel et masqué aux clients.
   - Les taux de conversion sont figés lors de l'émission de la facture et conservés dans les métadonnées pour archivage et génération de documents rectificatifs (avoirs et factures rectificatives).

5. **Internationalisation & RTL** :
   - Support complet du Français (FR), de l'Anglais (EN) et de l'Arabe (AR) avec mise en page bidirectionnelle (RTL) automatique.

6. **Assistance WhatsApp** :
   - Bouton flottant avec message prérempli contextualisé selon la référence et la dernière étape confirmée du dossier.

---

## 6. Tests et Validation

- **Tests d'intégration complets** :
  ```bash
  node tests/integration.mjs
  ```
  Vérifie sur une base en mémoire isolée :
  - L'authentification par mot de passe secret et la révocation de session.
  - La création, l'isolation des dossiers et le CSRF.
  - Le suivi public expurgé vs l'accès privé par jeton révocable de 7 jours.
  - La gestion des étapes, prévisions, brouillons et publication par lot sur conteneur.
  - L'émission de factures PDF, taux figés, avoirs intégraux et factures rectificatives.
  - La réception des preuves de paiement et la validation manuelle des fonds.
  - Le téléversement et le streaming sécurisé des documents privés.
  - L'export et la sauvegarde/restauration complète avec fichiers.

- **Compilation et Linter** :
  ```bash
  npm run build
  npm run lint
  ```
