param([string]$Destination = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'transworld-delivery\transworld-delivery'))
$ErrorActionPreference = 'Stop'
$targetProject = [System.IO.Path]::GetFullPath($Destination)
if (!(Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git doit etre installe.' }
if (!(Test-Path -LiteralPath (Join-Path $targetProject '.git'))) { throw "Depot Git introuvable : $targetProject" }
$gitRoot = & git -C $targetProject rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or [System.IO.Path]::GetFullPath($gitRoot.Trim()) -ine $targetProject) { throw 'Le chemin doit viser la racine exacte du depot.' }
$remote = & git -C $targetProject remote get-url origin
if ($LASTEXITCODE -ne 0 -or $remote -notmatch 'github\.com[:/]loicndjana06/transworld-delivery(?:\.git)?/?$') { throw 'Le depot origin doit etre loicndjana06/transworld-delivery sur GitHub. Aucun remote modifie.' }
$branch = & git -C $targetProject branch --show-current
if ($LASTEXITCODE -ne 0 -or $branch.Trim() -ne 'main') { throw 'Placez-vous sur la branche main de votre depot avant de relancer.' }
$alreadyStaged = & git -C $targetProject diff --cached --name-only
if ($alreadyStaged) { throw 'Des changements sont deja prepares dans Git. Terminez ou retirez cette preparation avant de lancer le transfert.' }
& (Join-Path $PSScriptRoot 'Installer-Correction.ps1') -Destination $targetProject
$manifest = Join-Path $PSScriptRoot 'SOURCE_FILES.txt'
if (!(Test-Path -LiteralPath $manifest)) { throw 'SOURCE_FILES.txt absent : utilisez l archive complete.' }
$paths = @(Get-Content -LiteralPath $manifest | Where-Object { $_ -and ($_ -eq '.env.example' -or $_ -notmatch '(^|/)\.env') })
& git -C $targetProject add -- $paths
if ($LASTEXITCODE -ne 0) { throw 'Preparation des fichiers echouee. Aucun push effectue.' }
foreach ($obsolete in @('pnpm-lock.yaml','bun.lock','bun.lockb','pnpm-workspace.yaml','vite.config.ts','cloudflare-env.d.ts','.openai/hosting.json')) {
  $tracked = & git -C $targetProject ls-files -- $obsolete
  if ($tracked -and !(Test-Path -LiteralPath (Join-Path $targetProject $obsolete))) {
    & git -C $targetProject add --all -- $obsolete
    if ($LASTEXITCODE -ne 0) { throw 'Preparation de la suppression d un fichier obsolete echouee.' }
  }
}
& git -C $targetProject diff --cached --quiet
$changeStatus = $LASTEXITCODE
if ($changeStatus -eq 1) {
  & git -C $targetProject commit -m 'Prepare TRANSWORLD DELIVERY pour Vercel et Supabase'
  if ($LASTEXITCODE -ne 0) { throw 'Commit impossible. Verifiez votre identite Git, puis relancez les commandes indiquees dans le README.' }
} elseif ($changeStatus -ne 0) { throw 'Verification Git impossible.' }
& git -C $targetProject push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push refuse. Le code et le commit sont conserves localement. Ne forcez pas le push : relevez le message Git.' }
Write-Host 'GitHub mis a jour. Si ce depot est deja lie a Vercel, consulter le nouveau deploiement.'
Write-Host 'Les variables restent a configurer dans Vercel ; le SQL reste a executer dans Supabase.'
