#!/usr/bin/env pwsh
# Prove the sync's merge path end-to-end against synthetic upstream changes, in a
# throwaway clone so the real working tree is never touched.
#
# Context: the scheduled workflow has not fired yet (added ~4h ago; cron is
# 03:17 UTC) and the available token lacks `workflow` scope, so it cannot be
# dispatched. This exercises the same git operations locally instead.
#
# A note on getting this right: the first version of this script "passed" case 2
# without testing anything. It created the upstream commit directly on top of the
# merge base, so merging into i18n-zh — which was also sitting at that base — was a
# FAST-FORWARD, not a merge. No conflict could occur, and the script reported the
# catalog rule working on a conflict that never happened. A conflict requires the
# two sides to have DIVERGED: both must commit, from a common ancestor, and touch
# the same line. Case 2 below now does that, and asserts a conflict was actually
# produced before claiming the rule resolved it.
#
# Run: pwsh -File tools/verify-sync-merge.ps1

$ErrorActionPreference = "Stop"
$repo = (Get-Location).Path
$upstreamUrl = (git -C $repo remote get-url upstream)
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("nb-sync-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$catalogPaths = @('src/i18n/messages/', 'src/i18n/config.ts', 'src/i18n/request.ts', 'edge-runtime.d.ts')
$gitId = @('-c', 'user.email=test@local', '-c', 'user.name=test')

# Edit one specific single-line catalog entry. The target must be a `key: "value"`
# on ONE line: groupsDescription is written across two lines in this catalog
# (`groupsDescription:` then the string on the next line), so replacing the whole
# line renamed the KEY and left the value untouched — the assertion then compared a
# line that was never edited and reported a false failure.
function Set-CatalogLine([string]$path, [string]$value) {
  $lines = Get-Content $path
  $modified = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^(\s+)createGroup:\s*".*",\s*$') {
      $lines[$i] = "$($Matches[1])createGroup: `"$value`","
      $modified = $true
      break
    }
  }
  if (-not $modified) { throw "target key 'createGroup' not found as a single line in $path" }
  Set-Content -Path $path -Value $lines
}

Write-Host "=== cloning into $tmp ===" -ForegroundColor Cyan
git clone --quiet --no-hardlinks $repo $tmp 2>&1 | Out-Null
Push-Location $tmp
$failures = 0
try {
  git checkout --quiet i18n-zh
  git remote add upstream $upstreamUrl 2>$null
  $base = (git rev-parse HEAD)
  Write-Host "  base: $($base.Substring(0,8))"

  # ---------------------------------------------------------------- case 1
  Write-Host "`n=== case 1: upstream touched a NON-catalog file ===" -ForegroundColor Cyan
  # Diverge: i18n-zh gets its own commit so the merge cannot fast-forward.
  Add-Content -Path "README.md" -Value "`n<!-- fork note -->"
  git add README.md
  git @gitId commit --quiet -m "fork: own change"

  git checkout --quiet -b up1 $base
  Add-Content -Path "next.config.js" -Value "// synthetic upstream change"
  git add next.config.js
  git @gitId commit --quiet -m "upstream: non-catalog change"

  git checkout --quiet i18n-zh
  $out = git merge --no-edit up1 2>&1
  $rc = $LASTEXITCODE
  $out | ForEach-Object { "    $_" }
  if ($rc -eq 0) {
    Write-Host "    => MERGED, no conflict (correct: different files)" -ForegroundColor Green
  } else {
    Write-Host "    => CONFLICTED (unexpected: files are unrelated)" -ForegroundColor Red
    $failures++
  }

  # ---------------------------------------------------------------- case 2
  Write-Host "`n=== case 2: both sides edited the SAME catalog line ===" -ForegroundColor Cyan
  # Reset to the true base, then diverge properly on BOTH sides.
  git checkout --quiet i18n-zh
  git reset --hard --quiet $base
  Set-CatalogLine "src/i18n/messages/en.ts" "FORK VALUE"
  git add "src/i18n/messages/en.ts"
  git @gitId commit --quiet -m "fork: catalog edit"

  git checkout --quiet -b up2 $base
  Set-CatalogLine "src/i18n/messages/en.ts" "UPSTREAM VALUE"
  git add "src/i18n/messages/en.ts"
  git @gitId commit --quiet -m "upstream: catalog edit"

  git checkout --quiet i18n-zh
  git merge --no-edit up2 2>&1 | ForEach-Object { "    $_" }
  $conflicted = @(git diff --name-only --diff-filter=U)
  if ($conflicted.Count -eq 0) {
    Write-Host "    => NO CONFLICT - the scenario did not diverge; this case proves nothing." -ForegroundColor Red
    $failures++
  } else {
    Write-Host "    => conflict produced on: $($conflicted -join ', ')" -ForegroundColor Green

    # Apply the workflow's rule: catalog paths take OURS, anything else is manual.
    $manual = @()
    foreach ($f in $conflicted) {
      $isCatalog = $false
      foreach ($p in $catalogPaths) { if ($f.StartsWith($p)) { $isCatalog = $true } }
      if ($isCatalog) {
        Write-Host "        ours  : $f" -ForegroundColor Green
        git checkout --ours -- $f; git add -- $f
      } else {
        Write-Host "        manual: $f" -ForegroundColor Red
        $manual += $f
      }
    }
    if ($manual.Count -eq 0) {
      git @gitId commit --quiet --no-edit
      $kept = (Select-String -Path "src/i18n/messages/en.ts" -Pattern '^\s+createGroup: ' | Select-Object -First 1).Line.Trim()
      Write-Host "    => resolved as ours and committed (the workflow would push this)"
      Write-Host "       kept: $kept"
      if ($kept -match 'FORK VALUE') {
        Write-Host "       our value survived, upstream's discarded (correct)" -ForegroundColor Green
      } else {
        Write-Host "       WRONG: our value was overwritten" -ForegroundColor Red
        $failures++
      }
    } else {
      Write-Host "    => needs a human; the workflow would abort and open an issue" -ForegroundColor Yellow
    }
  }

  Write-Host ""
  if ($failures -eq 0) {
    Write-Host "=== ALL CASES BEHAVED AS DESIGNED ===" -ForegroundColor Green
  } else {
    Write-Host "=== $failures CASE(S) FAILED ===" -ForegroundColor Red
    exit 1
  }
} finally {
  Pop-Location
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  Write-Host "cleaned up $tmp" -ForegroundColor Cyan
}
