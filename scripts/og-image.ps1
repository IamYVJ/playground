# Regenerates og.png — the 1200x630 social preview referenced by the og:image and
# twitter:image tags in index.html. Windows only (System.Drawing); run from the repo root:
#
#   powershell -ExecutionPolicy Bypass -File scripts/og-image.ps1
#
# Checked in so the image can be rebuilt when the wording or brand colours change,
# rather than being a one-off binary nobody can reproduce.

Add-Type -AssemblyName System.Drawing
$W = 1200; $H = 630
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'

# --- dark ground, matching the site's dark surface ---
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0E0E12'))

# --- soft indigo glow, top-right, echoing the hero's radial gradient ---
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(560, -340, 900, 760)
$pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$pgb.CenterColor = [System.Drawing.Color]::FromArgb(70, 99, 102, 241)
$pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 99, 102, 241))
$g.FillPath($pgb, $path)

# --- second, pink glow bottom-left ---
$path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
$path2.AddEllipse(-320, 300, 820, 700)
$pgb2 = New-Object System.Drawing.Drawing2D.PathGradientBrush($path2)
$pgb2.CenterColor = [System.Drawing.Color]::FromArgb(48, 219, 39, 119)
$pgb2.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 219, 39, 119))
$g.FillPath($pgb2, $path2)

function New-RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, 2*$r, 2*$r, 180, 90)
  $p.AddArc($x+$w-2*$r, $y, 2*$r, 2*$r, 270, 90)
  $p.AddArc($x+$w-2*$r, $y+$h-2*$r, 2*$r, 2*$r, 0, 90)
  $p.AddArc($x, $y+$h-2*$r, 2*$r, 2*$r, 90, 90)
  $p.CloseFigure(); return $p
}

# --- YVJ mark: gradient rounded square, same indigo -> pink as the favicon ---
$logo = New-RoundRect 90 92 104 104 26
$lgb = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(90, 92)),
  (New-Object System.Drawing.Point(194, 196)),
  [System.Drawing.ColorTranslator]::FromHtml('#6366F1'),
  [System.Drawing.ColorTranslator]::FromHtml('#DB2777'))
$g.FillPath($lgb, $logo)

$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
$fLogo = New-Object System.Drawing.Font('Segoe UI', 27, [System.Drawing.FontStyle]::Bold, 'Pixel')
$g.DrawString('YVJ', $fLogo, [System.Drawing.Brushes]::White,
  (New-Object System.Drawing.RectangleF(90, 92, 104, 104)), $fmt)

# --- wordmark beside the logo ---
$fMark = New-Object System.Drawing.Font('Segoe UI', 21, [System.Drawing.FontStyle]::Bold, 'Pixel')
$bMark = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#A1A1AA'))
$g.DrawString('YVJ' + [char]0x2019 + 'S PLAYGROUND', $fMark, $bMark, 222, 126)

# --- headline ---
$fTitle = New-Object System.Drawing.Font('Segoe UI', 62, [System.Drawing.FontStyle]::Bold, 'Pixel')
$g.DrawString('Small web apps', $fTitle, [System.Drawing.Brushes]::White, 82, 258)
$bAccent = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#818CF8'))
$g.DrawString('and games.', $fTitle, $bAccent, 82, 348)

# --- subtitle ---
$fSub = New-Object System.Drawing.Font('Segoe UI', 25, [System.Drawing.FontStyle]::Regular, 'Pixel')
$bSub = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#A1A1AA'))
$g.DrawString('Free, static and open source. Hosted on GitHub Pages.', $fSub, $bSub, 88, 462)

# --- url footer ---
$fUrl = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold, 'Pixel')
$bUrl = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F472B6'))
$g.DrawString('iamyvj.github.io/playground', $fUrl, $bUrl, 88, 528)

$out = Join-Path (Get-Location) 'og.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"wrote $out ({0:N0} bytes)" -f (Get-Item $out).Length
