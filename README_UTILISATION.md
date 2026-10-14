# TRANSWORLD DELIVERY — Guide d’utilisation

Mise à jour : 14 octobre 2026. Même projet que l’ancien KREA Cargo.

Site privé : https://krea-cargo-tracking.syrupy-moose-4995.chatgpt.site

Le nom commercial affiché est TRANSWORLD DELIVERY. L’ancienne adresse technique est conservée. L’application actuelle utilise une vraie base D1 et un stockage privé R2. Supabase et Vercel ne sont pas encore actifs. Aucun dossier client ou tarif fictif n’est prérempli.

## 1. Entrer dans l’administration

1. Maintenir le logo de l’en-tête pendant dix secondes sans relâcher ni déplacer le doigt.
2. Se connecter avec le compte propriétaire si demandé.
3. Saisir le mot de passe de gestion configuré côté serveur.

Aucun lien Administrateur n’apparaît dans la navigation publique. Le raccourci discret est complété par l’identité, la session sécurisée et les vérifications serveur. Au clavier, maintenir Entrée ou Espace fonctionne aussi. **Fermer la gestion** révoque la session. Elle expire au maximum après quatre heures. Le mot de passe n’est ni dans ce guide ni dans le code public : il est stocké dans le secret serveur `ADMIN_TEST_PASSWORD`. Le changer invalide les anciennes sessions.

Le Site est privé au propriétaire. Un lien privé de dossier ne contourne pas cette restriction générale. L’accès commercial aux clients sera validé après migration/configuration d’hébergement.

## 2. Configurer l’entreprise

Dans **Entreprise**, saisir l’identité réelle, l’adresse, les contacts, le service émetteur, l’éventuelle référence d’immatriculation et les instructions de paiement. Ne saisir aucune mention officielle ou taxe inventée.

Le nom et l’adresse sont nécessaires pour émettre une facture. L’identité est figée dans chaque nouvelle facture. Modifier la configuration ne remplace pas l’identité des factures déjà émises. Le bon de commande utilise les informations courantes du dossier et de l’entreprise.

## 3. Construire le catalogue des prestations

Dans **Prestations**, cliquer sur **Ajouter**. Choisir ou saisir un nom, la nature (Honoraires, Droits et taxes, Transport ou Autre), les conditions et le prestataire. Le montant interne CFA est facultatif.

Les noms proposés sont des catégories de services, sans prix imposé. Séparer notamment honoraires de transit/dédouanement et droits/taxes à l’importation. Surestaries et détention ne sont utilisées que lorsqu’elles s’appliquent réellement.

Vérifier un tarif avant de cocher **J’ai vérifié ce tarif avant son utilisation**. Les tarifs non vérifiés ne sont pas préremplis dans les factures. Toute modification du montant remet le tarif à vérifier. Ajouter, modifier, dupliquer et supprimer un modèle ne modifie pas une facture déjà émise.

## 4. Administrer les pays

Dans **Pays**, ajouter un pays et ses lieux desservis, sa structure d’étapes prévues, ses formalités vérifiées et leur source officielle HTTPS. Associer des prestations et leurs tarifs spécifiques.

**Dupliquer** prépare un nouveau modèle avec les lieux, étapes, formalités et prestations copiés. Modifier le nom et vérifier chaque indication pour le nouveau pays. Tous les tarifs copiés sont remis à vérifier. Rien n’est facturé ou publié automatiquement.

Les formalités sont renseignées par l’administrateur. Une URL saisie ne certifie pas automatiquement son contenu : vérifier qu’elle provient du service officiel concerné.

## 5. Créer un dossier réel

1. Cliquer sur **Nouvelle expédition**.
2. Saisir client, contact, courriel, marchandise, catégorie, référence d’achat externe et première facture d’achat. Ajouter le VIN s’il est connu (17 caractères, sans I, O ni Q).
3. Renseigner éventuellement le prix du produit seul et les deux taux positifs de conversion. Aucun transport n’est inclus automatiquement.
4. Renseigner départ, pays, destination, lieu de remise, créneau souhaité, conteneur/lot et estimation d’arrivée.
5. Vérifier le récapitulatif et joindre la facture d’achat authentique (PDF, JPG ou PNG ; 10 Mo maximum). Le partage au client est explicite.
6. Créer le dossier : référence unique `KC-…` et lien privé sont générés par le serveur.

Le dossier ne confirme ni paiement ni réception ni départ. La prévention des doublons recherche les mêmes facture, client et marchandise. Si l’import du fichier échoue après création, le dossier reste accessible et un message demande de reprendre l’import depuis Documents ; ne pas créer un deuxième dossier.

Copier le lien privé fourni. Il est valable sept jours. **Renouveler le lien privé** révoque l’ancien lien. Modifier le contact ou le courriel le révoque également. La référence seule affiche le suivi expurgé ; les données privées nécessitent un accès autorisé.

## 6. Compléter achat, VIN et remise

Ouvrir le dossier puis **Achat, VIN et remise**. Choisir un modèle de pays si souhaité. Les lieux proposés et la structure d’étapes du modèle facilitent la saisie.

Enregistrer pays, ville, port/aéroport/adresse, type de remise et créneau. Préciser la confirmation du service, des frais et de la disponibilité avant de cocher la destination confirmée. Le client voit ce choix et son état dans Marchandise.

Le parcours prévu est un plan de travail : il ne publie aucun mouvement. Le prix du produit peut être corrigé avec un motif ; les prix antérieurs restent dans le journal et les factures émises ne changent pas. Renseigner la source et la date des taux.

## 7. Bon de commande PDF

Depuis le dossier ou les Documents du suivi privé, télécharger le **Bon de commande PDF**. Il reprend client, marchandise, VIN/références disponibles, trajet, remise, créneau et prix enregistré.

Ce document est produit depuis les informations actuellement enregistrées. Il ne remplace ni la facture du vendeur, ni une preuve de paiement, ni une réservation, ni un Bill of Lading/AWB. Valider les mentions et le modèle métier avant utilisation définitive. Aucune signature manuscrite n’est inventée.

## 8. Étapes et escales

1. Ouvrir le dossier et **Ajouter une étape**.
2. Choisir confirmation ou prévision, puis type, lieu, date, mode (Maritime, Aérien, Terrestre ou Combiné), source et commentaire.
3. Saisir latitude/longitude si connues.
4. Choisir publication après vérification ou brouillon, vérifier l’aperçu, puis enregistrer.

Autant d’étapes que nécessaire peuvent être ajoutées : réception, préparation, transport, escales, transbordement, retard, arrivée, formalités, mise à disposition et livraison. Annulation et retour sont distincts. L’arrivée à destination n’est pas une remise au client. **Livré** exige une note de preuve/référence de remise et se confirme individuellement.

Les lots ou conteneurs peuvent être mis à jour avec sélection explicite des dossiers concernés. Aucun mouvement automatique n’est généré entre deux confirmations. Le suivi vérifie les mises à jour toutes les cinq secondes lorsque la page est visible.

**Corriger** conserve l’ancienne version de l’étape et son motif dans l’historique. Une correction d’étape publiée ajoute une notification. **Réviser l’arrivée** actualise l’estimation avec motif et notification. La date réelle et la date de publication restent distinctes.

## 9. Carte

Dans **Réglages**, renseigner une clé Maps JavaScript API et un Map ID. Restreindre la clé aux domaines du Site et à l’API nécessaire. Les coordonnées sont saisies par l’agence.

Le repère représente la dernière position confirmée. Les lieux prévus sont distincts des confirmations ; les liaisons sont indicatives, pas un itinéraire routier/maritime certifié ni un GPS en direct. Sans configuration, un schéma identifié s’affiche. La carte Google et ses restrictions/quotas doivent encore être testées sur le vrai service.

## 10. Facturer une prestation

1. Configurer d’abord Entreprise.
2. Ouvrir le dossier puis **Créer une facture**.
3. Choisir une prestation du catalogue ou saisir une prestation réelle.
4. Renseigner étape, justification, prestataire et responsable autorisé. Associer un justificatif du dossier si disponible.
5. Vérifier le montant, la source et la date des taux ; émettre la facture.

Si le dossier utilise un pays modèle, son tarif applicable est proposé uniquement s’il est vérifié. Le tarif reste modifiable avant émission. Les montants client sont USD et GNF ; la base et le taux CFA internes ne sont pas transmis au suivi client. Les conversions et l’identité sont figées dans la facture émise.

La disponibilité de la facture ajoute une notification. Le PDF conserve une validation nominative, sans imiter une signature manuscrite. L’instruction de paiement provient de l’identité configurée, sans faux prestataire de paiement.

## 11. Preuve de paiement

Le client utilisant son accès privé peut envoyer un PDF, JPG ou PNG. La facture passe à **Preuve reçue — en vérification**. Cette action ne confirme pas la réception des fonds.

L’administrateur vérifie réellement les fonds, puis utilise **Valider le paiement vérifié**. La confirmation est journalisée et notifiée. Aucun prestataire de paiement en ligne n’est branché. Les mouvements réellement confirmés continuent à être visibles même si une prestation reste impayée.

## 12. Rectifier après émission

**Rectifier** crée un document numéroté lié à la facture originale, qui reste intacte. Un motif et un responsable réel sont nécessaires.

- **Avoir intégral** : document de crédit du montant original ; il ne confirme aucun remboursement.
- **Facture rectificative** : nouveaux montant/taux vérifiés, nouveau document et nouvelle facture payable. Le dépôt de preuve et la validation manuelle s’effectuent sur cette nouvelle facture.

Le client retrouve original et document rectificatif. La facture originale rectifiée n’accepte plus de nouvelle preuve/validation. Les corrections sont conservées dans le journal. Le traitement fiscal définitif et les mentions doivent être validés selon la situation réelle.

## 13. Documents authentiques

Dans le dossier, choisir le type : facture d’achat, bon, facture de prestation, Bill of Lading, AWB, justificatif de frais, document douanier, preuve de remise ou autre. Importer le document authentique, puis décider explicitement s’il est partagé.

Fichiers privés par défaut. PDF, JPG et PNG ; 10 Mo maximum. Le contenu est contrôlé par sa signature de format, sans garantie antivirus. BL maritime et AWB aérienne sont importés, pas fabriqués par l’application.

## 14. Messages

Les publications, changements d’estimation, factures, preuves, validations et corrections importantes ajoutent des notifications privées. **Notifier le client** publie un message personnalisé.

Les courriels nécessitent `EMAIL_API_KEY`, `EMAIL_FROM`, un expéditeur vérifié et une adresse client valide. Ils ne sont pas configurés actuellement. Le panneau distingue non configuré, adresse absente, échec et accepté par le prestataire. Il propose la reprise, avec tentatives limitées. Accepté ne signifie pas livré dans la boîte mail.

Le bouton WhatsApp ouvre **+237 686 912 912**, avec référence et contexte sans jeton privé. Le client modifie et envoie lui-même le message. Aucun envoi WhatsApp automatique.

## 15. Langues et téléphone

Le sélecteur de l’en-tête propose FR, EN et العربية. L’arabe active droite à gauche. Le choix est une préférence locale du navigateur. Les libellés d’interface sont traduits ; les informations saisies par l’agence, messages personnalisés et documents authentiques restent dans leur langue d’origine. Les PDF métier sont actuellement en français.

Le rendu sur de vrais téléphones/tablettes et la relecture des traductions restent à valider. La voiture et la moto sont cadrées séparément, sans étirement.

## 16. Sauvegarder et restaurer

Dans **Sauvegarde**, télécharger le fichier confidentiel contenant données, modèles, historique, factures et fichiers. Limites de cet export applicatif : 500 lignes par table, 50 fichiers, 20 Mo de fichiers. L’export refuse le dépassement au lieu de tronquer silencieusement. Prévoir un dispositif externe au-delà de ces limites.

Sessions, liens privés et secrets ne sont pas exportés. Protéger la sauvegarde comme les dossiers clients. La sauvegarde n’est pas planifiée automatiquement.

La restauration accepte uniquement un compte vide, une sauvegarde de confiance et la confirmation **RESTAURER COMPTE VIDE**. Les fichiers et relations sont rétablis ; les identifiants internes sont renouvelés, les références métier conservées. Aucun courriel n’est envoyé. Renouveler ensuite les liens privés. Aucun dossier existant n’est écrasé. Un fichier incomplet ou invalide provoque le refus/rollback de l’import.

## 17. Migrer ensuite

Le même projet doit être adapté à Vercel avec Supabase Postgres, Auth et Storage. Les fichiers `integrations/supabase` préparent le schéma/RLS et la connexion, mais ne remplacent pas les routes D1/R2 actuelles. Ajouter les clés seules ne réalise pas le portage.

La prochaine étape nécessite Project URL et Publishable key. Ne jamais mettre une clé secret/service_role dans le navigateur. Aucun dossier client réel n’a encore été créé selon le cahier des charges. Si des dossiers sont créés entre-temps, inventorier les données et fichiers avant migration.

Les opérations transactionnelles, liens privés, PDF, corrections, modèles, sauvegardes et notifications doivent être portés puis testés sur le vrai projet. Le SQL préparé n’est pas une migration déjà exécutée. Après adaptation et recette complète, publier sur Vercel sous l’adresse choisie.

## 18. Validation avant ouverture aux clients

Voir `CHECKLIST_VALIDATION.md`. Les tests serveur utilisent SQLite, stockage et courriels simulés. TypeScript et compilation sont contrôlés. Les PDF sont inspectés visuellement. Le navigateur, les gestes sur téléphone et les services externes réels restent à tester.

Le site ne doit pas être déclaré entièrement opérationnel commercialement avant cette recette. Le README doit être mis à jour après la migration et les configurations finales.
