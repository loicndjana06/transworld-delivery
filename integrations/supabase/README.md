# Préparation Supabase et Vercel
Supabase est l'option externe retenue à la place de Firebase. Ces fichiers préparent l'intégration ; le Site courant reste connecté à D1/R2. Ajouter les clés ne change pas automatiquement les routes du Site.

## Informations nécessaires
URL du projet et clé Publishable (ou ancienne clé anon). Ne pas mettre une clé Secret ou service_role dans le navigateur. Pour une connexion SSR, utiliser ensuite @supabase/ssr et la vérification des claims/utilisateurs côté serveur selon la documentation Supabase.

## Mise en place sur un projet neuf
1. Créer le projet, puis exécuter schema.sql dans SQL Editor après relecture. Aucun tarif ou dossier d'essai n'est inséré.
2. Créer le compte administrateur dans Authentication. Créer une agence avec admin_uid égal à cet utilisateur et attribuer role=admin et agency_id dans app_metadata uniquement depuis un environnement serveur autorisé.
3. Configurer NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sur l'hébergement final.
4. Adapter les routes actuelles à repository.ts, puis porter les opérations transactionnelles de publication, facturation, paiement, corrections et audit dans des fonctions serveur/RPC. addEvent seul n'actualise pas le statut : cette étape reste nécessaire.
5. Porter les liens privés existants vers une connexion client ou une validation sécurisée du jeton côté serveur. Le RPC public renvoie uniquement le suivi expurgé, sans documents, coordonnées clients ni montant CFA.
6. Migrer les données exportées, associer explicitement les comptes clients et transférer les fichiers privés. Ne pas copier les anciens jetons.
7. Tester les règles sur le vrai projet : client A, client B, administrateur, visiteur anonyme ; vérifier que le montant CFA interne et les documents restent privés.

## Avant Vercel
Le projet actuel utilise Vinext et cloudflare:workers. Il faut une version Next.js/Vite adaptée avec Supabase Auth et Storage, sans dépendance au runtime Cloudflare ni à la connexion Sites. Supabase ne rend pas à lui seul le dépôt actuel prêt à déployer sur Vercel.

Google Maps et les courriels gardent leurs propres configurations. Le service de courriel et ses clés restent côté serveur. La facturation et la génération PDF doivent être testées après migration. Les validations des paiements restent manuelles jusqu'à une intégration réelle du prestataire.

Le schéma préparé inclut les modèles de pays/prestations, identité de l’entreprise, compléments VIN/remise, corrections de facture et historique des étapes. Il limite l’administration à admin_uid. Ce SQL n’a pas été exécuté sur votre projet ; les opérations serveur et les tests RLS restent à porter avant activation.
