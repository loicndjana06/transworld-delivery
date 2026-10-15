# TRANSWORLD DELIVERY — Guide des variables

15 octobre 2026. Basé sur le code corrigé remis, pas sur une modification ultérieure éventuelle d’AI Studio. Ce document ne contient aucun secret réel. Conserve tes secrets dans un gestionnaire de mots de passe, pas dans un document partagé ni GitHub.

## 1. Où remplir les valeurs ?

Dans AI Studio : utilise les champs de variables d’environnement affichés pour le projet. Le nom est à gauche ; colle uniquement la valeur dans « Secret value ». Ne colle pas NOM= devant une valeur. Clique Apply puis relance l’application si nécessaire. Ne colle pas les clés dans la conversation Gemini.

Dans Vercel : ouvre ton projet → Settings → Environment Variables → Add Environment Variable. Saisis le nom exact et sa valeur ; choisis Production, et Preview si tu y testes le projet. Enregistre et redéploie pour appliquer les modifications. Les valeurs saisies dans AI Studio ne sont pas automatiquement garanties présentes dans Vercel.

Sur ton PC seulement : les valeurs peuvent être dans .env.local à la racine du projet. Ce fichier ne doit jamais être envoyé sur GitHub. .env.example reste un modèle sans secrets.

Les variables ne se collent pas dans le SQL Editor Supabase. Cet éditeur sert aux migrations SQL. L’UUID administrateur peut également être nécessaire dans la fonction SQL is_admin(), selon le script installé.

## 2. Tableau de remplissage

| Nom exact | Quoi mettre | Vide possible ? |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | URL API du projet Supabase, de type https://IDENTIFIANT.supabase.co | Non |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Clé anon du même projet ; la version corrigée accepte aussi une clé publishable Supabase | Non pour la configuration client prévue |
| SUPABASE_SERVICE_ROLE_KEY | Clé service_role du même projet ; la version corrigée accepte aussi une nouvelle clé secret | Non ; serveur uniquement |
| ADMIN_USER_ID | 1d932391-a77a-4527-9b6d-1d7d4e884b4e, si ce compte est toujours ton administrateur dans ce projet | À renseigner explicitement pour éviter l’ambiguïté |
| ADMIN_TEST_PASSWORD | Un nouveau mot de passe administrateur fort que TU choisis et gardes secret | Non |
| MAP_TILE_URL | https://tile.openstreetmap.org/{z}/{x}/{y}.png | Oui dans le code corrigé : valeur par défaut |
| MAP_TILE_ATTRIBUTION | &copy; OpenStreetMap contributors | Oui dans le code corrigé : attribution par défaut ; conserver le lien de copyright dans l’interface |
| EMAIL_API_KEY | Clé API Resend, uniquement si tu configures l’envoi d’emails | Oui ; laisser les deux variables email vides ensemble |
| EMAIL_FROM | Nom et adresse expéditeur autorisée par Resend | Oui, avec EMAIL_API_KEY vide |

Attention aux noms : MAP_TILE_URL, pas MAP_TITLE_URL. NEXT_PUBLIC, pas NEW_PUBLIC. Respecte les noms exacts affichés par le code.

## 3. Supabase : trouver les trois valeurs

Ouvre https://supabase.com/dashboard et sélectionne le projet TRANSWORLD concerné.

### URL

Ouvre Connect : copie le Project URL dans le modèle d’environnement présenté. Selon le tableau de bord, il se trouve aussi dans Settings → Data API / API. Copie l’URL API, pas l’adresse du tableau de bord, ni une chaîne postgres://.

### Clé publique

Settings → API Keys. Si tu utilises les anciennes clés, ouvre l’onglet Legacy anon, service_role et copie anon. Si le tableau de bord propose Publishable and secret API keys, la clé publique commence par sb_publishable_.

Dans les sources corrigées, NEXT_PUBLIC_SUPABASE_ANON_KEY et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont des noms alternatifs acceptés. Utilise un seul nom cohérent avec les champs de ton projet. Si tu conserves NEXT_PUBLIC_SUPABASE_ANON_KEY, la version corrigée accepte la valeur publishable. Ne mets jamais une clé secret ou service_role dans un champ NEXT_PUBLIC.

### Clé serveur

Au même endroit, copie service_role depuis l’onglet Legacy, ou une nouvelle clé secret commençant par sb_secret_. La version corrigée accepte ces valeurs via SUPABASE_SERVICE_ROLE_KEY ; elle accepte également le nom alternatif SUPABASE_SECRET_KEY. Ne remplis pas plusieurs alias avec des clés différentes.

La clé serveur donne des droits élevés. Elle reste dans les secrets serveur AI Studio/Vercel, jamais dans un composant navigateur, une capture publique ou le dépôt. La présence du mot « Secret value » dans une interface ne rend pas une variable NEXT_PUBLIC confidentielle : ce préfixe peut l’exposer au navigateur.

URL et clés doivent appartenir au même projet. Ces clés ne sont ni ton mot de passe Supabase ni le mot de passe PostgreSQL. Les nouvelles clés et les anciennes ont des formats différents ; ne tronque aucune valeur.

Source : https://supabase.com/docs/guides/getting-started/api-keys

## 4. Mot de passe et identité administrateur

ADMIN_TEST_PASSWORD : malgré son nom historique, il sert à l’authentification du panneau de gestion dans la version corrigée. Tu choisis toi-même un mot de passe unique, long, idéalement généré par ton gestionnaire. Il n’existe pas de valeur à récupérer dans Google Maps ou Supabase. Ne réutilise pas un mot de passe déjà écrit dans nos conversations. Ne mets pas littéralement « MON_MOT_DE_PASSE ».

Après Apply ou redéploiement : maintiens le logo 10 secondes, puis saisis exactement ce mot de passe. /gestion fournit un accès de secours avec la même authentification. Si la fenêtre ne s’ouvre pas, ce n’est pas corrigé en changeant le mot de passe : il faut vérifier le code et ses interactions.

ADMIN_USER_ID : Supabase → Authentication → Users → ouvre ton compte administrateur → copie son User UID. Le dernier UID fourni est 1d932391-a77a-4527-9b6d-1d7d4e884b4e. Vérifie qu’il correspond toujours au projet utilisé et au UUID configuré dans is_admin(). L’UUID n’est pas un mot de passe. Le mot de passe de ce compte Supabase Auth et ADMIN_TEST_PASSWORD sont des mécanismes distincts dans les sources corrigées ; modifier l’un ne modifie pas automatiquement l’autre.

## 5. Carte gratuite sans clé Google

Pour remplir explicitement les champs :

MAP_TILE_URL : https://tile.openstreetmap.org/{z}/{x}/{y}.png

MAP_TILE_ATTRIBUTION : &copy; OpenStreetMap contributors

Garde les accolades {z}, {x}, {y}. N’ajoute aucune clé API. Le composant doit conserver l’attribution visible et le lien https://www.openstreetmap.org/copyright. Dans le code corrigé, tu peux aussi omettre ces deux variables pour utiliser ses valeurs par défaut.

Il n’y a pas de GOOGLE_MAPS_API_KEY ou GOOGLE_MAPS_MAP_ID à remplir pour ce choix. Si AI Studio les réclame encore, il utilise des prérequis obsolètes. Les tuiles publiques OSM ont une politique d’utilisation et une capacité limitée ; ce n’est pas une garantie de service illimitée.

Source : https://operations.osmfoundation.org/policies/tiles/

## 6. Emails : deux choix clairs

### Choix A — Pas d’email automatique pour le moment

EMAIL_API_KEY : laisse vide ou ne crée pas cette variable.

EMAIL_FROM : laisse vide ou ne crée pas cette variable.

Ne mets ni « none », ni « false », ni une fausse clé : ce seraient des valeurs non vides. Dans les sources corrigées, le site conserve ses notifications internes et WhatsApp ; aucun email client ne doit être annoncé comme envoyé. Cela permet de démarrer sans configurer un prestataire email, mais pas de promettre des alertes email hors du site.

Si AI Studio bloque Apply à cause de champs email vides, demande de rendre ces variables optionnelles dans son schéma de configuration et au démarrage. Ce n’est pas une raison pour inventer des valeurs. Même règle pour les variables de carte possédant déjà une valeur par défaut.

### Choix B — Envoyer de vrais emails clients avec Resend

1. Ouvre https://resend.com et crée/connecte ton compte.
2. Dans Domains → Add Domain, ajoute un domaine que tu contrôles. Une adresse Gmail personnelle n’est pas un domaine que tu peux vérifier pour l’envoi.
3. Resend affiche les enregistrements DNS nécessaires. Chez le gestionnaire DNS de ton domaine, ajoute exactement ces enregistrements, sans supprimer ceux qui existent déjà. Reviens dans Resend et vérifie jusqu’à l’état Verified.
4. Dans API Keys → Create API Key, crée une clé dédiée TRANSWORLD DELIVERY, avec permission d’envoi et restriction au domaine si proposée. Copie immédiatement la valeur complète, généralement re_..., dans EMAIL_API_KEY. Ce n’est pas un mot de passe de messagerie.
5. Dans EMAIL_FROM, mets un expéditeur utilisant ce domaine vérifié. Format : TRANSWORLD DELIVERY <notifications@TON-DOMAINE-VERIFIE>. Remplace tout le domaine fictif ; ne copie pas l’exemple sans adaptation.
6. Enregistre les deux valeurs côté serveur, redéploie/relance, puis déclenche une vraie notification autorisée. Vérifie les journaux Resend et la réception, y compris les indésirables.

EMAIL_FROM est l’expéditeur, pas l’adresse du client ni l’adresse de connexion Supabase. Le destinataire vient de l’email enregistré dans le dossier client. Configurer un expéditeur ne crée pas automatiquement une boîte de réception pour recevoir les réponses.

Pour un test limité sans domaine : Resend permet l’expéditeur onboarding@resend.dev dans son environnement de test, avec envoi vers l’adresse de ton propre compte Resend. Ce n’est pas un expéditeur de production permettant de notifier tous tes clients. Vérifie ses restrictions actuelles avant usage. L’envoi de production exige un domaine autorisé. Aucun abonnement payant n’est imposé par ce guide : vérifie les quotas et conditions du compte avant activation.

Sources : https://resend.com/docs/dashboard/domains/introduction ; https://resend.com/docs/dashboard/api-keys/introduction ; https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

## 7. Modèle à compléter, sans emails

Remplace les quatre valeurs indicatives avant utilisation. Ne colle pas ce modèle contenant des indications dans les champs comme si elles étaient des clés réelles.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=COLLER_URL_API_DU_PROJET
NEXT_PUBLIC_SUPABASE_ANON_KEY=COLLER_CLE_PUBLIQUE_DU_PROJET
SUPABASE_SERVICE_ROLE_KEY=COLLER_CLE_SERVEUR_DU_PROJET
ADMIN_USER_ID=1d932391-a77a-4527-9b6d-1d7d4e884b4e
ADMIN_TEST_PASSWORD=CHOISIR_UN_NOUVEAU_SECRET_PERSONNEL
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
MAP_TILE_ATTRIBUTION="&copy; OpenStreetMap contributors"
EMAIL_API_KEY=
EMAIL_FROM=
```

Dans les champs individuels AI Studio/Vercel, colle uniquement les valeurs, sans le signe égal ni les guillemets qui entourent une valeur dans ce modèle de fichier.

## 8. Contrôle avant publication

- Les migrations SQL correspondant au code sont exécutées ; la configuration seule ne crée pas les tables et droits.
- cargo-documents est privé ; import et téléchargement autorisés réellement testés.
- Mot de passe administrateur présent, UUID correct, création puis relecture d’un dossier après rechargement.
- Autre client ou lien invalide n’accède pas aux documents privés.
- Carte sans Google, attribution visible.
- Email : soit deux champs vides et aucun faux envoi, soit configuration réelle et réception vérifiée.
- Variables saisies aussi dans Vercel, pas seulement AI Studio ; nouveau déploiement après changement.
- Pas de fichier .env.local ni de secrets dans le dépôt public.

Source Vercel : https://vercel.com/docs/environment-variables/managing-environment-variables

Si AI Studio a réécrit l’authentification ou les noms des variables depuis la version corrigée, son .env.example et le code actuel doivent être comparés à ce guide avant copie. Ne rajoute pas au hasard Firebase, Gemini, Google Maps, DATABASE_URL ou un mot de passe PostgreSQL : ils ne sont pas requis par le modèle corrigé décrit ici.

## Complément de cette archive Vercel
AI Studio est entièrement facultatif. Pour la base existante, exécuter SUPABASE_MISE_A_JOUR.sql à la racine de cette archive : il comprend 05 et 06. Après déploiement, le bouton Réglages → Tester la base et le stockage vérifie réellement la connexion.
