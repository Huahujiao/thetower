$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$entries = @(
  @{ Source = 'art/generated/floor-plain-stone-v1.png'; Target = 'src/assets/board-floor-plain-v1.jpg' },
  @{ Source = 'art/generated/card-back-neutral-v1.png'; Target = 'src/assets/board-card-back-v1.jpg' },
  @{ Source = 'art/generated/card-back-scorch-v1.png'; Target = 'src/assets/board-card-back-scorch-v1.jpg' },
  @{ Source = 'art/generated/card-back-wither-v1.png'; Target = 'src/assets/board-card-back-wither-v1.jpg' },
  @{ Source = 'art/generated/card-back-drown-v1.png'; Target = 'src/assets/board-card-back-drown-v1.jpg' }
)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
foreach ($entry in $entries) {
  $sourceImage = [System.Drawing.Image]::FromFile((Join-Path $projectRoot $entry.Source))
  $bitmap = New-Object System.Drawing.Bitmap(1024, 1024)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
  try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($sourceImage, 0, 0, 1024, 1024)
    $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]88)
    $bitmap.Save((Join-Path $projectRoot $entry.Target), $codec, $parameters)
    Write-Output $entry.Target
  } finally {
    $parameters.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    $sourceImage.Dispose()
  }
}
