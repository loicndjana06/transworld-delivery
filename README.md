# TRANSWORLD DELIVERY — Vercel direct

Même projet, suivi après achat externe. Next.js + Supabase Postgres/Auth/Storage privé + Leaflet/OpenStreetMap. Aucun passage par AI Studio nécessaire. Aucune clé email ou Google nécessaire au démarrage.

**Lire COMMENCER_ICI.md** : correctif SQL pour la base existante, transfert PowerShell vers le dépôt GitHub actuel, variables Vercel et premier contrôle. README_UTILISATION.md explique la gestion quotidienne ; GUIDE_VARIABLES.md explique chaque valeur ; CHECKLIST_VALIDATION.md distingue les tests locaux de ce qui reste à vérifier en ligne.

Node 22.13+ ou 24.x. Développement local : copier .env.example vers .env.local, renseigner ses valeurs sans publier le fichier, puis npm ci et npm run dev. Vérifications : npm test et npm run build.

Les tests utilisent des données isolées, PostgreSQL embarqué et stockage simulé ; aucune donnée client de démonstration n’est installée en production. Aucune connexion au Supabase réel ou publication Vercel n’a été effectuée ici.
