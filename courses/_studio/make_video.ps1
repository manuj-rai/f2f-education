# Builds one lesson MP4 from a frame manifest (PNG frames + seconds on screen + fade length) with PowerPoint.
param([Parameter(Mandatory)][string]$Manifest, [Parameter(Mandatory)][string]$Out)
$ErrorActionPreference = 'Stop'
$m = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$pp = New-Object -ComObject PowerPoint.Application
$pres = $pp.Presentations.Add(0)                       # 0 = no window
try {
  $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
  $i = 0
  foreach ($f in $m.frames) {
    $i++
    $s = $pres.Slides.Add($i, 12)                        # ppLayoutBlank
    $null = $s.Shapes.AddPicture($f.png, 0, -1, 0, 0, 960, 540)
    $t = $s.SlideShowTransition
    $t.EntryEffect = 3849                                # ppEffectFadeSmoothly
    $t.Duration = [double]$f.trans
    $t.AdvanceOnClick = 0
    $t.AdvanceOnTime = -1
    $t.AdvanceTime = [double]$f.dur
  }
  if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Force }
  $pres.CreateVideo($Out, $true, 5, 1080, 30, 90)        # use timings, 1080p, 30 fps, quality 90
  $sw = [Diagnostics.Stopwatch]::StartNew()
  do { Start-Sleep -Seconds 3; $st = $pres.CreateVideoStatus } while (($st -eq 1 -or $st -eq 2) -and $sw.Elapsed.TotalMinutes -lt 45)
  $size = if (Test-Path -LiteralPath $Out) { [math]::Round((Get-Item -LiteralPath $Out).Length / 1MB, 1) } else { 0 }
  "status=$st (3=done) slides=$i size=${size}MB"
} finally {
  $pres.Saved = -1; $pres.Close()
  if ($pp.Presentations.Count -eq 0) { $pp.Quit() }
}
