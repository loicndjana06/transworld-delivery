# TRANSWORLD DELIVERY — GitHub → Vercel, sans AI Studio

Cette archive contient les sources corrigées du même projet. Elle ne contient aucun secret ni dossier fictif. Aucun compte AI Studio ni crédit Gemini n’est nécessaire pour l’utiliser.

## 1. Mettre à jour la base existante (sans refaire les buckets)

Puisque les tables et cargo-documents sont déjà configurés :
1. Ouvrir SUPABASE_MISE_A_JOUR.sql de cette archive avec Bloc-notes.
2. Copier TOUT son contenu.
3. Supabase → projet existant → SQL Editor → New query → coller → Run.
4. Ce script ajoute/remet en place les fonctions serveur de la migration 05 et les deux tables privées de la migration 06 (imports temporaires et prestations). Il ne supprime aucun dossier, aucune facture et aucun bucket. Il peut être relancé sans remise à zéro.
5. Si la migration 05 a déjà été exécutée, la réexécuter dans ce script est prévu. Ne pas recréer le projet Supabase.

Pour une base entièrement NEUVE uniquement : integrations/supabase/schema.sql comprend les migrations 01 à 06. Ce n’est pas le script à utiliser pour ta simple mise à jour actuelle.

## 2. Copier et pousser avec PowerShell

1. Extraire le ZIP dans un NOUVEAU dossier sur le Bureau. Ne pas l’extraire directement par-dessus ton dépôt.
2. Ouvrir le dossier extrait transworld-delivery-vercel contenant package.json et Publier-GitHub.ps1.
3. Dans la barre d’adresse de l’Explorateur, taper pwsh puis Entrée. Si indisponible, ouvrir PowerShell depuis le menu Démarrer et se placer dans ce dossier extrait.
4. Copier cette commande :

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Publier-GitHub.ps1

Le script cible le dépôt existant :

    C:\Users\Instal\Desktop\transworld-delivery\transworld-delivery

Il vérifie la racine Git, la branche main et le dépôt loicndjana06/transworld-delivery ; sauvegarde les fichiers locaux ; copie les corrections ; prépare uniquement les fichiers du paquet ; crée le commit et pousse main. Il conserve .git et les secrets locaux, sans push forcé. GitHub peut demander de se connecter. Si le push est refusé, le commit reste local : relever le message, ne pas utiliser --force.

Si le dépôt est ailleurs, ajouter -Destination "CHEMIN_COMPLET_DU_DEPOT" à la commande.

Si des changements sont déjà préparés dans Git, le script s’arrête avant copie. Pour retirer seulement cette préparation en conservant les fichiers : dans ton dépôt, git restore --staged . puis relancer le script. Si un commit a été créé mais le push a échoué, depuis ton dépôt : git push origin main.

Alternative sans push automatique : lancer Installer-Correction.ps1 seul. Le script PowerShell a été relu mais n’a pas pu être exécuté sur Windows dans l’environnement de préparation ; sa réussite sur ton PC reste à constater.

## 3. Configurer Vercel

Si le dépôt est déjà connecté à Vercel, le push peut déclencher un déploiement automatiquement. Un premier déploiement avant saisie des variables ne confirme pas le fonctionnement du suivi.

Sinon : Vercel → Add New → Project → importer loicndjana06/transworld-delivery.

- Framework : Next.js.
- Root Directory : racine contenant package.json. Le script copie les fichiers à la racine du dépôt existant.
- Node.js : 24.x, ou une version 22.x compatible avec engines.
- Install Command : npm ci.
- Build Command : npm run build.
- Output Directory : laisser la valeur par défaut Next.js ; ne pas mettre dist ou out.

Dans Settings → Environment Variables, renseigner pour Production :

| Nom | Valeur |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | URL API du même projet Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Clé publique anon ou publishable compatible |
| SUPABASE_SERVICE_ROLE_KEY | Clé serveur service_role ou secret compatible, jamais publique |
| ADMIN_USER_ID | 1d932391-a77a-4527-9b6d-1d7d4e884b4e si toujours ton compte administrateur |
| ADMIN_TEST_PASSWORD | Nouveau mot de passe de gestion personnel, long et secret |

EMAIL_API_KEY et EMAIL_FROM : ne pas les créer pour le moment. Les notifications internes restent disponibles, aucun email ne sera envoyé.
MAP_TILE_URL et MAP_TILE_ATTRIBUTION : facultatifs, valeurs OpenStreetMap intégrées ; aucune clé Google n’est nécessaire.

Renseigner aussi Preview si tu testes cette version. Ne pas employer la base de production pour des essais fictifs. Après tout changement de variable : Deployments → dernier déploiement → Redeploy.

Les variables ne se poussent PAS dans GitHub ; leur fichier d’exemple n’exécute aucune configuration réelle. Le SQL n’est pas exécuté par le simple push non plus.

## 4. Premier contrôle sur le site Vercel

1. Ouvrir directement l’URL Vercel dans son propre onglet.
2. Tester À propos, Services, Fonctionnement, Transport et frais, Contact et le menu mobile.
3. Maintenir le logo dix secondes sans bouger ; saisir ADMIN_TEST_PASSWORD. Accès de secours : /gestion.
4. Dans Réglages, cliquer Tester la base et le stockage. Le contrôle interroge réellement Supabase ; il ne crée aucun dossier.
5. Dans Entreprise, renseigner identité, adresse et instructions de paiement réelles.
6. Avec un véritable dossier autorisé : créer, importer la facture d’achat, ouvrir le lien privé dans un autre navigateur, télécharger le bon de commande, publier une étape et vérifier son apparition.
7. Vérifier une facture de prestation, les documents privés, les notifications internes et la révocation du lien. Ne valider des fonds ou une remise que s’ils sont réellement confirmés.

La compilation et les tests locaux ne remplacent pas ces contrôles sur ton hébergement et ton compte Supabase. Les transferts réels, le rendu tactile et le déploiement n’ont pas été vérifiés avec tes secrets.
