<#
============================================================
撮った動画（out/ の WebM）を、章ごとの MP4 に変える
使い方（PowerShell）：
  .\docs\05_報告\動画の道具\make-mp4.ps1                    … ビデオのフォルダの「家計簿の動画」に置く
  .\docs\05_報告\動画の道具\make-mp4.ps1 -OutDir 置き場所     … 置き場所を変える
前もって：ffmpeg を入れておく（winget install --id Gyan.FFmpeg -e --source winget）
  ※ winget で入れたあとは、PATH の「坂本　順治」の空白が半角に変わっていないか確かめる
============================================================
#>
param(
  [string]$OutDir = (Join-Path ([Environment]::GetFolderPath('MyVideos')) '家計簿の動画')
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'ffmpeg が見つかりません。上の「前もって」を行ってください' }
New-Item -ItemType Directory -Force $OutDir | Out-Null

# out/ の中のフォルダの名前（例：ch2-第2章-月ごとの記録）から、ファイルの名前（例：第2章_月ごとの記録.mp4）を作る
Get-ChildItem (Join-Path $PSScriptRoot 'out') -Directory | ForEach-Object {
  $webm = Join-Path $_.FullName 'video.webm'
  if (-not (Test-Path $webm)) { return }
  $parts = $_.Name -split '-'
  $name = if ($parts.Count -ge 3) { "$($parts[1])_$($parts[2..($parts.Count - 1)] -join '-').mp4" } else { "$($_.Name).mp4" }
  $mp4 = Join-Path $OutDir $name
  ffmpeg -loglevel error -y -i $webm -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart -an $mp4
  $mb = [math]::Round((Get-Item $mp4).Length / 1MB, 1)
  Write-Host "$name（$mb MB）"
}
Write-Host "置き場所：$OutDir" -ForegroundColor Green
