# Vérifications — TRANSWORLD DELIVERY Vercel direct r2

Cette checklist concerne les sources de cette archive, pas l’ancienne version importée dans AI Studio. Les tests isolés ne se connectent pas au Supabase du propriétaire.

| Fonction | Vérification effectuée | Contrôle restant |
|---|---|---|
| Next.js et TypeScript | Compilation de production et routes | Build Vercel après push |
| Navigation publique | Cinq pages informatives hydratées sans erreur dans le DOM, liens réels, formulaire de demande sur chacune | Navigation dans le navigateur réel |
| Demandes publiques | Formulaire soumis sans connexion admin ; données et limitation côté serveur | Réception d’une demande réelle |
| Menu mobile | Ouverture/fermeture testées dans le DOM | Rendu et gestes sur téléphone |
| Logo et gestion | Seuil 9 999/10 000 ms, annulation relâchement/déplacement, session et ouverture immédiate du panneau testés | Connexion sur l’URL Vercel |
| Dossier | Trois étapes du formulaire testées dans le DOM ; enregistrement/modifications testés sur PostgreSQL | Premier dossier réel autorisé |
| Pays/services/VIN/remise | Modèles, duplication sans prix approuvés, VIN et confirmations testés | Renseigner dessertes et tarifs réels, relecture pays par pays |
| Étapes/escales/lots | Prévisions, brouillons, publication, corrections, dates, sélection explicite et remise individuelle testés | Vérification d’un trajet réel |
| Paiement et prestation | Preuve ≠ fonds validés ; prise en charge bloquée avant paiement, autorisée après paiement, confirmée séparément ; aucun mouvement inventé | Vérifier avec des fonds et sources réels uniquement |
| Rectification | Originaux conservés, remplacement non payé lié à la prestation ; protection contre nouvelle demande automatique sur facture déjà payée | Réconciliation des fonds et mentions comptables par l’opérateur |
| Finances/PDF | USD/GNF client, XAF privé, conversions figées, bons/factures/rectifications testés | Identité et documents réels ; tarifs et sources des taux à renseigner |
| Import privé Vercel | Contrat navigateur vérifié : JSON léger, 5 Mo directement vers stockage signé ; contrôle serveur du contenu, taille, expiration et accès | Transfert réel depuis le navigateur vers le bucket Supabase |
| Téléchargements | Autorisation puis redirection signée testée ; refus de documents privés | Accès au véritable Storage ; URL signée valable 60 s après délivrance |
| Partage et liens | Retrait de partage, révocation du jeton et refus d’accès testés | Essai avec deux navigateurs |
| RLS et fonctions | Anon/tiers/admin, transactions, anti-injection, refus RPC et nouvelles tables privées testés sur PostgreSQL embarqué | Permissions installées dans la vraie base |
| Diagnostic de connexion | Route protégée interrogant DB et caractère privé du bucket ; contrat testé | Cliquer Réglages → Tester la base et le stockage sur Vercel |
| Notifications | Internes persistées, conditions d’envoi et échecs testés ; emails facultatifs | Réception client ; email indisponible si variables absentes |
| Carte | Leaflet/OSM sans clé, dernier point confirmé, schéma prévision/confirmation, mise à jour des métadonnées | Chargement réseau, zoom et rendu mobile |
| Langues | FR/EN/AR, changement RTL testé ; nouveaux libellés traduits | Relecture visuelle et linguistique sur appareils réels |
| Sauvegarde | Export/restore, remappage et fichiers testés ; limites explicites Vercel | Sauvegarde réelle ; gros volumes via outils Postgres/Storage ; aucune tâche planifiée promise |
| Transfert PowerShell | Scripts relus : sauvegarde, vérification du bon dépôt, fichiers ciblés, pas de push forcé | Exécution sur Windows non disponible ici |
| Production | Sources, correctif SQL, guide et variables préparés | Déploiement, configuration et recette sur la vraie URL |

## Tests livrés

npm test exécute six suites : integration, access-isolation, security-postgres, interactions, deployment-workflow et client-upload. PostgreSQL embarqué PGlite ; stockage et transport email simulés uniquement dans les tests. Les fichiers temporaires et données de tests ne sont pas livrés comme données de production.

Aucun dossier client, paiement, déplacement ou envoi fictif n’est créé au démarrage. Aucun secret réel n’est inclus. Aucun déploiement ni connexion au Supabase du propriétaire n’est revendiqué.
