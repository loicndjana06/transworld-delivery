# Connexion externe préparée
Le Site déployé utilise encore D1/R2 et la connexion Sites. `repository.ts` fournit un adaptateur Firebase réel pour la connexion, les abonnements Firestore, l'enregistrement des dossiers et le stockage. Il n'est pas automatiquement actif : les routes de l'application doivent être portées vers cet adaptateur avant de déployer sur Vercel ou Firebase Hosting.

1. Créer un projet Firebase personnel, enregistrer une application Web et activer Firestore et Authentication par courriel.
2. Créer le compte administrateur avec un mot de passe définitif. Attribuer les custom claims `admin: true` et `agencyId` avec Firebase Admin SDK depuis un environnement serveur autorisé ; ne pas permettre cette attribution depuis le navigateur.
3. Fournir la configuration Web à `firebaseRepository(config, agencyId)` ; ne pas publier les clés de compte de service.
4. Déployer les règles et les tester dans les émulateurs, notamment l'isolation des clients et le refus des listes publiques.
5. Utiliser l'export JSON de l'administration pour la migration ; attribuer explicitement les identifiants clients Firebase. Ne pas recopier les anciens jetons d'accès.
6. Porter les routes de factures, les notifications et l'échange du lien privé vers un accès client Firebase sur un serveur. Les PDF et les notifications du Site actuel ne migrent pas en collant une clé dans le front-end.

Les fichiers privés sont téléchargés avec getBlob sous contrôle des règles Firebase ; aucun lien de téléchargement permanent partageable n’est fourni.

Configuration Google Maps : GOOGLE_MAPS_API_KEY (clé publique restreinte aux domaines du site et à Maps JavaScript API), GOOGLE_MAPS_MAP_ID. Configuration courriel : EMAIL_API_KEY (secret du prestataire Resend), EMAIL_FROM (adresse expéditrice vérifiée). L'envoi reste désactivé tant que ces deux valeurs manquent.
