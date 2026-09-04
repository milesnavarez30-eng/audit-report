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
})();
