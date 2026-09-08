$ErrorActionPreference = "Stop"

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$indexContent = [System.IO.File]::ReadAllText($indexPath, $utf8NoBom)
$styleContent = [System.IO.File]::ReadAllText($stylePath, $utf8NoBom)

$cssBlock = @"

/* ==========================================================================
   GLOBAL FORM INPUT & SELECT STANDARDIZATION
   ========================================================================== */

/* 1. Global Field Wrapper & Label Alignment */
.form-group,
.input-group,
.field-wrapper,
div:has(> #simpleEodDestination),
div:has(> #simpleEodDate) {
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-end !important;
    gap: 6px !important;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-sizing: border-box !important;
}

/* Standardize All Form Labels */
label,
.form-label,
.field-label {
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.06em !important;
    text-transform: uppercase !important;
    color: #94a3b8 !important;
    margin: 0 0 6px 0 !important;
    padding: 0 !important;
    line-height: 1.2 !important;
    display: block !important;
}

/* Light mode label */
body.light-mode label,
[data-theme="light"] label,
body.light-mode .form-label,
[data-theme="light"] .form-label {
    color: #475569 !important;
}

/* 2. Strict Uniform Height for All Inputs and Dropdowns */
input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"]),
select,
.form-control,
.form-select,
#simpleEodDestination,
#simpleEodDate {
    height: 40px !important;
    min-height: 40px !important;
    max-height: 40px !important;
    line-height: 38px !important;
    padding: 0 14px !important;
    border-radius: 10px !important;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    box-sizing: border-box !important;
    width: 100% !important;
    outline: none !important;
    transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
}

input[type="hidden"],
[hidden] {
    display: none !important;
}

/* 3. Theme Colors for Inputs & Selects */
/* Dark Mode */
:root input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"]),
:root select,
body.dark-mode input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"]),
body.dark-mode select,
[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"]),
[data-theme="dark"] select {
    background-color: #121929 !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    color: #f8fafc !important;
}

:root input:focus,
:root select:focus,
body.dark-mode input:focus,
body.dark-mode select:focus,
[data-theme="dark"] input:focus,
[data-theme="dark"] select:focus {
    border-color: #38bdf8 !important;
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15) !important;
}

select option {
    background-color: #121929 !important;
    color: #f8fafc !important;
}

/* Light Mode */
body.light-mode input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"]),
body.light-mode select,
[data-theme="light"] input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"]),
[data-theme="light"] select {
    background-color: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    color: #0f172a !important;
}

body.light-mode input:focus,
body.light-mode select:focus,
[data-theme="light"] input:focus,
[data-theme="light"] select:focus {
    border-color: #0284c7 !important;
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12) !important;
}

body.light-mode select option,
[data-theme="light"] select option {
    background-color: #ffffff !important;
    color: #0f172a !important;
}

/* 4. Normalize Datepicker Picker Indicator & Native Select Arrow */
input[type="date"]::-webkit-calendar-picker-indicator {
    cursor: pointer !important;
    opacity: 0.6 !important;
    filter: invert(0.8) !important;
}

input[type="date"]::-webkit-datetime-edit {
    padding: 0 !important;
}

input[type="date"]::-webkit-date-and-time-value {
    text-align: left !important;
    line-height: 38px !important;
}

body.light-mode input[type="date"]::-webkit-calendar-picker-indicator,
[data-theme="light"] input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(0.2) !important;
}

/* 5. Row Container Alignment for Destination & Date */
#maintenancePanel .site-date-wrapper,
#maintenancePanel .meta-row,
#maintenancePanel div:has(> #simpleEodDestination),
#eodPanel .site-date-wrapper,
#eodPanel .meta-row,
#eodPanel .simple-eod-top,
body.ops-redesign-v3 #eodPanel .simple-eod-top,
.simple-eod-top,
div:has(> .form-group > #simpleEodDestination),
div:has(> .form-group > #simpleEodDate) {
    display: grid !important;
    grid-template-columns: 1fr 280px !important;
    gap: 16px !important;
    align-items: flex-end !important;
    margin-bottom: 16px !important;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
}

.simple-eod-top > .form-group,
#eodPanel .simple-eod-top > .form-group,
.site-date-wrapper > .form-group,
.meta-row > .form-group {
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-end !important;
    gap: 6px !important;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-sizing: border-box !important;
}

@media (max-width: 768px) {
    #maintenancePanel .site-date-wrapper,
    #maintenancePanel .meta-row,
    #maintenancePanel div:has(> #simpleEodDestination),
    #eodPanel .site-date-wrapper,
    #eodPanel .meta-row,
    #eodPanel .simple-eod-top,
    body.ops-redesign-v3 #eodPanel .simple-eod-top,
    .simple-eod-top,
    div:has(> .form-group > #simpleEodDestination),
    div:has(> .form-group > #simpleEodDate) {
        grid-template-columns: 1fr !important;
    }
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
