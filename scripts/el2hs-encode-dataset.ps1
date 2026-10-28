<#
EL2 human study: prepare EL2_HS_DATASET_BASE64 / EL2_HS_MANIFEST_BASE64 for Vercel.

Reads the two private files (gitignored), gzips and Base64-encodes them in memory,
checks the round trip against the frozen SHA-256, and reports sizes only.
Values are never printed or written to disk; use -Copy to put one on the clipboard.

  .\scripts\el2hs-encode-dataset.ps1                 # report sizes and budget
  .\scripts\el2hs-encode-dataset.ps1 -Copy Dataset   # clipboard <- EL2_HS_DATASET_BASE64
  .\scripts\el2hs-encode-dataset.ps1 -Copy Manifest  # clipboard <- EL2_HS_MANIFEST_BASE64
#>
param(
  [ValidateSet('Dataset', 'Manifest')]
  [string]$Copy,
  # Runtime-exposed Vercel system variables and anything else not listed in .env.
  [int]$OtherAllowanceBytes = 4096
)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'research\retrieval\formal-study\el2\human-study'
$frozenSha = '1e3b6d1f61974de3f8d24600fe7b51f5e3f53dd9c734d89c2ba725713fc2a4d8'
$limit = 65536

function Get-Sha256([byte[]]$bytes) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}

function ConvertTo-GzipBase64([byte[]]$bytes) {
  $out = New-Object System.IO.MemoryStream
  $gz = New-Object System.IO.Compression.GZipStream($out, [System.IO.Compression.CompressionLevel]::Optimal)
  $gz.Write($bytes, 0, $bytes.Length)
  $gz.Dispose()
  [Convert]::ToBase64String($out.ToArray())
}

function ConvertFrom-GzipBase64([string]$b64) {
  $in = New-Object System.IO.MemoryStream(, [Convert]::FromBase64String($b64))
  $gz = New-Object System.IO.Compression.GZipStream($in, [System.IO.Compression.CompressionMode]::Decompress)
  $out = New-Object System.IO.MemoryStream
  $gz.CopyTo($out)
  $gz.Dispose()
  , $out.ToArray()
}

$items = @(
  @{ Key = 'Dataset'; Name = 'EL2_HS_DATASET_BASE64'; Path = Join-Path $dir 'datasets\el2-hs-questions.internal.v1.json' },
  @{ Key = 'Manifest'; Name = 'EL2_HS_MANIFEST_BASE64'; Path = Join-Path $dir 'DATASET-MANIFEST.json' }
)

$total = 0
foreach ($item in $items) {
  if (-not (Test-Path -LiteralPath $item.Path)) { throw "Missing private file: $($item.Path)" }
  $raw = [IO.File]::ReadAllBytes($item.Path)
  $value = ConvertTo-GzipBase64 $raw
  $back = ConvertFrom-GzipBase64 $value
  if ((Get-Sha256 $back) -ne (Get-Sha256 $raw)) { throw "Round trip changed $($item.Name); not using it." }
  if ($item.Key -eq 'Dataset' -and (Get-Sha256 $raw) -ne $frozenSha) { throw 'Local dataset does not match the frozen SHA-256.' }
  $item.Value = $value
  $total += $item.Name.Length + $value.Length
  '{0,-24} raw {1,7:N0} B -> gzip+base64 {2,7:N0} B  (round trip OK)' -f $item.Name, $raw.Length, $value.Length
}

$envFile = Join-Path $root '.env'
$others = 0
if (Test-Path -LiteralPath $envFile) {
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*(DB_[A-Z_]+|EL2_HS_[A-Z_]+)\s*=\s*(.*)$') { $others += $matches[1].Length + $matches[2].Trim().Length }
  }
}
$others += 'EL2_HS_EXPORT_TOKEN'.Length + 64
$budget = $total + $others + $OtherAllowanceBytes
''
'Dataset variables      : {0,7:N0} B' -f $total
'Other app variables    : {0,7:N0} B (from .env names/lengths + export token)' -f $others
'Allowance (system etc.): {0,7:N0} B' -f $OtherAllowanceBytes
'Estimated total        : {0,7:N0} B of {1:N0} B Vercel limit -> {2}' -f $budget, $limit, $(if ($budget -lt $limit) { 'OK' } else { 'TOO LARGE' })

if ($Copy) {
  $item = $items | Where-Object { $_.Key -eq $Copy }
  Set-Clipboard -Value $item.Value
  ''
  "Copied $($item.Name) to the clipboard ($($item.Value.Length) characters). Paste it into Vercel, then clear the clipboard."
}
