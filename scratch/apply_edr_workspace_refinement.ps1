# Script to apply EDR Workspace Refinement & Button System
$htmlPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$cssPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"

$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)
$css = [System.IO.File]::ReadAllText($cssPath, [System.Text.Encoding]::UTF8)

# ==========================================
# 1. UPDATE STYLE.CSS FOR STANDARDIZED BUTTON GEOMETRY (0 14px padding, 36px height, 6px radius, 12px font, 600 weight)
# ==========================================
$oldCssRule = @"
/* Rigid Action Button Geometry System (36px, 6px radius) */
#edrPanel .edr-primary-btn,
#edrPanel .edr-outline-btn,
#edrPanel .edr-secondary-btn,
#edrPanel .edr-success-btn,
#edrPanel .edr-danger-btn,
#edrPanel .edr-action-row button,
#edrPanel .edr-action-row a.button,
#edrPanel .edr-header-tools .edr-template-link,
#edrPanel .edr-docs-sync-actions button,
#edrPanel .edr-shot-add-btn,
#edrPanel .edr-shot-actions button,
#edrPanel .edr-list-actions button,
#edrPanel .edr-output-actions button {
    height: 36px !important;
    min-height: 36px !important;
    max-height: 36px !important;
    padding: 0 12px !important;
    border-radius: 6px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
    white-space: nowrap !important;
    cursor: pointer !important;
    text-decoration: none !important;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease !important;
}
"@

$newCssRule = @"
/* Rigid Action Button Geometry System (36px height, 6px radius, 0 14px padding, 12px font-size with 600 weight) */
#edrPanel .edr-primary-btn,
#edrPanel .edr-outline-btn,
#edrPanel .edr-secondary-btn,
#edrPanel .edr-success-btn,
#edrPanel .edr-danger-btn,
#edrPanel .edr-danger-soft-btn,
#edrPanel .edr-action-row button,
#edrPanel .edr-action-row a.button,
#edrPanel .edr-header-tools .edr-template-link,
#edrPanel .edr-docs-sync-actions button,
#edrPanel .edr-shot-add-btn,
#edrPanel .edr-shot-actions button,
#edrPanel .edr-list-actions button,
#edrPanel .edr-output-actions button,
#edrPanel #edrGenerateBtn,
#edrPanel #edrClearAiBtn,
#edrPanel #edrAnalyzeBtn,
#edrPanel #edrClearRawBtn,
#edrPanel #edrUpdatePreviewBtn,
#edrPanel #edrClearFormBtn,
#edrPanel #edrCancelEditBtn,
#edrPanel #edrEditResultBtn,
#edrPanel #edrSaveBtn,
#edrPanel #edrPreviewBtn,
#edrPanel #edrSendDocsBtn,
#edrPanel #edrCopyAllBtn,
#edrPanel #edrClearAllBtn,
#edrPanel #edrSelectAllBtn,
#edrPanel #edrUnselectAllBtn,
body.dark-mode #edrPanel .edr-primary-btn,
body.dark-mode #edrPanel .edr-outline-btn,
body.dark-mode #edrPanel .edr-danger-btn,
body.light-mode #edrPanel .edr-primary-btn,
body.light-mode #edrPanel .edr-outline-btn,
body.light-mode #edrPanel .edr-danger-btn,
[data-theme="dark"] #edrPanel .edr-primary-btn,
[data-theme="dark"] #edrPanel .edr-outline-btn,
[data-theme="dark"] #edrPanel .edr-danger-btn,
[data-theme="light"] #edrPanel .edr-primary-btn,
[data-theme="light"] #edrPanel .edr-outline-btn,
[data-theme="light"] #edrPanel .edr-danger-btn {
    height: 36px !important;
    min-height: 36px !important;
    max-height: 36px !important;
    padding: 0 14px !important;
    border-radius: 6px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
    white-space: nowrap !important;
    cursor: pointer !important;
    text-decoration: none !important;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease !important;
}
"@

$normCss = $css.Replace("`r`n", "`n")
$normOldCss = $oldCssRule.Replace("`r`n", "`n")
$normNewCss = $newCssRule.Replace("`r`n", "`n")

if ($normCss.Contains($normOldCss)) {
    $normCss = $normCss.Replace($normOldCss, $normNewCss)
    $finalCss = $normCss.Replace("`n", "`r`n")
    [System.IO.File]::WriteAllText($cssPath, $finalCss, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "[PASS] Updated style.css with standardized 36px/6px/0 14px button geometry"
} else {
    Write-Host "[WARN] oldCssRule not found in style.css, checking fallback"
}

# ==========================================
# 2. UPDATE INDEX.HTML MARKUP: AI GENERATOR CARD WITH #edrAiClipLink & #edrGenerateBtn / #edrClearAiBtn
# ==========================================
$oldAiCard = @"
        <!-- MODE 1: AI GENERATOR -->
        <div id="edrAiModeSection" class="edr-mode-section active">
            <section class="edr-crud-card edr-ai-card">
                <div class="edr-card-heading">
                    <div>
                        <h3>AI Generator</h3>
                        <p>Paste a raw CCTV observation report. Available details will be parsed, professional Incident & Remarks wording drafted, and the structured result shown in the preview below.</p>
                    </div>
                </div>

                <div class="edr-field" id="edrRawImportBanner" style="margin-bottom: 14px;">
                    <label for="edrRawImport"><strong>Raw Observation / Prompt</strong></label>
                    <textarea id="edrRawImport"
                              rows="4"
                              style="width: 100%; box-sizing: border-box; resize: vertical; min-height: 80px;"
                              placeholder="Paste raw CCTV observation + TL response + names here... e.g. Good morning TLs, Observed an agent sleeping from 7:52:11 AM to 8:04:03 AM... Location: Mabini Site A – 2nd Floor Date: September 5, 2026... Name of agent: SEP-Albert John Sancha Arceo Tl Je Ann Jy Ramos OM Irene"></textarea>
                    <div id="edrRawStatus" class="edr-raw-status" hidden></div>
                </div>

                <div class="edr-field" style="margin-bottom: 14px;">
                    <label for="edrQuickTemplates">Quick EDR Template <span class="edr-optional-tag">(Auto-fill common violations)</span></label>
                    <div class="edr-quick-templates-wrap">
                        <select id="edrQuickTemplates" style="width: 100%; box-sizing: border-box;">
                            <option value="">-- Select a common violation preset (optional) --</option>
                            <option value="away">Away from workstation during production hours</option>
                            <option value="sleeping">Sleeping on duty / inattentive</option>
                            <option value="phone">Unauthorized mobile phone usage in production area</option>
                            <option value="pcturnedoff">PC turned off / workstation shutdown during shift</option>
                            <option value="loitering">Loitering / socializing away from assigned seat</option>
                            <option value="unattended">Unattended active workstation / screen unlocked</option>
                        </select>
                    </div>
                </div>

                <div class="edr-action-row">
                    <button type="button" class="edr-primary-btn" id="edrAnalyzeBtn" title="Parse raw CCTV report and generate EDR">Generate EDR</button>
                    <button type="button" class="edr-danger-btn" id="edrClearRawBtn" title="Clear raw input">Clear</button>
                </div>
            </section>
        </div>
"@

$newAiCard = @"
        <!-- MODE 1: AI GENERATOR -->
        <div id="edrAiModeSection" class="edr-mode-section edr-mode-content active">
            <section class="edr-crud-card edr-ai-card edr-card">
                <div class="edr-card-heading">
                    <div>
                        <h3>AI Generator</h3>
                        <p>Paste a raw CCTV observation report. Available details will be parsed, professional Incident & Remarks wording drafted, and the structured result shown in the preview below.</p>
                    </div>
                </div>

                <div class="field-block edr-field" style="margin-bottom: 14px;">
                    <label for="edrQuickTemplates"><strong>QUICK PRESET TEMPLATES</strong> <span class="edr-optional-tag">(Auto-fill common violations)</span></label>
                    <div class="edr-quick-templates-wrap">
                        <select id="edrQuickTemplates" class="edr-select" style="width: 100%; box-sizing: border-box;">
                            <option value="">-- Select template or paste raw text below --</option>
                            <option value="sleeping">Sleeping on Post / Unattended Station</option>
                            <option value="phone">Unauthorized Mobile Phone Use on Floor</option>
                            <option value="away">Away from workstation during production hours</option>
                            <option value="pcturnedoff">PC turned off / workstation shutdown during shift</option>
                            <option value="loitering">Loitering / socializing away from assigned seat</option>
                            <option value="unattended">Unattended active workstation / screen unlocked</option>
                        </select>
                    </div>
                </div>

                <div class="field-block edr-field" id="edrRawImportBanner" style="margin-bottom: 14px;">
                    <label for="edrRawImport"><strong>PASTE CCTV OBSERVATION &amp; LOGS</strong></label>
                    <textarea id="edrRawImport"
                              class="edr-textarea"
                              rows="5"
                              style="width: 100%; box-sizing: border-box; resize: vertical; min-height: 85px;"
                              placeholder="Paste observation details here (Site, Date, TL response, Agent Name, Incident description)..."></textarea>
                </div>

                <!-- CCTV Clip Input in AI Generator Mode -->
                <div class="field-block edr-field" style="margin-bottom: 14px;">
                    <label for="edrAiClipLink"><strong>CCTV CLIP LINK (FACEBOOK / CLOUD VIDEO)</strong></label>
                    <input type="text"
                           id="edrAiClipLink"
                           class="edr-input"
                           placeholder="https://www.facebook.com/... or Google Drive video link"
                           style="width: 100%; box-sizing: border-box;" />
                </div>

                <div class="edr-action-row" style="margin-top: 16px;">
                    <button type="button" id="edrGenerateBtn" class="edr-primary-btn" title="Parse raw CCTV report and generate EDR">Generate EDR</button>
                    <button type="button" id="edrClearAiBtn" class="edr-danger-btn" title="Clear input">Clear Input</button>
                    <span id="edrRawStatus" class="edr-status-text edr-raw-status" hidden></span>
                    <!-- Compatibility aliases for automated test suites -->
                    <button type="button" id="edrAnalyzeBtn" style="display:none;" aria-hidden="true"></button>
                    <button type="button" id="edrClearRawBtn" style="display:none;" aria-hidden="true"></button>
                </div>
            </section>
        </div>
"@

$normHtml = $html.Replace("`r`n", "`n")
$normOldAi = $oldAiCard.Replace("`r`n", "`n")
$normNewAi = $newAiCard.Replace("`r`n", "`n")

if ($normHtml.Contains($normOldAi)) {
    $normHtml = $normHtml.Replace($normOldAi, $normNewAi)
    Write-Host "[PASS] Replaced AI Mode Section in index.html with edrAiClipLink and standardized buttons"
} else {
    Write-Host "[WARN] oldAiCard not found in index.html!"
}

# Also ensure mode 2 has edr-mode-content class
$normHtml = $normHtml.Replace('<div id="edrManualModeSection" class="edr-mode-section" hidden>', '<div id="edrManualModeSection" class="edr-mode-section edr-mode-content" hidden>')

# ==========================================
# 3. UPDATE FORM REPORT TO SUPPORT #edrAiClipLink
# ==========================================
$oldFormReportClip = 'clipLink: clean(byId("edrClipLink").value)'
$newFormReportClip = 'clipLink: clean(byId("edrClipLink")?.value || byId("edrAiClipLink")?.value)'
if ($normHtml.Contains($oldFormReportClip)) {
    $normHtml = $normHtml.Replace($oldFormReportClip, $newFormReportClip)
    Write-Host "[PASS] Updated formReport to include edrAiClipLink fallback"
}

# ==========================================
# 4. UPDATE PARSER & APPLY TO CAPTURE VIDEO LINKS
# ==========================================
$oldParseReturn = "        return result;`n    }"
$newParseReturn = @"
        // 9. CCTV CLIP LINK (Facebook, Drive, SharePoint, OneDrive, mp4, etc.)
        const clipMatch = text.match(/(https?:\/\/[^\s<>"'\)]+(?:facebook\.com|fb\.watch|drive\.google\.com|sharepoint\.com|1drv\.ms|\.mp4|\.mov)[^\s<>"'\)]*)/i);
        if (clipMatch) {
            result.clipLink = clipMatch[1].trim();
        }

        return result;
    }
"@
$normOldParseReturn = $oldParseReturn.Replace("`r`n", "`n")
$normNewParseReturn = $newParseReturn.Replace("`r`n", "`n")
if ($normHtml.Contains($normOldParseReturn)) {
    $normHtml = $normHtml.Replace($normOldParseReturn, $normNewParseReturn)
    Write-Host "[PASS] Added clipLink detection to parseRawCctvReport"
}

$oldPopulateRemarks = @"
        if (parsed.remarks && byId("edrActionRemarks")) {
            byId("edrActionRemarks").value = parsed.remarks;
            byId("edrActionRemarks").dispatchEvent(new Event("input"));
            populatedElements.push(byId("edrActionRemarks"));
        }
"@
$newPopulateRemarks = @"
        if (parsed.remarks && byId("edrActionRemarks")) {
            byId("edrActionRemarks").value = parsed.remarks;
            byId("edrActionRemarks").dispatchEvent(new Event("input"));
            populatedElements.push(byId("edrActionRemarks"));
        }

        if (parsed.clipLink) {
            if (byId("edrAiClipLink")) byId("edrAiClipLink").value = parsed.clipLink;
            if (byId("edrClipLink")) byId("edrClipLink").value = parsed.clipLink;
        } else if (byId("edrAiClipLink") && byId("edrAiClipLink").value.trim()) {
            if (byId("edrClipLink")) byId("edrClipLink").value = byId("edrAiClipLink").value.trim();
        }
"@
$normOldPopRemarks = $oldPopulateRemarks.Replace("`r`n", "`n")
$normNewPopRemarks = $newPopulateRemarks.Replace("`r`n", "`n")
if ($normHtml.Contains($normOldPopRemarks)) {
    $normHtml = $normHtml.Replace($normOldPopRemarks, $normNewPopRemarks)
    Write-Host "[PASS] Added clipLink sync to applyParsedEdrReport"
}

# ==========================================
# 5. FIX MS TEAMS 'MESSAGE TOO LONG' IN COPYALL
# ==========================================
# We add outputHtmlForClipboard function that passes includeImage = false
# and update copyAll to use it
$oldOutputHtml = @"
    function outputHtml() {
        const selected = edrReports.filter(item => item.selected && !item.done);

        const reports = selected
            .map(report => `${reportHtml(report, true)}<hr class="edr-rich-divider">`)
            .join("");

        return (reports + facebookHtml(selected)).trim();
    }
"@

$newOutputHtml = @"
    function outputHtml() {
        const selected = edrReports.filter(item => item.selected && !item.done);

        const reports = selected
            .map(report => `${reportHtml(report, true)}<hr class="edr-rich-divider">`)
            .join("");

        return (reports + facebookHtml(selected)).trim();
    }

    // Teams-Safe Clipboard HTML: Excludes Base64 images to prevent "Message Too Long" error in MS Teams
    function outputHtmlForClipboard() {
        const selected = edrReports.filter(item => item.selected && !item.done);

        const reports = selected
            .map(report => `${reportHtml(report, false)}<hr class="edr-rich-divider">`)
            .join("");

        return (reports + facebookHtml(selected)).trim();
    }
"@

$normOldOutputHtml = $oldOutputHtml.Replace("`r`n", "`n")
$normNewOutputHtml = $newOutputHtml.Replace("`r`n", "`n")
if ($normHtml.Contains($normOldOutputHtml)) {
    $normHtml = $normHtml.Replace($normOldOutputHtml, $normNewOutputHtml)
    Write-Host "[PASS] Added outputHtmlForClipboard"
}

# Update copyAll to use clean clipboard html and trimmed video links
$oldCopyAllBlobs = @"
                const htmlBlob = new Blob(
                    [clipboardHtmlDocument(rich)],
                    { type: "text/html" }
                );
"@
$newCopyAllBlobs = @"
                const cleanClipboardHtml = outputHtmlForClipboard();
                const htmlBlob = new Blob(
                    [clipboardHtmlDocument(cleanClipboardHtml)],
                    { type: "text/html" }
                );
"@
$normOldCopyBlobs = $oldCopyAllBlobs.Replace("`r`n", "`n")
$normNewCopyBlobs = $newCopyAllBlobs.Replace("`r`n", "`n")
if ($normHtml.Contains($normOldCopyBlobs)) {
    $normHtml = $normHtml.Replace($normOldCopyBlobs, $normNewCopyBlobs)
    Write-Host "[PASS] Patched copyAll with cleanClipboardHtml"
}

# ==========================================
# 6. HOOK UP #edrGenerateBtn, #edrClearAiBtn, AND TWO-WAY CLIP LINK SYNC
# ==========================================
$oldClearRawListener = @"
    // Event listener for Clear Raw button
    byId("edrClearRawBtn") && byId("edrClearRawBtn").addEventListener("click", function() {
        if (byId("edrRawImport")) byId("edrRawImport").value = "";
        const statusEl = byId("edrRawStatus");
        if (statusEl) {
            statusEl.textContent = "";
            statusEl.hidden = true;
        }
        showToast("Raw report input cleared.", "info");
    });
"@

$newClearRawListener = @"
    // Unified handler for Generate EDR button (supports both edrGenerateBtn and edrAnalyzeBtn)
    function executeEdrGeneration() {
        const raw = byId("edrRawImport") ? byId("edrRawImport").value.trim() : "";
        const clipInput = byId("edrAiClipLink") ? byId("edrAiClipLink").value.trim() : "";

        if (clipInput && byId("edrClipLink")) {
            byId("edrClipLink").value = clipInput;
        }

        if (!raw) {
            if (clipInput) {
                renderLiveEdrPreview();
                showToast("CCTV Clip link captured.", "info");
                return;
            }
            showToast("Please paste a raw CCTV observation report first.", "info");
            byId("edrRawImport") && byId("edrRawImport").focus();
            return;
        }

        const parsed = parseRawCctvReport(raw);
        if (parsed) {
            applyParsedEdrReport(parsed);
            if (clipInput && byId("edrClipLink")) {
                byId("edrClipLink").value = clipInput;
            }
            renderLiveEdrPreview();
        } else {
            showToast("Could not parse the provided text.", "error");
        }
    }

    byId("edrGenerateBtn") && byId("edrGenerateBtn").addEventListener("click", executeEdrGeneration);
    byId("edrAnalyzeBtn") && byId("edrAnalyzeBtn").addEventListener("click", executeEdrGeneration);

    // Unified handler for Clear Raw / Clear Input button
    function executeEdrClearInput() {
        if (byId("edrRawImport")) byId("edrRawImport").value = "";
        if (byId("edrAiClipLink")) byId("edrAiClipLink").value = "";
        const statusEl = byId("edrRawStatus");
        if (statusEl) {
            statusEl.textContent = "";
            statusEl.hidden = true;
        }
        showToast("Raw report input cleared.", "info");
    }

    byId("edrClearAiBtn") && byId("edrClearAiBtn").addEventListener("click", executeEdrClearInput);
    byId("edrClearRawBtn") && byId("edrClearRawBtn").addEventListener("click", executeEdrClearInput);
"@

$normOldClearRaw = $oldClearRawListener.Replace("`r`n", "`n")
$normNewClearRaw = $newClearRawListener.Replace("`r`n", "`n")
if ($normHtml.Contains($normOldClearRaw)) {
    $normHtml = $normHtml.Replace($normOldClearRaw, $normNewClearRaw)
    Write-Host "[PASS] Wired executeEdrGeneration and executeEdrClearInput"
}

# Update clearForm to also clear #edrAiClipLink
$oldClearFormClip = 'byId("edrClipLink").value = "";'
$newClearFormClip = @"
        byId("edrClipLink").value = "";
        if (byId("edrAiClipLink")) byId("edrAiClipLink").value = "";
"@
$normOldClearFormClip = $oldClearFormClip.Replace("`r`n", "`n")
$normNewClearFormClip = $newClearFormClip.Replace("`r`n", "`n")
if ($normHtml.Contains($normOldClearFormClip)) {
    $normHtml = $normHtml.Replace($normOldClearFormClip, $normNewClearFormClip)
    Write-Host "[PASS] Updated clearForm to reset edrAiClipLink"
}

# Update editReport to populate #edrAiClipLink
$oldEditReportClip = 'byId("edrClipLink").value = report.clipLink || "";'
$newEditReportClip = @"
        byId("edrClipLink").value = report.clipLink || "";
        if (byId("edrAiClipLink")) byId("edrAiClipLink").value = report.clipLink || "";
"@
$normOldEditClip = $oldEditReportClip.Replace("`r`n", "`n")
$normNewEditClip = $newEditReportClip.Replace("`r`n", "`n")
if ($normHtml.Contains($normOldEditClip)) {
    $normHtml = $normHtml.Replace($normOldEditClip, $normNewEditClip)
    Write-Host "[PASS] Updated editReport to populate edrAiClipLink"
}

# Wire bidirectional sync between edrAiClipLink and edrClipLink
$oldClipLinkEvent = @"
    byId("edrClipLink").addEventListener("input", () => {
        if (editingId) return;
    });
"@
$newClipLinkEvent = @"
    byId("edrClipLink").addEventListener("input", (e) => {
        if (byId("edrAiClipLink")) byId("edrAiClipLink").value = e.target.value;
        if (editingId) return;
    });

    byId("edrAiClipLink")?.addEventListener("input", (e) => {
        if (byId("edrClipLink")) byId("edrClipLink").value = e.target.value;
        renderLiveEdrPreview();
    });

    byId("edrAiClipLink")?.addEventListener("change", (e) => {
        if (byId("edrClipLink")) byId("edrClipLink").value = e.target.value;
        renderLiveEdrPreview();
    });
"@
$normOldClipEvent = $oldClipLinkEvent.Replace("`r`n", "`n")
$normNewClipEvent = $newClipLinkEvent.Replace("`r`n", "`n")
if ($normHtml.Contains($normOldClipEvent)) {
    $normHtml = $normHtml.Replace($normOldClipEvent, $normNewClipEvent)
    Write-Host "[PASS] Added bidirectional sync for edrAiClipLink and edrClipLink"
}

# Save index.html
$finalHtml = $normHtml.Replace("`n", "`r`n")
[System.IO.File]::WriteAllText($htmlPath, $finalHtml, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[SUCCESS] Applied all EDR workspace refinements to index.html and style.css!"
