$ErrorActionPreference = "Stop"

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$indexContent = [System.IO.File]::ReadAllText($indexPath, $utf8NoBom)
$styleContent = [System.IO.File]::ReadAllText($stylePath, $utf8NoBom)

$cssBlock = @"

/* ==========================================================================
   REMOVE SLASH ICON & RESTORE CLEAN INPUT WIDTH
   ========================================================================== */

/* 1. Completely remove the slash icon */
.slash-icon,
.search-label .slash-icon,
.input-pill-wrapper .slash-icon {
    display: none !important;
    visibility: hidden !important;
}

/* 2. Reset input sizing and cancel the slash transform shift */
.search-label input,
.input-pill-wrapper input {
    width: 100% !important;
    padding: 0 12px !important;
    transform: none !important;
}

.search-label input:valid,
.input-pill-wrapper input:valid,
.search-label input:focus,
.input-pill-wrapper input:focus {
    width: 100% !important;
    transform: none !important;
}

/* 3. Retain clean pill shape and theme colors (#212121 dark, #d8d5d5 light) */
.search-label,
.input-pill-wrapper {
    border-radius: 9999px !important;
}

:root .search-label,
:root .input-pill-wrapper,
body.dark-mode .search-label,
body.dark-mode .input-pill-wrapper,
[data-theme="dark"] .search-label,
[data-theme="dark"] .input-pill-wrapper {
    background-color: #212121 !important;
}

body.light-mode .search-label,
body.light-mode .input-pill-wrapper,
[data-theme="light"] .search-label,
[data-theme="light"] .input-pill-wrapper {
    background-color: #d8d5d5 !important;
}
"@

# Update style.css: append to the end of file
$trimmedStyle = $styleContent.TrimEnd()
$newStyleContent = $trimmedStyle + "`r`n" + $cssBlock + "`r`n"
[System.IO.File]::WriteAllText($stylePath, $newStyleContent, $utf8NoBom)
Write-Host "Updated style.css"

# Update index.html: insert right before </style>\r\n\r\n</head>
$targetIndex = "</style>`r`n`r`n</head>"
if (-not $indexContent.Contains($targetIndex)) {
    $targetIndex = "</style>`n`n</head>"
    if (-not $indexContent.Contains($targetIndex)) {
        throw "Could not find </style></head> anchor in index.html"
    }
    $newIndexContent = $indexContent.Replace($targetIndex, $cssBlock + "`n" + $targetIndex)
} else {
    $newIndexContent = $indexContent.Replace($targetIndex, $cssBlock + "`r`n" + $targetIndex)
}

[System.IO.File]::WriteAllText($indexPath, $newIndexContent, $utf8NoBom)
Write-Host "Updated index.html"

# Verify UTF-8 no BOM
$styleBytes = [System.IO.File]::ReadAllBytes($stylePath)
if ($styleBytes[0] -eq 0xEF -and $styleBytes[1] -eq 0xBB -and $styleBytes[2] -eq 0xBF) {
    throw "style.css has UTF-8 BOM"
}

$indexBytes = [System.IO.File]::ReadAllBytes($indexPath)
if ($indexBytes[0] -eq 0xEF -and $indexBytes[1] -eq 0xBB -and $indexBytes[2] -eq 0xBF) {
    throw "index.html has UTF-8 BOM"
}

Write-Host "Both files successfully updated with UTF-8 (No BOM)"
