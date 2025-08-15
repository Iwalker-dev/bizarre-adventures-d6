Param(
  [string]$ManifestPath = "system.json",
  [string]$OutDir = "artifacts"
)

$ErrorActionPreference = "Stop"
$manifest = Get-Content $ManifestPath | ConvertFrom-Json
$version  = $manifest.version
$name     = $manifest.id

if (-not $version) { throw "No 'version' in $ManifestPath" }
if (-not $name)    { throw "No 'id' in $ManifestPath" }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$exclude = @(".git",".github",".vscode","node_modules","artifacts","dist","tests","coverage","*.log","*.zip",".DS_Store",".idea")
$items = Get-ChildItem -Force | Where-Object { $exclude -notcontains $_.Name }

$zipPath = Join-Path $OutDir "$($name)-v$($version).zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path $items -DestinationPath $zipPath
Write-Host "Packed -> $zipPath"
