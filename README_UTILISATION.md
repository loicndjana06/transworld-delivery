# Guide de gestion — TRANSWORLD DELIVERY
## Accès et sécurité
L'administrateur est unique, rattaché à l'UUID indiqué dans .env.example et is_admin(). Le maintien du logo dure 10 secondes. Relâchement, déplacement, perte de focus ou sortie de page annulent le maintien. /gestion fournit un accès de secours sans lien public.
ADMIN_TEST_PASSWORD doit être long, unique et choisi par vous. Aucun mot de passe de secours n'est prévu. Vérification côté serveur puis session de quatre heures enregistrée avec son empreinte dans Supabase. Le cookie HTTPS est HttpOnly, Secure et partitionné pour les aperçus intégrés modernes. Si le navigateur bloque les cookies d'aperçu, ouvrir l'application dans son propre onglet. La déconnexion révoque la session ; changer le mot de passe invalide les anciennes empreintes.
Huit tentatives par adresse réseau et par quinze minutes. Ne partagez pas la clé service_role/secret. Les routes vérifient le cookie, le propriétaire ou le jeton avant d'utiliser la clé serveur. Les modifications exigent POST et une origine autorisée. Les fonctions transactionnelles sont interdites aux rôles anon/authenticated.
Pour changer d'administrateur : mettre le même UUID réel dans ADMIN_USER_ID et is_admin(), changer le mot de passe et révoquer les anciennes sessions.
## Navigation et langues
/a-propos, /services, /fonctionnement, /tarifs et /contact ont de vraies routes. Le champ de suivi se trouve sur /#tracking.
Les liens informatifs sont utilisables sans JavaScript ; gestion et suivi nécessitent JavaScript.
FR/EN/AR et RTL sont conservés. Les nouveaux textes publics sont traduits ; les textes libres restent dans leur langue de saisie. Relecture linguistique et visuelle sur appareils réels encore nécessaire.
## Dossiers et documents
Nouvelle expédition : client/contact/courriel, marchandise, référence d'achat et première facture, trajet, puis vérification et import de la facture authentique PDF/JPEG/PNG (10 Mo maximum). VIN si connu. Créer le dossier ne confirme ni paiement ni départ.
La référence KC est unique. Le lien privé contient un jeton valable sept jours. Partager uniquement avec le client. Renouveler révoque l'ancien lien ; une correction de contact peut aussi le révoquer.
La référence seule ne donne pas accès aux informations personnelles, notes, documents ou factures. Tous les fichiers sont dans cargo-documents privé et partagés explicitement. BL/AWB authentiques à importer ; jamais générés artificiellement. Les PDF produits sont bons de commande, factures et rectifications, sans signature manuscrite fictive.
## Étapes et carte
Ajouter une étape : type, lieu, date réelle ou prévue, source, note, coordonnées connues et mode air/mer/terre/combiné. Vérifier puis publier ou garder en brouillon. La remise effective exige une référence de preuve ; une arrivée ne vaut pas livraison.
Une correction conserve l'historique et exige un motif. Les mises à jour de lot nécessitent une sélection explicite ; les livraisons sont confirmées individuellement.
Leaflet utilise OpenStreetMap sans clé ni facturation cartographique. Attribution visible, usage raisonnable, aucun téléchargement massif/offline. Les tracés sont schématiques ; ce ne sont pas des routes GPS réellement parcourues. La dernière position est celle confirmée par l'administrateur, jamais un déplacement automatique.
Le client reçoit les mises à jour par requête autorisée toutes les cinq secondes lorsque l'onglet est visible, ainsi qu'au retour de connexion/focus. Les abonnements anonymes Postgres Changes qui ne pouvaient pas lire les tables privées ont été retirés. Il ne s'agit pas d'un GPS continu ni d'une livraison instantanée garantie.
## Prix, factures et paiements
Prix produit séparé ; prestations réelles et justificatifs selon le dossier. Aucun montant d'exemple imposé. CFA Afrique centrale interne, USD/GNF côté client. Les taux positifs, source et date sont renseignés ; les factures gardent leur instantané.
Catalogue et modèles de pays modifiables. Les tarifs copiés nécessitent une revue. L'entreprise et son adresse réelles sont nécessaires avant facturation.
Une preuve déposée passe en vérification et ne confirme pas des fonds. Seul le gestionnaire valide la réception réelle. Une facture rectifiée garde son original avec avoir ou nouvelle facture. Un avoir ne provoque aucun remboursement bancaire.
Le paiement lève l'attente financière associée mais ne génère pas d'étape physique. L'agence publie chaque déplacement confirmé ; les mouvements existants restent visibles malgré une autre facture en attente.
## Messages et demandes
Les demandes publiques sont réellement enregistrées sous le propriétaire unique, avec limitation des envois. Elles ne valent ni réservation ni paiement.
Les notifications internes sont persistées et consultables avec le lien privé. Sans EMAIL_API_KEY/EMAIL_FROM, aucun email n'est envoyé. Avec Resend configuré, succès API signifie accepté par le prestataire, pas nécessairement reçu par le destinataire. Trois tentatives maximum avec clé d'idempotence.
WhatsApp +237686912912 prépare un message référence/étape, sans jeton privé. Le client peut le modifier et doit l'envoyer lui-même.
## Sauvegarde
Export confidentiel : 500 lignes par table, 50 fichiers et 2 Mo de fichiers au total, avec un JSON complet limité à 3 Mo pour rester compatible Vercel. L'export refuse les dépassements au lieu de tronquer. Aucun jeton privé ni session exporté.
Restaurer exige un compte vide et RESTAURER COMPTE VIDE. Identifiants remappés, anciens liens révoqués. Pour davantage de données, prévoir une sauvegarde complète externe de Postgres et Storage. Pas de sauvegarde automatique planifiée dans ce projet.
## Installation et architecture
Suivre COMMENCER_ICI.md. Pour la base existante, SUPABASE_MISE_A_JOUR.sql installe les compléments 05 et 06 : transactions cargo_execute, limitation cargo_throttle/cargo_rate_limits, imports privés cargo_uploads et prestations service_tasks. Les tables et le bucket déjà installés sont conservés.
Le serveur utilise des transactions PostgreSQL via cargo_execute (service_role uniquement, security invoker). Aucun endpoint public n'accepte de SQL ; les valeurs utilisateur sont échappées avant leur transmission serveur. Les tables restent privées sous RLS.
Aucun stockage local de production. Les anciennes migrations Drizzle sont historiques et ne s'exécutent plus au démarrage.
## Vérification réellement effectuée
Tests sur PostgreSQL embarqué : transactions, droits RLS, authentification de session, dossiers, factures, PDF, liens privés, sauvegarde et restauration. Tests React dans un DOM isolé : hydratation, navigation, menu, maintien logo, connexion et ouverture du formulaire.
Les fichiers et emails sont simulés uniquement dans les tests. Aucune donnée de démonstration n'est livrée en production. Votre connexion Supabase réelle, les transferts Storage, les emails, les gestes sur téléphone et le déploiement Vercel restent à vérifier avec votre configuration. Les quotas et conditions des prestataires s'appliquent.

## Prestations conditionnées au paiement
À la création d’une facture, indiquer la prestation à prendre en charge et cocher si sa prise en charge exige des fonds validés. Avant validation, le bouton de confirmation est bloqué côté serveur, y compris si une preuve a été déposée. Après validation, la prestation devient autorisée mais reste à confirmer par le gestionnaire avec une source réelle. Cette confirmation n’ajoute aucune étape géographique. Les mouvements confirmés restent visibles en toute circonstance financière.
Une rectification conserve l’ancien document. Une prestation non encore prise en charge reçoit un nouveau lien financier vers la facture de remplacement. Les confirmations déjà réalisées ne sont pas inventées à nouveau.
Le client voit le total des factures actives, les paiements validés et le solde. Les documents rectifiés sont exclus, le prix d’achat externe n’est pas ajouté une seconde fois, et les prestations indéterminées ne sont pas présentées comme un prix final.

## Fichiers et Vercel
Les formulaires d’import utilisent une URL temporaire d’écriture sur un chemin unique du bucket privé : les 10 Mo autorisés ne traversent pas les requêtes de fonctions Vercel. Le serveur autorise d’abord le dossier, puis vérifie taille et signature PDF/JPEG/PNG avant enregistrement. Un import interrompu peut laisser une autorisation temporaire et un objet non associé ; ne pas supprimer les objets associés aux dossiers lors d’un nettoyage Storage.
Les téléchargements de fichiers importés sont autorisés côté serveur puis redirigés vers une URL signée valable 60 secondes. Un lien déjà délivré peut rester utilisable pendant ce bref délai après retrait d’un partage. Bons de commande et factures PDF sont produits par le serveur.
Les preuves sont privées par défaut. Partager avec le client ou Retirer le partage modifie les autorisations du document ; les changements sont journalisés. Révoquer le lien privé coupe l’accès au dossier sans en créer un nouveau ; Renouveler remplace l’ancien jeton.
Les petits exports/restaurations sont bornés pour Vercel. Pour un dossier contenant de gros fichiers, utiliser une sauvegarde Postgres et Storage complète via les outils du fournisseur ; aucune sauvegarde automatique hors site n’est promise.

## Vérification de configuration
Dans Réglages, Tester la base et le stockage confirme un accès réel aux tables et la présence d’un bucket privé. Il ne valide pas à lui seul un import, une réception d’email, un transfert bancaire ou le rendu mobile. Les emails absents ne bloquent pas l’application. Les tentatives d’envoi sont bornées en durée ; les messages restant en attente peuvent être repris depuis Réessayer les courriels.

Une facture déjà payée ne peut pas être remplacée automatiquement par une nouvelle demande de paiement : le serveur exige d’abord une réconciliation des fonds hors de ce remplacement. Un avoir reste possible, sans simuler de remboursement. L’application ne réalise aucun débit bancaire, remboursement automatique ou rapprochement bancaire.
