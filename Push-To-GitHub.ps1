$ErrorActionPreference = 'Stop'

# Push this Punyakart source tree to the dedicated empty fix repository.
$repoUrl = 'https://github.com/himanshu-raj-sharma/punyakart-fix.git'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath 'package.json')) {
  throw 'package.json was not found. Run this script from the extracted Punyakart project folder.'
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git is not installed. Install Git for Windows, then rerun this script.'
}

# Do not commit real .env files, private keys, certificates, dependencies or build output.
$blockedFiles = @(
  Get-ChildItem -LiteralPath . -Force -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $relative = [System.IO.Path]::GetRelativePath($PWD.Path, $_.FullName).Replace('\\', '/')
      $leaf = $_.Name
      $isEnvFile = ($leaf -match '^\.env($|\.)') -and
        ($leaf -notmatch '^\.env(\..+)?\.example$') -and
        ($leaf -ne '.env.template')
      $isPrivateMaterial = $leaf -match '\.(pem|key|p12|pfx)$'
      $inGeneratedFolder = $relative -match '(^|/)(node_modules|dist|\.git|\.opencode|\.omnirush)(/|$)'
      ($isEnvFile -or $isPrivateMaterial) -and -not $inGeneratedFolder
    } |
    Select-Object -ExpandProperty FullName
)
if ($blockedFiles.Count -gt 0) {
  Write-Host 'STOP: These potentially sensitive files must be removed or replaced with safe example templates before pushing:' -ForegroundColor Red
  $blockedFiles | ForEach-Object { Write-Host (' - ' + [System.IO.Path]::GetRelativePath($PWD.Path, $_)) }
  throw 'No files were pushed. Protect secrets first.'
}

# Initialize this extracted source as a new repo; do not force-push.
if (-not (Test-Path -LiteralPath '.git')) {
  git init
  if ($LASTEXITCODE -ne 0) { throw 'git init failed.' }
}
git branch -M main
if ($LASTEXITCODE -ne 0) { throw 'Could not set branch to main.' }

$existingRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $existingRemote) {
  if ($existingRemote.Trim() -ne $repoUrl) {
    git remote set-url origin $repoUrl
    if ($LASTEXITCODE -ne 0) { throw 'Could not update the origin remote.' }
  }
} else {
  git remote add origin $repoUrl
  if ($LASTEXITCODE -ne 0) { throw 'Could not add the origin remote.' }
}

git add -A
if ($LASTEXITCODE -ne 0) { throw 'git add failed.' }
$stagedPaths = @(git diff --cached --name-only)
$badStaged = @($stagedPaths | Where-Object {
  $leaf = [System.IO.Path]::GetFileName($_)
  (($leaf -match '^\.env($|\.)') -and ($leaf -notmatch '^\.env(\..+)?\.example$') -and ($leaf -ne '.env.template')) -or
  ($leaf -match '\.(pem|key|p12|pfx)$')
})
if ($badStaged.Count -gt 0) {
  Write-Host 'STOP: Sensitive paths are staged:' -ForegroundColor Red
  $badStaged | ForEach-Object { Write-Host (' - ' + $_) }
  throw 'No push performed. Remove sensitive files from the staging area.'
}
if ($stagedPaths.Count -eq 0) {
  Write-Host 'No new changes to commit. Checking whether the current branch can be pushed.' -ForegroundColor Yellow
} elseif (-not (git config user.name) -or -not (git config user.email)) {
  $commitName = Read-Host 'Git commit author name'
  $commitEmail = Read-Host 'Git commit author email (use your GitHub noreply email if preferred)'
  if ([string]::IsNullOrWhiteSpace($commitName) -or [string]::IsNullOrWhiteSpace($commitEmail)) {
    throw 'A commit name and email are required. Nothing was pushed.'
  }
  git config user.name $commitName
  git config user.email $commitEmail
  if ($LASTEXITCODE -ne 0) { throw 'Could not set local commit identity.' }
}
if ($stagedPaths.Count -gt 0) {
  git commit -m 'Add Punyakart Meta tracking fixes'
  if ($LASTEXITCODE -ne 0) { throw 'git commit failed. Nothing was pushed.' }
}

# The target repository was empty when this script was prepared. Refuse any history overwrite.
$remoteMain = git ls-remote --heads origin refs/heads/main
if ($LASTEXITCODE -ne 0) { throw 'Could not read the GitHub remote. Sign in through Git Credential Manager and retry.' }
if (-not [string]::IsNullOrWhiteSpace(($remoteMain -join '').Trim())) {
  throw 'The remote main branch is no longer empty. Stopping without force-pushing; fetch and reconcile the remote first.'
}

git push -u origin main
if ($LASTEXITCODE -ne 0) {
  throw 'Push failed. Complete GitHub authentication in the browser/Git Credential Manager, then rerun this script.'
}
Write-Host 'SUCCESS: Punyakart source was pushed to https://github.com/himanshu-raj-sharma/punyakart-fix' -ForegroundColor Green
