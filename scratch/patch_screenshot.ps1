$path = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$target = @"
    function setCurrentScreenshot(dataUrl, markDirty = false) {
        currentScreenshot = dataUrl || "";

        if (markDirty) {
            screenshotDirty = true;
        }

        const empty = byId("edrScreenshotEmpty");
        const wrap = byId("edrScreenshotPreviewWrap");
        const img = byId("edrScreenshotPreview");

        if (!empty || !wrap || !img) return;

        if (currentScreenshot) {
            img.src = currentScreenshot;
            empty.hidden = true;
            wrap.hidden = false;
            byId("edrScreenshotZone")?.classList.add("has-image");
        } else {
            img.removeAttribute("src");
            empty.hidden = false;
            wrap.hidden = true;
            byId("edrScreenshotZone")?.classList.remove("has-image");
        }
    }
"@

$replacement = @"
    function setCurrentScreenshot(dataUrl, markDirty = false) {
        currentScreenshot = dataUrl || "";

        if (markDirty) {
            screenshotDirty = true;
        }

        const empty = byId("edrScreenshotEmpty");
        const wrap = byId("edrScreenshotPreviewWrap");
        const img = byId("edrScreenshotPreview");

        if (!empty || !wrap || !img) return;

        if (currentScreenshot) {
            img.src = currentScreenshot;
            empty.hidden = true;
            wrap.hidden = false;
            byId("edrScreenshotZone")?.classList.add("has-image");
        } else {
            img.removeAttribute("src");
            empty.hidden = false;
            wrap.hidden = true;
            byId("edrScreenshotZone")?.classList.remove("has-image");
        }

        if (typeof renderLiveEdrPreview === "function") {
            renderLiveEdrPreview();
        }
    }
"@

# Normalize line endings for replacement
$normalizedContent = $content.Replace("`r`n", "`n")
$normalizedTarget = $target.Replace("`r`n", "`n")
$normalizedReplacement = $replacement.Replace("`r`n", "`n")

if ($normalizedContent.Contains($normalizedTarget)) {
    $newContent = $normalizedContent.Replace($normalizedTarget, $normalizedReplacement)
    # Check if original had CRLF
    if ($content.Contains("`r`n")) {
        $newContent = $newContent.Replace("`n", "`r`n")
    }
    [System.IO.File]::WriteAllText($path, $newContent, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "SUCCESS: Replaced setCurrentScreenshot!"
} else {
    Write-Host "FAILED: Target not found in content!"
    # Print some context around setCurrentScreenshot
    $idx = $normalizedContent.IndexOf("setCurrentScreenshot")
    if ($idx -ge 0) {
        $snippet = $normalizedContent.Substring($idx, [Math]::Min(500, $normalizedContent.Length - $idx))
        Write-Host "Found snippet:"
        Write-Host $snippet
    }
}
