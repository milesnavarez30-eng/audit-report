$ErrorActionPreference = "Stop"

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$indexContent = [System.IO.File]::ReadAllText($indexPath, $utf8NoBom)
$styleContent = [System.IO.File]::ReadAllText($stylePath, $utf8NoBom)

$cssBlock = @"

/* ==========================================================================
   UNIFY WORKSPACE LAYOUT IN BOTH LIGHT & DARK MODES
   (Eliminates outer container boxes and shifting layouts)
   ========================================================================== */

/* 1. Reset root workspace wrapper across ALL themes */
.app-layout,
.app-container,
#app,
body > div:first-child {
    display: flex !important;
    gap: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
}

#authGate,
.auth-gate {
    display: grid !important;
    place-items: center !important;
}

#authGate[hidden],
.auth-gate[hidden],
[hidden] {
    display: none !important;
}

/* 2. Strip outer container framing in BOTH Dark and Light modes */
:root .main-content,
:root .workspace-wrapper,
:root .content-area,
:root main,
:root #mainContent,
:root .tab-content,
:root #maintenancePanel,
:root #eodPanel,
:root .app-tab-panel,
body.light-mode .main-content,
body.light-mode .workspace-wrapper,
body.light-mode .content-area,
body.light-mode main,
body.light-mode #mainContent,
body.light-mode .tab-content,
body.light-mode #maintenancePanel,
body.light-mode #eodPanel,
body.light-mode .app-tab-panel,
[data-theme="light"] .main-content,
[data-theme="light"] .workspace-wrapper,
[data-theme="light"] .content-area,
[data-theme="light"] main,
[data-theme="light"] #mainContent,
[data-theme="light"] .tab-content,
[data-theme="light"] #maintenancePanel,
[data-theme="light"] #eodPanel,
[data-theme="light"] .app-tab-panel,
[data-theme="dark"] .main-content,
[data-theme="dark"] .workspace-wrapper,
[data-theme="dark"] .content-area,
[data-theme="dark"] main,
[data-theme="dark"] #mainContent,
[data-theme="dark"] .tab-content,
[data-theme="dark"] #maintenancePanel,
[data-theme="dark"] #eodPanel,
[data-theme="dark"] .app-tab-panel,
body.ops-redesign-v3 #maintenancePanel,
body.ops-redesign-v3 #eodPanel,
body.ops-redesign-v3 .app-tab-panel,
body.ops-redesign-v3.light-mode #maintenancePanel,
body.ops-redesign-v3.light-mode #eodPanel,
body.ops-redesign-v3.light-mode .app-tab-panel {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 24px 32px !important; /* Identical padding across both modes */
    margin: 0 !important; /* Identical zero margin across both modes */
    width: 100% !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
}

/* 3. Strip any outer panel/card styles applied specifically to the Maintenance view */
#maintenancePanel > .card,
#maintenancePanel > .panel,
#maintenancePanel > .container,
#maintenancePanel .maintenance-shell,
#eodPanel > .card,
#eodPanel > .panel,
#eodPanel > .container,
#eodPanel .simple-eod-shell,
body.light-mode #maintenancePanel > .card,
body.light-mode #maintenancePanel > .panel,
body.light-mode #maintenancePanel > .container,
body.light-mode #maintenancePanel .maintenance-shell,
body.light-mode #eodPanel > .card,
body.light-mode #eodPanel > .panel,
body.light-mode #eodPanel > .container,
body.light-mode #eodPanel .simple-eod-shell,
[data-theme="light"] #maintenancePanel > .card,
[data-theme="light"] #maintenancePanel > .panel,
[data-theme="light"] #maintenancePanel > .container,
[data-theme="light"] #maintenancePanel .maintenance-shell,
[data-theme="light"] #eodPanel > .card,
[data-theme="light"] #eodPanel > .panel,
[data-theme="light"] #eodPanel > .container,
[data-theme="light"] #eodPanel .simple-eod-shell,
[data-theme="dark"] #maintenancePanel > .card,
[data-theme="dark"] #maintenancePanel > .panel,
[data-theme="dark"] #maintenancePanel > .container,
[data-theme="dark"] #maintenancePanel .maintenance-shell,
[data-theme="dark"] #eodPanel > .card,
[data-theme="dark"] #eodPanel > .panel,
[data-theme="dark"] #eodPanel > .container,
[data-theme="dark"] #eodPanel .simple-eod-shell,
body.ops-redesign-v3 #maintenancePanel > .container,
body.ops-redesign-v3 #maintenancePanel .maintenance-shell,
body.ops-redesign-v3 #eodPanel > .container,
body.ops-redesign-v3 #eodPanel .simple-eod-shell,
body.ops-redesign-v3.light-mode #maintenancePanel > .container,
body.ops-redesign-v3.light-mode #maintenancePanel .maintenance-shell,
body.ops-redesign-v3.light-mode #eodPanel > .container,
body.ops-redesign-v3.light-mode #eodPanel .simple-eod-shell {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
}

/* 4. Canvas background color management (Ensures proper contrast without extra boxes) */
body,
body.dark-mode,
[data-theme="dark"],
body.ops-redesign-v3,
body.ops-redesign-v3.dark-mode {
    background-color: #090d16 !important;
}

body.light-mode,
[data-theme="light"],
body.ops-redesign-v3.light-mode,
html[data-theme="light"] body {
    background-color: #f1f3f7 !important;
}
"@

# Update style.css: append to the end of file (trimming trailing blank lines)
$trimmedStyle = $styleContent.TrimEnd()
$newStyleContent = $trimmedStyle + "`r`n" + $cssBlock + "`r`n"
[System.IO.File]::WriteAllText($stylePath, $newStyleContent, $utf8NoBom)
Write-Host "Updated style.css"

# Update index.html: insert right before </style>\r\n\r\n</head>
$targetIndex = "</style>`r`n`r`n</head>"
if (-not $indexContent.Contains($targetIndex)) {
    # try unix line endings if needed
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
