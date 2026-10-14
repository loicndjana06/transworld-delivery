# TRANSWORLD DELIVERY — transfert du code existant

Source du site existant, version du 14 octobre 2026.
Ce ZIP contient le code réel publié, les images, les PDF, les tests, migrations D1 et préparation Supabase. Ce n’est pas encore une version directement compatible Vercel : les routes utilisent Cloudflare D1/R2 et la connexion Sites. Le portage vers Supabase doit être réalisé et testé.

## Mettre ce code dans GitHub
1. Décompresser le ZIP sur votre ordinateur.
2. Créer un dépôt privé nommé transworld-delivery sur GitHub.
3. Ajouter les fichiers à la racine du dépôt : package.json, app, public, db, drizzle, integrations, scripts, tests et les guides. Ne pas déposer le ZIP lui-même ni ajouter un niveau de dossier au-dessus de package.json.
4. Inclure .env.example (valeurs vides) et .gitignore. Les autres .env, secrets, node_modules, .git et fichiers de QA ne sont pas inclus.
5. Enregistrer l’ajout des fichiers (Commit changes), puis conserver le lien du dépôt.

## Reprendre dans Google AI Studio
Dans Build, ouvrir + (Add files), puis Import from GitHub et sélectionner ce dépôt. Utiliser AI_STUDIO_PROMPT.txt et CHECKLIST_VALIDATION.md. Garder le visuel et les fonctionnalités ; adapter l’infrastructure au lieu de reconstruire un autre site.

## Avant Vercel
Porter réellement Auth, données, stockage, liens privés, transactions, PDF et sauvegardes sur Supabase ; tester les règles RLS et les accès. Le SQL sous integrations/supabase est une préparation pour projet neuf, non exécutée. Un mot de passe de gestion doit être reconfiguré côté serveur : aucun secret du site actuel n’est exporté.

Publier sur Vercel après la recette. La connexion des services et l’ajout de clés seuls ne remplacent pas cette adaptation. Google Maps et les courriels nécessitent leurs propres configurations.
