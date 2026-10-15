param([string]$Destination = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'transworld-delivery\transworld-delivery'))
$ErrorActionPreference = 'Stop'
$sourceProject = $PSScriptRoot
$targetProject = [System.IO.Path]::GetFullPath($Destination)
if ($sourceProject -eq $targetProject) { throw 'Extraire le ZIP dans un autre dossier avant de lancer ce script.' }
if (!(Test-Path (Join-Path $targetProject '.git')) -or !(Test-Path (Join-Path $targetProject 'package.json'))) {
  throw "Depot Git introuvable dans $targetProject. Utiliser -Destination suivi du chemin du depot."
}
$gitRoot = & git -C $targetProject rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or [System.IO.Path]::GetFullPath($gitRoot.Trim()) -ine $targetProject) { throw 'Le dossier cible doit etre la racine exacte de votre depot Git.' }
$trackedSecrets = & git -C $targetProject ls-files -- '.env' '.env.local' '.env.production' '.env.development' '.env.preview'
if ($trackedSecrets) { throw 'Un fichier de secrets est deja suivi par Git. Retirez-le du suivi et renouvelez les secrets exposes avant publication.' }
$projectBackup = Join-Path ([Environment]::GetFolderPath('Desktop')) ('transworld-delivery-sauvegarde-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& robocopy $targetProject $projectBackup /E /XD .git node_modules .next .sites-runtime .vercel /XF '.env*' '*.tsbuildinfo' /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw 'Sauvegarde echouee : aucune correction copiee.' }
& robocopy $sourceProject $targetProject /E /XD .git node_modules .next .sites-runtime .local-data .vercel /XF '.env*' '*.tsbuildinfo' /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw 'Copie incomplete : conserver la sauvegarde et verifier les erreurs.' }
Copy-Item (Join-Path $sourceProject '.env.example') (Join-Path $targetProject '.env.example') -Force
foreach ($oldLock in @('pnpm-lock.yaml','bun.lock','bun.lockb','pnpm-workspace.yaml','vite.config.ts','cloudflare-env.d.ts','.openai/hosting.json')) {
  $oldLockPath = Join-Path $targetProject $oldLock
  if (Test-Path $oldLockPath) { Remove-Item $oldLockPath }
}
Write-Host "Sources corrigees dans : $targetProject"
Write-Host "Sauvegarde locale : $projectBackup"
Write-Host 'Aucun push et aucun changement dans Supabase effectues par ce script.'
Write-Host 'Dans le depot, verifier git status, puis git add ., git commit et git push.'
