# TRANSWORLD DELIVERY

Guide opérateur : [README_UTILISATION.md](README_UTILISATION.md).

Supabase est préparé dans integrations/supabase, sans être activé.

Application privée de suivi et gestion des expéditions TRANSWORLD DELIVERY, continuité de KREA Cargo. Guide opérateur : README_UTILISATION.md ; état réel de validation : CHECKLIST_VALIDATION.md.

## Fonctions livrées
- Vitrine responsive avec deux visuels illustratifs générés et compressés en WebP.
- Recherche de suivi, frise de confirmations et prévisions, quatre rubriques client.
- Aucun dossier ou trajet de démonstration prérempli.
- Gestion des expéditions liées au compte connecté, création guidée et référence non séquentielle.
- Brouillons, publication, mise à jour de lots avec sélection explicite, révision des estimations.
- Documents privés D1/R2, partage explicite, jetons hachés de sept jours, renouvellement et révocation.
- Demandes enregistrées et journal des actions.
- Actualisation du suivi toutes les cinq secondes lorsque la page est visible.

## Accès
Le Site reste privé au propriétaire par défaut. L’identité ChatGPT est fournie par Sites. Toutes les opérations de gestion vérifient l’identité et la propriété des dossiers côté serveur. Les liens privés ne contournent pas le contrôle d’accès du Site privé. Ne pas ouvrir au public sans configuration métier supplémentaire.

## Avant ouverture aux clients
Confirmer marque, coordonnées officielles et prestations. Configurer le périmètre agence, l’accès des employés et les demandes publiques. Valider le design sur de vrais smartphones. Effectuer la recette sur les ressources déployées et définir sauvegardes, conservation, surveillance, quotas et politique de confidentialité. Ajouter si nécessaire les corrections d’événements avec historique détaillé, la vérification antivirus, les notifications et les intégrations transporteurs. Paiement et catalogue de produits réels ne sont pas intégrés à cette version.

## Vérifications
`node tests/integration.mjs` vérifie les routes sur SQLite en mémoire et un stockage de fichiers simulé : création, isolation, CSRF, brouillons, publication, dates, versions, estimation, lots, fichiers et liens privés. Les services Cloudflare sont simulés pour ces tests. Vérification TypeScript avec `node node_modules/typescript/bin/tsc --noEmit`. Construction avec le helper Sites.

## Visuels
Création avec l’outil de génération d’images intégré. Prompts : photographie éditoriale d’un porte-conteneurs au port au coucher du soleil ; photographie d’un SUV, d’une moto et de cartons dans un entrepôt. Assets : `public/images/port.webp` et `public/images/services.webp`. Ils ne représentent pas les biens ou installations de l’agence.

## Accès discret à la gestion
Maintenir le logo de l’en-tête pendant dix secondes ouvre la gestion pour le compte connecté, ou la connexion si la session est absente. Une pression courte ramène à l’accueil. Relâcher, déplacer le doigt de plus de 12 pixels, annuler le geste ou quitter la page interrompt le délai. Les touches Espace ou Entrée proposent le même geste au clavier. Aucun lien de gestion ne figure dans le menu ou le pied de page. Ce raccourci ne remplace pas les contrôles de propriété côté serveur.

## Assistance WhatsApp
Le bouton flottant ouvre `wa.me` pour le numéro +237 686 912 912. Le message inclut la référence et la dernière étape confirmée quand le client consulte son suivi, et adapte le sujet à la rubrique. Aucun jeton privé, document ni coordonnée client ne figure dans le lien. Le message reste un brouillon que la personne peut modifier ou envoyer depuis WhatsApp ; aucun envoi automatique.

## Mise à jour du suivi et des prestations
Les données de production restent vides jusqu'à leur saisie par l'agence. Les factures de prestation sont créées explicitement avec motif, prestataire et responsable réel. Les références de montant XAF restent privées ; USD/GNF et les taux figés sont affichés au client. Le client peut transmettre un PDF ou une image comme preuve ; seul l'administrateur valide le paiement. Le site ne prétend pas bloquer physiquement la marchandise ni connaître une position GPS en direct.

La carte Google accepte des coordonnées manuelles et un repère sobre de véhicule. Un schéma explicitement identifié est affiché en l'absence de clé. Saisir une clé Maps JavaScript API restreinte aux domaines de déploiement et un Map ID dans Réglages pour activer Google Maps.

Un mot de passe de test supplémentaire est fourni par la variable secrète ADMIN_TEST_PASSWORD. Il ne remplace pas l'identité Sites ni les contrôles serveur. Le mot de passe n'est pas dans le code client. Les notifications privées sont stockées dans la base ; l'envoi par courriel utilise EMAIL_API_KEY et EMAIL_FROM après configuration. Un succès de l'API signifie acceptation par le prestataire, pas livraison garantie dans la boîte de réception. Les échecs ont des tentatives limitées et un bouton de reprise. Aucun envoi réel n'a été testé.

L'adaptateur Firebase, les règles et le guide sous integrations/firebase préparent la migration, qui n'est pas encore activée. Le code actuel dépend encore de Sites, D1 et R2 ; il ne peut pas être directement publié sur Vercel par simple copie d'une URL. L'export JSON aide au transfert et ne comprend pas les anciens jetons privés. Les fichiers R2 doivent être migrés séparément.

Les tests fonctionnels utilisent SQLite en mémoire, un stockage simulé et un prestataire de courriel simulé. Ils couvrent aussi les PDF, factures et preuves. La compilation TypeScript et le build sont requis. Le rendu dans un navigateur, les gestes sur smartphone, les règles Firebase en émulateur et les services Google Maps et courriel réels restent à vérifier avant ouverture aux clients.

## Extension du 14 octobre 2026
Dossiers enrichis VIN/achat/remise, import de la première facture, modèles de pays avec tarifs à vérifier, catalogue, identité réelle, corrections historisées, avoirs et factures rectificatives, documents typés, sauvegarde/restauration bornée avec fichiers, sélecteur FR/EN/AR et RTL. Voir CHECKLIST_VALIDATION.md pour distinguer tests en mémoire, recette navigateur et configurations externes.
