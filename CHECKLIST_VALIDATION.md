# TRANSWORLD DELIVERY — État de validation

14 octobre 2026. Même projet, aucune base fictive préremplie.

| Périmètre | Développé | Test effectué | À valider / configurer |
| --- | --- | --- | --- |
| Nouveau nom, logo textuel, titre | Oui | Compilation | Vérification visuelle sur appareil |
| Administration unique, maintien 10 s, mot de passe secret, déconnexion | Oui | Contrôles serveur, invalidation de session | Geste téléphone et compte réel |
| Dossier, référence, références d’achat, VIN et facture importée | Oui | Création, validation VIN, refus d’accès | Formulaire complet dans navigateur |
| Bon de commande PDF | Oui | PDF, accès privé, rendu visuel | Mentions métier et identité réelle |
| Pays, duplication, lieux, parcours, tarifs | Oui | Isolation, doublons, duplication et tarif à vérifier | Saisies officielles par administrateur |
| Catalogue de services | Oui | Enregistrement et contrôle d’accès | Tarifs/conditions réels |
| Remise, créneau, confirmation du service | Oui | Enregistrement et versions concurrentes | Parcours client réel |
| Étapes, escales, lots, retards, retour, annulation, clôture | Oui | Publications, états, dates, sélection des lots | Scénario complet réel |
| Corrections d’étapes et estimation | Oui | Ancienne version conservée, motif, concurrence | Courriel réel |
| Maps et repère dernière confirmation | Oui | Champs/coordonnées | Clé, Map ID, restrictions, service Google réel |
| Prix, conversions USD/GNF et CFA interne privé | Oui | Prix, confidentialité, motif de correction | Source/date des taux réels |
| Factures, identité figée, justificatif | Oui | PDF et snapshots | Modèle et mentions à valider |
| Avoir / facture rectificative | Oui | Original conservé, nouvelle facture payable, accès privé | Traitement fiscal réel et modèle |
| Preuve de paiement et validation manuelle | Oui | Format, états, refus sur original rectifié | Fonds réellement vérifiés par administrateur |
| Documents privés et classement BL/AWB | Oui | Format, partage, isolation | Fichiers authentiques et éventuel antivirus |
| Notifications internes / messages personnalisés | Oui | Création et états | Parcours navigateur |
| Courriels | Code prêt | Prestataire simulé, reprises | Expéditeur, clé et envoi réel non configurés |
| WhatsApp | Oui | Lien contextualisé dans le code | Ouverture réelle sur téléphone |
| Sauvegarde/restauration données et fichiers | Oui, limites documentées | Export, refus compte occupé, restauration et révocation des liens | Sauvegarde réelle périodique et test de reprise en hébergement |
| FR / EN / AR / RTL | Interface développée | TypeScript / vérification des clés de traduction | Relecture et rendu mobile ; données libres restent dans leur langue |
| Supabase | Préparation SQL/RLS/adaptateur | Pas de test sur projet réel | Portage serveur et connexion non effectués |
| Vercel / AI Studio | Guide de préparation | Non déployé sur Vercel | Adaptation hors Cloudflare/Sites, export et recette |
| Recette finale commerciale | Non terminée | Tests serveur ciblés réussis | Dossier réel de bout en bout, navigateur et services externes |

Les tests créent des fixtures uniquement dans une base en mémoire et des fichiers locaux de QA ; ils n’insèrent pas de données dans la base de production.
