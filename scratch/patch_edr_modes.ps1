$path = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# 1. Update the input/change listener to trigger renderLiveEdrPreview
$oldListeners = @"
        byId(id)?.addEventListener("input", () => {
            persistEdrWorkspace();
            scheduleFormHistory();
        });

        byId(id)?.addEventListener("change", () => {
            persistEdrWorkspace();
            scheduleFormHistory();
        });
"@

$newListeners = @"
        byId(id)?.addEventListener("input", () => {
            persistEdrWorkspace();
            scheduleFormHistory();
            if (typeof renderLiveEdrPreview === "function") renderLiveEdrPreview();
        });

        byId(id)?.addEventListener("change", () => {
            persistEdrWorkspace();
            scheduleFormHistory();
            if (typeof renderLiveEdrPreview === "function") renderLiveEdrPreview();
        });
"@

# 2. Add switchEdrMode and renderLiveEdrPreview right after byId("edrHistoryBackdrop")?.addEventListener("click", closeEdrHistoryModal);
$targetAnchor = 'byId("edrHistoryBackdrop")?.addEventListener("click", closeEdrHistoryModal);'

$addition = @"
    byId("edrHistoryBackdrop")?.addEventListener("click", closeEdrHistoryModal);

    function switchEdrMode(mode) {
        const aiTab = byId("edrModeAiTab");
        const manualTab = byId("edrModeManualTab");
        const aiSec = byId("edrAiModeSection");
        const manualSec = byId("edrManualModeSection");

        if (mode === "ai") {
            aiTab?.classList.add("active");
            aiTab?.setAttribute("aria-selected", "true");
            manualTab?.classList.remove("active");
            manualTab?.setAttribute("aria-selected", "false");

            if (aiSec) {
                aiSec.classList.add("active");
                aiSec.hidden = false;
            }
            if (manualSec) {
                manualSec.classList.remove("active");
                manualSec.hidden = true;
            }
        } else {
            manualTab?.classList.add("active");
            manualTab?.setAttribute("aria-selected", "true");
            aiTab?.classList.remove("active");
            aiTab?.setAttribute("aria-selected", "false");

            if (manualSec) {
                manualSec.classList.add("active");
                manualSec.hidden = false;
            }
            if (aiSec) {
                aiSec.classList.remove("active");
                aiSec.hidden = true;
            }
        }
    }

    byId("edrModeAiTab")?.addEventListener("click", () => switchEdrMode("ai"));
    byId("edrModeManualTab")?.addEventListener("click", () => switchEdrMode("manual"));

    function renderLiveEdrPreview() {
        const target = byId("edrLivePreviewContent");
        if (!target) return;

        const site = byId("edrSite") ? byId("edrSite").value.trim() : "";
        const date = byId("edrDate") ? byId("edrDate").value.trim() : "";
        const time = byId("edrTimeObserved") ? byId("edrTimeObserved").value.trim() : "";
        const supRole = byId("edrSupervisorRole") ? byId("edrSupervisorRole").value.trim() : "Team Leader";
        const supName = byId("edrSupervisorName") ? byId("edrSupervisorName").value.trim() : "";
        const omName = byId("edrOmName") ? byId("edrOmName").value.trim() : "";
        const subjType = byId("edrSubjectType") ? byId("edrSubjectType").value.trim() : "Agent/s";
        const subjName = byId("edrSubjectName") ? byId("edrSubjectName").value.trim() : "";
        const account = byId("edrAccount") ? byId("edrAccount").value.trim() : "";
        const incident = byId("edrIncident") ? byId("edrIncident").value.trim() : "";
        const remarks = byId("edrActionRemarks") ? byId("edrActionRemarks").value.trim() : "";
        const clipLink = byId("edrClipLink") ? byId("edrClipLink").value.trim() : "";

        const hasAnyContent = Boolean(
            site || date || time || supName || omName || subjName || account || incident || remarks || currentScreenshot || clipLink
        );

        if (!hasAnyContent) {
            target.innerHTML = '<div class="edr-preview-placeholder">Live preview will appear here as you type or generate an EDR.</div>';
            return;
        }

        const supText = [supRole, supName].filter(Boolean).join(" ");
        const subjText = [subjType, subjName].filter(Boolean).join(" ");

        let html = '<div class="edr-preview-table-wrap"><table class="edr-preview-table" style="width:100%;border-collapse:collapse;font-size:13px;">';
        
        if (site || date) {
            html += `<tr><td style="padding:6px 10px;font-weight:600;width:140px;color:var(--ops-muted, #94a3b8);border-bottom:1px solid rgba(255,255,255,0.06);">Location / Date</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(site)}${site && date ? ' &bull; ' : ''}${escapeHtml(date)}</td></tr>`;
        }
        if (time) {
            html += `<tr><td style="padding:6px 10px;font-weight:600;color:var(--ops-muted, #94a3b8);border-bottom:1px solid rgba(255,255,255,0.06);">Time Observed</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(time)}</td></tr>`;
        }
        if (subjText) {
            html += `<tr><td style="padding:6px 10px;font-weight:600;color:var(--ops-muted, #94a3b8);border-bottom:1px solid rgba(255,255,255,0.06);">Subject</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(subjText)}${account ? ' (' + escapeHtml(account) + ')' : ''}</td></tr>`;
        }
        if (supText || omName) {
            html += `<tr><td style="padding:6px 10px;font-weight:600;color:var(--ops-muted, #94a3b8);border-bottom:1px solid rgba(255,255,255,0.06);">Supervisor / OM</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(supText)}${supText && omName ? ' &bull; OM: ' : ''}${escapeHtml(omName)}</td></tr>`;
        }
        if (incident) {
            html += `<tr><td style="padding:6px 10px;font-weight:600;color:var(--ops-muted, #94a3b8);border-bottom:1px solid rgba(255,255,255,0.06);">Incident</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:pre-wrap;">${escapeHtml(incident)}</td></tr>`;
        }
        if (remarks) {
            html += `<tr><td style="padding:6px 10px;font-weight:600;color:var(--ops-muted, #94a3b8);border-bottom:1px solid rgba(255,255,255,0.06);">Action / Remarks</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:pre-wrap;">${escapeHtml(remarks)}</td></tr>`;
        }
        if (clipLink) {
            html += `<tr><td style="padding:6px 10px;font-weight:600;color:var(--ops-muted, #94a3b8);border-bottom:1px solid rgba(255,255,255,0.06);">CCTV Clip</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);"><a href="${escapeHtml(clipLink)}" target="_blank" rel="noopener" style="color:var(--ops-accent, #38bdf8);">${escapeHtml(clipLink)}</a></td></tr>`;
        }
        if (currentScreenshot) {
            html += `<tr><td style="padding:6px 10px;font-weight:600;color:var(--ops-muted, #94a3b8);border-bottom:1px solid rgba(255,255,255,0.06);">Screenshot</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);"><img src="${currentScreenshot}" style="max-width:280px;max-height:160px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);" alt="EDR Screenshot Preview" /></td></tr>`;
        }

        html += '</table></div>';
        target.innerHTML = html;
    }
"@

# 3. Add call to renderLiveEdrPreview on init (right after refreshOutput(); around line 29660)
$targetInit = '    refreshOutput();'
$replacementInit = @"
    refreshOutput();
    renderLiveEdrPreview();
"@

# Normalize
$normalizedContent = $content.Replace("`r`n", "`n")
$normalizedOldListeners = $oldListeners.Replace("`r`n", "`n")
$normalizedNewListeners = $newListeners.Replace("`r`n", "`n")
$normalizedAnchor = $targetAnchor.Replace("`r`n", "`n")
$normalizedAddition = $addition.Replace("`r`n", "`n")
$normalizedTargetInit = $targetInit.Replace("`r`n", "`n")
$normalizedReplacementInit = $replacementInit.Replace("`r`n", "`n")

if ($normalizedContent.Contains($normalizedOldListeners) -and $normalizedContent.Contains($normalizedAnchor)) {
    $normalizedContent = $normalizedContent.Replace($normalizedOldListeners, $normalizedNewListeners)
    $normalizedContent = $normalizedContent.Replace($normalizedAnchor, $normalizedAddition)
    if ($normalizedContent.Contains($normalizedTargetInit)) {
        $normalizedContent = $normalizedContent.Replace($normalizedTargetInit, $normalizedReplacementInit)
    }
    
    $newContent = $normalizedContent.Replace("`n", "`r`n")
    [System.IO.File]::WriteAllText($path, $newContent, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "SUCCESS: Patched EDR modes and preview in index.html!"
} else {
    Write-Host "FAILED: Targets not found in content!"
}
