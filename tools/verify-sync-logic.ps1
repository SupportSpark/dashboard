#!/usr/bin/env pwsh
# Verify the sync workflow's decision logic against the real repository, without
# needing Actions dispatch rights. Mirrors what sync-upstream.yml does:
#   1. resolve the target ref (explicit > newest release tag > upstream/main)
#   2. skip when it is already an ancestor of HEAD
#   3. otherwise compute what would conflict, and classify each file as
#      catalog-owned (ours wins) or manual.
#
# Run from the repo root:  pwsh -File tools/verify-sync-logic.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== 1. resolve the target ref ===" -ForegroundColor Cyan
$explicit = $env:TARGET_REF
if ($explicit) {
  $target = $explicit
} else {
  $target = (git tag -l 'v[0-9]*' --sort=-v:refname |
    Where-Object { $_ -match '^v[0-9]+\.[0-9]+\.[0-9]+$' } |
    Select-Object -First 1)
  if (-not $target) { $target = "upstream/main" }
}
Write-Host "  target: $target"

$targetSha = (git rev-parse $target 2>$null)
if (-not $targetSha) { Write-Host "  cannot resolve $target" -ForegroundColor Red; exit 1 }
Write-Host "  sha:    $($targetSha.Substring(0,8))"

Write-Host "`n=== 2. is it already merged? (the skip guard) ===" -ForegroundColor Cyan
git merge-base --is-ancestor $targetSha HEAD 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "  ALREADY UP TO DATE - the workflow would skip and push nothing." -ForegroundColor Green
  Write-Host "  (this is the correct, quiet outcome)"
  exit 0
}
Write-Host "  behind: upstream has commits we do not have" -ForegroundColor Yellow

Write-Host "`n=== 3. what would conflict? ===" -ForegroundColor Cyan
Write-Host "  merge-base: $((git merge-base HEAD $targetSha).Substring(0,8))"
$behind = (git rev-list --count "HEAD..$targetSha")
Write-Host "  commits upstream is ahead: $behind"

# Dry-run merge to enumerate conflicts without touching the worktree.
$conflicts = git merge-tree --write-tree --name-only HEAD $targetSha 2>&1
$conflicted = @()
$inList = $false
foreach ($line in $conflicts) {
  if ($line -match '^$') { continue }
  if ($line -match '^CONFLICT') { $inList = $true; continue }
  if ($inList -and $line -match '^\S') { $conflicted += $line.Trim() }
}

if ($conflicted.Count -eq 0) {
  Write-Host "  no conflicts - the workflow would merge, build, typecheck, and push." -ForegroundColor Green
  exit 0
}

Write-Host "  conflicted files: $($conflicted.Count)"
$catalogPaths = @('src/i18n/messages/', 'src/i18n/config.ts', 'src/i18n/request.ts', 'edge-runtime.d.ts')
$ours = @(); $manual = @()
foreach ($f in $conflicted) {
  $isCatalog = $false
  foreach ($p in $catalogPaths) { if ($f.StartsWith($p)) { $isCatalog = $true } }
  if ($isCatalog) { $ours += $f } else { $manual += $f }
}
Write-Host "    catalog-owned (ours wins, auto-resolved): $($ours.Count)"
$ours | ForEach-Object { Write-Host "      ours  : $_" -ForegroundColor Green }
if ($manual.Count -gt 0) {
  Write-Host "    needs a human (the workflow aborts and opens an issue): $($manual.Count)" -ForegroundColor Red
  $manual | ForEach-Object { Write-Host "      manual: $_" -ForegroundColor Red }
} else {
  Write-Host "    nothing needs a human - the workflow would resolve and push." -ForegroundColor Green
}
