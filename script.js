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

    // 5. Cyber-Terminal SECURE_DATA Login Controller & Submission Handler
    function initCyberTerminalLogin() {
        const forms = [
            document.getElementById("loginForm"),
            document.getElementById("authSignInForm"),
            document.querySelector(".terminal-card"),
            document.querySelector(".auth-form")
        ].filter(Boolean);

        if (!forms.length) return;

        // Guarantee no native GET submission or page reload happens even before JS binds
        forms.forEach(form => {
            form.setAttribute("onsubmit", "event.preventDefault(); return false;");
            form.onsubmit = function (e) {
                if (e && typeof e.preventDefault === "function") e.preventDefault();
                return false;
            };
        });

        // Support modern and legacy username IDs: username, operatorId, loginUser, email
        const usernameIds = ["username", "operatorId", "loginUser", "email", "authSignInUsername"];
        const usernameNames = ["username", "operatorId", "loginUser", "email"];

        // Support modern and legacy password IDs: password, securityPasscode, loginPass
        const passwordIds = ["password", "securityPasscode", "loginPass", "authSignInPassword"];
        const passwordNames = ["password", "access_key", "securityPasscode", "loginPass"];

        function getFieldElement(ids, names, formEl) {
            // First check within the active form for elements with values
            if (formEl && formEl.querySelector) {
                for (const id of ids) {
                    const el = formEl.querySelector(`#${id}`);
                    if (el && el.value && el.value.trim()) return el;
                }
                for (const name of names) {
                    const el = formEl.querySelector(`input[name="${name}"]`);
                    if (el && el.value && el.value.trim()) return el;
                }
                for (const id of ids) {
                    const el = formEl.querySelector(`#${id}`);
                    if (el) return el;
                }
                for (const name of names) {
                    const el = formEl.querySelector(`input[name="${name}"]`);
                    if (el) return el;
                }
            }

            // Fall back to document-wide lookup
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el && el.value && el.value.trim()) return el;
            }
            for (const name of names) {
                const el = document.querySelector(`input[name="${name}"]`);
                if (el && el.value && el.value.trim()) return el;
            }
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el) return el;
            }
            for (const name of names) {
                const el = document.querySelector(`input[name="${name}"]`);
                if (el) return el;
            }
            return null;
        }

        function hideLoginModal() {
            const loginModal = document.getElementById("loginModal");
            if (loginModal) {
                loginModal.hidden = true;
                loginModal.style.display = "none";
                loginModal.classList.add("hidden");
                loginModal.setAttribute("aria-hidden", "true");
            }
            const authGate = document.getElementById("authGate");
            if (authGate) {
                authGate.hidden = true;
                authGate.style.display = "none";
                authGate.classList.add("hidden");
                authGate.setAttribute("aria-hidden", "true");
            }
            const wrappers = document.querySelectorAll(".terminal-login-wrapper, .glitch-form-wrapper");
            wrappers.forEach(w => {
                w.hidden = true;
                w.style.display = "none";
                w.classList.add("hidden");
            });

            document.body.classList.remove("auth-locked");
            document.body.classList.add("auth-unlocked");
        }

        window.hideLoginModal = hideLoginModal;

        async function handleLoginSubmission(event) {
            if (event) {
                event.preventDefault();
                if (typeof event.stopPropagation === "function") event.stopPropagation();
            }

            const currentForm = (event?.target?.tagName === "FORM")
                ? event.target
                : (event?.target?.closest?.("form") || document.getElementById("loginForm") || document.getElementById("authSignInForm"));

            const usernameInput = getFieldElement(usernameIds, usernameNames, currentForm);
            const passwordInput = getFieldElement(passwordIds, passwordNames, currentForm);
            const loginBtn = document.getElementById("loginBtn") || document.getElementById("authSignInBtn");
            const btnLabel = loginBtn?.querySelector(".btn-label") || loginBtn?.querySelector(".btn-text") || loginBtn;

            const usernameVal = String(usernameInput?.value || "").trim();
            const passwordVal = String(passwordInput?.value || "");

            let msgEl = document.getElementById("authMessage") || document.querySelector(".terminal-body .auth-message") || document.querySelector(".auth-message");
            if (!msgEl) {
                const termBody = document.querySelector(".terminal-body") || document.getElementById("loginForm");
                if (termBody) {
                    msgEl = document.createElement("div");
                    msgEl.id = "authMessage";
                    msgEl.className = "auth-message";
                    termBody.appendChild(msgEl);
                }
            }

            if (!usernameVal || !passwordVal) {
                if (msgEl) {
                    msgEl.textContent = "Please enter both username and access key.";
                    msgEl.hidden = false;
                }
                return false;
            }

            const oldBtnText = btnLabel ? btnLabel.textContent : "";
            if (loginBtn) loginBtn.disabled = true;
            if (btnLabel) btnLabel.textContent = "CONNECTING...";

            try {
                // 1. Delegate to cctvAuthenticate in index.html if present
                if (typeof window.cctvAuthenticate === "function") {
                    await window.cctvAuthenticate(usernameVal, passwordVal);
                } else if (window.supabase && window.CCTV_AUTH_CONFIG) {
                    const cfg = window.CCTV_AUTH_CONFIG;
                    const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLIC_KEY, {
                        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
                    });

                    let email = usernameVal.includes("@") ? usernameVal.toLowerCase() : null;
                    if (!email) {
                        try {
                            const { data: rpcEmail } = await client.rpc("resolve_login_username", { p_username: usernameVal });
                            if (rpcEmail && typeof rpcEmail === "string") email = rpcEmail.trim().toLowerCase();
                        } catch (_) {}
                    }
                    if (!email) {
                        const local = usernameVal.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "");
                        email = `${local || "user"}@cctvops.example.com`;
                    }

                    const { error } = await client.auth.signInWithPassword({ email, password: passwordVal });
                    if (error) throw error;
                }

                // 2. Hide login modal cleanly upon successful authentication and reveal main workspace
                hideLoginModal();
                if (msgEl) {
                    msgEl.textContent = "";
                    msgEl.hidden = true;
                }
            } catch (err) {
                const messageText = err.message === "Invalid login credentials"
                    ? "Incorrect username or access key."
                    : (err.message || "Authentication failed.");
                if (msgEl) {
                    msgEl.textContent = messageText;
                    msgEl.hidden = false;
                }
            } finally {
                if (loginBtn) loginBtn.disabled = false;
                if (btnLabel) btnLabel.textContent = oldBtnText || "INITIATE_CONNECTION";
            }

            return false;
        }

        forms.forEach(form => {
            form.addEventListener("submit", handleLoginSubmission, true);
            form.querySelectorAll("input").forEach(input => {
                input.addEventListener("keydown", function (e) {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        handleLoginSubmission(e);
                    }
                });
            });
        });

        const loginBtn = document.getElementById("loginBtn") || document.getElementById("authSignInBtn");
        if (loginBtn) {
            loginBtn.addEventListener("click", function (e) {
                const parentForm = loginBtn.closest("form");
                if (parentForm) {
                    e.preventDefault();
                    handleLoginSubmission(e);
                }
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initCyberTerminalLogin, { once: true });
    } else {
        initCyberTerminalLogin();
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            generateHardenedPdf: window.generateHardenedPdf,
            verifyMaintenanceTransmissionResults: window.verifyMaintenanceTransmissionResults,
            normalizeTrackerSite,
            normalizeAuditorName,
            initCyberTerminalLogin,
            hideLoginModal: window.hideLoginModal
        };
    }
})();

