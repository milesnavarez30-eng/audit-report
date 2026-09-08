/**
 * CCTV OPS - Enterprise Monitoring Dashboard Supplementary Controller
 * Hardened PDF Canvas Generation & Google Sheets Transmission Verification
 */

(function () {
    "use strict";

    // 1. Hook and Harden PDF Generation (Zero Scroll Offsets & Portrait A4 Margins)
    const pdfBtn = document.getElementById("simpleEodPdfBtn");
    if (pdfBtn) {
        // Intercept before any internal handlers to ensure viewport is pinned to (0, 0)
        pdfBtn.addEventListener("click", function () {
            window.scrollTo(0, 0);
        }, true);
    }

    // Exportable / Reusable PDF Generator with Explicit Zero Scroll Offsets
    window.generateHardenedPdf = async function (rootElement, customFilename) {
        window.scrollTo(0, 0);

        if (typeof html2pdf === "undefined") {
            window.print();
            return null;
        }

        const filename = customFilename || (typeof reportFilename === "function" ? reportFilename() : "CCTV_Ops_Report.pdf");

        const opt = {
            margin: [6, 6, 6, 6],
            filename: filename,
            image: { type: "jpeg", quality: 0.985 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                scrollY: 0,
                scrollX: 0
            },
            jsPDF: {
                unit: "mm",
                format: "a4",
                orientation: "portrait",
                compress: true
            },
            pagebreak: {
                mode: ["css", "legacy"],
                avoid: [
                    ".grouped-report-block",
                    ".grouped-photo-row",
                    ".grouped-photo-row img",
                    ".simple-pdf-images",
                    ".grouped-remarks",
                    ".simple-pdf-table tr"
                ]
            }
        };

        const target = rootElement || (document.getElementById("simpleEodPrintRoot") ? document.getElementById("simpleEodPrintRoot").firstElementChild : document.body);
        return html2pdf().set(opt).from(target).toPdf().save();
    };

    // 2. Google Sheets Transmission Block Images Verification Guard
    window.verifyMaintenanceTransmissionResults = function (result, payload) {
        if (!result) return true;

        const blockResults = Array.isArray(result.blockResults) ? result.blockResults : [];
        const payloadBlocks = (payload && Array.isArray(payload.blocks)) ? payload.blocks : [];

        const blockMismatch = blockResults.find(item => {
            const inserted = Number(item.insertedImages || 0);
            const blockScreenshots = payloadBlocks[(item.blockNumber || 1) - 1]?.screenshots?.length;
            const expected = item.expectedImages !== undefined
                ? Number(item.expectedImages)
                : (blockScreenshots !== undefined ? Number(blockScreenshots) : inserted);

            // Treat block as successful if insertedImages > 0 or if insertedImages === (block.expectedImages || screenshots.length)
            if (inserted > 0 && (item.expectedImages === undefined || inserted === expected)) {
                return false;
            }
            return inserted !== expected;
        });

        if (blockMismatch) {
            const exp = blockMismatch.expectedImages !== undefined
                ? blockMismatch.expectedImages
                : (payloadBlocks[(blockMismatch.blockNumber || 1) - 1]?.screenshots?.length ?? blockMismatch.insertedImages);
            throw new Error(
                `Block ${blockMismatch.blockNumber} screenshot failed: ${blockMismatch.insertedImages}/${exp} image(s) inserted.`
            );
        }

        return true;
    };

    // 3. CCTV Audit Tracker Site Normalization Rule
    function normalizeTrackerSite(raw) {
        const text = String(raw || "").trim().toLowerCase();
        
        // Check Mabini Site B first to avoid false positives
        if (
            text.includes("mabini site b") || 
            text.includes("site b") || 
            text === "mabini_b" ||
            (text.includes("mabini") && (text.includes("3rd") || text.includes("4th")))
        ) {
            return "Mabini Site B";
        }

        // Match any Mabini Site A variation (1st floor, 2nd floor, 1F, 2F, etc.)
        if (
            text.includes("mabini site a") || 
            text.includes("site a") || 
            text === "mabini_a" ||
            text.includes("mabini a") ||
            (text.includes("mabini") && (text.includes("1st") || text.includes("2nd") || text.includes("1f") || text.includes("2f")))
        ) {
            return "Mabini Site A";
        }

        if (text.includes("maa") || text.startsWith("maa_")) return "Maa";
        if (text.includes("gensan")) return "Gensan";
        if (text.includes("ecoland")) return "Ecoland";
        if (text.includes("digos")) return "Digos";
        if (text.includes("cdo")) return "CDO";

        return raw ? raw.trim() : "Mabini Site A";
    }

    window.normalizeTrackerSite = normalizeTrackerSite;

    // 4. CCTV Audit Auditor First Name ("Miles") Normalization & Clipboard Guard
    function normalizeAuditorName(raw) {
        if (raw && typeof raw === "object") {
            raw = raw.name || raw.display_name || raw.username || raw.full_name || "";
        }
        const text = String(raw || "").trim().toLowerCase();
        if (text.includes("miles") || text.includes("mico")) return "Miles";
        if (text.includes("wendie") || text.includes("amor")) return "Wendie";
        if (text.includes("seth")) return "Seth";
        if (text.includes("john ric") || text === "jr" || text.includes("john")) return "John Ric";
        if (text.includes("kenneth")) return "Kenneth";
        return raw ? String(raw).trim().split(/\s+/)[0] : "Miles";
    }

    window.normalizeAuditorName = normalizeAuditorName;

    // Harden submitEntry, renderTable, and copyToClipboard
    if (typeof window !== "undefined") {
        if (typeof window.submitEntry === "function") {
            const originalSubmit = window.submitEntry;
            window.submitEntry = function () {
                const res = originalSubmit.apply(this, arguments);
                if (typeof entryList !== "undefined" && Array.isArray(entryList)) {
                    entryList.forEach(entry => {
                        const auditor = normalizeAuditorName(
                            entry.name ||
                            entry.auditorName ||
                            (typeof currentUser !== "undefined" ? (currentUser?.name || currentUser?.username) : null) ||
                            window.CCTV_ACCOUNT_CONTEXT?.profile?.display_name ||
                            "Miles"
                        );
                        entry.name = auditor;
                        entry.auditorName = auditor;
                    });
                }
                return res;
            };
        }

        if (typeof window.renderTable === "function") {
            const originalRender = window.renderTable;
            window.renderTable = function () {
                const res = originalRender.apply(this, arguments);
                const rows = document.querySelectorAll("#outputTable tbody tr");
                rows.forEach((tr, index) => {
                    const entry = typeof entryList !== "undefined" && Array.isArray(entryList) ? entryList[index] : null;
                    const cells = tr.children;
                    if (!cells || !cells.length) return;
                    const hasTrackerCell = tr.querySelector(".audit-guard-table-cell") !== null;
                    const nameCellIdx = hasTrackerCell ? 5 : 4;
                    if (cells[nameCellIdx]) {
                        const rawVal = entry?.name || entry?.auditorName || cells[nameCellIdx].textContent;
                        cells[nameCellIdx].textContent = normalizeAuditorName(rawVal);
                    }
                });
                return res;
            };
        }

        if (typeof window.copyToClipboard === "function") {
            const originalCopy = window.copyToClipboard;
            window.copyToClipboard = function () {
                if (typeof entryList !== "undefined" && Array.isArray(entryList)) {
                    entryList.forEach(entry => {
                        const auditor = normalizeAuditorName(entry.name || entry.auditorName || "Miles");
                        entry.name = auditor;
                        entry.auditorName = auditor;
                    });
                }
                const rows = document.querySelectorAll("#outputTable tbody tr");
                rows.forEach(tr => {
                    const cells = tr.children;
                    if (!cells || !cells.length) return;
                    const hasTrackerCell = tr.querySelector(".audit-guard-table-cell") !== null;
                    const nameCellIdx = hasTrackerCell ? 5 : 4;
                    if (cells[nameCellIdx]) {
                        cells[nameCellIdx].textContent = normalizeAuditorName(cells[nameCellIdx].textContent);
                    }
                });
                return originalCopy.apply(this, arguments);
            };
        }
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            generateHardenedPdf: window.generateHardenedPdf,
            verifyMaintenanceTransmissionResults: window.verifyMaintenanceTransmissionResults,
            normalizeTrackerSite,
            normalizeAuditorName
        };
    }
})();

