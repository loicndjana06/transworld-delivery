# Supabase — version Vercel

Base existante avec migrations 01–04 déjà appliquées : ouvrir SUPABASE_MISE_A_JOUR.sql à la racine, copier tout le contenu dans SQL Editor et Run. Ce script applique 05 puis 06 sans supprimer de dossier ni refaire le bucket. Il est prévu pour être relancé si 05 existe déjà.

Base neuve uniquement : schema.sql contient 01–06. Les fichiers modulaires peuvent également être exécutés dans leur ordre numérique. L’administrateur personnel est l’UUID 1d932391-a77a-4527-9b6d-1d7d4e884b4e ; le vérifier dans Authentication → Users avant utilisation.

La couche serveur utilise cargo_execute, réservé à service_role. Le navigateur ne reçoit jamais cette clé. Les accès clients passent par les routes serveur avec référence et jeton autorisé ; aucune lecture anonyme directe des tables privées n’est ajoutée pour le rafraîchissement.

cargo-documents reste privé, PDF/JPEG/PNG, 10 Mo. Les autorisations temporaires d’import sont créées côté serveur, les fichiers sont transférés directement à Storage et contrôlés avant enregistrement. Les téléchargements autorisés utilisent des liens signés de 60 secondes.

Le suivi se rafraîchit par requête autorisée toutes les cinq secondes quand l’onglet est visible. La publication Realtime historique peut rester installée ; l’application ne dépend pas d’un abonnement anonyme aux tables.

Variables et déploiement : voir COMMENCER_ICI.md et GUIDE_VARIABLES.md. Garder les emails vides s’ils ne sont pas configurés. Carte Leaflet/OpenStreetMap sans clé Google. Les quotas fournisseurs restent applicables.
