#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Merge-integrity gate for the i18n-zh branch.

.DESCRIPTION
  Runs the cheap, deterministic checks that must hold before the branch is
  pushed or an image is built. Deliberately does NOT run npm install / build;
  it only inspects the tree.

  Checks
    1. No conflict markers (<<<<<<<, =======, >>>>>>>) anywhere tracked.
    2. No unmerged index entries.
    3. Translation catalogs still exist and are structurally aligned:
       same set of dotted key paths in en.ts and zh.ts.
    4. No leftover references to things upstream deleted
       (next-themes, GlobalThemeProvider, ip-cidr in the files upstream
       migrated to isValidIP).
    5. The i18n plumbing files are all present.
    6. Every file that uses useTranslations() belongs to a tree that still
       imports next-intl in package.json.

.EXAMPLE
  pwsh -File tools/check-merge-integrity.ps1
#>
[CmdletBinding()]
param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
Set-Location $Root

$fail = 0
function Fail([string]$msg) { Write-Host "  FAIL  $msg" -ForegroundColor Red;   $script:fail++ }
function Pass([string]$msg) { Write-Host "  ok    $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "  warn  $msg" -ForegroundColor Yellow }
function Section([string]$msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 1. markers
Section "conflict markers"
# Also include unmerged paths — during a conflicted merge these are exactly the
# files most likely to still carry markers.
$tracked = @(
  @(git ls-files) + @(git diff --name-only --diff-filter=U) |
    Where-Object { $_ } | Sort-Object -Unique
)
$withMarkers = @()
foreach ($f in $tracked) {
  if (-not (Test-Path -LiteralPath $f)) { continue }
  # Skip binary-ish files quickly by extension.
  if ($f -match '\.(png|jpg|jpeg|gif|ico|woff2?|ttf|wasm|mmdb|db|pdf)$') { continue }
  $text = Get-Content -LiteralPath $f -Raw -ErrorAction SilentlyContinue
  if ($null -eq $text) { continue }
  if ($text -match '(?m)^<<<<<<< ' -or $text -match '(?m)^>>>>>>> ') {
    $n = ([regex]::Matches($text, '(?m)^<<<<<<< ')).Count
    $withMarkers += [pscustomobject]@{ File = $f; Hunks = $n }
  }
}
if ($withMarkers.Count -eq 0) {
  Pass "no conflict markers in $($tracked.Count) tracked files"
} else {
  Fail "$($withMarkers.Count) file(s) still contain conflict markers:"
  $withMarkers | Sort-Object Hunks -Descending | ForEach-Object {
    Write-Host ("           {0,3}  {1}" -f $_.Hunks, $_.File) -ForegroundColor Red
  }
}

# ------------------------------------------------------------- 2. index state
Section "merge state"
$unmerged = @(git diff --name-only --diff-filter=U)
if ($unmerged.Count -eq 0) { Pass "no unmerged index entries" }
else {
  Fail "$($unmerged.Count) unmerged path(s):"
  $unmerged | ForEach-Object { Write-Host "           $_" -ForegroundColor Red }
}

# ---------------------------------------------------------------- 3. catalogs
Section "translation catalogs"
$enPath = "src/i18n/messages/en.ts"
$zhPath = "src/i18n/messages/zh.ts"
foreach ($p in @($enPath, $zhPath)) {
  if (Test-Path -LiteralPath $p) {
    $lines = (Get-Content -LiteralPath $p).Count
    Pass "$p present ($lines lines)"
  } else {
    Fail "$p missing"
  }
}

# Compare dotted key paths. The catalogs are `export default { a: { b: "..." } }`,
# so a depth-tracking scan over quoted keys is enough and avoids needing a TS
# parser here.
function Get-KeyPaths([string]$path) {
  $keys = New-Object System.Collections.Generic.List[string]
  $stack = New-Object System.Collections.Generic.List[string]
  foreach ($raw in Get-Content -LiteralPath $path) {
    $line = $raw -replace '//.*$', ''
    # Capture every `name:` occurrence (nested object members).
    foreach ($m in [regex]::Matches($line, '(?<![A-Za-z0-9_$])(["'']?)([A-Za-z_$][A-Za-z0-9_$-]*)\1\s*:')) {
      $key = $m.Groups[2].Value
      $isObjectOpen = $line.Substring($m.Index + $m.Length) -match '^\s*\{'
      if ($isObjectOpen) {
        $stack.Add($key)
        $keys.Add(($stack -join '.'))
      } else {
        $keys.Add((@($stack) + $key) -join '.')
      }
    }
    # Pop for each closing brace that ends an object level.
    $opens  = ([regex]::Matches($line, '\{')).Count
    $closes = ([regex]::Matches($line, '\}')).Count
    $net = $closes - $opens
    if ($net -gt 0 -and $line -notmatch ':\s*\{') {
      $pop = [Math]::Min($net, $stack.Count)
      if ($pop -gt 0) { $stack.RemoveRange($stack.Count - $pop, $pop) }
    }
  }
  return $keys | Sort-Object -Unique
}

if ((Test-Path -LiteralPath $enPath) -and (Test-Path -LiteralPath $zhPath)) {
  # The authoritative comparison is tools/check-catalog-parity.mjs: it compiles
  # both catalogs with TypeScript and walks the resulting objects, which is exact.
  # The brace-counting heuristic that used to live here mis-nested on ICU strings
  # and template literals and reported ~4000 phantom mismatches on a catalog that
  # was in fact perfectly aligned, so it is not used for the verdict.
  $parityOut = & node tools/check-catalog-parity.mjs . 2>&1
  $parityCode = $LASTEXITCODE
  $summary = ($parityOut | Select-String -Pattern 'leaf keys' | Select-Object -First 1).Line
  if ($summary) { Pass $summary.Trim() }
  if ($parityCode -eq 0) {
    Pass "catalog parity OK (verified by TypeScript object walk)"
  } else {
    Fail "catalog parity FAILED - see 'node tools/check-catalog-parity.mjs .'"
    $parityOut | Select-Object -First 20 | ForEach-Object { Write-Host "           $_" -ForegroundColor Red }
  }
}

# ------------------------------------------------------- 4. deleted-depitives
Section "references to code upstream removed"
$banned = @(
  @{ Pattern = 'next-themes';             Hint = 'upstream replaced next-themes with src/contexts/ThemeProvider.tsx' },
  @{ Pattern = 'GlobalThemeProvider';     Hint = 'upstream deleted GlobalThemeProvider' },
  @{ Pattern = 'ip-cidr';                 Hint = 'upstream switched to isValidIP from @utils/ip' }
)
foreach ($b in $banned) {
  $hits = @(git grep -n -- $b.Pattern -- src package.json 2>$null)
  if ($hits.Count -eq 0) { Pass "no references to '$($b.Pattern)'" }
  else {
    Warn "'$($b.Pattern)' still referenced ($($hits.Count)) - $($b.Hint)"
    $hits | Select-Object -First 10 | ForEach-Object { Write-Host "           $_" -ForegroundColor Yellow }
  }
}

# ------------------------------------------------- 5. catalog source of truth
Section "catalog provenance"
# The catalogs are a DERIVED artifact: i18n-fragments/*.json are merged into them
# by tools/merge-i18n-fragments.mjs. A real incident during the localization pass
# had a helper script restore the catalogs from a stale snapshot, silently wiping
# every key merged after the snapshot was taken (two workers lost their
# namespaces for ~20 minutes and their verification reported hundreds of
# "missing key" failures that were not their fault).
#
# Two guards, both cheap:
#   a) no stray restore/snapshot scripts in the repo root
#   b) every fragment key is actually present in the catalog
$a = @()
foreach ($pat in @('restore-catalog', 'merge-local', 'revert-catalog')) {
  $a += @(Get-ChildItem -Path . -Filter "*$pat*" -File -ErrorAction SilentlyContinue)
}
$a += @(Get-ChildItem -Path . -Filter "*.mjs" -File -ErrorAction SilentlyContinue |
  Where-Object { (Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue) -match 'catalog-backup' })
if ($a.Count -eq 0) { Pass "no stray catalog restore/snapshot scripts" }
else {
  Fail "found script(s) that may restore the catalogs from a stale snapshot:"
  $a | Select-Object -Unique | ForEach-Object { Write-Host "           $($_.Name)" -ForegroundColor Red }
}
if (Test-Path ".catalog-backup") {
  Warn ".catalog-backup/ exists - a stale catalog snapshot; the fragments are the source of truth"
}

$fragDir = "i18n-fragments"
if (Test-Path $fragDir) {
  $fragFiles = @(Get-ChildItem $fragDir -Filter *.json -File)
  if ($fragFiles.Count -gt 0) {
    $enText = Get-Content -LiteralPath 'src/i18n/messages/en.ts' -Raw
    $zhText = Get-Content -LiteralPath 'src/i18n/messages/zh.ts' -Raw
    $missing = @()
    foreach ($ff in $fragFiles) {
      $data = Get-Content $ff.FullName -Raw | ConvertFrom-Json
      foreach ($ns in $data.PSObject.Properties) {
        if ($ns.Name -like '_*') { continue }
        foreach ($k in $ns.Value.PSObject.Properties) {
          if ($enText -notmatch "(?m)^\s+$([regex]::Escape($k.Name)):") {
            $missing += "$($ff.Name): $($ns.Name).$($k.Name)"
          }
        }
      }
    }
    if ($missing.Count -eq 0) { Pass "all $($fragFiles.Count) fragment(s) are merged into en.ts" }
    else {
      Fail "$($missing.Count) fragment key(s) are NOT in en.ts - run tools/merge-i18n-fragments.mjs"
      $missing | Select-Object -First 15 | ForEach-Object { Write-Host "           $_" -ForegroundColor Red }
    }
  }
} else { Pass "no fragment directory (nothing to reconcile)" }

# ------------------------------------------------- 6. render-time crashes
Section "messages render without throwing"
# A key that RESOLVES can still crash the page: next-intl throws at render time
# for malformed ICU (an unclosed rich tag, a lone apostrophe starting a quoted
# literal) and for a t.rich() whose tag the call site did not provide. Next.js
# then swaps the page for its "This page couldn't load" screen, which reads as a
# network problem but is a crash. This check also catches React hooks called at
# module scope, which throw on import — that one took a production page down.
$renderOut = & node tools/check-message-rendering.mjs 2>&1
$renderCode = $LASTEXITCODE
if ($renderCode -eq 0) {
  Pass ($renderOut | Select-Object -First 1)
} else {
  Fail "catalog messages throw at render time - page will show Next.js's error screen"
  $renderOut | Select-Object -First 25 | ForEach-Object { Write-Host "           $_" -ForegroundColor Red }
}

# ------------------------------------------------------------ 7. i18n plumbing
Section "i18n plumbing"
$required = @(
  'src/i18n/config.ts',
  'src/i18n/request.ts',
  'src/i18n/detection.ts',
  'src/i18n/global.d.ts',
  'src/i18n/messages/en.ts',
  'src/i18n/messages/zh.ts',
  'src/contexts/LocaleProvider.tsx',
  'src/components/ui/LocaleSwitcher.tsx'
)
$missingPlumbing = @($required | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missingPlumbing.Count -eq 0) { Pass "all $($required.Count) i18n files present" }
else {
  Fail "missing i18n files:"
  $missingPlumbing | ForEach-Object { Write-Host "           $_" -ForegroundColor Red }
}

# LocaleProvider must still be mounted in AppLayout, or the app silently
# reverts to untranslated English.
if (Test-Path -LiteralPath 'src/layouts/AppLayout.tsx') {
  if (Select-String -Path 'src/layouts/AppLayout.tsx' -Pattern '<LocaleProvider' -Quiet) {
    Pass "AppLayout mounts <LocaleProvider>"
  } else {
    Fail "AppLayout no longer mounts <LocaleProvider> - translations will not render"
  }
  if (Select-String -Path 'src/layouts/AppLayout.tsx' -Pattern 'withIntl|ThemeProvider' -Quiet) {
    Pass "AppLayout references the theme provider chain"
  } else {
    Warn "AppLayout does not reference ThemeProvider"
  }
} else { Fail "src/layouts/AppLayout.tsx missing" }

# next.config.js must still wrap with the next-intl plugin.
if (Test-Path -LiteralPath 'next.config.js') {
  if (Select-String -Path 'next.config.js' -Pattern 'next-intl/plugin' -Quiet) {
    Pass "next.config.js wraps with createNextIntlPlugin"
  } else {
    Fail "next.config.js no longer uses the next-intl plugin"
  }
}

# package.json must declare next-intl.
if (Test-Path -LiteralPath 'package.json') {
  $pkg = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
  if ($pkg.dependencies.'next-intl') { Pass "next-intl declared ($($pkg.dependencies.'next-intl'))" }
  else { Fail "next-intl missing from package.json dependencies" }
  if ($pkg.dependencies.'next') { Pass "next declared ($($pkg.dependencies.'next'))" }
}

# --------------------------------------------------------------- 7. call sites
Section "translation call sites"
$users = @(git grep -l 'useTranslations' -- src 2>$null)
Write-Host "         files using useTranslations(): $($users.Count)"
if ($users.Count -gt 0) { Pass "localization call sites present" } else { Fail "no useTranslations() call sites found" }

$hardcoded = @(git grep -l 'getTranslations' -- src 2>$null)
Write-Host "         files using getTranslations(): $($hardcoded.Count)"

# ------------------------------------------------------------------- summary
Section "summary"
if ($fail -eq 0) {
  Write-Host "  INTEGRITY OK - $($tracked.Count) tracked files, no markers, no unmerged paths" -ForegroundColor Green
  exit 0
} else {
  Write-Host "  INTEGRITY FAILED - $fail check(s) failed" -ForegroundColor Red
  exit 1
}
