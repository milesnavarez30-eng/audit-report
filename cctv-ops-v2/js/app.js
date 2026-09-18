/**
 * CCTV OPS V2 - Main Application Orchestrator & Prototype Controller
 */

(function () {
  "use strict";

  const cfg = window.CCTV_V2_CONFIG;
  const storage = window.CCTV_STORAGE;
  const edr = window.CCTV_EDR;
  const audit = window.CCTV_AUDIT;
  const auth = window.CCTV_AUTH;
  const sorter = window.sorterService;
  const maintenance = window.maintenanceService;
  const pending = window.pendingService;
  const followup = window.followupService;

  let currentScreenshot = "";
  let supervisorRole = "Team Leader";
  let subjectType = "Agent/s";

  // Elements
  const el = id => document.getElementById(id);

  // Centralized Global Toast Manager Delegation
  function showToast(message, type = "info", opts) {
    if (typeof window.showToast === "function") {
      return window.showToast(message, type, opts);
    }
  }

  // Live Manila Clock
  function updateManilaClock() {
    try {
      const now = new Date();
      const options = {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      };
      const formatter = new Intl.DateTimeFormat("en-US", options);
      const parts = formatter.format(now);
      const clockEl = el("manilaClockText");
      if (clockEl) clockEl.textContent = `${parts} PHT`;
    } catch (_) {}
  }

  // Populate Dropdown Options
  function populateRespondentList(role) {
    const respList = el("listRespondents");
    const input = el("edrSupervisorName");
    if (!respList || !input) return;

    if (role === "OM") {
      const oms = edr.getOmNames();
      respList.innerHTML = oms.map(o => `<option value="${o}"></option>`).join("");
      input.placeholder = "Search OM...";
    } else {
      const tls = edr.getTeamLeaderNames();
      respList.innerHTML = tls.map(t => `<option value="${t}"></option>`).join("");
      input.placeholder = "Search Team Leader...";
    }
  }

  function initFormDropdowns() {
    // Site select
    const siteSelect = el("edrSite");
    const sites = storage.getItem(cfg.KEYS.DROPDOWN_SITE, cfg.DEFAULTS.SITES);
    if (siteSelect) {
      siteSelect.innerHTML = sites.map(s => `<option value="${s}">${s}</option>`).join("");
    }

    // OM datalist (dedicated OM field)
    const omList = el("listOms");
    const oms = edr.getOmNames();
    if (omList) {
      omList.innerHTML = oms.map(o => `<option value="${o}"></option>`).join("");
    }

    // Respondent datalist (initial TL only)
    populateRespondentList(supervisorRole);

    // Subject TL datalist (for Violation Subject = TL)
    const subjTlList = el("listSubjectTls");
    const tls = edr.getTeamLeaderNames();
    if (subjTlList) {
      subjTlList.innerHTML = tls.map(t => `<option value="${t}"></option>`).join("");
    }

    // Account / Campaign datalist
    const accList = el("listAccounts");
    const accounts = edr.getAccountNames();
    if (accList && Array.isArray(accounts)) {
      accList.innerHTML = accounts.map(a => `<option value="${a}"></option>`).join("");
    }

    // Date default
    const dateInput = el("edrDate");
    if (dateInput && !dateInput.value) {
      const today = new Date().toISOString().slice(0, 10);
      dateInput.value = today;
    }

    // Facebook date tag
    const fbTag = el("fbDateTag");
    if (fbTag) {
      const now = new Date();
      fbTag.textContent = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }

  // Segmented Choice Buttons
  function initChoiceButtons() {
    const btnTl = el("btnRoleTl");
    const btnOm = el("btnRoleOm");
    const respInput = el("edrSupervisorName");

    if (btnTl && btnOm) {
      btnTl.addEventListener("click", () => {
        if (supervisorRole === "Team Leader") return;
        btnTl.classList.add("active");
        btnOm.classList.remove("active");
        supervisorRole = "Team Leader";

        // Switching OM -> TL: clear if current value is not a valid TL
        if (respInput && respInput.value) {
          const validTls = edr.getTeamLeaderNames();
          const current = respInput.value.trim().toLowerCase();
          const isValid = validTls.some(t => t.toLowerCase() === current);
          if (!isValid) {
            respInput.value = "";
          }
        }
        populateRespondentList("Team Leader");
      });

      btnOm.addEventListener("click", () => {
        if (supervisorRole === "OM") return;
        btnOm.classList.add("active");
        btnTl.classList.remove("active");
        supervisorRole = "OM";

        // Switching TL -> OM: clear if current value is not a valid OM
        if (respInput && respInput.value) {
          const validOms = edr.getOmNames();
          const current = respInput.value.trim().toLowerCase();
          const isValid = validOms.some(o => o.toLowerCase() === current);
          if (!isValid) {
            respInput.value = "";
          }
        }
        populateRespondentList("OM");
      });
    }

    const btnAgent = el("btnSubjAgent");
    const btnSubjTl = el("btnSubjTl");
    const subjInput = el("edrSubjectName");

    if (btnAgent && btnSubjTl) {
      btnAgent.addEventListener("click", () => {
        btnAgent.classList.add("active");
        btnSubjTl.classList.remove("active");
        subjectType = "Agent/s";
        if (subjInput) {
          subjInput.placeholder = "Employee name...";
          subjInput.removeAttribute("list");
        }
      });
      btnSubjTl.addEventListener("click", () => {
        btnSubjTl.classList.add("active");
        btnAgent.classList.remove("active");
        subjectType = "Team Leader";
        if (subjInput) {
          subjInput.placeholder = "Search Team Leader...";
          subjInput.setAttribute("list", "listSubjectTls");
        }
      });
    }
  }

  // Screenshot Upload, Paste & Drop
  function initScreenshotDropzone() {
    const zone = el("dropzoneScreenshot");
    const fileInput = el("fileScreenshot");
    const thumb = el("shotThumb");
    const dropText = el("dropText");
    const btnRemove = el("btnRemoveShot");

    if (!zone) return;

    zone.addEventListener("click", (e) => {
      if (e.target !== btnRemove) fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleImageFile(file);
    });

    // Drag and Drop
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleImageFile(file);
      }
    });

    // Paste from Clipboard
    window.addEventListener("paste", (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf("image") === 0) {
          const blob = item.getAsFile();
          handleImageFile(blob);
          showToast("Screenshot pasted from clipboard.", "success");
          break;
        }
      }
    });

    btnRemove.addEventListener("click", (e) => {
      e.stopPropagation();
      clearScreenshot();
    });

    function handleImageFile(file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        currentScreenshot = evt.target.result;
        thumb.src = currentScreenshot;
        thumb.style.display = "block";
        dropText.textContent = `${file.name || "Screenshot ready"}`;
        btnRemove.style.display = "inline-flex";
        updateLivePreview();
      };
      reader.readAsDataURL(file);
    }

    function clearScreenshot() {
      currentScreenshot = "";
      thumb.src = "";
      thumb.style.display = "none";
      dropText.textContent = "Drop image, Ctrl+V, or click to browse";
      btnRemove.style.display = "none";
      fileInput.value = "";
      updateLivePreview();
    }

    window.setCctvScreenshot = function (dataUrl) {
      if (dataUrl) {
        currentScreenshot = dataUrl;
        thumb.src = dataUrl;
        thumb.style.display = "block";
        dropText.textContent = "Screenshot attached";
        btnRemove.style.display = "inline-flex";
      } else {
        clearScreenshot();
      }
    };
  }

  // Modal Screenshot Evidence Viewer
  function openScreenshotViewer(dataUrl, title, meta) {
    if (!dataUrl) {
      showToast("No screenshot image to display.", "info");
      return;
    }
    const modal = el("modalScreenshotViewer");
    const img = el("screenshotViewerImg");
    const titleEl = el("screenshotViewerTitle");
    const metaEl = el("screenshotViewerMeta");
    if (!modal || !img) return;

    img.src = dataUrl;
    if (titleEl) titleEl.textContent = title || "CCTV Incident Evidence";
    if (metaEl) metaEl.textContent = meta || "Full Resolution Screenshot";
    modal.hidden = false;
  }

  function closeScreenshotViewer() {
    const modal = el("modalScreenshotViewer");
    const img = el("screenshotViewerImg");
    if (modal) modal.hidden = true;
    if (img) img.src = "";
  }

  // Helper to format ISO YYYY-MM-DD to "Sep 9, 2026" or preserve custom date text
  function formatDisplayDate(dateStr) {
    if (!dateStr) return "No Date";
    const str = String(dateStr).trim();
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
    if (m) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthIdx = parseInt(m[2], 10) - 1;
      const month = months[monthIdx] || m[2];
      const day = parseInt(m[3], 10);
      return `${month} ${day}, ${m[1]}`;
    }
    return str;
  }

  function formatLastEdited(isoStr) {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return "";
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const day = d.getDate();
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `Edited: ${month} ${day}, ${year} Â· ${hours}:${minutes} ${ampm}`;
    } catch (_) {
      return "";
    }
  }

  // Render EDR Cards in Column 2
  function renderEdrList(rawReports) {
    const listContainer = el("edrListContainer");
    if (!listContainer) return;

    // Consistently sort records by observed/report date ascending (earliest first, oldest at top, newest at bottom)
    const reports = [...(rawReports || [])].sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      const cmp = dateA.localeCompare(dateB);
      if (cmp !== 0) return cmp;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    const total = reports.length;
    const selected = reports.filter(r => r.selected).length;
    const done = reports.filter(r => r.done).length;

    el("badgeTotalCount").textContent = total;
    el("badgeSelectedCount").textContent = `${selected} selected`;
    el("badgeDoneCount").textContent = `${done} done`;
    el("railEdrBadge").textContent = total;

    // Update Delete Selected button
    const btnDel = el("btnDeleteSelectedEdr");
    const btnDelText = el("btnDeleteSelectedEdrText");
    if (btnDel) {
      btnDel.disabled = selected === 0;
      if (btnDelText) {
        btnDelText.textContent = selected > 0 ? `Delete Selected (${selected})` : "Delete Selected";
      }
    }

    if (!reports.length) {
      listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:11.5px; text-align:center; padding:30px 10px;">No EDR records found. Complete the form on the left to save an incident.</div>';
      updateLivePreview();
      return;
    }

    const existingCards = listContainer.querySelectorAll(".record-row");
    const existingIds = Array.from(existingCards).map(c => c.dataset.id);
    const newIds = reports.map(r => r.id);
    // Fast-path: only update selection/done state when IDs are identical AND
    // no report content has changed (updatedAt fingerprint). If any record was
    // edited, fall through to the full re-render so event listeners are
    // re-attached with a fresh reference to the latest report object.
    const isSameStructure = existingIds.length === newIds.length &&
      existingIds.every((id, i) => {
        if (id !== newIds[i]) return false;
        const card = listContainer.querySelector(`.record-row[data-id="${id}"]`);
        return card && card.dataset.updatedAt === (reports[i].updatedAt || "");
      });

    if (isSameStructure) {
      reports.forEach((r, idx) => {
        const card = listContainer.querySelector(`.record-row[data-id="${r.id}"]`) || existingCards[idx];
        if (!card) return;
        const isDone = !!r.done;
        const isSelected = !!r.selected;
        card.classList.toggle("is-selected", isSelected);
        card.classList.toggle("is-done", isDone);
        const chk = card.querySelector(".edr-check");
        if (chk) {
          chk.checked = isSelected;
          chk.disabled = false;
        }
        const doneBtn = card.querySelector(".btn-done-toggle");
        if (doneBtn) {
          doneBtn.textContent = isDone ? "Reopen" : "Done";
          doneBtn.title = isDone ? "Reopen EDR" : "Mark as Done";
          doneBtn.classList.toggle("is-done-btn", isDone);
        }
        let chipsWrap = card.querySelector(".status-chips-wrap");
        let doneChip = card.querySelector(".chip-done");
        if (isDone && !doneChip && chipsWrap) {
          const chip = document.createElement("span");
          chip.className = "status-chip chip-done";
          chip.title = "Completed";
          chip.textContent = "DONE";
          chipsWrap.appendChild(chip);
        } else if (!isDone && doneChip) {
          doneChip.remove();
        }
      });
      updateLivePreview();
      return;
    }

    const esc = window.escapeHtml || (s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g, '&#39;'));

    listContainer.innerHTML = reports.map((r) => {
      const isDone = !!r.done;
      const isSelected = !!r.selected;
      const isLinked = !!edr.isReportInAudit(r.id);
      const hasRealImage = !!(r.screenshotData && r.screenshotData.trim().length > 10);
      const hasRemoteOnly = !hasRealImage && !!r.screenshotFileId;
      const hasShot = hasRealImage || hasRemoteOnly;
      const formattedDate = formatDisplayDate(r.date);
      const lastEditedText = r.updatedAt ? formatLastEdited(r.updatedAt) : "";

      // Status chips: SS, DONE, DOCS (no IN AUDIT status badge)
      const chips = [];
      if (hasShot) {
        chips.push('<span class="status-chip chip-ss" title="Screenshot attached">SS</span>');
      }
      if (isDone) {
        chips.push('<span class="status-chip chip-done" title="Completed">DONE</span>');
      }
      if (hasRemoteOnly || r.docsSynced) {
        chips.push('<span class="status-chip chip-docs" title="Synced to Google Docs">DOCS</span>');
      }
      const chipsHtml = chips.length ? `<span class="status-chips-wrap">${chips.join('')}</span>` : '';

      return `
        <div class="record-row ${isSelected ? 'is-selected' : ''} ${isDone ? 'is-done' : ''}" data-id="${esc(r.id)}" data-updated-at="${esc(r.updatedAt || '')}">
          <label class="record-select-col" style="cursor:pointer;" title="Select record">
            <input type="checkbox" class="edr-check" data-id="${esc(r.id)}" ${isSelected ? 'checked' : ''} style="cursor:pointer;">
          </label>

          <div class="record-info">
            <div class="record-main-line">
              <span class="record-date">${esc(formattedDate)}</span>
              <span class="record-sep">Â·</span>
              <span class="record-site" title="${esc(r.site || 'Site')}">${esc(r.site || 'Site')}</span>
              ${chipsHtml}
            </div>
            <div class="record-sub-line">
              <span class="record-campaign" title="${esc(r.account || 'General')}">${esc(r.account || 'General')}</span>
              <span class="record-sep">Â·</span>
              <span class="record-resp" title="${esc(r.supervisorRole || 'TL')}: ${esc(r.supervisorName || 'N/A')}">
                <span class="sub-label">${esc(r.supervisorRole || 'TL')}:</span> <strong>${esc(r.supervisorName || 'N/A')}</strong>
              </span>
              ${r.subjectName ? `
                <span class="record-sep">Â·</span>
                <span class="record-subj" title="Subject: ${esc(r.subjectName)}"><span class="sub-label">Subj:</span> ${esc(r.subjectName)}</span>
              ` : ''}
              ${lastEditedText ? `
                <span class="record-sep">Â·</span>
                <span class="record-last-edited" title="${esc(lastEditedText)}">${esc(lastEditedText)}</span>
              ` : ''}
            </div>
          </div>

          <div class="record-actions">
            ${hasShot ? `
              <button type="button" class="btn-action btn-shot-view" title="View CCTV screenshot">View SS</button>
            ` : `
              <button type="button" class="btn-action btn-shot-add" title="Add screenshot">Add SS</button>
            `}
            <button type="button" class="btn-action btn-audit-send" title="Send to CCTV Audit">
              <span class="label-long">Send to Audit</span>
              <span class="label-short">Audit</span>
            </button>
            <button type="button" class="btn-action btn-done-toggle ${isDone ? 'is-done-btn' : ''}" title="${isDone ? 'Reopen EDR' : 'Mark as Done'}">
              ${isDone ? 'Reopen' : 'Done'}
            </button>
            <button type="button" class="btn-action btn-edit" title="Edit EDR">Edit</button>

            <!-- Compact More Menu for Screenshot & Deletion Actions -->
            <div class="record-more-menu-wrap">
              <button type="button" class="btn-action btn-more-trigger" title="More options">â‹¯</button>
              <div class="record-dropdown-menu">
                ${hasShot ? `
                  <button type="button" class="dropdown-item btn-action-copy btn-shot-copy">
                    <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>Copy SS</span>
                  </button>
                  <button type="button" class="dropdown-item btn-action-replace btn-shot-replace">
                    <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span>Replace SS</span>
                  </button>
                  <button type="button" class="dropdown-item btn-action-remove btn-shot-remove text-danger">
                    <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>Remove SS</span>
                  </button>
                  <div class="dropdown-divider"></div>
                ` : ''}
                <button type="button" class="dropdown-item btn-action-delete btn-delete text-danger">
                  <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  <span>Delete EDR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Attach Event Listeners to Cards
    listContainer.querySelectorAll(".record-row").forEach(card => {
      const id = card.dataset.id;
      const report = reports.find(r => r.id === id);
      if (!report) return;

      const chk = card.querySelector(".edr-check");
      if (chk) {
        const handleToggle = (e) => {
          e.stopPropagation();
          edr.toggleSelect(id, chk.checked);
          card.classList.toggle("is-selected", chk.checked);
          updateLivePreview();
        };
        chk.addEventListener("change", handleToggle);
      }

      // View SS
      const triggerView = async () => {
        if (!report.screenshotData && report.screenshotFileId) {
          showToast("Loading remote screenshot...", "info");
          await edr.ensureRemoteScreenshot(report);
        }
        if (window.openFullScreenshotViewer) {
          window.openFullScreenshotViewer(
            report.screenshotData,
            `${report.site || 'Site'} Â· ${report.account || 'EDR'}`,
            `Observed: ${report.date || ''} ${report.timeObserved || ''} Â· Supervisor: ${report.supervisorName || 'N/A'}`
          );
        } else {
          openScreenshotViewer(
            report.screenshotData,
            `${report.site || 'Site'} Â· ${report.account || 'EDR'}`,
            `Observed: ${report.date || ''} ${report.timeObserved || ''} Â· Supervisor: ${report.supervisorName || 'N/A'}`
          );
        }
      };

      // Add / Replace SS
      const triggerAddReplace = () => {
        const picker = document.createElement("input");
        picker.type = "file";
        picker.accept = "image/*";
        picker.onchange = async () => {
          const file = picker.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (evt) => {
            const dataUrl = evt.target.result;
            try {
              await edr.attachScreenshotToReport(id, dataUrl);
              showToast("Screenshot attached to saved EDR.", "success");
            } catch (err) {
              showToast(err.message || "Failed to attach screenshot.", "error");
            }
          };
          reader.readAsDataURL(file);
        };
        picker.click();
      };

      card.querySelector(".btn-shot-view")?.addEventListener("click", triggerView);
      card.querySelector(".btn-shot-add")?.addEventListener("click", triggerAddReplace);

      // Copy SS (in More menu)
      card.querySelector(".btn-shot-copy")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        closeMoreMenu(moreMenu);
        try {
          await edr.copyScreenshot(report);
          showToast("CCTV screenshot copied to clipboard as PNG image.", "success");
        } catch (err) {
          showToast(err.message || "Failed to copy screenshot.", "error");
        }
      });

      card.querySelector(".btn-audit-send")?.addEventListener("click", () => {
        sendSingleReportToAudit(report);
      });

      card.querySelector(".btn-done-toggle")?.addEventListener("click", () => {
        edr.toggleDone(id);
      });

      card.querySelector(".btn-edit")?.addEventListener("click", () => {
        populateFormForEdit(report);
      });

      // More Menu Toggle
      const moreBtn = card.querySelector(".btn-more-trigger");
      const moreMenu = card.querySelector(".record-dropdown-menu");
      moreBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = moreMenu?.classList.contains("is-open");
        document.querySelectorAll(".record-dropdown-menu.is-open").forEach(closeMoreMenu);
        if (!isOpen && moreMenu) {
          openMoreMenu(moreMenu, moreBtn, moreMenu.parentElement);
        }
      });

      // Replace SS (in More menu)
      card.querySelector(".btn-action-replace")?.addEventListener("click", (e) => {
        e.stopPropagation();
        closeMoreMenu(moreMenu);
        triggerAddReplace();
      });

      // Remove SS (in More menu)
      card.querySelector(".btn-action-remove")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        closeMoreMenu(moreMenu);
        const ok = await window.appConfirm({
          title: "Remove Screenshot",
          message: "Remove CCTV screenshot evidence from this saved EDR?",
          confirmText: "Remove Screenshot",
          tone: "danger"
        });
        if (ok) {
          await edr.removeScreenshotFromReport(id);
          showToast("CCTV screenshot removed.", "info");
        }
      });

      // Delete EDR (in More menu)
      card.querySelector(".btn-action-delete")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        closeMoreMenu(moreMenu);
        const ok = await window.appConfirm({
          title: "Delete EDR Record",
          message: `Permanently delete EDR record for ${report.subjectName || 'this employee'}?`,
          confirmText: "Delete Record",
          tone: "danger"
        });
        if (ok) {
          edr.deleteReport(id);
          showToast("EDR record deleted.", "info");
        }
      });
    });

    // Global listener for closing dropdowns on outside click
    if (!window._edrMoreMenuGlobalBound) {
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".record-more-menu-wrap") && !e.target.closest(".record-dropdown-menu")) {
          document.querySelectorAll(".record-dropdown-menu.is-open").forEach(closeMoreMenu);
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          document.querySelectorAll(".record-dropdown-menu.is-open").forEach(closeMoreMenu);
        }
      });
      window._edrMoreMenuGlobalBound = true;
    }

    updateLivePreview();
  }

  // Edit Mode
  function populateFormForEdit(report) {
    edr.setEditingId(report.id);
    el("edrSite").value = report.site || "";
    el("edrDate").value = report.date || "";
    el("edrTimeObserved").value = report.timeObserved || report.timeStart || "";

    supervisorRole = report.supervisorRole || "Team Leader";
    if (supervisorRole === "OM") {
      el("btnRoleOm").classList.add("active");
      el("btnRoleTl").classList.remove("active");
      populateRespondentList("OM");
    } else {
      el("btnRoleTl").classList.add("active");
      el("btnRoleOm").classList.remove("active");
      populateRespondentList("Team Leader");
    }
    el("edrSupervisorName").value = report.supervisorName || "";
    el("edrOmName").value = report.omName || "";

    subjectType = report.subjectType || "Agent/s";
    if (subjectType === "Team Leader") {
      el("btnSubjTl").classList.add("active");
      el("btnSubjAgent").classList.remove("active");
      el("edrSubjectName").placeholder = "Search Team Leader...";
      el("edrSubjectName").setAttribute("list", "listSubjectTls");
    } else {
      el("btnSubjAgent").classList.add("active");
      el("btnSubjTl").classList.remove("active");
      el("edrSubjectName").placeholder = "Employee name...";
      el("edrSubjectName").removeAttribute("list");
    }
    el("edrSubjectName").value = report.subjectName || "";
    el("edrAccount").value = report.account || "";
    el("edrIncident").value = report.incident || "";
    el("edrActionRemarks").value = report.action || "";
    el("edrClipLink").value = report.clipLink || "";

    if (window.setCctvScreenshot) {
      window.setCctvScreenshot(report.screenshotData || "");
    }

    el("edrFormTitle").textContent = "Update EDR";
    el("btnEdrSubmitText").textContent = "Update EDR";
    el("btnEdrCancelEdit").style.display = "inline-flex";
  }

  function resetForm() {
    edr.setEditingId(null);
    el("edrForm").reset();
    supervisorRole = "Team Leader";
    el("btnRoleTl").classList.add("active");
    el("btnRoleOm").classList.remove("active");
    subjectType = "Agent/s";
    el("btnSubjAgent").classList.add("active");
    el("btnSubjTl").classList.remove("active");
    el("edrSubjectName").placeholder = "Employee name...";
    el("edrSubjectName").removeAttribute("list");
    initFormDropdowns();
    if (window.setCctvScreenshot) window.setCctvScreenshot("");
    el("edrFormTitle").textContent = "Manual EDR Entry";
    el("btnEdrSubmitText").textContent = "Save EDR";
    el("btnEdrCancelEdit").style.display = "none";
    edr.clearDraftForm().catch(() => {});
  }

  // Draft Autosave & Restore
  let draftTimer = null;
  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const editing = edr.getEditingReport();
      if (!editing) {
        edr.saveDraftForm(getFormData());
      }
    }, 500);
  }

  function restoreDraftForm() {
    const draft = edr.getDraftForm();
    if (!draft) return;
    if (!draft.incident && !draft.subjectName && !draft.account && !draft.screenshotData) return;

    if (draft.site && el("edrSite")) el("edrSite").value = draft.site;
    if (draft.date && el("edrDate")) el("edrDate").value = draft.date;
    if (draft.timeObserved && el("edrTimeObserved")) el("edrTimeObserved").value = draft.timeObserved;

    supervisorRole = draft.supervisorRole === "OM" ? "OM" : "Team Leader";
    if (supervisorRole === "OM") {
      el("btnRoleOm")?.classList.add("active");
      el("btnRoleTl")?.classList.remove("active");
    } else {
      el("btnRoleTl")?.classList.add("active");
      el("btnRoleOm")?.classList.remove("active");
    }
    populateRespondentList(supervisorRole);
    if (draft.supervisorName && el("edrSupervisorName")) el("edrSupervisorName").value = draft.supervisorName;
    if (draft.omName && el("edrOmName")) el("edrOmName").value = draft.omName;

    subjectType = draft.subjectType === "Team Leader" ? "Team Leader" : "Agent/s";
    if (subjectType === "Team Leader") {
      el("btnSubjTl")?.classList.add("active");
      el("btnSubjAgent")?.classList.remove("active");
      el("edrSubjectName")?.setAttribute("list", "listSubjectTls");
    } else {
      el("btnSubjAgent")?.classList.add("active");
      el("btnSubjTl")?.classList.remove("active");
      el("edrSubjectName")?.removeAttribute("list");
    }
    if (draft.subjectName && el("edrSubjectName")) el("edrSubjectName").value = draft.subjectName;
    if (draft.account && el("edrAccount")) el("edrAccount").value = draft.account;
    if (draft.incident && el("edrIncident")) el("edrIncident").value = draft.incident;
    if (draft.action && el("edrActionRemarks")) el("edrActionRemarks").value = draft.action;
    if (draft.clipLink && el("edrClipLink")) el("edrClipLink").value = draft.clipLink;
    if (draft.screenshotData && window.setCctvScreenshot) {
      window.setCctvScreenshot(draft.screenshotData);
    }
  }

  // Update Live Preview in Column 3 â€” uses rich HTML so screenshots are visible
  function updateLivePreview() {
    const previewBox = el("edrPreviewBox");
    if (!previewBox) return;
    const fbText = el("edrFacebookText")?.value || "";
    const html = edr.buildPreviewHtml(fbText);
    previewBox.innerHTML = html;
  }

  function closeMoreMenu(menu) {
    if (!menu) return;
    menu.classList.remove("is-open");
    const owner = menu._edrMenuOwner;
    if (owner && menu.parentElement !== owner) owner.appendChild(menu);
    menu._edrMenuOwner = null;
    menu.style.position = "";
    menu.style.left = "";
    menu.style.top = "";
    menu.style.right = "";
    menu.style.zIndex = "";
  }

  function openMoreMenu(menu, trigger, owner) {
    if (!menu || !trigger || !owner) return;
    menu._edrMenuOwner = owner;
    document.body.appendChild(menu);
    menu.classList.add("is-open");
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 4;
    const openUpward = triggerRect.bottom + gap + menuRect.height > window.innerHeight;
    const left = Math.max(4, Math.min(triggerRect.right - menuRect.width, window.innerWidth - menuRect.width - 4));
    const top = openUpward
      ? Math.max(4, triggerRect.top - menuRect.height - gap)
      : Math.min(window.innerHeight - menuRect.height - 4, triggerRect.bottom + gap);
    menu.style.position = "fixed";
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.right = "auto";
    menu.style.zIndex = "10000";
  }

  function getFormData() {
    return {
      site: el("edrSite").value,
      date: el("edrDate").value,
      timeObserved: el("edrTimeObserved").value,
      timeStart: el("edrTimeObserved").value,
      supervisorRole: supervisorRole,
      supervisorName: el("edrSupervisorName").value,
      omName: el("edrOmName").value,
      subjectType: subjectType,
      subjectName: el("edrSubjectName").value,
      account: el("edrAccount").value,
      incident: el("edrIncident").value,
      action: el("edrActionRemarks").value,
      clipLink: el("edrClipLink").value,
      screenshotData: currentScreenshot
    };
  }

  async function sendSingleReportToAudit(report) {
    if (!report) {
      showToast("No EDR report specified.", "error");
      return;
    }
    try {
      const result = edr.sendReportToAudit(report);
      renderEdrList(edr.getReports());
      if (typeof renderAuditTable === "function") {
        renderAuditTable();
      }

      if (result.action === "created") {
        showToast(
          "Added to CCTV Audit Data Output Grid. NOC starts as Pending; Remarks can be edited anytime.",
          "success"
        );
      } else {
        showToast(
          "CCTV Audit Data Output Grid entry updated. Existing NOC and Remarks were kept.",
          "info"
        );
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Could not send EDR to CCTV Audit.", "error");
    }
  }

  async function sendSelectedReportsToAudit(selectedReports) {
    const reports = Array.isArray(selectedReports) ? selectedReports : [selectedReports];
    if (!reports.length) {
      showToast("Select at least one EDR to send to CCTV Audit.", "warning");
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const rep of reports) {
      try {
        const res = edr.sendReportToAudit(rep);
        if (res && res.action === "created") createdCount++;
        else updatedCount++;
      } catch (err) {
        console.error("sendReportToAudit error for EDR:", rep.id, err);
      }
    }

    renderEdrList(edr.getReports());
    if (typeof renderAuditTable === "function") {
      renderAuditTable();
    }

    if (createdCount > 0 && updatedCount > 0) {
      showToast(`Sent ${createdCount} EDR(s) to CCTV Audit (${updatedCount} updated).`, "success");
    } else if (createdCount > 0) {
      showToast(`Sent ${createdCount} EDR(s) to CCTV Audit. NOC starts as Pending.`, "success");
    } else if (updatedCount > 0) {
      showToast(`Updated ${updatedCount} existing record(s) in CCTV Audit.`, "info");
    } else {
      showToast("Selected EDRs processed for CCTV Audit.", "info");
    }
  }

  async function sendSingleReportToDocs(report) {
    if (!report) {
      showToast("No EDR report specified.", "error");
      return;
    }
    const docsUrl = edr.getDocsUrl();
    if (!docsUrl) {
      el("modalDocsSetup").hidden = false;
      showToast("Connect Google Docs first to sync reports.", "info");
      return;
    }
    try {
      const res = await edr.syncToGoogleDocs(report);
      if (res && res.success) {
        showToast("EDR sent to Google Docs successfully.", "success");
      } else {
        showToast(res?.reason || "Failed to send to Google Docs.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to sync to Google Docs.", "error");
    }
  }

  // Initialize UI Events
  function initEvents() {
    // Form submit
    el("edrForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = getFormData();
      await edr.createOrUpdate(data);
      resetForm();
      showToast("EDR saved successfully.", "success");
    });

    el("btnEdrClear")?.addEventListener("click", resetForm);
    el("btnEdrCancelEdit")?.addEventListener("click", resetForm);

    // Send to Google Docs (From Left Column Form Footer)
    el("btnSendFormToDocs")?.addEventListener("click", async () => {
      const editing = edr.getEditingReport();
      if (editing) {
        const data = getFormData();
        const updated = await edr.createOrUpdate(data);
        resetForm();
        await sendSingleReportToDocs(updated || editing);
        return;
      }

      const form = el("edrForm");
      if (el("edrIncident")?.value || el("edrSubjectName")?.value || el("edrSupervisorName")?.value) {
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        const data = getFormData();
        const saved = await edr.createOrUpdate(data);
        resetForm();
        if (saved) {
          await sendSingleReportToDocs(saved);
        }
        return;
      }

      const selected = edr.getReports().filter(r => r.selected && !r.done);
      if (selected.length === 1) {
        await sendSingleReportToDocs(selected[0]);
        return;
      }
      if (selected.length > 1) {
        showToast("Please select only ONE EDR to send to Google Docs.", "warning");
        return;
      }

      showToast("Complete the EDR form or select a saved record from the list.", "info");
    });

    // Send to CCTV Audit (From Left Column Form Footer)
    el("btnSendFormToAudit")?.addEventListener("click", async () => {
      const editing = edr.getEditingReport();
      if (editing) {
        const data = getFormData();
        const updated = await edr.createOrUpdate(data);
        resetForm();
        await sendSingleReportToAudit(updated || editing);
        return;
      }

      const form = el("edrForm");
      if (el("edrIncident")?.value || el("edrSubjectName")?.value || el("edrSupervisorName")?.value) {
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        const data = getFormData();
        const saved = await edr.createOrUpdate(data);
        resetForm();
        if (saved) {
          await sendSingleReportToAudit(saved);
        }
        return;
      }

      const selected = edr.getReports().filter(r => r.selected && !r.done);
      if (selected.length >= 1) {
        await sendSelectedReportsToAudit(selected);
        return;
      }

      showToast("Complete the EDR form or select at least one saved record from the list.", "info");
    });

    // Send to Google Docs (From Right Column Teams Dispatch Header)
    el("btnSendSelectedToDocs")?.addEventListener("click", async () => {
      const selected = edr.getReports().filter(r => r.selected && !r.done);
      if (selected.length === 1) {
        await sendSingleReportToDocs(selected[0]);
        return;
      }
      if (selected.length > 1) {
        showToast("Please select only ONE EDR to send to Google Docs.", "warning");
        return;
      }

      const editing = edr.getEditingReport();
      if (editing) {
        await sendSingleReportToDocs(editing);
        return;
      }

      showToast("Select one EDR from the saved list to send to Google Docs.", "info");
    });

    // Send to CCTV Audit (From Right Column Teams Dispatch Header)
    el("btnSendSelectedToAudit")?.addEventListener("click", async () => {
      const selected = edr.getReports().filter(r => r.selected && !r.done);
      if (selected.length >= 1) {
        await sendSelectedReportsToAudit(selected);
        return;
      }

      const editing = edr.getEditingReport();
      if (editing) {
        await sendSelectedReportsToAudit([editing]);
        return;
      }

      showToast("Select at least one EDR from the saved list to send to CCTV Audit.", "info");
    });

    // Select all / Clear selection
    el("btnSelectAll")?.addEventListener("click", () => edr.selectAll(true));
    el("btnUnselectAll")?.addEventListener("click", () => edr.selectAll(false));

    // Bulk Delete Selected Saved EDRs
    el("btnDeleteSelectedEdr")?.addEventListener("click", async () => {
      const reports = edr.getReports() || [];
      const selected = reports.filter(r => r.selected);
      const count = selected.length;
      if (!count) return;

      const confirmed = await window.appConfirm({
        title: "Delete Selected Saved EDRs?",
        message: `Are you sure you want to permanently delete the ${count} selected Saved EDR${count === 1 ? '' : 's'}? This action cannot be undone.`,
        confirmText: `Delete ${count === 1 ? 'EDR' : count + ' EDRs'}`,
        cancelText: "Cancel",
        tone: "danger"
      });

      if (!confirmed) return;

      const deletedCount = await edr.deleteSelectedReports();
      showToast(`${deletedCount} Saved EDR${deletedCount === 1 ? '' : 's'} deleted.`, "success");
    });

    // Facebook textarea input
    el("edrFacebookText")?.addEventListener("input", updateLivePreview);

    // Copy All Teams Button
    el("btnCopyAllTeams")?.addEventListener("click", async () => {
      try {
        const fb = el("edrFacebookText")?.value || "";
        const res = await edr.copyAllToTeams(fb);
        const imageText = res.inlineScreenshotCount
          ? ` with ${res.inlineScreenshotCount} inline screenshot${res.inlineScreenshotCount === 1 ? "" : "s"}`
          : "";
        showToast(`Copied ${res.count} complete EDR report(s)${imageText} for Teams.`, "success");
      } catch (err) {
        showToast(err.message || "Failed to copy.", "error");
      }
    });

    // Expand / Collapse Teams Dispatch Review Mode
    function setDispatchExpanded(expanded) {
      const layout = document.querySelector("#paneEdr .edr-split-layout");
      if (!layout) return;
      if (expanded) {
        layout.classList.add("dispatch-expanded");
      } else {
        layout.classList.remove("dispatch-expanded");
      }
      const isExpanded = layout.classList.contains("dispatch-expanded");
      const btn = el("btnToggleDispatchExpand");
      const label = el("labelDispatchExpand");
      const icon = el("iconDispatchExpand");
      if (label) label.textContent = isExpanded ? "Collapse Review" : "Expand Review";
      if (btn) {
        btn.classList.toggle("btn-active", isExpanded);
        btn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
        btn.title = isExpanded ? "Restore standard split view" : "Expand review for inspection";
      }
      if (icon) {
        if (isExpanded) {
          icon.innerHTML = '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
        } else {
          icon.innerHTML = '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
        }
      }
    }
    window.setDispatchExpanded = setDispatchExpanded;

    el("btnToggleDispatchExpand")?.addEventListener("click", () => {
      const layout = document.querySelector("#paneEdr .edr-split-layout");
      if (!layout) return;
      setDispatchExpanded(!layout.classList.contains("dispatch-expanded"));
    });

    // Reload Saved EDRs from Google Docs
    el("btnReloadDocs")?.addEventListener("click", async () => {
      const btn = el("btnReloadDocs");
      try {
        window.setButtonBusy(btn, true, "Reloading...");
        window.setGlobalProgress(true);
        showToast("Loading saved EDRs from Google Docs...", "info");
        const res = await edr.loadSavedEdrsFromDocs();
        showToast(`Loaded ${res.count} saved EDR(s) from Google Docs.`, "success");
      } catch (err) {
        showToast(err.message || "Failed to load from Google Docs.", "error");
      } finally {
        window.setButtonBusy(btn, false);
        window.setGlobalProgress(false);
      }
    });

    // Option Management - Respondent (TL/OM)
    el("btnAddSupervisorOption")?.addEventListener("click", () => {
      const curr = el("edrSupervisorName")?.value.trim();
      const val = prompt(`Add new ${supervisorRole} to masterlist:`, curr);
      if (val && val.trim()) {
        const added = edr.addSupervisorOption(supervisorRole, val.trim());
        initFormDropdowns();
        populateRespondentList(supervisorRole);
        el("edrSupervisorName").value = val.trim();
        showToast(added ? `Added "${val.trim()}" to ${supervisorRole} list.` : `"${val.trim()}" is already in list.`, added ? "success" : "info");
      }
    });

    el("btnRemoveSupervisorOption")?.addEventListener("click", () => {
      const curr = el("edrSupervisorName")?.value.trim();
      if (!curr) {
        showToast(`Select or type a ${supervisorRole} name to remove.`, "info");
        return;
      }
      if (confirm(`Remove "${curr}" from the ${supervisorRole} masterlist?`)) {
        edr.removeSupervisorOption(supervisorRole, curr);
        initFormDropdowns();
        populateRespondentList(supervisorRole);
        el("edrSupervisorName").value = "";
        showToast(`Removed "${curr}" from ${supervisorRole} list.`, "info");
      }
    });

    // Option Management - Account / Campaign
    el("btnAddAccountOption")?.addEventListener("click", () => {
      const curr = el("edrAccount")?.value.trim();
      const val = prompt("Add new Account / Campaign to masterlist:", curr);
      if (val && val.trim()) {
        const added = edr.addAccountOption(val.trim());
        initFormDropdowns();
        el("edrAccount").value = val.trim();
        showToast(added ? `Added "${val.trim()}" to Campaign list.` : `"${val.trim()}" is already in list.`, added ? "success" : "info");
      }
    });

    el("btnRemoveAccountOption")?.addEventListener("click", () => {
      const curr = el("edrAccount")?.value.trim();
      if (!curr) {
        showToast("Select or type an Account / Campaign to remove.", "info");
        return;
      }
      if (confirm(`Remove "${curr}" from the Campaign masterlist?`)) {
        edr.removeAccountOption(curr);
        initFormDropdowns();
        el("edrAccount").value = "";
        showToast(`Removed "${curr}" from Campaign list.`, "info");
      }
    });

    // Modal Screenshot Viewer Events
    el("btnCloseScreenshotViewer")?.addEventListener("click", closeScreenshotViewer);
    el("btnViewerCloseBottom")?.addEventListener("click", closeScreenshotViewer);
    el("modalScreenshotViewer")?.addEventListener("click", (e) => {
      if (e.target === el("modalScreenshotViewer")) closeScreenshotViewer();
    });
    el("btnViewerCopyScreenshot")?.addEventListener("click", async () => {
      const img = el("screenshotViewerImg");
      if (img && img.src) {
        try {
          await edr.copyScreenshot(img.src);
          showToast("CCTV screenshot copied to clipboard as PNG image.", "success");
        } catch (err) {
          showToast(err.message || "Failed to copy screenshot.", "error");
        }
      }
    });

    // Google Docs Dialog Setup
    el("btnOpenDocsSetup")?.addEventListener("click", () => {
      el("inputDocsUrl").value = edr.getDocsUrl();
      el("modalDocsSetup").hidden = false;
    });

    el("btnCloseDocsSetup")?.addEventListener("click", () => {
      el("modalDocsSetup").hidden = true;
    });

    el("btnCancelDocsSetup")?.addEventListener("click", () => {
      el("modalDocsSetup").hidden = true;
    });

    el("btnTestDocsSetup")?.addEventListener("click", async () => {
      const url = el("inputDocsUrl")?.value;
      try {
        showToast("Testing Google Docs connection...", "info");
        const res = await edr.testDocsConnection(url);
        showToast(`Connected to "${res.documentName || "EDR Google Doc"}".`, "success");
        el("edrDocsUrlHint").textContent = `Connected: ${res.documentName || "EDR Doc"}`;
        el("edrDocsUrlHint").className = "docs-url-hint valid";
      } catch (err) {
        showToast(err.message || "Connection test failed.", "error");
        el("edrDocsUrlHint").textContent = err.message || "Connection test failed.";
        el("edrDocsUrlHint").className = "docs-url-hint invalid";
      }
    });

    el("btnClearDocsSetup")?.addEventListener("click", () => {
      edr.clearDocsUrl();
      el("inputDocsUrl").value = "";
      el("modalDocsSetup").hidden = true;
      if (el("edrDocsStatusText")) el("edrDocsStatusText").textContent = "Local Storage";
      el("edrDocsUrlHint").textContent = "URL must end in /exec.";
      el("edrDocsUrlHint").className = "docs-url-hint";
      updateIntegrationStatusPills();
      showToast("Google Docs connection disconnected.", "info");
    });

    el("btnSaveDocsSetup")?.addEventListener("click", async () => {
      const url = el("inputDocsUrl").value.trim();
      if (!edr.isValidDocsUrl(url)) {
        showToast("Invalid Web App URL. Must end in /exec.", "error");
        return;
      }
      try {
        showToast("Testing and connecting...", "info");
        const testRes = await edr.testDocsConnection(url);
        edr.setDocsUrl(url);
        el("modalDocsSetup").hidden = true;
        if (el("edrDocsStatusText")) el("edrDocsStatusText").textContent = "Docs Connected";
        updateIntegrationStatusPills();
        showToast(`Connected to "${testRes.documentName || "EDR Doc"}". Loading saved EDRs...`, "success");
        await edr.loadSavedEdrsFromDocs();
      } catch (err) {
        showToast(`Connection failed: ${err.message}`, "error");
      }
    });

    // Form inputs: attach autosave
    [
      "edrSite",
      "edrDate",
      "edrTimeObserved",
      "edrSupervisorName",
      "edrOmName",
      "edrSubjectName",
      "edrAccount",
      "edrIncident",
      "edrActionRemarks",
      "edrClipLink"
    ].forEach(id => {
      el(id)?.addEventListener("input", scheduleDraftSave);
      el(id)?.addEventListener("change", scheduleDraftSave);
    });

    // Auth Modal
    el("btnUserMenu")?.addEventListener("click", () => {
      el("modalAuth").hidden = false;
    });
    el("btnCloseAuth")?.addEventListener("click", () => {
      el("modalAuth").hidden = true;
    });

    el("formSignIn")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = el("loginUser").value;
      const p = el("loginPass").value;
      try {
        await auth.signIn(u, p);
        el("modalAuth").hidden = true;
        showToast(`Signed in as ${u}`, "success");
      } catch (err) {
        el("authErrorMsg").style.display = "block";
        el("authErrorMsg").textContent = err.message || "Sign in failed";
      }
    });
  }

  // =========================================================================
  // WORKSPACE NAVIGATION SYSTEM
  // =========================================================================
  let currentWorkspace = "edr";

  const WORKSPACES = {
    report: {
      tabId: "tabCctvReport",
      paneId: "paneCctvReport",
      title: "CCTV Report",
      subtitle: ""
    },
    conduct: {
      tabId: "tabConduct",
      paneId: "paneConduct",
      title: "Code of Conduct",
      subtitle: ""
    },
    edr: {
      tabId: "tabEdr",
      paneId: "paneEdr",
      title: "End of the Day Report",
      subtitle: ""
    },
    audit: {
      tabId: "tabAudit",
      paneId: "paneAudit",
      title: "CCTV Audit",
      subtitle: ""
    },
    trackers: {
      tabId: "tabTrackers",
      paneId: "paneTrackers",
      title: "Trackers",
      subtitle: ""
    },
    hris: {
      tabId: "tabHris",
      paneId: "paneHris",
      title: "HRIS",
      subtitle: ""
    },
    sorter: {
      tabId: "tabSorter",
      paneId: "paneSorter",
      title: "AI Sorter",
      subtitle: ""
    },
    maintenance: {
      tabId: "tabMaintenance",
      paneId: "paneMaintenance",
      title: "Maintenance",
      subtitle: ""
    },
    followup: {
      tabId: "tabFollowup",
      paneId: "paneFollowup",
      title: "Follow Up Reports",
      subtitle: ""
    },
    pending: {
      tabId: "tabPending",
      paneId: "panePending",
      title: "Pending Reports",
      subtitle: ""
    },
    masterlist: {
      tabId: "tabMasterlist",
      paneId: "paneMasterlist",
      title: "Masterlist",
      subtitle: ""
    },
    history: {
      tabId: "tabHistory",
      paneId: "paneHistory",
      title: "Activity History",
      subtitle: ""
    },
    accounts: {
      tabId: "tabAccounts",
      paneId: "paneAccounts",
      title: "Account Management",
      subtitle: ""
    }
  };

  function switchWorkspace(targetKey) {
    if (!WORKSPACES[targetKey]) return;
    if (auth && typeof auth.canAccessWorkspace === "function" && !auth.canAccessWorkspace(targetKey)) {
      showToast("Access restricted: You do not have permission to access this workspace.", "warning");
      return;
    }
    currentWorkspace = targetKey;

    // Update nav rail buttons
    Object.entries(WORKSPACES).forEach(([key, ws]) => {
      const tabBtn = el(ws.tabId);
      const paneEl = el(ws.paneId);
      const isActive = key === targetKey;

      if (tabBtn) {
        tabBtn.classList.toggle("active", isActive);
        tabBtn.setAttribute("aria-selected", isActive ? "true" : "false");
      }
      if (paneEl) {
        paneEl.hidden = !isActive;
        paneEl.classList.toggle("active", isActive);
      }
    });

    // Close mobile navigation drawer if open
    el("navRail")?.classList.remove("mobile-open");
    el("navRailBackdrop")?.classList.remove("is-visible");

    // Update topbar titles
    const titleEl = document.querySelector(".workspace-main-title");
    const subBadge = document.querySelector(".workspace-title-wrap .badge");
    if (titleEl) titleEl.textContent = WORKSPACES[targetKey].title;
    if (subBadge) {
      const sub = WORKSPACES[targetKey].subtitle || "";
      subBadge.textContent = sub;
      subBadge.style.display = sub ? "inline-flex" : "none";
    }

    // Activate hooks
    if (targetKey === "edr") {
      // Cleanly ensure EDR is ready in standard view
    } else {
      if (typeof window.setDispatchExpanded === "function") {
        window.setDispatchExpanded(false);
      }
    }

    if (targetKey === "audit") {
      renderAuditTable();
      renderGuardStatus();
    } else if (targetKey === "trackers") {
      renderTrackersWorkspace();
    } else if (targetKey === "sorter") {
      renderSorterWorkspace();
    } else if (targetKey === "maintenance") {
      renderMaintenanceWorkspace();
    } else if (targetKey === "pending") {
      renderPendingWorkspace();
    } else if (targetKey === "followup") {
      renderFollowupWorkspace();
    } else if (targetKey === "report") {
      renderCctvReportWorkspace();
    } else if (targetKey === "conduct") {
      renderCodeOfConductWorkspace();
    } else if (targetKey === "masterlist") {
      renderMasterlistWorkspace();
    } else if (targetKey === "history") {
      renderHistoryWorkspace();
    } else if (targetKey === "accounts") {
      if (typeof window._renderAccountsWorkspaceFn === 'function') {
        window._renderAccountsWorkspaceFn();
      }
    }
  }

  window.switchWorkspace = switchWorkspace;

  function initWorkspaceNavigation() {
    Object.keys(WORKSPACES).forEach(wsKey => {
      const btn = el(WORKSPACES[wsKey].tabId);
      if (btn) {
        btn.addEventListener("click", () => switchWorkspace(wsKey));
      }
    });

    // Mobile nav hamburger toggle
    el("btnMobileNavToggle")?.addEventListener("click", () => {
      const rail = el("navRail");
      const backdrop = el("navRailBackdrop");
      if (!rail) return;
      const isOpen = rail.classList.toggle("mobile-open");
      backdrop?.classList.toggle("is-visible", isOpen);
    });

    // Tap backdrop to close mobile drawer
    el("navRailBackdrop")?.addEventListener("click", () => {
      el("navRail")?.classList.remove("mobile-open");
      el("navRailBackdrop")?.classList.remove("is-visible");
    });

    function isRailVisuallyCollapsed() {
      const rail = el("navRail");
      if (!rail) return false;
      if (rail.classList.contains("collapsed")) return true;
      if (window.innerWidth >= 768 && window.innerWidth <= 1023 && !rail.classList.contains("user-expanded")) {
        return true;
      }
      return false;
    }

    function updateRailToggleState(isCollapsed) {
      const btn = el("btnToggleRail");
      if (!btn) return;
      const labelText = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
      btn.title = labelText;
      btn.setAttribute("data-tooltip", labelText);
      btn.setAttribute("aria-label", labelText);
      const icon = btn.querySelector(".collapse-btn-icon");
      if (icon) {
        icon.innerHTML = isCollapsed
          ? '<polyline points="9 18 15 12 9 6"></polyline>'
          : '<polyline points="15 18 9 12 15 6"></polyline>';
      }
      const textSpan = btn.querySelector(".collapse-btn-text");
      if (textSpan) {
        textSpan.textContent = isCollapsed ? "Expand" : "Collapse";
      }
    }
    window.updateRailToggleState = updateRailToggleState;

    // Keep toggle button label in sync with viewport changes under zoom or resize
    window.addEventListener("resize", () => {
      updateRailToggleState(isRailVisuallyCollapsed());
    });

    // Rail collapse toggle (desktop & tablet)
    el("btnToggleRail")?.addEventListener("click", () => {
      const rail = el("navRail");
      if (rail) {
        const currentlyCollapsed = isRailVisuallyCollapsed();
        const willBeCollapsed = !currentlyCollapsed;
        rail.classList.toggle("collapsed", willBeCollapsed);
        rail.classList.toggle("user-expanded", !willBeCollapsed);
        updateRailToggleState(willBeCollapsed);
      }
    });

    const initialRail = el("navRail");
    if (initialRail) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("rail") === "collapsed") {
        initialRail.classList.add("collapsed");
        initialRail.classList.remove("user-expanded");
      }
      if (urlParams.get("edr") === "expanded" && typeof window.setDispatchExpanded === "function") {
        window.setDispatchExpanded(true);
      }
      updateRailToggleState(isRailVisuallyCollapsed());
    }
  }

  // =========================================================================
  // CCTV AUDIT CONTROLLER
  // =========================================================================
  let auditEditingIndex = -1;

  function initAuditDropdowns() {
    // Audit Sites
    const siteSelect = el("auditSite");
    if (siteSelect) {
      const sites = storage.getItem(cfg.KEYS.DROPDOWN_SITE, cfg.DEFAULTS.SITES);
      siteSelect.innerHTML = sites.map(s => `<option value="${s}">${s}</option>`).join("");
    }

    // Audit OM
    const omSelect = el("auditOmName");
    if (omSelect) {
      const oms = storage.getItem(cfg.KEYS.DROPDOWN_OM, cfg.DEFAULTS.OMS);
      omSelect.innerHTML = oms.map(o => `<option value="${o}">${o}</option>`).join("");
    }

    // Audit Account
    const accSelect = el("auditAccount");
    if (accSelect) {
      const accs = storage.getItem(cfg.KEYS.DROPDOWN_ACCOUNT, cfg.DEFAULTS.ACCOUNTS);
      accSelect.innerHTML = accs.map(a => `<option value="${a}">${a}</option>`).join("");
    }

    // Audit Reason Code
    const reasonSelect = el("auditReasonCode");
    if (reasonSelect) {
      const reasons = storage.getItem(cfg.KEYS.DROPDOWN_REASON, cfg.DEFAULTS.REASON_CODES);
      reasonSelect.innerHTML = reasons.map(r => `<option value="${r}">${r}</option>`).join("");
    }

    // Audit TL datalist
    const tlList = el("listAuditTls");
    if (tlList) {
      const tls = edr.getTeamLeaderNames();
      tlList.innerHTML = tls.map(t => `<option value="${t}"></option>`).join("");
    }

    // Audit Date default
    const dateInput = el("auditDate");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
  }

  function renderAuditTable() {
    const tableBody = el("auditTableBody");
    const emptyNotice = el("auditEmptyNotice");
    if (!tableBody) return;

    const rawEntries = audit.getEntries();

    // Update Badges
    const totalBadge = el("auditTotalRowsBadge");
    if (totalBadge) {
      totalBadge.textContent = `${rawEntries.length} ${rawEntries.length === 1 ? "row" : "rows"}`;
    }

    const linkedCount = rawEntries.filter(e => e.sourceEdrId).length;
    const linkedBadge = el("auditLinkedBadge");
    if (linkedBadge) {
      linkedBadge.textContent = `${linkedCount} from EDR`;
    }

    const railBadge = el("railAuditBadge");
    if (railBadge) {
      railBadge.textContent = rawEntries.length;
      if (rawEntries.length > 0) {
        railBadge.style.setProperty("display", "inline-flex", "important");
      } else {
        railBadge.style.setProperty("display", "none", "important");
      }
    }

    if (!rawEntries.length) {
      tableBody.innerHTML = "";
      if (emptyNotice) emptyNotice.style.display = "block";
      return;
    }

    if (emptyNotice) emptyNotice.style.display = "none";

    function getAuditSortDate(entry) {
      if (!entry) return "";
      const raw = entry.rawDate || entry.auditDate || "";
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
      const fmt = entry.formattedDate || "";
      const parts = fmt.split("/");
      if (parts.length === 3) {
        const m = parts[0].padStart(2, "0");
        const d = parts[1].padStart(2, "0");
        const y = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
        return `${y}-${m}-${d}`;
      }
      return raw || fmt;
    }

    // Consistently sort records by audit date ascending, preserving stable order when equal
    const sortedItems = rawEntries.map((entry, origIdx) => ({
      entry,
      origIdx,
      sortDate: getAuditSortDate(entry)
    })).sort((a, b) => {
      const cmp = a.sortDate.localeCompare(b.sortDate);
      if (cmp !== 0) return cmp;
      return a.origIdx - b.origIdx;
    });

    tableBody.innerHTML = sortedItems.map((item, displayIdx) => {
      const { entry, origIdx } = item;
      const rowNum = displayIdx + 1;
      const dateDisplay = entry.formattedDate || entry.rawDate || "â€”";
      const auditor = entry.name || entry.auditorName || "Miles";
      const nocLower = String(entry.noc || "").toLowerCase();
      let nocBadgeClass = "badge-info";
      if (nocLower === "yes") nocBadgeClass = "badge-success";
      else if (nocLower === "no") nocBadgeClass = "badge-danger";
      else if (nocLower === "pending") nocBadgeClass = "badge-warning";
      else if (nocLower === "disputed") nocBadgeClass = "badge-neutral";

      const hasEdr = !!entry.sourceEdrId;
      const isEditing = auditEditingIndex === origIdx;

      return `
        <tr class="audit-row ${isEditing ? 'is-editing' : ''}" data-idx="${origIdx}" data-id="${entry.id || ''}">
          <td style="text-align:center; font-family:var(--font-mono); font-size:10.5px; color:var(--text-dim);">${rowNum}</td>
          <td style="font-weight:600; color:#38bdf8; white-space:nowrap;">${window.escapeHtml(dateDisplay)}</td>
          <td style="white-space:nowrap; color:var(--text-secondary);">${window.escapeHtml(auditor)}</td>
          <td style="white-space:nowrap; font-weight:500;">
            ${window.escapeHtml(entry.site || "")}
            ${hasEdr ? '<span class="badge badge-info" style="font-size:8px; padding:1px 4px; margin-left:4px;" title="Linked from EDR">EDR</span>' : ''}
          </td>
          <td style="white-space:nowrap; font-weight:600; color:var(--text-primary);">${window.escapeHtml(entry.tlName || "N/A")}</td>
          <td style="white-space:nowrap;">${window.escapeHtml(entry.agentName || "N/A")}</td>
          <td style="white-space:nowrap; color:var(--text-secondary);">${window.escapeHtml(entry.omName || "")}</td>
          <td style="white-space:nowrap; color:var(--text-secondary);">${window.escapeHtml(entry.cleanAccount || "")}</td>
          <td style="white-space:nowrap;"><span class="badge badge-neutral" style="font-size:9.5px;">${window.escapeHtml(entry.reasonCode || "")}</span></td>
          <td style="text-align:center;"><span class="badge ${nocBadgeClass}" style="font-size:9.5px;">${window.escapeHtml(entry.noc || "Pending")}</span></td>
          <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${window.escapeHtml(entry.remarks || "")}">${window.escapeHtml(entry.remarks || "")}</td>
          <td style="text-align:center; white-space:nowrap;">
            <div style="display:inline-flex; align-items:center; gap:2px;">
              <button type="button" class="btn btn-ghost btn-sm btn-copy-audit-row" data-idx="${origIdx}" title="Copy this row for Tracker (Arial 10pt / TSV)" style="padding:2px 5px; height:24px;">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
              <button type="button" class="btn btn-ghost btn-sm btn-edit-audit" data-idx="${origIdx}" title="Edit this entry" style="padding:2px 5px; height:24px;">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn btn-ghost btn-sm btn-delete-audit text-danger" data-idx="${origIdx}" data-id="${entry.id || ''}" title="Delete this entry" style="padding:2px 5px; height:24px;">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Wire Row Copy buttons
    tableBody.querySelectorAll(".btn-copy-audit-row").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const origIdx = parseInt(btn.getAttribute("data-idx"), 10);
        const rep = rawEntries[origIdx];
        if (!rep) return;
        try {
          await audit.copyAuditForTracker([rep]);
          showToast("Row copied for Tracker (Arial 10pt formatted).", "success");
        } catch (err) {
          showToast(err.message || "Failed to copy row.", "error");
        }
      });
    });

    // Wire Row Click Selection
    tableBody.querySelectorAll(".audit-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest("a")) return;
        tableBody.querySelectorAll(".audit-row.is-selected").forEach(r => {
          if (r !== row) r.classList.remove("is-selected");
        });
        row.classList.toggle("is-selected");
      });
    });

    // Wire Edit buttons
    tableBody.querySelectorAll(".btn-edit-audit").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        editAuditEntry(idx);
      });
    });

    // Wire Delete buttons
    tableBody.querySelectorAll(".btn-delete-audit").forEach(btn => {
      btn.addEventListener("click", async () => {
        const origIdx = parseInt(btn.getAttribute("data-idx"), 10);
        const entryId = btn.getAttribute("data-id");
        const rep = rawEntries[origIdx] || (entryId ? rawEntries.find(e => e.id === entryId) : null);
        const agreed = await window.appConfirm({
          title: "Delete Audit Entry?",
          message: `Delete audit entry for ${rep?.agentName || rep?.tlName || "entry"} (${rep?.site || ""})?`,
          confirmText: "Delete",
          tone: "danger"
        });
        if (agreed) {
          if (entryId) {
            audit.deleteEntry(entryId);
          } else {
            audit.deleteEntry(origIdx);
          }
          showToast("Audit entry deleted.", "info");
        }
      });
    });
  }

  function editAuditEntry(index) {
    const entries = audit.getEntries();
    const entry = entries[index];
    if (!entry) return;

    auditEditingIndex = index;

    if (el("auditDate")) el("auditDate").value = entry.rawDate || "";
    if (el("auditSite")) {
      const sVal = entry.site || "";
      const siteSelect = el("auditSite");
      const matched = Array.from(siteSelect.options).find(o => 
        o.value === sVal || 
        o.value.startsWith(sVal) || 
        (window.normalizeTrackerSite && window.normalizeTrackerSite(o.value) === window.normalizeTrackerSite(sVal))
      );
      if (matched) {
        siteSelect.value = matched.value;
      } else {
        siteSelect.value = sVal;
      }
    }
    if (el("auditTlName")) el("auditTlName").value = entry.tlName || "";
    if (el("auditAgentName")) el("auditAgentName").value = entry.agentName || "";
    if (el("auditOmName")) el("auditOmName").value = entry.omName || "";
    if (el("auditAccount")) el("auditAccount").value = entry.cleanAccount || "";
    if (el("auditReasonCode")) el("auditReasonCode").value = entry.reasonCode || "";
    if (el("auditNoc")) el("auditNoc").value = entry.noc || "YES";
    if (el("auditRemarks")) el("auditRemarks").value = entry.remarks || "";

    const submitBtn = el("btnAuditSubmitText");
    if (submitBtn) submitBtn.textContent = "Update Entry";

    el("auditForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    renderAuditTable();
  }

  function resetAuditForm() {
    auditEditingIndex = -1;
    el("auditForm")?.reset();
    const dateInput = el("auditDate");
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    const submitBtn = el("btnAuditSubmitText");
    if (submitBtn) submitBtn.textContent = "Add Entry to List";
    renderAuditTable();
  }

  // Audit Option Management (+ / -)
  function setupAuditOptionManagement() {
    function addOpt(storageKey, defaultArray, selectId, label) {
      const val = prompt(`Enter new ${label}:`);
      if (val && val.trim()) {
        const clean = val.trim();
        const current = storage.getItem(storageKey, defaultArray);
        if (!current.some(c => c.toLowerCase() === clean.toLowerCase())) {
          current.push(clean);
          current.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
          storage.setItem(storageKey, current);
          initAuditDropdowns();
          if (el(selectId)) el(selectId).value = clean;
          showToast(`Added "${clean}" to ${label} list.`, "success");
        } else {
          showToast(`"${clean}" is already in the list.`, "info");
        }
      }
    }

    async function removeOpt(storageKey, defaultArray, selectId, label) {
      const select = el(selectId);
      const val = select ? select.value : "";
      if (!val) {
        showToast(`Please select a ${label} to remove.`, "info");
        return;
      }
      const agreed = await window.appConfirm({
        title: `Remove ${label}?`,
        message: `Remove "${val}" from saved ${label} options?`,
        confirmText: "Remove",
        tone: "danger"
      });
      if (agreed) {
        let current = storage.getItem(storageKey, defaultArray);
        current = current.filter(c => c.toLowerCase() !== val.toLowerCase());
        storage.setItem(storageKey, current);
        initAuditDropdowns();
        showToast(`Removed "${val}" from ${label} list.`, "info");
      }
    }

    // Site
    el("btnAddAuditSite")?.addEventListener("click", () => {
      addOpt(cfg.KEYS.DROPDOWN_SITE, cfg.DEFAULTS.SITES, "auditSite", "Site");
    });
    el("btnRemoveAuditSite")?.addEventListener("click", () => {
      removeOpt(cfg.KEYS.DROPDOWN_SITE, cfg.DEFAULTS.SITES, "auditSite", "Site");
    });

    // OM
    el("btnAddAuditOm")?.addEventListener("click", () => {
      addOpt(cfg.KEYS.DROPDOWN_OM, cfg.DEFAULTS.OMS, "auditOmName", "OM");
    });
    el("btnRemoveAuditOm")?.addEventListener("click", () => {
      removeOpt(cfg.KEYS.DROPDOWN_OM, cfg.DEFAULTS.OMS, "auditOmName", "OM");
    });

    // Account
    el("btnAddAuditAccount")?.addEventListener("click", () => {
      addOpt(cfg.KEYS.DROPDOWN_ACCOUNT, cfg.DEFAULTS.ACCOUNTS, "auditAccount", "Account / Campaign");
    });
    el("btnRemoveAuditAccount")?.addEventListener("click", () => {
      removeOpt(cfg.KEYS.DROPDOWN_ACCOUNT, cfg.DEFAULTS.ACCOUNTS, "auditAccount", "Account / Campaign");
    });

    // Reason
    el("btnAddAuditReason")?.addEventListener("click", () => {
      addOpt(cfg.KEYS.DROPDOWN_REASON, cfg.DEFAULTS.REASON_CODES, "auditReasonCode", "CCTV Reason");
    });
    el("btnRemoveAuditReason")?.addEventListener("click", () => {
      removeOpt(cfg.KEYS.DROPDOWN_REASON, cfg.DEFAULTS.REASON_CODES, "auditReasonCode", "CCTV Reason");
    });
  }

  function initAuditEvents() {
    initAuditDropdowns();
    setupAuditOptionManagement();

    // Form submission
    el("auditForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const dateVal = el("auditDate")?.value;
      if (!dateVal) {
        showToast("Please specify the audit date.", "error");
        return;
      }

      const entryData = {
        rawDate: dateVal,
        site: el("auditSite")?.value || "",
        tlName: el("auditTlName")?.value.trim() || "N/A",
        agentName: el("auditAgentName")?.value.trim() || "N/A",
        omName: el("auditOmName")?.value || "",
        account: el("auditAccount")?.value || "",
        cleanAccount: el("auditAccount")?.value || "",
        reasonCode: el("auditReasonCode")?.value || "SLEEPING",
        noc: el("auditNoc")?.value || "YES",
        remarks: el("auditRemarks")?.value.trim() || "N/A"
      };

      if (auditEditingIndex >= 0) {
        audit.setEditingIndex(auditEditingIndex);
        audit.addEntry(entryData);
        showToast("Audit entry updated.", "success");
      } else {
        audit.addEntry(entryData);
        showToast("Audit entry added to Data Output Grid.", "success");
      }

      resetAuditForm();
    });

    // Clear form
    el("btnAuditClearForm")?.addEventListener("click", resetAuditForm);

    // Clear All
    el("btnAuditClearAll")?.addEventListener("click", async () => {
      const agreed = await window.appConfirm({
        title: "Clear All Audit Rows?",
        message: "Are you sure you want to clear all CCTV Audit rows? This cannot be undone.",
        confirmText: "Clear All",
        tone: "danger"
      });
      if (agreed) {
        audit.clearAllEntries();
        resetAuditForm();
        showToast("All CCTV Audit rows cleared.", "info");
      }
    });

    // Copy for Tracker (Arial 10pt formatted)
    el("btnAuditCopyTracker")?.addEventListener("click", async () => {
      try {
        await audit.copyAuditForTracker();
        showToast("Audit data copied for Tracker (Arial 10pt formatted).", "success");
      } catch (err) {
        showToast(err.message || "Failed to copy audit data.", "error");
      }
    });
  }

  // =========================================================================
  // LIVE TRACKER SPREADSHEET CONTROLLER
  // =========================================================================
  let liveTrackerGrid = null;

  function initLiveTrackerController() {
    // Deprecated in favor of authoritative TRACKERS -> CCTV Audit workspace.
    // Early exit eliminates unnecessary 3,584-row background fetching, rendering, and sync loops.
    return;

    function populateAuditorFilter() {
      const select = el("liveTrackerAuditorFilter");
      if (!select || !window.CCTV_LIVE_TRACKER) return;
      const current = window.CCTV_LIVE_TRACKER.getAuditorFilter();
      const auditors = window.CCTV_LIVE_TRACKER.getUniqueAuditors();
      const totalCount = window.CCTV_LIVE_TRACKER.getTotalRowCount();

      const options = [
        `<option value="all">All Records (${totalCount} rows)</option>`,
        `<option value="my">My Records Only</option>`
      ];
      auditors.forEach(a => {
        options.push(`<option value="${a.toLowerCase()}">${a}</option>`);
      });
      select.innerHTML = options.join("");
      select.value = current;
    }

    // Update status UI
    function updateTrackerStatus(syncStatus) {
      const rowCount = window.CCTV_LIVE_TRACKER.getRowCount();
      const totalCount = window.CCTV_LIVE_TRACKER.getTotalRowCount();
      const countBadge = el("liveTrackerRowCountBadge");
      if (countBadge) {
        countBadge.textContent = rowCount !== totalCount 
          ? `${rowCount} of ${totalCount} rows` 
          : `${rowCount} ${rowCount === 1 ? "row" : "rows"}`;
      }

      // Dataset source status badge
      const dataState = window.CCTV_LIVE_TRACKER.getDataState?.() || {};
      const stateBadge = el("liveTrackerDataStateBadge");
      if (stateBadge) {
        if (dataState.unsavedCount > 0) {
          stateBadge.textContent = `Unsynced edits (${dataState.unsavedCount})`;
          stateBadge.className = "badge badge-local";
          stateBadge.title = "Local modifications pending sync to Google Sheet";
        } else if (dataState.source === "live") {
          stateBadge.textContent = `${totalCount} ROWS â€¢ LIVE SHEET â€¢ CONNECTED`;
          stateBadge.className = "badge badge-live";
          stateBadge.title = `Authoritative dataset loaded from shared ${dataState.sheetName || "AUDIT 2026"} Google Sheet`;
        } else if (dataState.source === "cached") {
          stateBadge.textContent = `${totalCount} ROWS â€¢ CACHED SNAPSHOT`;
          stateBadge.className = "badge badge-cached";
          stateBadge.title = "Local cached snapshot of shared Google Sheet";
        } else if (dataState.source === "error" || syncStatus.error) {
          stateBadge.textContent = `API ERROR: ${syncStatus.error || dataState.lastError || "Failed to load"}`;
          stateBadge.className = "badge badge-danger";
          stateBadge.title = syncStatus.error || dataState.lastError || "Failed to load Google Sheet";
        } else if (dataState.source === "connecting") {
          stateBadge.textContent = "CONNECTING TO GOOGLE SHEET...";
          stateBadge.className = "badge badge-info";
          stateBadge.title = "Connecting to shared Google Sheet...";
        } else {
          stateBadge.textContent = "Ready";
          stateBadge.className = "badge badge-neutral";
          stateBadge.title = "Live Tracker ready";
        }
      }

      const syncBadge = el("liveTrackerSyncBadge");
      if (syncBadge) {
        if (syncStatus.state === "saving") {
          syncBadge.textContent = "Saving...";
          syncBadge.className = "badge badge-info";
        } else if (syncStatus.state === "unsaved") {
          syncBadge.textContent = `Unsaved (${syncStatus.unsavedCount})`;
          syncBadge.className = "badge badge-warning";
        } else if (syncStatus.state === "conflict") {
          syncBadge.textContent = "Conflict";
          syncBadge.className = "badge badge-danger";
        } else if (syncStatus.state === "saved") {
          syncBadge.textContent = "Saved";
          syncBadge.className = "badge badge-success";
        } else if (dataState.source === "live") {
          syncBadge.textContent = "Read-Only";
          syncBadge.className = "badge badge-success";
          syncBadge.title = "Google Sheet writes disabled (Read-only mode)";
        } else if (dataState.source === "error" || syncStatus.error) {
          syncBadge.textContent = "Disconnected";
          syncBadge.className = "badge badge-danger";
        } else {
          syncBadge.textContent = "Idle";
          syncBadge.className = "badge badge-neutral";
        }
      }

      const syncTime = el("liveTrackerSyncTime");
      if (syncTime) {
        if (syncStatus.error || dataState.lastError) {
          syncTime.textContent = `Error: ${syncStatus.error || dataState.lastError}`;
          syncTime.style.color = "var(--accent-danger)";
        } else if (dataState.source === "live") {
          syncTime.textContent = `Live Connected (${new Date(dataState.lastFetchTime || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
          syncTime.style.color = "var(--text-muted)";
        } else if (dataState.source === "connecting") {
          syncTime.textContent = "Fetching shared Google Sheet...";
          syncTime.style.color = "var(--text-muted)";
        } else if (dataState.source === "cached") {
          syncTime.textContent = "Cached snapshot";
          syncTime.style.color = "var(--text-muted)";
        } else {
          syncTime.textContent = "Idle";
          syncTime.style.color = "var(--text-muted)";
        }
      }

      // Old live tracker rail badge removed to prevent overriding DATA OUTPUT GRID staged count

      const undoBtn = el("btnTrackerUndo");
      if (undoBtn) undoBtn.disabled = !window.CCTV_LIVE_TRACKER.canUndo();
      const redoBtn = el("btnTrackerRedo");
      if (redoBtn) redoBtn.disabled = !window.CCTV_LIVE_TRACKER.canRedo();
    }

    window.CCTV_LIVE_TRACKER.subscribeSync(updateTrackerStatus);
    window.CCTV_LIVE_TRACKER.subscribe(() => {
      populateAuditorFilter();
      updateTrackerStatus(window.CCTV_LIVE_TRACKER.getSyncStatus());
    });
    populateAuditorFilter();
    updateTrackerStatus(window.CCTV_LIVE_TRACKER.getSyncStatus());

    // Auditor Filter change
    el("liveTrackerAuditorFilter")?.addEventListener("change", (e) => {
      const val = e.target.value;
      window.CCTV_LIVE_TRACKER.setAuditorFilter(val);
      const count = window.CCTV_LIVE_TRACKER.getRowCount();
      showToast(`Filter applied: showing ${count} rows.`, "info");
    });

    // Find in Sheet button
    el("btnTrackerFind")?.addEventListener("click", () => {
      if (liveTrackerGrid) {
        liveTrackerGrid.openFind();
      }
    });

    // Refresh from Google Sheet button
    el("btnTrackerRefresh")?.addEventListener("click", async () => {
      showToast("Fetching entire shared AUDIT 2026 sheet...", "info");
      const res = await window.CCTV_LIVE_TRACKER.fetchSharedSheetData(true);
      if (res && res.success) {
        showToast(`Loaded ${res.count} shared records from Google Sheets.`, "success");
        populateAuditorFilter();
      } else {
        showToast("Failed to fetch shared sheet: " + (res?.error || "Network error"), "error");
      }
    });

    // Toolbar Buttons
    el("btnTrackerAddRow")?.addEventListener("click", () => {
      window.CCTV_LIVE_TRACKER.insertRow();
      showToast("New row added.", "info");
    });

    el("btnTrackerInsertByDate")?.addEventListener("click", async () => {
      const today = new Date().toISOString().split("T")[0];
      const targetDate = prompt("Enter target date for chronological insertion (YYYY-MM-DD):", today);
      if (targetDate && targetDate.trim()) {
        const res = window.CCTV_LIVE_TRACKER.insertRowByDate({ date: targetDate.trim() });
        showToast(`Row inserted at position #${res.index + 1} based on date ${targetDate.trim()}.`, "success");
      }
    });

    el("btnTrackerUndo")?.addEventListener("click", () => {
      if (window.CCTV_LIVE_TRACKER.undo()) {
        showToast("Undone.", "info");
      }
    });

    el("btnTrackerRedo")?.addEventListener("click", () => {
      if (window.CCTV_LIVE_TRACKER.redo()) {
        showToast("Redone.", "info");
      }
    });

    el("btnTrackerCopyAll")?.addEventListener("click", async () => {
      const rows = window.CCTV_LIVE_TRACKER.getRows();
      const cols = window.CCTV_LIVE_TRACKER.getColumns();
      if (!rows.length) {
        showToast("No tracker rows to copy.", "info");
        return;
      }
      const lines = rows.map(r => cols.map(c => r[c.key] || "").join("\t"));
      const tsv = lines.join("\r\n");
      try {
        await navigator.clipboard.writeText(tsv);
        showToast(`Copied ${rows.length} rows formatted for Google Sheets.`, "success");
      } catch (err) {
        showToast("Failed to copy rows: " + err.message, "error");
      }
    });

    el("btnTrackerSyncNow")?.addEventListener("click", async () => {
      const settings = window.CCTV_LIVE_TRACKER.getSettings();
      if (!settings.webAppUrl) {
        showToast("Please configure your Google Sheets Apps Script URL in Setup first.", "warning");
        el("modalTrackerSetup").hidden = false;
        return;
      }
      showToast("Syncing with Google Sheets...", "info");
      await window.CCTV_LIVE_TRACKER.triggerImmediateSync();
    });

    el("btnTrackerClearAll")?.addEventListener("click", async () => {
      const agreed = await window.appConfirm({
        title: "Clear Live Tracker?",
        message: "Are you sure you want to clear all rows in the Live Tracker? This cannot be undone.",
        confirmText: "Clear All",
        tone: "danger"
      });
      if (agreed) {
        window.CCTV_LIVE_TRACKER.clearAllRows();
        showToast("Tracker rows cleared.", "info");
      }
    });

    // Sheet Setup Modal
    const TRACKER_APPS_SCRIPT_SAMPLE = `function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify({ status: "success", rows: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var conflicts = [];

    if (payload.action === "batch_sync_tracker" && Array.isArray(payload.updates)) {
      payload.updates.forEach(function(u) {
        var values = [
          u.values.year || "",
          u.values.month || "",
          u.values.date || "",
          u.values.auditor || u.values.name || "",
          u.values.om || "",
          u.values.site || "",
          u.values.tl || "",
          u.values.agent || "",
          u.values.account || "",
          u.values.reason || "",
          u.values.noc || "",
          u.values.remarks || ""
        ];

        if (u.isNew) {
          var targetRow = (typeof u.index === 'number' && u.index >= 0) ? u.index + 2 : lastRow + 1;
          if (targetRow <= lastRow) {
            sheet.insertRowBefore(targetRow);
            sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
          } else {
            sheet.appendRow(values);
          }
        } else {
          var targetRow = u.index + 2;
          if (targetRow <= sheet.getLastRow()) {
            var current = sheet.getRange(targetRow, 1, 1, values.length).getValues()[0];
            var currentFp = current.map(function(c) { return String(c || '').trim(); }).join('||');
            if (u.fingerprint && currentFp !== u.fingerprint) {
              conflicts.push({ uid: u.uid, serverValues: current });
              return;
            }
            sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
          } else {
            sheet.appendRow(values);
          }
        }
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, conflicts: conflicts }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

    el("btnTrackerSetup")?.addEventListener("click", () => {
      const settings = window.CCTV_LIVE_TRACKER.getSettings();
      if (el("trackerSheetWebAppUrl")) {
        el("trackerSheetWebAppUrl").value = settings.webAppUrl || "";
      }
      if (el("trackerAppsScriptCode")) {
        el("trackerAppsScriptCode").value = TRACKER_APPS_SCRIPT_SAMPLE;
      }
      el("modalTrackerSetup").hidden = false;
    });

    el("btnCopyTrackerAppsScript")?.addEventListener("click", () => {
      if (el("trackerAppsScriptCode")) {
        navigator.clipboard.writeText(TRACKER_APPS_SCRIPT_SAMPLE).then(() => {
          showToast("Apps Script code copied to clipboard.", "success");
        }).catch(() => {
          el("trackerAppsScriptCode").select();
          showToast("Selected code. Press Ctrl+C to copy.", "info");
        });
      }
    });

    el("btnCloseTrackerSetup")?.addEventListener("click", () => {
      el("modalTrackerSetup").hidden = true;
    });
    el("btnCancelTrackerSetup")?.addEventListener("click", () => {
      el("modalTrackerSetup").hidden = true;
    });

    el("btnSaveTrackerSetup")?.addEventListener("click", () => {
      const url = el("trackerSheetWebAppUrl")?.value.trim() || "";
      window.CCTV_LIVE_TRACKER.saveSettings({ webAppUrl: url });
      el("modalTrackerSetup").hidden = true;
      if (url) {
        showToast("Google Sheets Live Tracker URL saved!", "success");
        window.CCTV_LIVE_TRACKER.triggerImmediateSync();
      } else {
        showToast("Google Sheets sync URL disconnected.", "info");
      }
    });
  }

  // =========================================================================
  // SMART AUDIT GUARD CONTROLLER
  // =========================================================================
  function renderGuardStatus() {
    const rows = audit.getTrackerRows();
    const snap = audit.getTrackerSnapshot();
    const analysis = audit.getTrackerAnalysis();

    const countBadge = el("guardRecordCountBadge");
    if (countBadge) countBadge.textContent = `${rows.length} records`;

    const statusBadge = el("guardStatusBadge");
    if (statusBadge) {
      statusBadge.textContent = rows.length ? "Active Snapshot" : "Idle";
      statusBadge.className = rows.length ? "badge badge-success" : "badge badge-info";
    }

    const syncText = el("guardLastSyncText");
    if (syncText) {
      syncText.textContent = snap
        ? `Snapshot: ${snap.syncedAt ? new Date(snap.syncedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "Active"} (${rows.length} rows)`
        : "No snapshot loaded";
    }

    const issuesBox = el("guardIssuesBox");
    if (!issuesBox) return;

    if (!rows.length) {
      issuesBox.style.display = "none";
      issuesBox.innerHTML = "";
      return;
    }

    issuesBox.style.display = "flex";

    if (!analysis.issues.length) {
      issuesBox.innerHTML = `
        <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:var(--radius-sm); padding:8px 12px; font-size:11.5px; color:#34d399; display:flex; align-items:center; gap:8px;">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span><strong>All rows verified clean.</strong> 0 duplicates, spelling issues, or invalid values detected.</span>
        </div>
      `;
      return;
    }

    // Render issue items
    issuesBox.innerHTML = analysis.issues.map(iss => {
      const isDanger = iss.level === "danger";
      const badgeClass = isDanger ? "badge-danger" : "badge-warning";
      const borderCol = isDanger ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)";
      const bgCol = isDanger ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)";

      return `
        <div style="background:${bgCol}; border:1px solid ${borderCol}; border-radius:var(--radius-sm); padding:8px 12px; font-size:11px; display:flex; flex-direction:column; gap:3px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge ${badgeClass}" style="font-size:8.5px; text-transform:uppercase;">${window.escapeHtml(iss.type)}</span>
            <strong style="color:var(--text-primary); font-size:11.5px;">${window.escapeHtml(iss.title)}</strong>
          </div>
          <div style="color:var(--text-secondary);">${window.escapeHtml(iss.detail)}</div>
          ${iss.suggestion ? `<div style="color:#38bdf8; font-weight:600; margin-top:2px;">â†³ ${window.escapeHtml(iss.suggestion)}</div>` : ''}
        </div>
      `;
    }).join("");
  }

  function initSmartAuditGuard() {
    // Import Button & File Input
    el("btnGuardUpload")?.addEventListener("click", () => {
      el("fileGuardUpload")?.click();
    });

    el("fileGuardUpload")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      showToast(`Importing ${file.name}...`, "info");
      try {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const wb = window.XLSX.read(data, { type: "array" });
            const res = await audit.importTrackerWorkbook(wb);
            showToast(`Loaded ${res.rowsCount} rows from tracker. ${res.issuesCount} issue(s) flagged.`, res.issuesCount ? "info" : "success");
            renderGuardStatus();
          } catch (err) {
            showToast(`Import error: ${err.message}`, "error");
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        showToast(`Failed to read file: ${err.message}`, "error");
      }
      e.target.value = "";
    });

    // Paste Modal
    el("btnGuardPaste")?.addEventListener("click", () => {
      el("txtGuardPaste").value = "";
      el("modalGuardPaste").hidden = false;
    });

    el("btnCloseGuardPaste")?.addEventListener("click", () => {
      el("modalGuardPaste").hidden = true;
    });
    el("btnCancelGuardPaste")?.addEventListener("click", () => {
      el("modalGuardPaste").hidden = true;
    });

    el("btnSubmitGuardPaste")?.addEventListener("click", async () => {
      const text = el("txtGuardPaste")?.value || "";
      if (!text.trim()) {
        showToast("Please paste rows before submitting.", "info");
        return;
      }
      try {
        const res = await audit.pasteTrackerRows(text, false);
        el("modalGuardPaste").hidden = true;
        showToast(`Loaded ${res.rowsCount} rows. ${res.issuesCount} issue(s) flagged.`, res.issuesCount ? "info" : "success");
        renderGuardStatus();
      } catch (err) {
        showToast(`Paste failed: ${err.message}`, "error");
      }
    });

    el("btnGuardMergePasted")?.addEventListener("click", async () => {
      const text = el("txtGuardPaste")?.value || "";
      if (!text.trim()) {
        showToast("Please paste rows before merging.", "info");
        return;
      }
      try {
        const res = await audit.pasteTrackerRows(text, true);
        el("modalGuardPaste").hidden = true;
        showToast(`Merged ${res.rowsCount} rows. ${res.issuesCount} issue(s) flagged.`, res.issuesCount ? "info" : "success");
        renderGuardStatus();
      } catch (err) {
        showToast(`Merge failed: ${err.message}`, "error");
      }
    });

    // Clear Snapshot
    el("btnGuardClear")?.addEventListener("click", async () => {
      const agreed = await window.appConfirm({
        title: "Clear Tracker Snapshot?",
        message: "Clear imported tracker rows from memory? (Your actual Google Sheet and saved audit entries will NOT be affected)",
        confirmText: "Clear Snapshot",
        tone: "danger"
      });
      if (agreed) {
        await audit.clearTrackerSnapshot();
        renderGuardStatus();
        showToast("Tracker snapshot cleared.", "info");
      }
    });
  }

  // =========================================================================
  // AI SORTER & INTERACTIVE MINI-SHEET SPREADSHEET GRID CONTROLLER
  // =========================================================================
  let sorterParsedRows = [];
  let sorterAssignedRows = [];
  let sorterAssignments = new Map();
  let miniSheetSelectedRows = new Set();
  let miniSheetSelectionAnchor = null;
  let miniSheetCellSelection = null;
  let miniSheetCellAnchor = null;
  let miniSheetCellFocus = null;
  let miniSheetCellDragging = false;
  let miniSheetFindMatches = [];
  let miniSheetFindCursor = -1;
  let miniSheetKeyboardActive = false;
  let sorterAutosaveTimer = null;

  function showSorterMessage(text, type = "info") {
    const msgEl = el("maintenanceMessage");
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = `maintenance-message ${type}`;
    msgEl.style.display = "flex";
  }

  function hideSorterMessage() {
    const msgEl = el("maintenanceMessage");
    if (!msgEl) return;
    msgEl.textContent = "";
    msgEl.style.display = "none";
  }

  function saveSorterDraftDebounced(delay = 400) {
    if (sorterAutosaveTimer) {
      clearTimeout(sorterAutosaveTimer);
    }
    if (delay <= 0) {
      sorterAutosaveTimer = null;
      persistSorterDraftNow();
      return;
    }
    sorterAutosaveTimer = setTimeout(() => {
      sorterAutosaveTimer = null;
      persistSorterDraftNow();
    }, delay);
  }

  function persistSorterDraftNow() {
    if (!sorter || typeof sorter.saveDraft !== "function") return;
    const rawText = el("maintenanceInput")?.value || "";
    const hasRows = sorterAssignedRows && sorterAssignedRows.length > 0;
    const hasRaw = rawText.trim().length > 0;

    // If both rows and raw input are empty, clear any persisted draft
    if (!hasRows && !hasRaw) {
      sorter.clearDraft?.().catch(console.error);
      return;
    }

    const draft = {
      rawText,
      assignedRows: sorterAssignedRows,
      parsedRows: sorterParsedRows,
      assignments: Array.from(sorterAssignments.entries()),
      selectedRows: Array.from(miniSheetSelectedRows),
      searchQuery: el("miniSheetFindTlInput")?.value || ""
    };

    sorter.saveDraft(draft).catch(err => {
      console.warn("Autosave sorter draft failed:", err);
    });
  }

  async function clearSorterDraft() {
    if (sorterAutosaveTimer) {
      clearTimeout(sorterAutosaveTimer);
      sorterAutosaveTimer = null;
    }
    try {
      await sorter?.clearDraft?.();
    } catch (err) {
      console.warn("Could not clear sorter draft:", err);
    }
  }

  async function restoreSorterDraft() {
    if (!sorter || typeof sorter.loadDraft !== "function") return false;
    try {
      const draft = await sorter.loadDraft();
      if (!draft) return false;

      const hasRaw = typeof draft.rawText === "string" && draft.rawText.trim().length > 0;
      const hasRows = Array.isArray(draft.assignedRows) && draft.assignedRows.length > 0;

      if (!hasRaw && !hasRows) return false;

      if (hasRaw && el("maintenanceInput")) {
        el("maintenanceInput").value = draft.rawText;
      }

      if (hasRows) {
        sorterAssignedRows = draft.assignedRows.map(r => ({ ...r }));
        sorterParsedRows = Array.isArray(draft.parsedRows) && draft.parsedRows.length
          ? draft.parsedRows.map(r => ({ ...r }))
          : sorterAssignedRows.map(r => ({ ...r }));

        if (Array.isArray(draft.assignments) && draft.assignments.length) {
          sorterAssignments = new Map(draft.assignments);
        } else if (typeof sorter.buildAssignments === "function") {
          sorterAssignments = sorter.buildAssignments(sorterParsedRows);
        }

        if (Array.isArray(draft.selectedRows) && draft.selectedRows.length > 0) {
          miniSheetSelectedRows = new Set(draft.selectedRows);
          miniSheetSelectionAnchor = draft.selectedRows[0];
        }

        if (draft.searchQuery && el("miniSheetFindTlInput")) {
          el("miniSheetFindTlInput").value = draft.searchQuery;
          highlightMiniSheetFindMatchesRealtime(draft.searchQuery);
        }

        renderSorterRows(sorterAssignedRows);
        updateMiniSheetSelectionUi();

        const reviewCount = sorterAssignedRows.filter(r => r.floor === sorter.FLOOR.REVIEW).length;
        const recognizedCount = sorterAssignedRows.length - reviewCount;
        const gfCount = sorterAssignedRows.filter(r => r.floor === sorter.FLOOR.GROUND).length;
        const f1Count = sorterAssignedRows.filter(r => r.floor === sorter.FLOOR.FIRST).length;
        const f2Count = sorterAssignedRows.filter(r => r.floor === sorter.FLOOR.SECOND).length;

        if (el("overallRowCount")) el("overallRowCount").textContent = `${sorterAssignedRows.length} rows`;
        if (el("miniSheetRowCount")) el("miniSheetRowCount").textContent = `${sorterAssignedRows.length} rows`;
        if (el("sorterGfCount")) el("sorterGfCount").textContent = `GF: ${gfCount}`;
        if (el("sorter1fCount")) el("sorter1fCount").textContent = `1F: ${f1Count}`;
        if (el("sorter2fCount")) el("sorter2fCount").textContent = `2F: ${f2Count}`;
        if (el("sorterReviewCount")) el("sorterReviewCount").textContent = `Review: ${reviewCount}`;

        const emptyNotice = el("maintenanceEmpty");
        if (emptyNotice) emptyNotice.style.display = "none";

        showSorterMessage(`Restored working session (${sorterAssignedRows.length} rows) from local draft.`, "info");
        return true;
      } else if (hasRaw) {
        showSorterMessage("Restored pasted report text from local draft.", "info");
        return true;
      }
    } catch (err) {
      console.warn("Could not restore AI Sorter draft:", err);
    }
    return false;
  }

  function renderSorterWorkspace() {
    const emptyNotice = el("maintenanceEmpty");
    if (emptyNotice) {
      emptyNotice.style.display = sorterAssignedRows.length ? "none" : "block";
    }
    if (sorterAssignedRows.length) {
      renderSorterRows(sorterAssignedRows, true);
      updateMiniSheetSelectionUi();
    }
  }

  function analyzeMaintenance(scrollToResults = true) {
    const raw = (el("maintenanceInput")?.value || "").trim();
    if (!raw) {
      showSorterMessage("Paste your maintenance report first.", "error");
      return;
    }

    try {
      hideSorterMessage();
      const rows = sorter.parseReport(raw);
      const assignments = sorter.buildAssignments(rows);
      const assignedRows = sorter.assignRows(rows, assignments);

      sorterParsedRows = rows;
      sorterAssignments = assignments;
      sorterAssignedRows = assignedRows;

      renderSorterRows(assignedRows);
      window.historyService?.captureIfChanged("aiSorter", "Analyzed maintenance report");

      const reviewCount = assignedRows.filter(r => r.floor === sorter.FLOOR.REVIEW).length;
      const recognizedCount = assignedRows.length - reviewCount;

      const gfCount = assignedRows.filter(r => r.floor === sorter.FLOOR.GROUND).length;
      const f1Count = assignedRows.filter(r => r.floor === sorter.FLOOR.FIRST).length;
      const f2Count = assignedRows.filter(r => r.floor === sorter.FLOOR.SECOND).length;

      if (el("overallRowCount")) el("overallRowCount").textContent = `${assignedRows.length} rows`;
      if (el("sorterGfCount")) el("sorterGfCount").textContent = `GF: ${gfCount}`;
      if (el("sorter1fCount")) el("sorter1fCount").textContent = `1F: ${f1Count}`;
      if (el("sorter2fCount")) el("sorter2fCount").textContent = `2F: ${f2Count}`;
      if (el("sorterReviewCount")) el("sorterReviewCount").textContent = `Review: ${reviewCount}`;

      const msg = `Reference-aware sort complete: ${assignedRows.length} rows. ${recognizedCount} were assigned to a floor${reviewCount ? `; ${reviewCount} need review.` : "."}`;
      showSorterMessage(msg, reviewCount ? "info" : "success");
      saveSorterDraftDebounced(0);

      if (scrollToResults && el("aiSorterTableWrapper")) {
        el("aiSorterTableWrapper").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (err) {
      showSorterMessage(err.message || "Unable to read the report.", "error");
    }
  }

  function renderSorterRows(rows, skipMiniSheet = false) {
    const tbodyCompat = el("maintenanceOutputTable")?.querySelector("tbody");
    if (tbodyCompat) {
      let previousFloor = null;
      tbodyCompat.innerHTML = rows.map((row, rowIndex) => {
        const isFloorBreak = previousFloor !== null && previousFloor !== row.floor;
        previousFloor = row.floor;
        return `
          <tr class="${isFloorBreak ? "floor-break" : ""}" data-floor="${window.escapeHtml(row.floor)}" data-row-index="${rowIndex}">
            <td>${window.escapeHtml(row.timestamp || "")}</td>
            <td>${window.escapeHtml(row.date || "")}</td>
            <td>${window.escapeHtml(sorter.displayTLValue(row.tl))}</td>
            <td>${window.escapeHtml(row.account || "")}</td>
            <td>${window.escapeHtml(row.site || "")}</td>
            <td><strong>${window.escapeHtml(row.station || "")}</strong></td>
            <td>${window.escapeHtml(row.issue || "")}</td>
          </tr>
        `;
      }).join("");
    }

    const emptyNotice = el("maintenanceEmpty");
    if (emptyNotice) {
      emptyNotice.style.display = rows.length ? "none" : "block";
    }

    if (!skipMiniSheet) {
      renderMiniSheet(rows);
    }
  }

  function renderMiniSheet(rows) {
    const sheet = el("maintenanceMiniSheet");
    if (!sheet) return;

    miniSheetSelectedRows = new Set(
      [...miniSheetSelectedRows].filter(index => index >= 0 && index < rows.length)
    );

    const tbody = sheet.querySelector("tbody");
    if (!tbody) return;

    const fields = sorter.MINI_SHEET_FIELDS;

    let previousFloor = null;
    const filledRowsHtml = rows.map((row, rowIndex) => {
      const isFloorBreak = previousFloor !== null && previousFloor !== row.floor;
      previousFloor = row.floor;

      const displayValues = {
        timestamp: row.timestamp || "",
        date: row.date || "",
        tl: sorter.displayTLValue(row.tl),
        account: row.account || "",
        site: row.site || "",
        station: row.station || "",
        issue: row.issue || ""
      };

      return `
        <tr data-row-index="${rowIndex}" class="${miniSheetSelectedRows.has(rowIndex) ? "selected-row" : ""} ${isFloorBreak ? "floor-break" : ""}">
          <th class="mini-sheet-row-number" scope="row" title="Click to select row. Shift+Click = range, Ctrl+Click = toggle.">${rowIndex + 2}</th>
          ${fields.map((field, colIndex) => `
            <td
              contenteditable="true"
              spellcheck="false"
              data-row-index="${rowIndex}"
              data-col-index="${colIndex}"
              data-field="${field}"
              aria-label="Row ${rowIndex + 2} ${field}">
              ${window.escapeHtml(displayValues[field])}
            </td>
          `).join("")}
        </tr>
      `;
    }).join("");

    const minimumVisibleRows = 32;
    const blankCount = Math.max(8, minimumVisibleRows - rows.length);
    const blankRowsHtml = Array.from({ length: blankCount }, (_, i) => {
      const rowNumber = rows.length + i + 2;
      return `
        <tr class="mini-sheet-blank-row">
          <th class="mini-sheet-row-number" scope="row">${rowNumber}</th>
          ${fields.map(() => `<td aria-hidden="true"></td>`).join("")}
        </tr>
      `;
    }).join("");

    tbody.innerHTML = filledRowsHtml + blankRowsHtml;

    if (el("miniSheetRowCount")) {
      el("miniSheetRowCount").textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
    }

    tbody.querySelectorAll(".mini-sheet-row-number").forEach(rowHeader => {
      rowHeader.addEventListener("mousedown", event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const tr = rowHeader.closest("tr");
        if (!tr || tr.dataset.rowIndex == null) return;
        setMiniSheetKeyboardActive(true);
        selectMiniSheetRow(Number(tr.dataset.rowIndex), event);
      });
      rowHeader.addEventListener("click", event => {
        if (event.button !== 0) return;
        event.preventDefault();
      });
    });

    tbody.querySelectorAll('td[contenteditable="true"]').forEach(cell => {
      cell.addEventListener("mousedown", event => {
        if (event.button !== 0) return;
        if (cell.dataset.editing === "true") return;

        event.preventDefault();
        setMiniSheetKeyboardActive(true);

        const point = {
          row: Number(cell.dataset.rowIndex),
          col: Number(cell.dataset.colIndex)
        };

        miniSheetSelectedRows.clear();
        miniSheetSelectionAnchor = null;

        if (event.shiftKey && miniSheetCellAnchor) {
          setMiniSheetCellSelection(miniSheetCellAnchor, point);
        } else {
          miniSheetCellAnchor = point;
          setMiniSheetCellSelection(point, point);
        }

        miniSheetCellDragging = true;
        sheet.classList.add("cell-range-dragging");
      });

      cell.addEventListener("mouseenter", () => {
        if (!miniSheetCellDragging || !miniSheetCellAnchor) return;
        setMiniSheetCellSelection(miniSheetCellAnchor, {
          row: Number(cell.dataset.rowIndex),
          col: Number(cell.dataset.colIndex)
        });
      });

      cell.addEventListener("dblclick", event => {
        event.preventDefault();
        const point = {
          row: Number(cell.dataset.rowIndex),
          col: Number(cell.dataset.colIndex)
        };
        miniSheetCellAnchor = point;
        setMiniSheetCellSelection(point, point);
        beginMiniSheetCellEdit(cell);
      });

      cell.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          cell.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cell.blur();
        }
      });

      cell.addEventListener("blur", () => {
        cell.classList.remove("cell-editing");
        delete cell.dataset.editing;

        const rowIndex = Number(cell.dataset.rowIndex);
        const field = cell.dataset.field;
        const row = sorterAssignedRows[rowIndex];
        if (!row || !field) return;

        const value = cell.textContent
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        row[field] = value;
        if (field === "tl") {
          row.tlNames = sorter.extractTLNames(value);
        }

        renderSorterRows(sorterAssignedRows, true);
        window.historyService?.scheduleCapture("aiSorter", `Edited ${field} in AI Sorter`, 400);
        saveSorterDraftDebounced(400);
      });
    });

    updateMiniSheetSelectionUi();
    highlightMiniSheetFindMatches();
  }

  function beginMiniSheetCellEdit(cell) {
    if (!cell) return;
    miniSheetCellDragging = false;
    cell.classList.add("cell-editing");
    cell.dataset.editing = "true";
    cell.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // â”€â”€â”€ Missing Helpers for Global Keyboard Shortcut Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Moves cell selection by arrow keys (item 5-8 parity with V1)
   */
  function handleMiniSheetArrowNavigation(event) {
    if (!miniSheetCellSelection && !miniSheetSelectedRows.size) return;
    event.preventDefault();

    const numRows = sorterAssignedRows.length;
    const numCols = sorter.MINI_SHEET_FIELDS.length;

    if (miniSheetCellSelection) {
      // Move cell selection
      let { startRow, startCol } = miniSheetCellSelection;
      if (event.key === "ArrowUp")    startRow = Math.max(0, startRow - 1);
      if (event.key === "ArrowDown")  startRow = Math.min(numRows - 1, startRow + 1);
      if (event.key === "ArrowLeft")  startCol = Math.max(0, startCol - 1);
      if (event.key === "ArrowRight") startCol = Math.min(numCols - 1, startCol + 1);

      const point = { row: startRow, col: startCol };
      miniSheetCellAnchor = point;
      miniSheetCellFocus = point;
      setMiniSheetCellSelection(point, point);

      // Scroll cell into view
      const targetCell = el("maintenanceMiniSheet")?.querySelector(
        `td[data-row-index="${startRow}"][data-col-index="${startCol}"]`
      );
      targetCell?.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else if (miniSheetSelectedRows.size) {
      // Move row selection
      const sorted = [...miniSheetSelectedRows].sort((a, b) => a - b);
      let newIndex;
      if (event.key === "ArrowUp")   newIndex = Math.max(0, sorted[0] - 1);
      if (event.key === "ArrowDown") newIndex = Math.min(numRows - 1, sorted[sorted.length - 1] + 1);
      if (newIndex === undefined) return;
      miniSheetSelectedRows.clear();
      miniSheetSelectedRows.add(newIndex);
      miniSheetSelectionAnchor = newIndex;
      updateMiniSheetSelectionUi();
    }
  }

  /**
   * Paste clipboard text into the current cell-range selection
   */
  function pasteIntoMiniSheetCellSelection(text) {
    if (!miniSheetCellSelection || !text) return;
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    const { startRow, startCol } = miniSheetCellSelection;
    const fields = sorter.MINI_SHEET_FIELDS;

    lines.forEach((line, lineIdx) => {
      const cols = line.split("\t");
      cols.forEach((val, colIdx) => {
        const rowIdx = startRow + lineIdx;
        const colI = startCol + colIdx;
        if (rowIdx >= sorterAssignedRows.length || colI >= fields.length) return;
        const row = sorterAssignedRows[rowIdx];
        if (!row) return;
        const field = fields[colI];
        row[field] = val.trim();
        if (field === "tl") row.tlNames = sorter.extractTLNames(val.trim());
      });
    });

    renderSorterRows(sorterAssignedRows);
    window.historyService?.captureIfChanged("aiSorter", "Pasted into cells in AI Sorter");
    saveSorterDraftDebounced(300);
    showToast("Pasted into selected cells.", "success");
  }

  /**
   * Append TSV rows from clipboard into the mini sheet (Ctrl+V when rows active)
   */
  function pasteRowsIntoMiniSheet(text) {
    if (!text) return;
    const newRows = sorter.parseMiniSheetClipboardRows(text);
    if (!newRows || !newRows.length) {
      showSorterMessage("Clipboard does not contain readable maintenance rows.", "error");
      return;
    }
    const start = sorterAssignedRows.length;
    sorterAssignedRows.push(...newRows);
    // Select newly pasted rows
    miniSheetSelectedRows.clear();
    for (let i = start; i < sorterAssignedRows.length; i++) {
      miniSheetSelectedRows.add(i);
    }
    miniSheetSelectionAnchor = start;
    renderSorterRows(sorterAssignedRows);
    window.historyService?.captureIfChanged("aiSorter", `Pasted ${newRows.length} rows into AI Sorter`);
    saveSorterDraftDebounced(300);
    setTimeout(() => {
      el("maintenanceMiniSheet")?.querySelector(`tr[data-row-index="${start}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }, 60);
    showToast(`${newRows.length} pasted row(s) added to AI Sorter.`, "success");
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function normalizeMiniSheetCellRange(a, b) {
    if (!a || !b) return null;
    return {
      startRow: Math.min(a.row, b.row),
      endRow: Math.max(a.row, b.row),
      startCol: Math.min(a.col, b.col),
      endCol: Math.max(a.col, b.col)
    };
  }

  function hasMiniSheetCellSelection() {
    return !!miniSheetCellSelection;
  }

  function miniSheetCellSelectionCount() {
    if (!miniSheetCellSelection) return 0;
    const rows = miniSheetCellSelection.endRow - miniSheetCellSelection.startRow + 1;
    const cols = miniSheetCellSelection.endCol - miniSheetCellSelection.startCol + 1;
    return Math.max(0, rows * cols);
  }

  function clearMiniSheetCellSelection(updateUi = true) {
    miniSheetCellSelection = null;
    miniSheetCellAnchor = null;
    miniSheetCellFocus = null;
    miniSheetCellDragging = false;

    const sheet = el("maintenanceMiniSheet");
    if (sheet) {
      sheet.classList.remove("cell-range-dragging");
      sheet.querySelectorAll("td.cell-range-selected, td.cell-range-active, td.sheet-cell-active")
        .forEach(cell => cell.classList.remove("cell-range-selected", "cell-range-active", "sheet-cell-active"));
    }

    if (updateUi) updateMiniSheetSelectionUi();
  }

  function updateMiniSheetCellSelectionUi() {
    const sheet = el("maintenanceMiniSheet");
    if (!sheet) return;

    sheet.querySelectorAll("td.cell-range-selected, td.cell-range-active, td.sheet-cell-active")
      .forEach(cell => cell.classList.remove("cell-range-selected", "cell-range-active", "sheet-cell-active"));

    if (!miniSheetCellSelection) return;

    const { startRow, endRow, startCol, endCol } = miniSheetCellSelection;

    sheet.querySelectorAll('tbody td[data-row-index][data-col-index]').forEach(cell => {
      const row = Number(cell.dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      const inside = row >= startRow && row <= endRow && col >= startCol && col <= endCol;
      if (inside) {
        cell.classList.add("cell-range-selected");
      }
    });

    const activeRow = (miniSheetCellFocus && Number.isInteger(miniSheetCellFocus.row)) ? miniSheetCellFocus.row : startRow;
    const activeCol = (miniSheetCellFocus && Number.isInteger(miniSheetCellFocus.col)) ? miniSheetCellFocus.col : startCol;

    const activeCell = sheet.querySelector(
      `tbody td[data-row-index="${activeRow}"][data-col-index="${activeCol}"]`
    ) || sheet.querySelector(
      `tbody td[data-row-index="${startRow}"][data-col-index="${startCol}"]`
    );
    if (activeCell) {
      activeCell.classList.add("cell-range-active", "sheet-cell-active");
    }
  }

  function setMiniSheetCellSelection(anchor, current = anchor) {
    if (!anchor || !current) return;
    const range = normalizeMiniSheetCellRange(anchor, current);
    if (!range) return;
    miniSheetCellSelection = range;
    updateMiniSheetCellSelectionUi();
    updateMiniSheetSelectionUi();
  }

  function selectedMiniSheetIndexes() {
    return [...miniSheetSelectedRows]
      .filter(index => Number.isInteger(index) && index >= 0 && index < sorterAssignedRows.length)
      .sort((a, b) => a - b);
  }

  function selectMiniSheetRow(rowIndex, event = {}) {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= sorterAssignedRows.length) {
      return;
    }

    clearMiniSheetCellSelection(false);

    const isToggle = !!(event.ctrlKey || event.metaKey);
    const isRange = !!event.shiftKey;

    if (isRange && miniSheetSelectionAnchor !== null) {
      const start = Math.min(miniSheetSelectionAnchor, rowIndex);
      const end = Math.max(miniSheetSelectionAnchor, rowIndex);
      if (!isToggle) miniSheetSelectedRows.clear();
      for (let i = start; i <= end; i++) {
        miniSheetSelectedRows.add(i);
      }
    } else if (isToggle) {
      if (miniSheetSelectedRows.has(rowIndex)) {
        miniSheetSelectedRows.delete(rowIndex);
      } else {
        miniSheetSelectedRows.add(rowIndex);
      }
      miniSheetSelectionAnchor = rowIndex;
    } else {
      miniSheetSelectedRows.clear();
      miniSheetSelectedRows.add(rowIndex);
      miniSheetSelectionAnchor = rowIndex;
    }

    setMiniSheetKeyboardActive(true);
    updateMiniSheetSelectionUi();
  }

  function selectAllMiniSheetRows() {
    if (!sorterAssignedRows.length) {
      showToast("There are no rows to select.", "info");
      return;
    }

    miniSheetSelectedRows.clear();
    sorterAssignedRows.forEach((_, index) => miniSheetSelectedRows.add(index));
    miniSheetSelectionAnchor = 0;
    setMiniSheetKeyboardActive(true);
    updateMiniSheetSelectionUi();
    showToast(`${sorterAssignedRows.length} rows selected.`, "info");
  }

  function selectSameTlMiniSheetRows() {
    const indexes = selectedMiniSheetIndexes();
    if (!indexes.length) {
      showToast("Select a row first, then use Select Same TL.", "error");
      return;
    }

    const sourceRow = sorterAssignedRows[indexes[0]];
    if (!sourceRow) return;

    const targetNames = sorter.extractTLNames(sourceRow.tl)
      .map(name => sorter.normalizeReferenceText(name))
      .filter(Boolean);

    if (!targetNames.length) {
      showToast("The selected row has no Team Leader name to match.", "error");
      return;
    }

    miniSheetSelectedRows.clear();
    sorterAssignedRows.forEach((row, index) => {
      const rowNames = sorter.extractTLNames(row.tl)
        .map(name => sorter.normalizeReferenceText(name))
        .filter(Boolean);

      const matches = targetNames.some(target => rowNames.some(name => name === target));
      if (matches) miniSheetSelectedRows.add(index);
    });

    miniSheetSelectionAnchor = indexes[0];
    setMiniSheetKeyboardActive(true);
    updateMiniSheetSelectionUi();

    const shown = sorter.displayTLValue(sourceRow.tl) || "same TL";
    showToast(`${miniSheetSelectedRows.size} row(s) selected for ${shown}.`, "success");
  }

  function clearMiniSheetSelection() {
    miniSheetSelectedRows.clear();
    miniSheetSelectionAnchor = null;
    clearMiniSheetCellSelection(false);
    updateMiniSheetSelectionUi();
  }

  function clearAnyMiniSheetSelection() {
    if (hasMiniSheetCellSelection()) {
      clearMiniSheetCellSelection();
      return;
    }
    clearMiniSheetSelection();
  }

  function updateMiniSheetSelectionUi() {
    const indexes = selectedMiniSheetIndexes();
    const rowCount = indexes.length;
    const cellCount = miniSheetCellSelectionCount();
    const hasCells = cellCount > 0;

    const selectedCount = el("miniSheetSelectedCount");
    if (selectedCount) {
      selectedCount.textContent = hasCells
        ? `${cellCount} cell${cellCount === 1 ? "" : "s"} selected`
        : `${rowCount} selected`;
    }

    const copyButton = el("miniSheetCopyRowsBtn");
    const cutButton = el("miniSheetCutRowsBtn");
    const clearButton = el("miniSheetClearSelectionBtn");

    if (copyButton) copyButton.disabled = !hasCells && rowCount === 0;
    if (cutButton) cutButton.disabled = !hasCells && rowCount === 0;
    if (clearButton) clearButton.disabled = !hasCells && rowCount === 0;

    [
      "miniSheetToReportBtn",
      "miniSheetRemoveRowBtn",
      "miniSheetSelectSameTlBtn"
    ].forEach(id => {
      const button = el(id);
      if (button) button.disabled = rowCount === 0;
    });

    const tbody = el("maintenanceMiniSheet")?.querySelector("tbody");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach((tr, rowIndex) => {
        const targetRowIndex = tr.dataset.rowIndex != null ? Number(tr.dataset.rowIndex) : rowIndex;
        const isSelected = miniSheetSelectedRows.has(targetRowIndex);
        tr.classList.toggle("selected-row", isSelected);
      });
    }

    updateMiniSheetCellSelectionUi();
  }

  async function copyMiniSheetSelection() {
    if (hasMiniSheetCellSelection()) {
      const text = sorter.selectedMiniSheetCellTsv(sorterAssignedRows, miniSheetCellSelection);
      const ok = await window.copyToClipboardHtmlAndText(text, `<pre>${window.escapeHtml(text)}</pre>`);
      showToast(
        ok ? `${miniSheetCellSelectionCount()} selected cell(s) copied.` : "Could not copy the selected cells.",
        ok ? "success" : "error"
      );
      return;
    }

    const indexes = selectedMiniSheetIndexes();
    if (!indexes.length) {
      showToast("Select one or more rows first.", "error");
      return;
    }

    const tsv = sorter.selectedMiniSheetTsv(sorterAssignedRows, indexes, false);
    const ok = await window.copyToClipboardHtmlAndText(tsv, `<pre>${window.escapeHtml(tsv)}</pre>`);
    showToast(
      ok ? `${indexes.length} selected row(s) copied. Ready to paste.` : "Could not copy the selected rows.",
      ok ? "success" : "error"
    );
  }

  async function cutMiniSheetSelection() {
    if (hasMiniSheetCellSelection()) {
      const text = sorter.selectedMiniSheetCellTsv(sorterAssignedRows, miniSheetCellSelection);
      const ok = await window.copyToClipboardHtmlAndText(text, `<pre>${window.escapeHtml(text)}</pre>`);
      if (!ok) {
        showToast("Could not copy the selected cells, so nothing was cleared.", "error");
        return;
      }

      const count = miniSheetCellSelectionCount();
      const { startRow, endRow, startCol, endCol } = miniSheetCellSelection;

      for (let r = startRow; r <= endRow; r++) {
        const row = sorterAssignedRows[r];
        if (!row) continue;
        for (let c = startCol; c <= endCol; c++) {
          const field = sorter.MINI_SHEET_FIELDS[c];
          if (!field) continue;
          row[field] = "";
          if (field === "tl") row.tlNames = [];
        }
      }

      renderSorterRows(sorterAssignedRows);
      if (window.historyService?.captureIfChanged) {
        await window.historyService.captureIfChanged("aiSorter", `Cut ${count} cell(s) in AI Sorter`);
      }
      saveSorterDraftDebounced(300);
      showToast(`${count} cell(s) cut to clipboard.`, "success");
      return;
    }

    const indexes = selectedMiniSheetIndexes();
    if (!indexes.length) {
      showToast("Select one or more rows first.", "error");
      return;
    }

    const tsv = sorter.selectedMiniSheetTsv(sorterAssignedRows, indexes, false);
    const ok = await window.copyToClipboardHtmlAndText(tsv, `<pre>${window.escapeHtml(tsv)}</pre>`);
    if (!ok) {
      showToast("Could not copy the selected rows, so nothing was removed.", "error");
      return;
    }

    [...indexes].sort((a, b) => b - a).forEach(index => {
      sorterAssignedRows.splice(index, 1);
    });

    miniSheetSelectedRows.clear();
    miniSheetSelectionAnchor = null;
    renderSorterRows(sorterAssignedRows);
    if (window.historyService?.captureIfChanged) {
      await window.historyService.captureIfChanged("aiSorter", `Cut ${indexes.length} row(s) in AI Sorter`);
    }
    saveSorterDraftDebounced(300);
    showToast(`${indexes.length} row(s) cut to clipboard and removed from the Mini Sheet.`, "success");
  }

  async function removeSelectedMiniSheetRows() {
    const indexes = selectedMiniSheetIndexes();
    if (!indexes.length) {
      showToast("Select one or more rows first.", "error");
      return;
    }

    const approved = await window.appConfirm({
      title: "Remove selected rows?",
      message: `Remove ${indexes.length} selected row${indexes.length === 1 ? "" : "s"} from the current sorted result?`,
      confirmText: "Remove",
      tone: "danger"
    });

    if (!approved) return;

    [...indexes].sort((a, b) => b - a).forEach(index => {
      sorterAssignedRows.splice(index, 1);
    });

    miniSheetSelectedRows.clear();
    miniSheetSelectionAnchor = null;
    renderSorterRows(sorterAssignedRows);
    if (window.historyService?.captureIfChanged) {
      await window.historyService.captureIfChanged("aiSorter", `Removed ${indexes.length} row(s) from AI Sorter`);
    }
    saveSorterDraftDebounced(300);
    showToast("Selected Mini Sheet rows were removed.", "info");
  }

  function sendSelectedMiniSheetRowsToMaintenanceReport() {
    const indexes = selectedMiniSheetIndexes();
    if (!indexes.length) {
      showToast("Select one or more rows first.", "error");
      return;
    }

    const tsv = sorter.selectedMiniSheetTsv(sorterAssignedRows, indexes, false);
    const sourceTl = sorter.displayTLValue(sorterAssignedRows[indexes[0]]?.tl || "");

    if (typeof window.addMaintenanceSorterRowsToReport === "function") {
      window.addMaintenanceSorterRowsToReport(tsv, {
        rowCount: indexes.length,
        sourceTl
      });
    } else {
      window.__pendingMaintenanceRows = {
        tsv,
        rowCount: indexes.length,
        sourceTl
      };
    }

    showToast(`${indexes.length} selected row(s) sent directly to Maintenance Report.`, "success");
    switchWorkspace("maintenance");
  }

  function normalizeMiniSheetFindText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function highlightMiniSheetFindMatchesRealtime(query) {
    const sheet = el("maintenanceMiniSheet");
    if (!sheet) return;

    const tbody = sheet.querySelector("tbody");
    if (!tbody) return;

    tbody.querySelectorAll(".sheet-cell-match").forEach(cell => cell.classList.remove("sheet-cell-match"));

    const normalized = normalizeMiniSheetFindText(query);
    miniSheetFindMatches = [];

    if (!normalized) {
      tbody.querySelectorAll("tr[data-row-index]").forEach(tr => {
        tr.classList.remove("find-match", "find-current", "sheet-row-match");
      });
      if (el("miniSheetFindNextBtn")) el("miniSheetFindNextBtn").disabled = true;
      miniSheetFindCursor = -1;
      return;
    }

    sorterAssignedRows.forEach((row, rowIndex) => {
      const tr = tbody.querySelector(`tr[data-row-index="${rowIndex}"]`);
      if (!tr) return;

      let rowHasMatch = false;

      sorter.MINI_SHEET_FIELDS.forEach((field, colIndex) => {
        let val = field === "tl" ? sorter.displayTLValue(row.tl) : (row[field] != null ? String(row[field]) : "");
        const cellText = normalizeMiniSheetFindText(val);
        if (cellText.includes(normalized)) {
          rowHasMatch = true;
          const cell = tr.querySelector(`td[data-col-index="${colIndex}"]`);
          if (cell) cell.classList.add("sheet-cell-match");
        }
      });

      if (rowHasMatch) {
        miniSheetFindMatches.push(rowIndex);
        tr.classList.add("find-match", "sheet-row-match");
      } else {
        tr.classList.remove("find-match", "find-current", "sheet-row-match");
      }
    });

    if (el("miniSheetFindNextBtn")) {
      el("miniSheetFindNextBtn").disabled = miniSheetFindMatches.length <= 1;
    }

    if (miniSheetFindMatches.length > 0) {
      if (miniSheetFindCursor < 0 || miniSheetFindCursor >= miniSheetFindMatches.length) {
        miniSheetFindCursor = 0;
      }
      updateCurrentFindMatchHighlight();
    } else {
      miniSheetFindCursor = -1;
    }
  }

  function updateCurrentFindMatchHighlight() {
    const tbody = el("maintenanceMiniSheet")?.querySelector("tbody");
    if (!tbody) return;
    tbody.querySelectorAll("tr.find-current").forEach(tr => tr.classList.remove("find-current"));
    if (miniSheetFindCursor >= 0 && miniSheetFindCursor < miniSheetFindMatches.length) {
      const rowIndex = miniSheetFindMatches[miniSheetFindCursor];
      const tr = tbody.querySelector(`tr[data-row-index="${rowIndex}"]`);
      if (tr) tr.classList.add("find-current");
    }
  }

  function highlightMiniSheetFindMatches() {
    const input = el("miniSheetFindTlInput");
    highlightMiniSheetFindMatchesRealtime(input?.value || "");
  }

  function scrollToCurrentMiniSheetFindMatch() {
    if (miniSheetFindCursor < 0 || miniSheetFindCursor >= miniSheetFindMatches.length) return;
    const rowIndex = miniSheetFindMatches[miniSheetFindCursor];
    const row = el("maintenanceMiniSheet")?.querySelector(`tr[data-row-index="${rowIndex}"]`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }

  function findTeamLeaderInMiniSheet() {
    const input = el("miniSheetFindTlInput");
    const query = input?.value || "";

    highlightMiniSheetFindMatchesRealtime(query);

    if (!miniSheetFindMatches.length) {
      const trimmed = query.trim();
      if (!trimmed) {
        showToast("Type a search term first (TL, Account, Site, Station, etc.).", "info");
        input?.focus();
      } else {
        showToast(`No matches found for "${trimmed}".`, "error");
      }
      return;
    }

    miniSheetSelectedRows.clear();
    miniSheetFindMatches.forEach(index => miniSheetSelectedRows.add(index));
    miniSheetSelectionAnchor = miniSheetFindMatches[0];
    miniSheetFindCursor = 0;

    updateMiniSheetSelectionUi();
    updateCurrentFindMatchHighlight();
    scrollToCurrentMiniSheetFindMatch();

    input?.blur();
    setMiniSheetKeyboardActive(true);

    const count = miniSheetFindMatches.length;
    showToast(`${count} row(s) matched and selected.`, "success");
  }

  function findNextTeamLeaderMatch() {
    if (!miniSheetFindMatches.length) {
      findTeamLeaderInMiniSheet();
      return;
    }

    miniSheetFindCursor = (miniSheetFindCursor + 1) % miniSheetFindMatches.length;
    updateCurrentFindMatchHighlight();
    scrollToCurrentMiniSheetFindMatch();
    el("miniSheetFindTlInput")?.blur();
    setMiniSheetKeyboardActive(true);
    showToast(`Match ${miniSheetFindCursor + 1} of ${miniSheetFindMatches.length}.`, "info");
  }

  function setMiniSheetKeyboardActive(active) {
    miniSheetKeyboardActive = !!active;
    const card = el("maintenanceMiniSheet")?.closest(".mini-sheet-card");
    if (card) {
      card.classList.toggle("keyboard-active", miniSheetKeyboardActive);
    }
  }

  async function copySorted() {
    if (!sorterAssignedRows.length) {
      showSorterMessage("Sort a report first before copying.", "error");
      return;
    }

    const text = sorter.rowsToTSV(sorterAssignedRows);
    const ok = await window.copyToClipboardHtmlAndText(text, `<pre>${window.escapeHtml(text)}</pre>`);
    showToast(
      ok ? "Sorted report copied. You can paste it directly into Google Sheets." : "Copy failed. Please try again.",
      ok ? "success" : "error"
    );
  }

  function clearMaintenance() {
    clearSorterDraft();
    const input = el("maintenanceInput");
    if (input) input.value = "";
    sorterParsedRows = [];
    sorterAssignedRows = [];
    sorterAssignments = new Map();
    miniSheetSelectedRows.clear();
    miniSheetSelectionAnchor = null;
    miniSheetCellSelection = null;
    miniSheetCellAnchor = null;
    miniSheetCellFocus = null;
    miniSheetFindMatches = [];
    miniSheetFindCursor = -1;
    setMiniSheetKeyboardActive(false);

    if (el("miniSheetFindTlInput")) el("miniSheetFindTlInput").value = "";
    if (el("miniSheetFindNextBtn")) el("miniSheetFindNextBtn").disabled = true;
    highlightMiniSheetFindMatchesRealtime("");

    const tbodyCompat = el("maintenanceOutputTable")?.querySelector("tbody");
    if (tbodyCompat) tbodyCompat.innerHTML = "";
    const tbodyMini = el("maintenanceMiniSheet")?.querySelector("tbody");
    if (tbodyMini) tbodyMini.innerHTML = "";

    if (el("miniSheetRowCount")) el("miniSheetRowCount").textContent = "0 rows";
    if (el("overallRowCount")) el("overallRowCount").textContent = "0 rows";
    if (el("sorterGfCount")) el("sorterGfCount").textContent = "GF: 0";
    if (el("sorter1fCount")) el("sorter1fCount").textContent = "1F: 0";
    if (el("sorter2fCount")) el("sorter2fCount").textContent = "2F: 0";
    if (el("sorterReviewCount")) el("sorterReviewCount").textContent = "Review: 0";

    const emptyNotice = el("maintenanceEmpty");
    if (emptyNotice) emptyNotice.style.display = "block";

    updateMiniSheetSelectionUi();
    hideSorterMessage();
  }

  async function clearAllMiniSheetWorkspace() {
    if (!sorterAssignedRows.length && !String(el("maintenanceInput")?.value || "").trim()) {
      showToast("The sorter workspace is already empty.", "info");
      return;
    }

    const approved = await window.appConfirm({
      title: "Clear AI Sorter workspace?",
      message: "Clear the pasted report and every sorted Mini Sheet row?",
      confirmText: "Clear Workspace",
      tone: "danger"
    });

    if (!approved) return;

    clearMaintenance();
    showToast("AI Sorter cleared. Paste your next maintenance report.", "info");
  }

  // TL Floor Assignments Modal
  function renderTlSummaryTable() {
    const tbody = el("tlSummaryTable")?.querySelector("tbody");
    if (!tbody) return;

    const overrides = sorter.loadOverrides();
    const hidden = new Set(sorter.loadHiddenTLs());
    const edits = sorter.loadTLNameEdits();

    const entries = [...sorterAssignments.entries()]
      .filter(([name]) => !hidden.has(name))
      .sort((a, b) => {
        const aName = edits[a[0]] || a[0];
        const bName = edits[b[0]] || b[0];
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      });

    if (!entries.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:var(--text-muted); padding:18px;">
            No Team Leaders in the assignment list. Analyze a report first.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = entries.map(([name, item]) => {
      const detected = item.floor || sorter.FLOOR.REVIEW;
      const manual = overrides[name] || "";
      const shownName = edits[name] || name;

      return `
        <tr>
          <td>
            <input
              type="text"
              class="form-control form-control-sm tl-name-editor"
              data-original-tl="${encodeURIComponent(name)}"
              value="${window.escapeHtml(shownName)}"
              autocomplete="off"
              spellcheck="false"
              aria-label="Edit Team Leader name">
          </td>
          <td>
            <select
              class="form-control form-control-sm tl-floor-editor"
              data-original-tl="${encodeURIComponent(name)}"
              aria-label="Floor assignment for ${window.escapeHtml(shownName)}">
              <option value="" ${manual === "" ? "selected" : ""}>Auto â€” ${window.escapeHtml(detected)}</option>
              <option value="${sorter.FLOOR.GROUND}" ${manual === sorter.FLOOR.GROUND ? "selected" : ""}>Ground Floor</option>
              <option value="${sorter.FLOOR.FIRST}" ${manual === sorter.FLOOR.FIRST ? "selected" : ""}>1st Floor</option>
              <option value="${sorter.FLOOR.SECOND}" ${manual === sorter.FLOOR.SECOND ? "selected" : ""}>2nd Floor</option>
            </select>
          </td>
          <td style="text-align:center;">
            <button
              type="button"
              class="btn btn-danger-ghost btn-sm tl-row-remove"
              data-original-tl="${encodeURIComponent(name)}">
              Remove
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".tl-floor-editor").forEach(select => {
      select.addEventListener("change", function () {
        const originalName = decodeURIComponent(this.getAttribute("data-original-tl") || "");
        const data = sorter.loadOverrides();
        if (this.value) data[originalName] = this.value;
        else delete data[originalName];
        sorter.saveOverrides(data);
        if (el("maintenanceInput")?.value.trim()) {
          analyzeMaintenance(false);
        } else {
          saveSorterDraftDebounced(300);
        }
      });
    });

    tbody.querySelectorAll(".tl-name-editor").forEach(input => {
      const saveName = function () {
        const originalName = decodeURIComponent(this.getAttribute("data-original-tl") || "");
        const newName = this.value.replace(/\s+/g, " ").trim();
        const data = sorter.loadTLNameEdits();
        if (newName && newName !== originalName) data[originalName] = newName;
        else delete data[originalName];
        sorter.saveTLNameEdits(data);
        if (sorterAssignedRows.length) renderSorterRows(sorterAssignedRows);
        saveSorterDraftDebounced(300);
      };

      input.addEventListener("change", saveName);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          this.blur();
        }
      });
    });

    tbody.querySelectorAll(".tl-row-remove").forEach(button => {
      button.addEventListener("click", async function () {
        const originalName = decodeURIComponent(this.getAttribute("data-original-tl") || "");
        const shownName = sorter.getEditedTLName(originalName);

        const approved = await window.appConfirm({
          title: "Remove Team Leader?",
          message: `Remove "${shownName}" from the Team Leader Assignment list?`,
          confirmText: "Remove",
          tone: "danger"
        });

        if (!approved) return;

        const hiddenNames = new Set(sorter.loadHiddenTLs());
        hiddenNames.add(originalName);
        sorter.saveHiddenTLs([...hiddenNames]);
        renderTlSummaryTable();
        saveSorterDraftDebounced(300);
        showToast(`${shownName} removed from assignment list.`, "info");
      });
    });
  }

  function initSorterController() {
    // History adapter binding for AI Sorter undo/redo transactions
    sorter.getSortedRows = () => (sorterAssignedRows || []).map(r => ({ ...r }));
    sorter.setSortedRows = (rows) => {
      sorterAssignedRows = Array.isArray(rows) ? rows.map(r => ({ ...r })) : [];
      renderSorterRows(sorterAssignedRows);
      updateMiniSheetSelectionUi();
      saveSorterDraftDebounced(400);
    };
    if (window.sorterService) {
      window.sorterService.getSortedRows = sorter.getSortedRows;
      window.sorterService.setSortedRows = sorter.setSortedRows;
    }

    // Debounced draft autosave on raw textarea input
    el("maintenanceInput")?.addEventListener("input", () => {
      saveSorterDraftDebounced(500);
    });

    // Flush any pending draft save before unload
    window.addEventListener("beforeunload", () => {
      if (sorterAutosaveTimer) {
        clearTimeout(sorterAutosaveTimer);
        sorterAutosaveTimer = null;
        persistSorterDraftNow();
      }
    });

    // Automatically check and restore unfinished draft on app initialization
    restoreSorterDraft().catch(console.error);

    el("maintenanceSortBtn")?.addEventListener("click", () => {
      miniSheetSelectedRows.clear();
      miniSheetSelectionAnchor = null;
      miniSheetCellSelection = null;
      miniSheetCellAnchor = null;
      miniSheetCellFocus = null;
      miniSheetFindMatches = [];
      miniSheetFindCursor = -1;

      if (el("miniSheetFindTlInput")) el("miniSheetFindTlInput").value = "";
      if (el("miniSheetFindNextBtn")) el("miniSheetFindNextBtn").disabled = true;

      analyzeMaintenance(true);
    });

    el("maintenanceCopyBtn")?.addEventListener("click", copySorted);
    el("maintenanceClearBtn")?.addEventListener("click", async () => {
      if (!String(el("maintenanceInput")?.value || "").trim() && !sorterAssignedRows.length) {
        showToast("The AI Sorter is already empty.", "info");
        return;
      }
      const approved = await window.appConfirm({
        title: "Clear Maintenance AI Sorter?",
        message: "The pasted report and current sorted workspace will be cleared.",
        confirmText: "Clear Report",
        tone: "danger"
      });
      if (approved) clearMaintenance();
    });

    el("maintenanceResetAssignmentsBtn")?.addEventListener("click", async () => {
      const approved = await window.appConfirm({
        title: "Reset Team Leader assignments?",
        message: "Saved TL floors, edited names, and removed assignment rows will be reset.",
        confirmText: "Reset",
        tone: "danger"
      });
      if (!approved) return;

      sorter.resetAssignments();
      if (el("maintenanceInput")?.value.trim()) analyzeMaintenance(false);
      showToast("Team Leader Assignment was reset. Auto-learning will be used again.", "info");
    });

    el("btnOpenTlAssignments")?.addEventListener("click", () => {
      renderTlSummaryTable();
      el("modalTlAssignments").hidden = false;
    });

    el("btnCloseTlAssignments")?.addEventListener("click", () => {
      el("modalTlAssignments").hidden = true;
    });

    el("btnDoneTlAssignments")?.addEventListener("click", () => {
      el("modalTlAssignments").hidden = true;
    });

    el("btnModalResetTlAssignments")?.addEventListener("click", async () => {
      const approved = await window.appConfirm({
        title: "Reset Team Leader assignments?",
        message: "Reset all saved TL floor overrides, edited names, and hidden assignments?",
        confirmText: "Reset All",
        tone: "danger"
      });
      if (!approved) return;
      sorter.resetAssignments();
      renderTlSummaryTable();
      if (el("maintenanceInput")?.value.trim()) analyzeMaintenance(false);
      showToast("Assignments reset.", "info");
    });

    el("miniSheetSelectAllBtn")?.addEventListener("click", selectAllMiniSheetRows);
    el("miniSheetRemoveRowBtn")?.addEventListener("click", removeSelectedMiniSheetRows);
    el("miniSheetSelectSameTlBtn")?.addEventListener("click", selectSameTlMiniSheetRows);
    el("miniSheetCopyRowsBtn")?.addEventListener("click", () => copyMiniSheetSelection().catch(console.error));
    el("miniSheetCutRowsBtn")?.addEventListener("click", () => cutMiniSheetSelection().catch(console.error));
    el("miniSheetToReportBtn")?.addEventListener("click", sendSelectedMiniSheetRowsToMaintenanceReport);
    el("miniSheetClearSelectionBtn")?.addEventListener("click", clearAnyMiniSheetSelection);
    el("miniSheetFindTlBtn")?.addEventListener("click", findTeamLeaderInMiniSheet);
    el("miniSheetFindNextBtn")?.addEventListener("click", findNextTeamLeaderMatch);
    el("miniSheetClearAllBtn")?.addEventListener("click", clearAllMiniSheetWorkspace);

    const miniSheetFindInput = el("miniSheetFindTlInput");
    if (miniSheetFindInput) {
      miniSheetFindInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          findTeamLeaderInMiniSheet();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.value = "";
          miniSheetFindMatches = [];
          miniSheetFindCursor = -1;
          highlightMiniSheetFindMatchesRealtime("");
          if (el("miniSheetFindNextBtn")) el("miniSheetFindNextBtn").disabled = true;
        }
      });

      miniSheetFindInput.addEventListener("input", event => {
        highlightMiniSheetFindMatchesRealtime(event.target.value);
      });

      miniSheetFindInput.addEventListener("focus", () => {
        setMiniSheetKeyboardActive(false);
        clearMiniSheetCellSelection(true);
        const activeEditing = el("maintenanceMiniSheet")?.querySelector("td.cell-editing, td[data-editing='true']");
        if (activeEditing) activeEditing.blur();
      });
    }

    // Table focus & outside click listener (mirrors V1 lines 23700-23730)
    document.addEventListener("mousedown", (event) => {
      if (currentWorkspace !== "sorter") return;

      const isInsideFindBar = !!event.target.closest?.(".mini-sheet-findbar");
      if (isInsideFindBar) {
        setMiniSheetKeyboardActive(false);
        clearMiniSheetCellSelection(true);
        return;
      }

      const isInsideTable = !!event.target.closest?.("#maintenanceMiniSheet");
      if (isInsideTable) {
        setMiniSheetKeyboardActive(true);
        return;
      }

      const isInsideActions = !!event.target.closest?.(".mini-sheet-actions, .ai-sorter-toolbar, .mini-sheet-header, .mini-sheet-footer");
      if (isInsideActions) {
        // Keep current selection active so action buttons operate properly
        return;
      }

      // Clicked outside table and toolbar -> clear keyboard active and cell selection
      setMiniSheetKeyboardActive(false);
      clearMiniSheetCellSelection(true);

      // If clicked outside the entire sheet card, clear row selection as well
      if (!event.target.closest?.(".mini-sheet-card, #maintenanceMiniSheetCard, .card")) {
        miniSheetSelectedRows.clear();
        miniSheetSelectionAnchor = null;
        updateMiniSheetSelectionUi();
      }
    });

    document.addEventListener("mouseup", () => {
      if (!miniSheetCellDragging) return;
      miniSheetCellDragging = false;
      el("maintenanceMiniSheet")?.classList.remove("cell-range-dragging");
    });

    // =========================================================================
    // GLOBAL KEYBOARD SHORTCUTS: AI SORTER (items 5-8)
    // Mirrors V1 lines 23840-23967 exactly
    // =========================================================================
    document.addEventListener("keydown", (event) => {
      if (currentWorkspace !== "sorter") return;
      const active = document.activeElement;
      // Guard: never hijack shortcuts when user is typing in a non-minisheet input
      const inTypingField = active && /^(INPUT|TEXTAREA|SELECT)$/i.test(active.tagName) &&
        !active.closest("#maintenanceMiniSheet");
      if (inTypingField) return;
      const editingCell = active && active.matches &&
        active.matches('#maintenanceMiniSheet td[contenteditable="true"]') &&
        active.dataset.editing === "true";
      // Ctrl+F: Focus find bar
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "f") {
        if (editingCell) active.blur();
        event.preventDefault();
        setMiniSheetKeyboardActive(false);
        clearMiniSheetCellSelection(true);
        const findInput = el("miniSheetFindTlInput");
        if (findInput) { findInput.focus(); findInput.select(); }
        return;
      }
      // F3: Find next match
      if (event.key === "F3" && !editingCell) {
        event.preventDefault();
        setMiniSheetKeyboardActive(true);
        findNextTeamLeaderMatch();
        return;
      }
      // Arrow keys when mini-sheet keyboard active
      if (miniSheetKeyboardActive &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) &&
          !editingCell) {
        handleMiniSheetArrowNavigation(event);
        return;
      }
      if (!miniSheetKeyboardActive) return;
      if (editingCell) return;
      // Ctrl+A: Select all rows
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAllMiniSheetRows();
        return;
      }
      // Ctrl+C: Copy selected rows / cells
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "c") {
        if (!hasMiniSheetCellSelection() && !miniSheetSelectedRows.size) return;
        event.preventDefault();
        copyMiniSheetSelection().catch(console.error);
        return;
      }
      // Ctrl+X: Cut selected rows / cells
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "x") {
        if (!hasMiniSheetCellSelection() && !miniSheetSelectedRows.size) return;
        event.preventDefault();
        cutMiniSheetSelection().catch(console.error);
        return;
      }
      // Ctrl+Shift+M: Send to Maintenance report
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        if (!miniSheetSelectedRows.size) return;
        event.preventDefault();
        sendSelectedMiniSheetRowsToMaintenanceReport();
        return;
      }
      // Delete / Backspace: Clear cells or remove rows
      if (event.key === "Delete" || event.key === "Backspace") {
        if (hasMiniSheetCellSelection()) {
          event.preventDefault();
          const { startRow, endRow, startCol, endCol } = miniSheetCellSelection;
          for (let r = startRow; r <= endRow; r++) {
            const row = sorterAssignedRows[r];
            if (!row) continue;
            for (let c = startCol; c <= endCol; c++) {
              const field = sorter.MINI_SHEET_FIELDS[c];
              if (!field) continue;
              row[field] = "";
              if (field === "tl") row.tlNames = [];
            }
          }
          renderSorterRows(sorterAssignedRows);
          if (window.historyService?.captureIfChanged) {
            window.historyService.captureIfChanged("aiSorter", "Cleared selected cell(s) in AI Sorter");
          }
          saveSorterDraftDebounced(300);
          showToast("Selected cells cleared.", "info");
          return;
        }
        if (miniSheetSelectedRows.size) {
          event.preventDefault();
          removeSelectedMiniSheetRows();
          return;
        }
      }
      // Enter: Begin editing top-left selected cell
      if (event.key === "Enter") {
        if (hasMiniSheetCellSelection()) {
          event.preventDefault();
          const { startRow, startCol } = miniSheetCellSelection;
          const cell = el("maintenanceMiniSheet")?.querySelector(
            `td[data-row-index="${startRow}"][data-col-index="${startCol}"]`
          );
          if (cell) beginMiniSheetCellEdit(cell);
        } else if (miniSheetSelectedRows.size) {
          event.preventDefault();
          const sorted = [...miniSheetSelectedRows].sort((a, b) => a - b);
          const firstRow = sorted[0];
          const cell = el("maintenanceMiniSheet")?.querySelector(
            `td[data-row-index="${firstRow}"][data-col-index="0"]`
          );
          if (cell) beginMiniSheetCellEdit(cell);
        }
        return;
      }
      // Escape: Clear selection
      if (event.key === "Escape") {
        if (!hasMiniSheetCellSelection() && !miniSheetSelectedRows.size) return;
        event.preventDefault();
        clearAnyMiniSheetSelection();
        return;
      }
    });

    // Ctrl+V paste for AI Sorter: routes clipboard rows into mini sheet
    document.addEventListener("paste", (event) => {
      if (currentWorkspace !== "sorter") return;
      if (!miniSheetKeyboardActive) return;
      const active = document.activeElement;
      if (active && /^(INPUT|TEXTAREA|SELECT)$/i.test(active.tagName) &&
          !active.closest("#maintenanceMiniSheet")) return;
      const editingCell = active && active.matches &&
        active.matches('#maintenanceMiniSheet td[contenteditable="true"]') &&
        active.dataset.editing === "true";
      if (editingCell) return;
      const text = event.clipboardData?.getData("text/plain") || "";
      if (!text.trim()) return;
      event.preventDefault();
      if (hasMiniSheetCellSelection()) {
        pasteIntoMiniSheetCellSelection(text);
        return;
      }
      pasteRowsIntoMiniSheet(text);
    });
  }

  // =========================================================================
  // WORKSPACE 4: MAINTENANCE REPORT & MULTI-BLOCK CANVAS CONTROLLER
  // =========================================================================
  let maintenanceState = {
    date: "",

    destinationKey: "mabini_a",
    title: "Mabini Site A - 1st & 2nd Floor",
    blocks: []
  };
  let maintenanceAutosaveTimer = null;
  let activePasteBlockId = null;

  function setMaintenanceStatusMessage(text, type = "info") {
    const msgEl = el("simpleEodMessage");
    if (!msgEl) return;
    if (!text) {
      msgEl.style.display = "none";
      msgEl.textContent = "";
      return;
    }
    msgEl.textContent = text;
    msgEl.className = `maintenance-message ${type}`;
    msgEl.style.display = "flex";
  }

  function updateMaintenanceAutosaveIndicator(statusText, className = "saved") {
    const statusEl = el("simpleEodAutosaveStatus");
    if (!statusEl) return;
    statusEl.className = `maintenance-autosave-status ${className}`;
    statusEl.textContent = statusText;
  }

  function queueMaintenanceAutosave() {
    updateMaintenanceAutosaveIndicator("â— Saving...", "saving");
    if (window.historyService?.scheduleCapture) {
      window.historyService.scheduleCapture("maintenanceReport", "Updated maintenance report", 800);
    }
    if (maintenanceAutosaveTimer) clearTimeout(maintenanceAutosaveTimer);
    maintenanceAutosaveTimer = setTimeout(async () => {
      try {
        await maintenance.saveDraft(maintenanceState);
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        updateMaintenanceAutosaveIndicator(`â— Auto-saved (${timeStr})`, "saved");
      } catch (err) {
        console.error("Autosave draft error:", err);
        updateMaintenanceAutosaveIndicator("â— Autosave error", "error");
      }
    }, 600);
  }

  function renderMaintenanceWorkspace() {
    if (!maintenanceState.blocks.length) {
      loadMaintenanceDraftInitial();
    } else {
      syncMaintenanceHeaderUi();
      renderMaintenanceBlocks();
    }
    checkMaintenanceSheetsConnectionState();
  }

  function syncMaintenanceHeaderUi() {
    const destSelect = el("simpleEodDestination");
    if (destSelect && maintenanceState.destinationKey) {
      destSelect.value = maintenanceState.destinationKey;
    }
    const dateInput = el("simpleEodDate");
    if (dateInput) {
      if (!maintenanceState.date) {
        maintenanceState.date = maintenance.todayLocal();
      }
      dateInput.value = maintenanceState.date;
    }
    const siteInput = el("simpleEodSite");
    if (siteInput && maintenanceState.title) {
      siteInput.value = maintenanceState.title;
    }
  }

  async function loadMaintenanceDraftInitial() {
    try {
      const saved = await maintenance.loadDraft();
      if (saved && Array.isArray(saved.blocks) && saved.blocks.length > 0) {
        maintenanceState = {
          date: saved.date || maintenance.todayLocal(),
          destinationKey: saved.destinationKey || "mabini_a",
          title: saved.title || maintenance.MAINTENANCE_DESTINATIONS[saved.destinationKey]?.label || "Mabini Site A - 1st & 2nd Floor",
          blocks: saved.blocks
        };
      } else {
        maintenanceState = {
          date: maintenance.todayLocal(),
          destinationKey: "mabini_a",
          title: maintenance.MAINTENANCE_DESTINATIONS["mabini_a"].label,
          blocks: [maintenance.makeBlock()]
        };
      }
    } catch (err) {
      console.warn("Failed to load initial maintenance draft:", err);
      maintenanceState = {
        date: maintenance.todayLocal(),
        destinationKey: "mabini_a",
        title: maintenance.MAINTENANCE_DESTINATIONS["mabini_a"].label,
        blocks: [maintenance.makeBlock()]
      };
    }
    syncMaintenanceHeaderUi();
    renderMaintenanceBlocks();

    if (window.__pendingMaintenanceRows) {
      const pending = window.__pendingMaintenanceRows;
      window.__pendingMaintenanceRows = null;
      if (typeof window.addMaintenanceSorterRowsToReport === "function") {
        window.addMaintenanceSorterRowsToReport(pending.tsv, pending);
      }
    }
  }

  function renderMaintenanceBlocks() {
    const container = el("simpleEodBlocks");
    if (!container) return;

    container.innerHTML = "";

    maintenanceState.blocks.forEach((block, index) => {
      const blockEl = document.createElement("div");
      blockEl.className = "eod-block-card" + (block.dataHidden ? " is-hidden-report" : "");
      blockEl.id = `block_${block.id}`;
      blockEl.dataset.blockId = block.id;
      blockEl.addEventListener("click", () => {
        if (!block.dataHidden) activePasteBlockId = block.id;
      });

      // Header row
      const headerRow = document.createElement("div");
      headerRow.className = "eod-block-head";

      const titleWrap = document.createElement("div");
      titleWrap.style.display = "flex";
      titleWrap.style.alignItems = "center";
      titleWrap.style.gap = "8px";

      const titleSpan = document.createElement("span");
      titleSpan.className = "eod-block-title";
      titleSpan.textContent = `Report Section ${index + 1}`;

      titleWrap.appendChild(titleSpan);

      if (block.dataHidden) {
        const hiddenBadge = document.createElement("span");
        hiddenBadge.className = "badge";
        hiddenBadge.style.background = "rgba(245, 158, 11, 0.18)";
        hiddenBadge.style.color = "#f59e0b";
        hiddenBadge.style.border = "1px solid rgba(245, 158, 11, 0.45)";
        hiddenBadge.style.fontSize = "10px";
        hiddenBadge.style.fontWeight = "700";
        hiddenBadge.style.letterSpacing = "0.5px";
        hiddenBadge.textContent = "HIDDEN REPORT";
        titleWrap.appendChild(hiddenBadge);

        const rowsCount = maintenance.maintenanceRowsForSheets(block.lanesText || "").length;
        const shotCount = (block.screenshots || []).length;
        const summarySpan = document.createElement("span");
        summarySpan.style.fontSize = "11.5px";
        summarySpan.style.color = "var(--text-muted)";
        summarySpan.textContent = `(${rowsCount} row${rowsCount === 1 ? "" : "s"} Â· ${shotCount} screenshot${shotCount === 1 ? "" : "s"})`;
        titleWrap.appendChild(summarySpan);
      }

      const actionsWrap = document.createElement("div");
      actionsWrap.className = "eod-block-actions";

      // â”€â”€ Hide Report / Show Report toggle button â”€â”€
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      if (block.dataHidden) {
        toggleBtn.className = "btn btn-primary btn-sm";
        toggleBtn.textContent = "Show Report";
        toggleBtn.title = "Show report content";
        toggleBtn.style.fontWeight = "600";
      } else {
        toggleBtn.className = "btn btn-outline btn-sm";
        toggleBtn.textContent = "Hide Report";
        toggleBtn.title = "Hide report content";
      }
      toggleBtn.addEventListener("click", () => {
        block.dataHidden = !block.dataHidden;
        if (block.dataHidden && activePasteBlockId === block.id) {
          const nextVisible = maintenanceState.blocks.find(b => b.id !== block.id && !b.dataHidden);
          activePasteBlockId = nextVisible ? nextVisible.id : null;
        } else if (!block.dataHidden) {
          activePasteBlockId = block.id;
        }
        renderMaintenanceBlocks();
        queueMaintenanceAutosave();
        if (window.historyService?.captureIfChanged) {
          window.historyService.captureIfChanged("maintenanceReport", block.dataHidden ? `Hid Section ${index + 1}` : `Showed Section ${index + 1}`);
        }
      });
      actionsWrap.appendChild(toggleBtn);

      // Remove block button
      if (maintenanceState.blocks.length > 1) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-danger-ghost btn-sm";
        removeBtn.textContent = "Remove Section";
        removeBtn.addEventListener("click", async () => {
          const ok = await window.appConfirm({
            title: `Remove Report Section ${index + 1}?`,
            message: "Remove this section and its incident issues, remarks, and screenshots?",
            confirmText: "Remove",
            tone: "danger"
          });
          if (!ok) return;
          maintenanceState.blocks.splice(index, 1);
          renderMaintenanceBlocks();
          queueMaintenanceAutosave();
          if (window.historyService?.captureIfChanged) {
            await window.historyService.captureIfChanged("maintenanceReport", `Removed Section ${index + 1}`);
          }
          showToast(`Report Section ${index + 1} removed.`, "info");
        });
        actionsWrap.appendChild(removeBtn);
      }

      headerRow.appendChild(titleWrap);
      headerRow.appendChild(actionsWrap);
      blockEl.appendChild(headerRow);

      // Content wrapper â€” hidden when block.dataHidden is true
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "eod-block-content";
      if (block.dataHidden) {
        contentWrapper.style.display = "none";
      }

      // Desktop side-by-side grid
      const grid = document.createElement("div");
      grid.className = "maintenance-incident-action-grid";

      // Left column: Lanes / Incidents
      const leftCol = document.createElement("div");
      leftCol.className = "form-group";
      leftCol.style.marginBottom = "0";
      leftCol.style.display = "flex";
      leftCol.style.flexDirection = "column";
      leftCol.style.gap = "4px";

      const leftLabel = document.createElement("label");
      leftLabel.className = "form-label";
      leftLabel.style.fontSize = "11px";
      leftLabel.style.fontWeight = "600";
      leftLabel.style.textTransform = "uppercase";
      leftLabel.style.letterSpacing = "0.04em";
      leftLabel.style.color = "var(--text-secondary)";
      leftLabel.style.marginBottom = "2px";
      leftLabel.textContent = "Station Issues / Incident (Lanes)";
      leftCol.appendChild(leftLabel);

      const lanesArea = document.createElement("textarea");
      lanesArea.className = "form-control eod-lanes-textarea";
      lanesArea.rows = 6;
      lanesArea.style.flex = "1";
      lanesArea.style.minHeight = "120px";
      lanesArea.placeholder = "Paste station rows or enter incident issues (TSV format from Sorter or manual)...";
      lanesArea.value = block.lanesText || "";
      lanesArea.addEventListener("focus", () => {
        activePasteBlockId = block.id;
      });
      lanesArea.addEventListener("input", () => {
        block.lanesText = lanesArea.value;
        const detected = maintenance.detectMaintenanceDestinationFromRows(block.lanesText);
        if (detected && detected !== maintenanceState.destinationKey && maintenance.MAINTENANCE_DESTINATIONS[detected]) {
          maintenanceState.destinationKey = detected;
          maintenanceState.title = maintenance.MAINTENANCE_DESTINATIONS[detected].label;
          syncMaintenanceHeaderUi();
          showToast(`Destination auto-detected: ${maintenanceState.title}`, "info");
        }
        queueMaintenanceAutosave();
      });
      leftCol.appendChild(lanesArea);
      grid.appendChild(leftCol);

      // Right column: Action Taken / Remarks
      const rightCol = document.createElement("div");
      rightCol.className = "form-group";
      rightCol.style.marginBottom = "0";
      rightCol.style.display = "flex";
      rightCol.style.flexDirection = "column";
      rightCol.style.gap = "4px";

      const rightLabel = document.createElement("label");
      rightLabel.className = "form-label";
      rightLabel.style.fontSize = "11px";
      rightLabel.style.fontWeight = "600";
      rightLabel.style.textTransform = "uppercase";
      rightLabel.style.letterSpacing = "0.04em";
      rightLabel.style.color = "var(--text-secondary)";
      rightLabel.style.marginBottom = "2px";
      rightLabel.textContent = "Action Taken / Remarks";
      rightCol.appendChild(rightLabel);

      // --- Quick Choice Presets Container ---
      const presetContainer = document.createElement("div");
      presetContainer.className = "maint-preset-container";

      // Chips row with integrated + Add Choice
      const chipsRow = document.createElement("div");
      chipsRow.className = "maint-preset-chips";
      chipsRow.setAttribute("role", "group");
      chipsRow.setAttribute("aria-label", "Quick Remark Choices");

      const availableChoices = maintenance.getQuickRemarks ? maintenance.getQuickRemarks() : [];
      const renderChoices = [...availableChoices];
      if (block.selectedPreset && !renderChoices.includes(block.selectedPreset)) {
        renderChoices.push(block.selectedPreset);
      }

      renderChoices.forEach(choiceText => {
        const isSelected = block.selectedPreset === choiceText;
        const isDefault = Array.isArray(maintenance.DEFAULT_QUICK_REMARKS) && maintenance.DEFAULT_QUICK_REMARKS.includes(choiceText);

        const chipBtn = document.createElement("button");
        chipBtn.type = "button";
        chipBtn.className = "maint-preset-chip" + (isSelected ? " is-selected" : "");
        chipBtn.setAttribute("aria-pressed", isSelected ? "true" : "false");
        chipBtn.title = isSelected ? "Active preset (Click to deselect)" : `Select preset: "${choiceText}"`;

        const indicator = document.createElement("span");
        indicator.className = "maint-preset-chip-indicator";
        chipBtn.appendChild(indicator);

        const textSpan = document.createElement("span");
        textSpan.className = "maint-preset-chip-text";
        textSpan.textContent = choiceText;
        chipBtn.appendChild(textSpan);

        // Delete button for custom choices only
        if (!isDefault) {
          const delBtn = document.createElement("span");
          delBtn.className = "maint-preset-chip-del";
          delBtn.setAttribute("role", "button");
          delBtn.setAttribute("tabindex", "0");
          delBtn.setAttribute("aria-label", `Delete choice ${choiceText}`);
          delBtn.title = "Delete this choice";
          delBtn.textContent = "âœ•";
          delBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const ok = await window.appConfirm({
              title: "Delete Choice?",
              message: `Remove "${choiceText}" from quick remark choices?`,
              confirmText: "Delete",
              tone: "danger"
            });
            if (!ok) return;
            maintenance.deleteQuickRemark(choiceText);
            renderMaintenanceBlocks();
            showToast("Choice deleted.", "info");
          });
          delBtn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              delBtn.click();
            }
          });
          chipBtn.appendChild(delBtn);
        }

        chipBtn.addEventListener("click", () => {
          if (block.selectedPreset === choiceText) {
            block.selectedPreset = "";
            block.remarks = [""];
            showToast("Preset deselected.", "info");
          } else {
            block.selectedPreset = choiceText;
            block.remarks = [choiceText];
            showToast(`Selected preset: "${choiceText}"`, "info");
          }
          renderMaintenanceBlocks();
          queueMaintenanceAutosave();
        });

        chipsRow.appendChild(chipBtn);
      });

      // + Add Choice button seamlessly attached at the end of chips
      const addChoiceTrigger = document.createElement("button");
      addChoiceTrigger.type = "button";
      addChoiceTrigger.className = "maint-preset-add-btn";
      addChoiceTrigger.textContent = "+ Add Choice";
      addChoiceTrigger.title = "Add new custom remark choice";
      chipsRow.appendChild(addChoiceTrigger);

      presetContainer.appendChild(chipsRow);

      // Inline Add Form
      const inlineForm = document.createElement("div");
      inlineForm.className = "maint-preset-inline-form";
      inlineForm.style.display = "none";

      const inlineInput = document.createElement("input");
      inlineInput.type = "text";
      inlineInput.className = "maint-preset-inline-input";
      inlineInput.placeholder = "Type new remark choice...";
      inlineInput.maxLength = 140;

      const inlineSaveBtn = document.createElement("button");
      inlineSaveBtn.type = "button";
      inlineSaveBtn.className = "btn btn-primary btn-sm";
      inlineSaveBtn.style.padding = "2px 8px";
      inlineSaveBtn.style.fontSize = "10.5px";
      inlineSaveBtn.textContent = "Add";

      const inlineCancelBtn = document.createElement("button");
      inlineCancelBtn.type = "button";
      inlineCancelBtn.className = "btn btn-ghost btn-sm";
      inlineCancelBtn.style.padding = "2px 6px";
      inlineCancelBtn.style.fontSize = "10.5px";
      inlineCancelBtn.textContent = "Cancel";

      inlineForm.appendChild(inlineInput);
      inlineForm.appendChild(inlineSaveBtn);
      inlineForm.appendChild(inlineCancelBtn);
      presetContainer.appendChild(inlineForm);

      addChoiceTrigger.addEventListener("click", () => {
        const isHidden = inlineForm.style.display === "none";
        inlineForm.style.display = isHidden ? "flex" : "none";
        if (isHidden) {
          inlineInput.value = "";
          inlineInput.focus();
        }
      });

      const handleAddChoiceSubmit = () => {
        const text = (inlineInput.value || "").trim();
        if (!text) {
          showToast("Choice cannot be empty.", "error");
          inlineInput.focus();
          return;
        }
        const res = maintenance.addQuickRemark(text);
        if (!res.ok) {
          showToast(res.error, "error");
          inlineInput.focus();
          return;
        }
        block.selectedPreset = text;
        block.remarks = [text];
        inlineForm.style.display = "none";
        renderMaintenanceBlocks();
        queueMaintenanceAutosave();
        showToast("Quick choice added.", "success");
      };

      inlineSaveBtn.addEventListener("click", handleAddChoiceSubmit);
      inlineInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddChoiceSubmit();
        } else if (e.key === "Escape") {
          inlineForm.style.display = "none";
        }
      });
      inlineCancelBtn.addEventListener("click", () => {
        inlineForm.style.display = "none";
      });

      rightCol.appendChild(presetContainer);

      const remarksArea = document.createElement("textarea");
      remarksArea.className = "form-control eod-remarks-textarea";
      remarksArea.rows = 5;
      remarksArea.style.flex = "1";
      remarksArea.style.minHeight = "95px";
      const manualVal = Array.isArray(block.remarks) ? block.remarks.join("\n") : (block.remarks || "");
      remarksArea.value = manualVal;
      remarksArea.placeholder = block.selectedPreset
        ? `[Active preset: "${block.selectedPreset}"] (Leave empty to use preset, or type to override)...`
        : "Enter action taken or remarks (one per line)...";
      remarksArea.addEventListener("focus", () => {
        activePasteBlockId = block.id;
      });
      remarksArea.addEventListener("input", () => {
        const raw = remarksArea.value || "";
        const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        block.remarks = lines.length ? lines : [""];
        if (block.selectedPreset && (!lines.length || lines.join("\n") !== block.selectedPreset)) {
          const allChoices = maintenance.getQuickRemarks ? maintenance.getQuickRemarks() : [];
          block.selectedPreset = allChoices.find(c => c === lines.join("\n")) || "";
        }
        queueMaintenanceAutosave();
      });
      rightCol.appendChild(remarksArea);
      grid.appendChild(rightCol);

      contentWrapper.appendChild(grid);

      // Screenshot Proof Zone (REQUIRED)
      const proofZone = document.createElement("div");
      proofZone.className = "eod-proof-zone";
      proofZone.id = `proof_zone_${block.id}`;

      const proofHeader = document.createElement("div");
      proofHeader.className = "eod-proof-header";

      const proofTitleWrap = document.createElement("div");
      proofTitleWrap.style.display = "flex";
      proofTitleWrap.style.alignItems = "center";
      proofTitleWrap.style.gap = "6px";

      const proofTitle = document.createElement("span");
      proofTitle.style.fontWeight = "600";
      proofTitle.style.fontSize = "11px";
      proofTitle.style.color = "var(--text-secondary)";
      proofTitle.textContent = "Proof Screenshots";

      const proofBadge = document.createElement("span");
      proofBadge.className = "badge badge-neutral";
      proofBadge.textContent = `${(block.screenshots || []).length} image(s)`;

      proofTitleWrap.appendChild(proofTitle);
      proofTitleWrap.appendChild(proofBadge);

      const proofActions = document.createElement("div");
      proofActions.style.display = "flex";
      proofActions.style.alignItems = "center";
      proofActions.style.gap = "6px";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.multiple = true;
      fileInput.style.display = "none";
      fileInput.addEventListener("change", async () => {
        if (!fileInput.files || !fileInput.files.length) return;
        updateMaintenanceAutosaveIndicator("â— Processing images...", "saving");
        for (let i = 0; i < fileInput.files.length; i++) {
          try {
            const compressed = await maintenance.compressImage(fileInput.files[i]);
            if (!Array.isArray(block.screenshots)) block.screenshots = [];
            block.screenshots.push(compressed);
          } catch (err) {
            console.error("Screenshot compression error:", err);
          }
        }
        fileInput.value = "";
        renderMaintenanceBlocks();
        queueMaintenanceAutosave();
        showToast("Screenshot proof added.", "success");
      });
      proofActions.appendChild(fileInput);

      const addProofBtn = document.createElement("button");
      addProofBtn.type = "button";
      addProofBtn.className = "btn btn-outline btn-sm";
      addProofBtn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> <span>Add Screenshot</span>`;
      addProofBtn.addEventListener("click", () => fileInput.click());
      proofActions.appendChild(addProofBtn);

      proofHeader.appendChild(proofTitleWrap);
      proofHeader.appendChild(proofActions);
      proofZone.appendChild(proofHeader);

      const dropNotice = document.createElement("div");
      dropNotice.className = "eod-proof-drop-hint";
      dropNotice.style.fontSize = "10.5px";
      dropNotice.style.color = "var(--text-dim)";
      dropNotice.style.padding = "4px 0";
      dropNotice.textContent = "Browse, drag & drop image files, or press Ctrl+V to paste screenshot here.";
      proofZone.appendChild(dropNotice);

      const gridEl = document.createElement("div");
      gridEl.className = "eod-proof-grid";

      (block.screenshots || []).forEach((shot, shotIdx) => {
        const item = document.createElement("div");
        item.className = "eod-proof-item";

        const src = maintenance.maintenanceScreenshotSource(shot);

        const img = document.createElement("img");
        img.src = src;
        img.alt = `Proof Screenshot ${shotIdx + 1}`;
        img.title = "Click to view full resolution";
        img.addEventListener("click", () => {
          openScreenshotViewer(src, `Proof Screenshot - Block #${index + 1}`, `Image ${shotIdx + 1} of ${block.screenshots.length}`);
        });
        item.appendChild(img);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "eod-proof-remove";
        removeBtn.title = "Remove screenshot";
        removeBtn.innerHTML = "âœ•";
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          block.screenshots.splice(shotIdx, 1);
          renderMaintenanceBlocks();
          queueMaintenanceAutosave();
          showToast("Screenshot removed.", "info");
        });
        item.appendChild(removeBtn);

        gridEl.appendChild(item);
      });

      proofZone.appendChild(gridEl);

      // Drag and drop handlers for proofZone
      proofZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        proofZone.classList.add("drag-over");
      });
      proofZone.addEventListener("dragleave", () => {
        proofZone.classList.remove("drag-over");
      });
      proofZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        proofZone.classList.remove("drag-over");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          updateMaintenanceAutosaveIndicator("â— Processing images...", "saving");
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            const file = e.dataTransfer.files[i];
            if (file.type.startsWith("image/")) {
              try {
                const compressed = await maintenance.compressImage(file);
                if (!Array.isArray(block.screenshots)) block.screenshots = [];
                block.screenshots.push(compressed);
              } catch (err) {
                console.error("Drop compression error:", err);
              }
            }
          }
          renderMaintenanceBlocks();
          queueMaintenanceAutosave();
          showToast("Screenshot proof added.", "success");
        }
      });

      contentWrapper.appendChild(proofZone);
      blockEl.appendChild(contentWrapper);

      // Paste listener: routes Ctrl+V screenshot into this block's proof zone (item 9)
      blockEl.addEventListener("paste", async (e) => {
        if (block.dataHidden) return;
        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              activePasteBlockId = block.id;
              updateMaintenanceAutosaveIndicator("â— Processing pasted image...", "saving");
              try {
                const compressed = await maintenance.compressImage(file);
                if (!Array.isArray(block.screenshots)) block.screenshots = [];
                block.screenshots.push(compressed);
                renderMaintenanceBlocks();
                queueMaintenanceAutosave();
                showToast("Screenshot pasted into block proof.", "success");
              } catch (err) {
                console.error("Paste image compression error:", err);
              }
            }
            break;
          }
        }
      });

      container.appendChild(blockEl);
    });
  }



  async function checkMaintenanceSheetsConnectionState() {
    const pill = el("maintenanceSheetConnectionState");
    if (!pill) return;
    const url = maintenance.getMaintenanceSheetsWebAppUrl();
    if (!url || !maintenance.isValidAppsScriptWebAppUrl(url)) {
      pill.className = "maintenance-sheet-connection-state is-unchecked";
      pill.textContent = "Sheets: Not Connected";
      return;
    }
    pill.className = "maintenance-sheet-connection-state is-healthy";
    pill.textContent = "Sheets: Ready";
  }

  function syncMaintenanceStateFromDom() {
    const destSelect = el("simpleEodDestination");
    if (destSelect && destSelect.value) maintenanceState.destinationKey = destSelect.value;
    const dateInput = el("simpleEodDate");
    if (dateInput && dateInput.value) maintenanceState.date = dateInput.value;
    const siteInput = el("simpleEodSite");
    if (siteInput && siteInput.value) maintenanceState.title = siteInput.value;

    maintenanceState.blocks.forEach(block => {
      const blockEl = document.getElementById(`block_${block.id}`);
      if (!blockEl) return;
      const lanesArea = blockEl.querySelector("textarea.eod-lanes-textarea");
      const remarksArea = blockEl.querySelector("textarea.eod-remarks-textarea");

      if (lanesArea) {
        block.lanesText = lanesArea.value;
      }
      if (remarksArea) {
        const raw = (remarksArea.value || "").trim();
        if (raw) {
          block.remarks = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (block.selectedPreset && block.remarks.join("\n") !== block.selectedPreset) {
            const allChoices = maintenance.getQuickRemarks ? maintenance.getQuickRemarks() : [];
            block.selectedPreset = allChoices.find(c => c === block.remarks.join("\n")) || "";
          }
        } else if (block.selectedPreset) {
          block.remarks = [block.selectedPreset];
        } else {
          block.remarks = [""];
        }
      }
    });
  }

  function openMaintenancePrintPreview() {
    syncMaintenanceStateFromDom();
    const html = maintenance.maintenanceReportHtmlForSheets(maintenanceState);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.warn("Print trigger error:", e);
        }
      }, 350);
    } else {
      window.print();
    }
  }

  async function copyFullMaintenanceReportToSheets() {
    try {
      syncMaintenanceStateFromDom();
      const html = maintenance.maintenanceReportHtmlForSheets(maintenanceState);
      const text = maintenance.maintenanceReportPlainTextForSheets(maintenanceState);

      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" })
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      showToast("Full Maintenance Report copied (Arial 10pt formatted for Google Sheets).", "success");
    } catch (err) {
      console.error("Failed to copy report:", err);
      showToast(`Copy failed: ${err.message}`, "error");
    }
  }

  async function sendMaintenanceReportToSheets() {
    syncMaintenanceStateFromDom();
    const url = maintenance.getMaintenanceSheetsWebAppUrl();
    if (!url || !maintenance.isValidAppsScriptWebAppUrl(url)) {
      setMaintenanceStatusMessage("Please configure a valid Google Sheets Web App URL in Sheet Setup first.", "error");
      el("modalMaintenanceSheetSetup").hidden = false;
      return;
    }

    const sendBtn = el("simpleEodSendSheetsBtn");
    if (sendBtn) sendBtn.disabled = true;

    setMaintenanceStatusMessage("Preparing chunked upload for Google Sheets...", "info");

    try {
      const result = await maintenance.sendMaintenanceReportToGoogleSheets(url, maintenanceState, (p) => {
        if (p.stage === "chunks") {
          setMaintenanceStatusMessage(`Uploading image data chunk ${p.index} of ${p.total}...`, "info");
        } else if (p.stage === "committing") {
          setMaintenanceStatusMessage("Committing report to Google Sheets...", "info");
        }
      });

      if (result && (result.ok === true || result.success === true)) {
        setMaintenanceStatusMessage(`Report successfully logged to Google Sheets! (${result.rowsLogged || "OK"})`, "success");
        showToast("Maintenance Report uploaded to Google Sheets!", "success");
      } else {
        throw new Error(result?.error || "Apps Script returned failure");
      }
    } catch (err) {
      console.error("Send to Sheets failed:", err);
      setMaintenanceStatusMessage(`Google Sheets upload failed: ${err.message}`, "error");
      showToast(`Upload failed: ${err.message}`, "error");
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  async function downloadMaintenancePdf() {
    const pdfBtn = el("simpleEodPdfBtn");
    const originalText = pdfBtn?.textContent || "Download PDF";

    try {
      syncMaintenanceStateFromDom();

      const JsPdf = window.jspdf?.jsPDF;

      if (!JsPdf) {
        throw new Error("jsPDF library is unavailable.");
      }

      if (!maintenance?.maintenanceRowsForSheets) {
        throw new Error("Maintenance PDF helpers are unavailable.");
      }

      if (pdfBtn) {
        pdfBtn.disabled = true;
        pdfBtn.textContent = "Generating...";
      }

      showToast("Generating PDF...", "info");

      // Allow button state to paint before PDF work starts.
      await new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      const doc = new JsPdf({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

      if (typeof doc.autoTable !== "function") {
        throw new Error("jsPDF AutoTable is unavailable.");
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const marginX = 8;
      const marginBottom = 10;

      const state = maintenanceState || {};
      const blocks = Array.isArray(state.blocks) ? state.blocks : [];

      const cleanTitle = String(
        state.title || "Maintenance Report"
      )
        .replace(/\s*Maintenance\s+Report\s*$/i, "")
        .trim();

      const reportDate = state.date || "";
      const titleText = reportDate
        ? `${cleanTitle} (${reportDate})`
        : cleanTitle;

      const headers = [
        "TIMESTAMP",
        "DATE",
        "TL",
        "ACCOUNT",
        "SITE",
        "STATION NO.",
        "STATION ISSUE"
      ];

      let y = 12;

      function addPageIfNeeded(requiredHeight = 15) {
        if (y + requiredHeight > pageHeight - marginBottom) {
          doc.addPage();
          y = 12;
        }
      }

      function addDocumentTitle() {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(17, 24, 39);

        doc.text(titleText, marginX, y);

        y += 8;
      }

      addDocumentTitle();

      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const block = blocks[blockIndex] || {};

        const rows = maintenance.maintenanceRowsForSheets(
          block.lanesText || ""
        );
        addPageIfNeeded(10);

        if (rows.length) {
          doc.autoTable({
            startY: y,

            head: [headers],
            body: rows,

            theme: "grid",

            margin: {
              left: marginX,
              right: marginX,
              bottom: 10
            },

            styles: {
              font: "helvetica",
              fontSize: 5.6,
              cellPadding: 0.8,
              overflow: "linebreak",
              valign: "middle",

              textColor: [31, 41, 55],

              lineColor: [203, 213, 225],
              lineWidth: 0.15
            },

            headStyles: {
              fillColor: [49, 73, 95],
              textColor: [255, 255, 255],

              fontStyle: "bold",
              fontSize: 5.5,

              halign: "center",
              valign: "middle",

              cellPadding: 0.9
            },

            columnStyles: {
              0: { cellWidth: 19, halign: "center" },
              1: { cellWidth: 15, halign: "center" },
              2: { cellWidth: 31 },
              3: { cellWidth: 21, halign: "center" },
              4: { cellWidth: 24, halign: "center" },
              5: { cellWidth: 22, halign: "center" },
              6: { cellWidth: "auto" }
            },

            rowPageBreak: "avoid",

            didDrawPage: function () {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(6);
              doc.setTextColor(100, 116, 139);

              const pageNumber =
                doc.internal.getNumberOfPages();

              doc.text(
                String(pageNumber),
                pageWidth - marginX,
                pageHeight - 5,
                { align: "right" }
              );
            }
          });

          y = (doc.lastAutoTable?.finalY || y) + 5;
        }
        else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);

          doc.text(
            "No station issues recorded for this section.",
            marginX,
            y + 3
          );

          y += 9;
        }


        // ====================================================
        // SCREENSHOTS
        // ====================================================

        const screenshots = Array.isArray(block.screenshots)
          ? block.screenshots
          : [];

        const imageSources = screenshots
          .map(shot =>
            maintenance.maintenanceScreenshotSource?.(shot) || ""
          )
          .filter(src => /^data:image\//i.test(src));

        if (imageSources.length) {
          addPageIfNeeded(12);

          const gap = 4;
          const maxImageWidth = 82;
          const maxImageHeight = 46;

          let x = marginX;

          for (const src of imageSources) {
            let imageWidth = maxImageWidth;
            let imageHeight = maxImageHeight;

            try {
              const props = doc.getImageProperties(src);

              if (props?.width && props?.height) {
                const ratio = props.width / props.height;

                imageWidth = Math.min(
                  maxImageWidth,
                  maxImageHeight * ratio
                );

                imageHeight = imageWidth / ratio;
              }
            } catch (_) {}

            if (x + imageWidth > pageWidth - marginX) {
              x = marginX;
              y += maxImageHeight + gap;
            }

            if (y + imageHeight > pageHeight - 12) {
              doc.addPage();
              y = 12;
              x = marginX;
            }

            try {
              doc.addImage(
                src,
                "JPEG",
                x,
                y,
                imageWidth,
                imageHeight,
                undefined,
                "FAST"
              );
            }
            catch (_) {
              try {
                doc.addImage(
                  src,
                  x,
                  y,
                  imageWidth,
                  imageHeight
                );
              } catch (_) {}
            }

            x += imageWidth + gap;
          }

          y += maxImageHeight + 7;
        }


        // ====================================================
        // REMARKS
        // ====================================================

        const remarks =
          maintenance.getEffectiveBlockRemarks?.(block) || [];

        if (remarks.length) {
          const remarkText = remarks.join(" | ");

          const wrapped = doc.splitTextToSize(
            remarkText,
            pageWidth - (marginX * 2) - 8
          );

          const boxHeight = Math.max(
            12,
            7 + (wrapped.length * 3.5)
          );

          addPageIfNeeded(boxHeight + 5);

          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(34, 197, 94);

          doc.roundedRect(
            marginX,
            y,
            pageWidth - (marginX * 2),
            boxHeight,
            1,
            1,
            "FD"
          );

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(22, 101, 52);

          doc.text("Remarks:", marginX + 3, y + 4);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);

          doc.text(
            wrapped,
            marginX + 3,
            y + 8
          );

          y += boxHeight + 6;
        }


        // Space between report sections.
        y += 3;
      }


      // ======================================================
      // SAVE
      // ======================================================

      const safeTitle = String(
        state.title || "Maintenance"
      )
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      const fileName =
        `${safeTitle} - ${state.date || "report"}.pdf`;

      doc.save(fileName);

      showToast(
        "PDF downloaded successfully.",
        "success"
      );

    } catch (err) {
      console.error(
        "Direct Maintenance PDF generation failed:",
        err
      );

      showToast(
        err?.message || "Could not generate PDF.",
        "error"
      );

    } finally {
      if (pdfBtn) {
        pdfBtn.disabled = false;
        pdfBtn.textContent = originalText;
      }
    }
  }
  async function renderMaintenanceDraftsList() {
    const listEl = el("maintenanceDraftList");
    if (!listEl) return;
    listEl.innerHTML = "";
    try {
      const drafts = await maintenance.getNamedDrafts();
      if (!drafts || !drafts.length) {
        listEl.innerHTML = `<div style="font-size:11.5px; color:var(--text-muted); text-align:center; padding:18px 0;">No saved named drafts yet. Enter a name above to save one.</div>`;
        return;
      }
      drafts.forEach(d => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.justifyContent = "space-between";
        item.style.padding = "7px 10px";
        item.style.background = "var(--bg-surface)";
        item.style.border = "1px solid var(--border-default)";
        item.style.borderRadius = "var(--radius-sm)";
        item.style.gap = "8px";

        const info = document.createElement("div");
        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.gap = "2px";

        const name = document.createElement("span");
        name.style.fontSize = "12px";
        name.style.fontWeight = "600";
        name.style.color = "var(--text-primary)";
        name.textContent = d.name || "Untitled Draft";

        const meta = document.createElement("span");
        meta.style.fontSize = "10.5px";
        meta.style.color = "var(--text-muted)";
        const dDate = d.data?.date || "No date";
        const blocksCount = d.data?.blocks?.length || 0;
        meta.textContent = `${d.savedAt || ""} Â· ${dDate} Â· ${blocksCount} block(s)`;

        info.appendChild(name);
        info.appendChild(meta);

        const btns = document.createElement("div");
        btns.style.display = "flex";
        btns.style.alignItems = "center";
        btns.style.gap = "6px";

        const loadBtn = document.createElement("button");
        loadBtn.type = "button";
        loadBtn.className = "btn btn-primary btn-sm";
        loadBtn.textContent = "Load";
        loadBtn.addEventListener("click", async () => {
          const ok = await window.appConfirm({
            title: `Load draft "${d.name}"?`,
            message: "Replace current working report with this saved snapshot?",
            confirmText: "Load Draft"
          });
          if (!ok) return;
          const loaded = await maintenance.loadNamedDraft(d.id);
          if (loaded && loaded.data) {
            maintenanceState = {
              date: loaded.data.date || maintenance.todayLocal(),
              destinationKey: loaded.data.destinationKey || "mabini_a",
              title: loaded.data.title || maintenance.MAINTENANCE_DESTINATIONS[loaded.data.destinationKey]?.label || "Mabini Site A - 1st & 2nd Floor",
              blocks: loaded.data.blocks || [maintenance.makeBlock()]
            };
            syncMaintenanceHeaderUi();
            renderMaintenanceBlocks();
            queueMaintenanceAutosave();
            el("modalMaintenanceDrafts").hidden = true;
            showToast(`Draft "${d.name}" loaded.`, "success");
          }
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-danger-ghost btn-sm";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", async () => {
          const ok = await window.appConfirm({
            title: `Delete draft "${d.name}"?`,
            message: "This snapshot will be permanently deleted from this device.",
            confirmText: "Delete",
            tone: "danger"
          });
          if (!ok) return;
          await maintenance.deleteNamedDraft(d.id);
          renderMaintenanceDraftsList();
          showToast("Draft deleted.", "info");
        });

        btns.appendChild(loadBtn);
        btns.appendChild(delBtn);

        item.appendChild(info);
        item.appendChild(btns);
        listEl.appendChild(item);
      });
    } catch (err) {
      console.error("Error loading named drafts:", err);
      listEl.innerHTML = `<div style="font-size:11.5px; color:#f87171;">Error loading drafts: ${err.message}</div>`;
    }
  }

  function initMaintenanceController() {
    // Wire maintenanceService getBlocks and saveBlocks for History undo/redo support (items 11 & 12)
    maintenance.getBlocks = () => {
      return (maintenanceState.blocks || []).map(b => ({ ...b }));
    };
    maintenance.saveBlocks = async (blocks) => {
      maintenanceState.blocks = Array.isArray(blocks) && blocks.length
        ? blocks.map(b => ({ ...b }))
        : [maintenance.makeBlock()];
      renderMaintenanceBlocks();
      queueMaintenanceAutosave();
      return maintenanceState.blocks;
    };

    // Destination selector
    el("simpleEodDestination")?.addEventListener("change", (e) => {
      const destKey = e.target.value;
      if (maintenance.MAINTENANCE_DESTINATIONS[destKey]) {
        maintenanceState.destinationKey = destKey;
        maintenanceState.title = maintenance.MAINTENANCE_DESTINATIONS[destKey].label;
        const siteInput = el("simpleEodSite");
        if (siteInput) siteInput.value = maintenanceState.title;
        queueMaintenanceAutosave();
      }
    });

    // Date selector
    el("simpleEodDate")?.addEventListener("change", (e) => {
      maintenanceState.date = e.target.value;
      queueMaintenanceAutosave();
    });

    // Add Block
    el("simpleEodAddBtn")?.addEventListener("click", () => {
      maintenanceState.blocks.push(maintenance.makeBlock());
      renderMaintenanceBlocks();
      queueMaintenanceAutosave();
      showToast(`Added Block #${maintenanceState.blocks.length}.`, "info");
    });

    // Save to Drafts (opens modal with name prompt)
    el("simpleEodSaveBtn")?.addEventListener("click", () => {
      const modal = el("modalMaintenanceDrafts");
      if (modal) {
        modal.hidden = false;
        const nameInput = el("maintenanceDraftName");
        if (nameInput) {
          const dest = maintenance.MAINTENANCE_DESTINATIONS[maintenanceState.destinationKey]?.label || "Report";
          nameInput.value = `${dest} - ${maintenanceState.date || maintenance.todayLocal()}`;
          nameInput.focus();
        }
        renderMaintenanceDraftsList();
      }
    });

    // View Drafts
    el("simpleEodDraftsBtn")?.addEventListener("click", () => {
      const modal = el("modalMaintenanceDrafts");
      if (modal) {
        modal.hidden = false;
        renderMaintenanceDraftsList();
      }
    });

    // Save Named Draft button in modal
    el("btnSaveNamedDraft")?.addEventListener("click", async () => {
      const nameInput = el("maintenanceDraftName");
      const name = (nameInput?.value || "").trim();
      if (!name) {
        showToast("Please enter a name for the draft.", "error");
        return;
      }
      try {
        await maintenance.saveNamedDraft(name, maintenanceState);
        showToast(`Draft "${name}" saved!`, "success");
        if (nameInput) nameInput.value = "";
        renderMaintenanceDraftsList();
      } catch (err) {
        console.error("Save named draft failed:", err);
        showToast(`Save failed: ${err.message}`, "error");
      }
    });

    el("btnCloseMaintenanceDrafts")?.addEventListener("click", () => {
      el("modalMaintenanceDrafts").hidden = true;
    });

    el("btnDoneMaintenanceDrafts")?.addEventListener("click", () => {
      el("modalMaintenanceDrafts").hidden = true;
    });

    // Copy to Sheets
    el("simpleEodCopySheetsBtn")?.addEventListener("click", copyFullMaintenanceReportToSheets);

    // Send to Sheets
    el("simpleEodSendSheetsBtn")?.addEventListener("click", sendMaintenanceReportToSheets);

    // Sheet Setup
    el("simpleEodSheetSetupBtn")?.addEventListener("click", () => {
      const modal = el("modalMaintenanceSheetSetup");
      if (modal) {
        modal.hidden = false;
        const urlInput = el("maintenanceSheetWebAppUrl");
        if (urlInput) urlInput.value = maintenance.getMaintenanceSheetsWebAppUrl();
        const testRes = el("maintenanceSheetTestResult");
        if (testRes) {
          testRes.textContent = "";
          testRes.className = "maintenance-sheet-test-result";
        }
      }
    });

    el("btnCloseMaintenanceSheetSetup")?.addEventListener("click", () => {
      el("modalMaintenanceSheetSetup").hidden = true;
    });

    el("btnTestMaintenanceSheet")?.addEventListener("click", async () => {
      const urlInput = el("maintenanceSheetWebAppUrl");
      const url = (urlInput?.value || "").trim();
      const testRes = el("maintenanceSheetTestResult");
      if (!maintenance.isValidAppsScriptWebAppUrl(url)) {
        if (testRes) {
          testRes.textContent = "Invalid Apps Script Web App URL. Must end with /exec";
          testRes.style.color = "#f87171";
        }
        return;
      }
      if (testRes) {
        testRes.textContent = "Testing connection...";
        testRes.style.color = "var(--text-muted)";
      }
      try {
        const res = await maintenance.testMaintenanceSheetsConnection(url, maintenanceState.destinationKey);
        if (res && (res.ok === true || res.success === true)) {
          if (testRes) {
            testRes.textContent = `Connection successful! Destination: ${res.destinationLabel || res.destination || "OK"}`;
            testRes.style.color = "#4ade80";
          }
        } else {
          throw new Error(res?.error || "Invalid response from Apps Script");
        }
      } catch (err) {
        if (testRes) {
          testRes.textContent = `Connection failed: ${err.message}`;
          testRes.style.color = "#f87171";
        }
      }
    });

    el("btnSaveMaintenanceSheet")?.addEventListener("click", () => {
      const urlInput = el("maintenanceSheetWebAppUrl");
      const url = (urlInput?.value || "").trim();
      if (!maintenance.isValidAppsScriptWebAppUrl(url)) {
        showToast("Enter a valid Apps Script URL ending in /exec", "error");
        return;
      }
      maintenance.saveMaintenanceSheetSetup(url);
      checkMaintenanceSheetsConnectionState();
      el("modalMaintenanceSheetSetup").hidden = true;
      showToast("Google Sheets Web App connected!", "success");
    });

    el("btnClearMaintenanceSheet")?.addEventListener("click", () => {
      maintenance.clearMaintenanceSheetSetup();
      checkMaintenanceSheetsConnectionState();
      el("modalMaintenanceSheetSetup").hidden = true;
      showToast("Google Sheets Web App disconnected.", "info");
    });

    // Preview / Print
    el("simpleEodPreviewBtn")?.addEventListener("click", openMaintenancePrintPreview);

    // Download PDF
    el("simpleEodPdfBtn")?.addEventListener("click", downloadMaintenancePdf);

    // Clear All
    el("simpleEodClearBtn")?.addEventListener("click", async () => {
      const ok = await window.appConfirm({
        title: "Clear entire Maintenance Report?",
        message: "Reset all blocks, station issues, remarks, and screenshots in the working report?",
        confirmText: "Clear All",
        tone: "danger"
      });
      if (!ok) return;

      maintenanceState = {
        date: maintenance.todayLocal(),
        destinationKey: "mabini_a",
        title: maintenance.MAINTENANCE_DESTINATIONS["mabini_a"].label,
        blocks: [maintenance.makeBlock()]
      };
      await maintenance.clearAllDraft();
      syncMaintenanceHeaderUi();
      renderMaintenanceBlocks();
      showToast("Maintenance Report cleared.", "info");
    });

    // Expose Global Bridge for AI Sorter
    window.addMaintenanceSorterRowsToReport = function (tsv, meta = {}) {
      if (!maintenanceState.blocks || !maintenanceState.blocks.length) {
        maintenanceState.blocks = [maintenance.makeBlock()];
      }

      let target = maintenanceState.blocks.find(b => !b.lanesText.trim());
      if (!target) {
        target = maintenance.makeBlock();
        maintenanceState.blocks.push(target);
      }

      target.lanesText = (target.lanesText ? target.lanesText + "\n" : "") + String(tsv || "").trim();

      const detected = maintenance.detectMaintenanceDestinationFromRows(target.lanesText);
      if (detected && maintenance.MAINTENANCE_DESTINATIONS[detected]) {
        maintenanceState.destinationKey = detected;
        maintenanceState.title = maintenance.MAINTENANCE_DESTINATIONS[detected].label;
        syncMaintenanceHeaderUi();
      }

      renderMaintenanceBlocks();
      queueMaintenanceAutosave();
    };

    window.syncMaintenanceStateFromDom = syncMaintenanceStateFromDom;
    window.getMaintenanceState = () => maintenanceState;

    // =========================================================================
    // GLOBAL PASTE HANDLER: Maintenance workspace (item 9)
    // Routes Ctrl+V screenshot paste to the active block even when focus is
    // not directly on a proof zone (mirrors V1 document-level paste handler)
    // =========================================================================
    document.addEventListener("paste", async (event) => {
      if (currentWorkspace !== "maintenance") return;
      const active = document.activeElement;
      // If focus is in a specific textarea, let the block-level paste handler manage it
      if (active && active.tagName === "TEXTAREA") return;
      // Check if clipboard has an image
      const items = (event.clipboardData || window.clipboardData)?.items;
      if (!items) return;
      let imageFile = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          imageFile = items[i].getAsFile();
          break;
        }
      }
      if (!imageFile) {
        // Text paste in maintenance when not inside an input/textarea
        const text = event.clipboardData?.getData("text/plain") || "";
        if (text.trim()) {
          const active = document.activeElement;
          const inTypingField = active && (/^(INPUT|TEXTAREA)$/i.test(active.tagName) || active.isContentEditable);
          if (!inTypingField) {
            event.preventDefault();
            const targetBlock = maintenanceState.blocks.find(b => b.id === activePasteBlockId && !b.dataHidden) ||
              maintenanceState.blocks.find(b => !b.dataHidden);
            if (targetBlock) {
              targetBlock.lanesText = targetBlock.lanesText ? `${targetBlock.lanesText}\n${text.trim()}` : text.trim();
              renderMaintenanceBlocks();
              queueMaintenanceAutosave();
              if (window.historyService?.captureIfChanged) {
                window.historyService.captureIfChanged("maintenanceReport", `Pasted text into Block #${maintenanceState.blocks.indexOf(targetBlock) + 1}`);
              }
              showToast("Pasted text into active Maintenance block.", "success");
            }
          }
        }
        return;
      }
      event.preventDefault();

      // Find the active paste block
      const targetBlock = maintenanceState.blocks.find(b => b.id === activePasteBlockId && !b.dataHidden) ||
        maintenanceState.blocks.find(b => !b.dataHidden);
      if (!targetBlock) {
        showToast("No visible block found to receive screenshot.", "info");
        return;
      }
      updateMaintenanceAutosaveIndicator("â— Processing pasted image...", "saving");
      try {
        const compressed = await maintenance.compressImage(imageFile);
        if (!Array.isArray(targetBlock.screenshots)) targetBlock.screenshots = [];
        targetBlock.screenshots.push(compressed);
        renderMaintenanceBlocks();
        queueMaintenanceAutosave();
        if (window.historyService?.captureIfChanged) {
          window.historyService.captureIfChanged("maintenanceReport", `Added screenshot to Block #${maintenanceState.blocks.indexOf(targetBlock) + 1}`);
        }
        showToast("Screenshot pasted into Maintenance block.", "success");
      } catch (err) {
        console.error("Global maintenance paste error:", err);
      }
    });

    // =========================================================================
    // GLOBAL KEYBOARD: Maintenance Universal Shortcuts
    // =========================================================================
    document.addEventListener("keydown", async (event) => {
      if (currentWorkspace !== "maintenance") return;
      const active = document.activeElement;
      // Guard: when cursor is inside normal text field (input, textarea, contenteditable),
      // preserve normal text editing behavior where expected.
      const inTypingField = active && (/^(INPUT|TEXTAREA|SELECT)$/i.test(active.tagName) || active.isContentEditable);
      if (inTypingField) return;

      const key = event.key ? event.key.toLowerCase() : "";
      const isCtrlOrMeta = !!(event.ctrlKey || event.metaKey);

      // Target block for shortcuts: active block or first visible block
      const targetBlock = maintenanceState.blocks.find(b => b.id === activePasteBlockId && !b.dataHidden) ||
        maintenanceState.blocks.find(b => !b.dataHidden);

      // Ctrl+A: Select All lanes text in active block
      if (isCtrlOrMeta && !event.shiftKey && key === "a") {
        if (!targetBlock) return;
        event.preventDefault();
        const blockEl = document.getElementById(`block_${targetBlock.id}`);
        const lanesArea = blockEl?.querySelector("textarea.eod-lanes-textarea");
        if (lanesArea) {
          lanesArea.focus();
          lanesArea.select();
        }
        return;
      }

      // Ctrl+C: Copy selected maintenance data where applicable
      if (isCtrlOrMeta && !event.shiftKey && key === "c") {
        if (!targetBlock || !targetBlock.lanesText) return;
        event.preventDefault();
        try {
          await navigator.clipboard.writeText(targetBlock.lanesText);
          showToast(`Copied lanes data from Block #${maintenanceState.blocks.indexOf(targetBlock) + 1}.`, "success");
        } catch (_) {}
        return;
      }

      // Ctrl+X: Cut selected editable maintenance data where safe
      if (isCtrlOrMeta && !event.shiftKey && key === "x") {
        if (!targetBlock || !targetBlock.lanesText) return;
        event.preventDefault();
        try {
          await navigator.clipboard.writeText(targetBlock.lanesText);
          targetBlock.lanesText = "";
          renderMaintenanceBlocks();
          queueMaintenanceAutosave();
          if (window.historyService?.captureIfChanged) {
            await window.historyService.captureIfChanged("maintenanceReport", `Cut lanes data in Block #${maintenanceState.blocks.indexOf(targetBlock) + 1}`);
          }
          showToast("Lanes data cut to clipboard.", "success");
        } catch (_) {}
        return;
      }

      // Ctrl+F: Focus destination selector or filter
      if (isCtrlOrMeta && !event.shiftKey && key === "f") {
        event.preventDefault();
        const destSelect = el("simpleEodDestination");
        if (destSelect) destSelect.focus();
        return;
      }

      // Delete/Backspace: Clear selected block's lanes data
      if (key === "delete" || key === "backspace") {
        if (!targetBlock || !targetBlock.lanesText) return;
        event.preventDefault();
        targetBlock.lanesText = "";
        renderMaintenanceBlocks();
        queueMaintenanceAutosave();
        if (window.historyService?.captureIfChanged) {
          await window.historyService.captureIfChanged("maintenanceReport", `Cleared lanes in Block #${maintenanceState.blocks.indexOf(targetBlock) + 1}`);
        }
        showToast("Block lanes data cleared.", "info");
        return;
      }

      // Escape: Clear active block selection
      if (key === "escape") {
        activePasteBlockId = null;
        document.querySelectorAll(".eod-block-card.is-active-target").forEach(c => c.classList.remove("is-active-target"));
        return;
      }

      // ArrowUp / ArrowDown: Navigate between blocks
      if (key === "arrowup" || key === "arrowdown") {
        event.preventDefault();
        const visibleBlocks = maintenanceState.blocks.filter(b => !b.dataHidden);
        if (!visibleBlocks.length) return;
        const curIdx = visibleBlocks.findIndex(b => b.id === activePasteBlockId);
        let nextIdx = 0;
        if (key === "arrowup") {
          nextIdx = curIdx <= 0 ? visibleBlocks.length - 1 : curIdx - 1;
        } else {
          nextIdx = curIdx < 0 || curIdx >= visibleBlocks.length - 1 ? 0 : curIdx + 1;
        }
        activePasteBlockId = visibleBlocks[nextIdx].id;
        const blockEl = document.getElementById(`block_${activePasteBlockId}`);
        blockEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        showToast(`Selected Block #${maintenanceState.blocks.indexOf(visibleBlocks[nextIdx]) + 1}.`, "info");
        return;
      }
    });
  }

  // =========================================================================
  // WORKSPACE 5: PENDING REPORTS & FOLLOW-UP CONTROLLER
  // =========================================================================
  let pendingReportsList = [];
  let pendingAddScreenshotData = "";

  function updatePendingSummary() {
    const total = pendingReportsList.length;
    const followup = pendingReportsList.filter(pending.isFollowupDue).length;
    const email = pendingReportsList.filter(pending.isEmailDue).length;
    const attention = pendingReportsList.filter(r => pending.isFollowupDue(r) || pending.isEmailDue(r)).length;

    if (el("pendingTotalCount")) el("pendingTotalCount").textContent = String(total);
    if (el("pendingFollowupCount")) el("pendingFollowupCount").textContent = String(followup);
    if (el("pendingEmailCount")) el("pendingEmailCount").textContent = String(email);
    if (el("pendingQueueCountBadge")) el("pendingQueueCountBadge").textContent = `${total} items`;

    const railBadge = el("railPendingBadge");
    if (railBadge) {
      railBadge.textContent = String(attention || total);
      railBadge.style.display = total ? "inline-flex" : "none";
    }

    const banner = el("pendingDueBanner");
    if (banner) {
      if (!attention) {
        banner.hidden = true;
        banner.innerHTML = "";
      } else {
        banner.hidden = false;
        const pieces = [];
        if (followup) {
          pieces.push(`<strong>${followup}</strong> report${followup === 1 ? "" : "s"} need follow-up (1+ day)`);
        }
        if (email) {
          pieces.push(`<strong>${email}</strong> report${email === 1 ? "" : "s"} reached 4 days â€” send email`);
        }
        banner.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24" style="stroke:currentColor; flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> <span>${pieces.join(" Â· ")}</span>`;
      }
    }

    const alertStatus = el("pendingAlertStatus");
    if (alertStatus) {
      if (!("Notification" in window)) {
        alertStatus.textContent = "Browser alerts unavailable";
      } else if (Notification.permission === "granted") {
        alertStatus.textContent = "Browser alerts enabled";
      } else {
        alertStatus.textContent = "In-app alerts active";
      }
    }
  }

  function refreshPendingOmOptions() {
    const list = el("pendingOmOptions");
    if (!list) return;

    const masterOms = (cfg.OM_OPTIONS || []).slice();
    const reportOms = pendingReportsList.map(r => String(r.om || "").trim()).filter(Boolean);
    const unique = [...new Set([...masterOms, ...reportOms])].sort((a, b) => a.localeCompare(b));

    list.innerHTML = unique.map(val => `<option value="${val}"></option>`).join("");
  }

  function renderPendingList() {
    refreshPendingOmOptions();
    const listEl = el("pendingReportList");
    if (!listEl) return;

    if (!pendingReportsList.length) {
      listEl.innerHTML = `<div style="text-align:center; padding:48px 12px; font-size:12px; color:var(--text-muted);">No pending reports in queue. Use the form on the left to add one.</div>`;
      return;
    }

    listEl.innerHTML = "";

    const sorted = pendingReportsList.slice().sort((a, b) => {
      const aEmail = pending.isEmailDue(a) ? 1 : 0;
      const bEmail = pending.isEmailDue(b) ? 1 : 0;
      if (aEmail !== bEmail) return bEmail - aEmail;

      const aFollow = pending.isFollowupDue(a) ? 1 : 0;
      const bFollow = pending.isFollowupDue(b) ? 1 : 0;
      if (aFollow !== bFollow) return bFollow - aFollow;

      return pending.reportDateStart(a) - pending.reportDateStart(b);
    });

    sorted.forEach(report => {
      const card = document.createElement("div");
      card.className = "pending-card";
      card.dataset.id = report.id;

      const thumbBtn = document.createElement("button");
      thumbBtn.type = "button";
      thumbBtn.className = `pending-card-thumb-btn ${report.screenshotData ? "" : "no-image"}`;
      thumbBtn.title = report.screenshotData ? "Click to view full screenshot" : "No screenshot attached";
      if (report.screenshotData) {
        const img = document.createElement("img");
        img.src = report.screenshotData;
        img.alt = "Pending proof";
        thumbBtn.appendChild(img);
        thumbBtn.addEventListener("click", () => {
          openScreenshotViewer(report.screenshotData, "Pending Incident Evidence", `${report.label || "Report"} Â· OM: ${report.om || "N/A"}`);
        });
      } else {
        thumbBtn.disabled = true;
        thumbBtn.textContent = "No SS";
      }
      card.appendChild(thumbBtn);

      const body = document.createElement("div");
      body.className = "pending-card-body";

      const titleRow = document.createElement("div");
      titleRow.className = "pending-card-title-row";

      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "pending-card-label-input";
      labelInput.value = report.label || "";
      labelInput.placeholder = "Report / Agent Name";
      labelInput.title = "Click to edit report/agent label";
      labelInput.addEventListener("change", async (e) => {
        report.label = e.target.value.trim();
        report.updatedAt = new Date().toISOString();
        await pending.saveReports(pendingReportsList);
        updatePendingSummary();
      });
      titleRow.appendChild(labelInput);

      const statusWrap = document.createElement("div");
      statusWrap.style.display = "flex";
      statusWrap.style.alignItems = "center";
      statusWrap.style.gap = "6px";

      if (pending.isEmailDue(report)) {
        const chip = document.createElement("span");
        chip.className = "pending-status-chip pending-status-email";
        chip.textContent = "Send Email";
        statusWrap.appendChild(chip);
      } else if (pending.isFollowupDue(report)) {
        const chip = document.createElement("span");
        chip.className = "pending-status-chip pending-status-followup";
        chip.textContent = "Need Follow-up";
        statusWrap.appendChild(chip);
      } else {
        const chip = document.createElement("span");
        chip.className = "pending-status-chip pending-status-waiting";
        chip.textContent = "Waiting";
        statusWrap.appendChild(chip);
      }
      titleRow.appendChild(statusWrap);
      body.appendChild(titleRow);

      const metaRow = document.createElement("div");
      metaRow.className = "pending-card-meta";
      const ageStr = pending.ageText(pending.reportAgeMs(report));
      metaRow.textContent = `Reported ${report.reportDate || "N/A"} Â· Age ${ageStr} Â· Pending ${ageStr}`;
      body.appendChild(metaRow);

      const grid = document.createElement("div");
      grid.className = "pending-card-inputs-grid";

      const omWrap = document.createElement("div");
      omWrap.className = "form-group";
      omWrap.style.marginBottom = "0";
      const omLabel = document.createElement("label");
      omLabel.className = "form-label";
      omLabel.textContent = "OM";
      const omInput = document.createElement("input");
      omInput.type = "text";
      omInput.className = "form-control form-control-sm";
      omInput.setAttribute("list", "pendingOmOptions");
      omInput.value = report.om || "";
      omInput.placeholder = "OM Name";
      omInput.addEventListener("change", async (e) => {
        report.om = e.target.value.trim();
        report.updatedAt = new Date().toISOString();
        await pending.saveReports(pendingReportsList);
        refreshPendingOmOptions();
      });
      omWrap.appendChild(omLabel);
      omWrap.appendChild(omInput);
      grid.appendChild(omWrap);

      const teamsWrap = document.createElement("div");
      teamsWrap.className = "form-group";
      teamsWrap.style.marginBottom = "0";
      const teamsLabel = document.createElement("label");
      teamsLabel.className = "form-label";
      teamsLabel.textContent = "Teams Conversation";
      const teamsRow = document.createElement("div");
      teamsRow.style.display = "flex";
      teamsRow.style.gap = "4px";

      const teamsInput = document.createElement("input");
      teamsInput.type = "url";
      teamsInput.className = "form-control form-control-sm";
      teamsInput.value = report.teamsLink || "";
      teamsInput.placeholder = "Teams Link...";
      teamsInput.addEventListener("change", async (e) => {
        report.teamsLink = e.target.value.trim();
        report.updatedAt = new Date().toISOString();
        await pending.saveReports(pendingReportsList);
        renderPendingList();
      });

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn btn-outline btn-sm";
      openBtn.textContent = "Open";
      const validTeamsUrl = pending.safeUrl(report.teamsLink);
      openBtn.disabled = !validTeamsUrl;
      openBtn.addEventListener("click", () => {
        if (validTeamsUrl) {
          window.open(validTeamsUrl, "_blank", "noopener,noreferrer");
        }
      });

      teamsRow.appendChild(teamsInput);
      teamsRow.appendChild(openBtn);
      teamsWrap.appendChild(teamsLabel);
      teamsWrap.appendChild(teamsRow);
      grid.appendChild(teamsWrap);

      const remarksWrap = document.createElement("div");
      remarksWrap.className = "form-group";
      remarksWrap.style.marginBottom = "0";
      const remarksLabel = document.createElement("label");
      remarksLabel.className = "form-label";
      remarksLabel.textContent = "Remarks";
      const remarksArea = document.createElement("textarea");
      remarksArea.className = "form-control form-control-sm";
      remarksArea.rows = 2;
      remarksArea.placeholder = "Enter status or remarks...";
      remarksArea.value = report.remarks || "";
      remarksArea.addEventListener("change", async (e) => {
        report.remarks = e.target.value.trim();
        report.updatedAt = new Date().toISOString();
        await pending.saveReports(pendingReportsList);
      });
      remarksWrap.appendChild(remarksLabel);
      remarksWrap.appendChild(remarksArea);
      grid.appendChild(remarksWrap);

      body.appendChild(grid);

      const actions = document.createElement("div");
      actions.className = "pending-card-actions";

      const replaceBtn = document.createElement("button");
      replaceBtn.type = "button";
      replaceBtn.className = "btn btn-outline btn-sm";
      replaceBtn.textContent = "Replace SS";
      replaceBtn.addEventListener("click", () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.addEventListener("change", async () => {
          if (!fileInput.files || !fileInput.files.length) return;
          try {
            report.screenshotData = await pending.compressImage(fileInput.files[0]);
            report.updatedAt = new Date().toISOString();
            await pending.saveReports(pendingReportsList);
            renderPendingList();
            showToast("Screenshot replaced successfully.", "success");
          } catch (err) {
            console.error("Replace screenshot failed:", err);
            showToast(`Replace failed: ${err.message}`, "error");
          }
        });
        fileInput.click();
      });
      actions.appendChild(replaceBtn);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-danger-ghost btn-sm";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        const ok = await window.appConfirm({
          title: "Delete pending report?",
          message: `Remove "${report.label || "this report"}"? Use this when the NOC is already resolved or submitted.`,
          confirmText: "Delete",
          tone: "danger"
        });
        if (!ok) return;
        pendingReportsList = pendingReportsList.filter(item => item.id !== report.id);
        await pending.saveReports(pendingReportsList);
        renderPendingList();
        updatePendingSummary();
        showToast("Pending report deleted.", "info");
      });
      actions.appendChild(delBtn);

      body.appendChild(actions);
      card.appendChild(body);
      listEl.appendChild(card);
    });
  }

  async function loadPendingReportsInitial() {
    try {
      const saved = await pending.loadReports();
      pendingReportsList = Array.isArray(saved) ? saved : [];
    } catch (e) {
      console.warn("Could not load initial pending reports:", e);
      pendingReportsList = [];
    }

    const dateInput = el("pendingReportDate");
    if (dateInput && !dateInput.value) {
      dateInput.value = pending.todayLocal();
    }

    renderPendingList();
    updatePendingSummary();
    pending.checkDueNotifications(pendingReportsList, true);
  }

  function renderPendingWorkspace() {
    if (!pendingReportsList.length) {
      loadPendingReportsInitial();
    } else {
      renderPendingList();
      updatePendingSummary();
    }
  }

  function setPendingAddScreenshot(dataUrl) {
    pendingAddScreenshotData = dataUrl || "";
    const empty = el("pendingAddShotEmpty");
    const wrap = el("pendingAddShotPreviewWrap");
    const preview = el("pendingAddShotPreview");

    if (pendingAddScreenshotData) {
      if (preview) preview.src = pendingAddScreenshotData;
      if (empty) empty.hidden = true;
      if (wrap) wrap.hidden = false;
    } else {
      if (preview) preview.removeAttribute("src");
      if (empty) empty.hidden = false;
      if (wrap) wrap.hidden = true;
    }
  }

  function clearPendingAddForm() {
    if (el("pendingReportLabel")) el("pendingReportLabel").value = "";
    if (el("pendingReportDate")) el("pendingReportDate").value = pending.todayLocal();
    if (el("pendingReportOm")) el("pendingReportOm").value = "";
    if (el("pendingTeamsLink")) el("pendingTeamsLink").value = "";
    if (el("pendingAddShotInput")) el("pendingAddShotInput").value = "";
    setPendingAddScreenshot("");
  }

  function initPendingController() {
    el("btnAddPendingReport")?.addEventListener("click", async () => {
      const label = (el("pendingReportLabel")?.value || "").trim();
      const reportDate = el("pendingReportDate")?.value || pending.todayLocal();
      const om = (el("pendingReportOm")?.value || "").trim();
      const teamsLink = (el("pendingTeamsLink")?.value || "").trim();

      if (!om) {
        showToast("Please select or enter an OM.", "error");
        el("pendingReportOm")?.focus();
        return;
      }

      const now = new Date().toISOString();
      const newReport = {
        id: pending.uid(),
        label,
        reportDate,
        om,
        teamsLink,
        remarks: "",
        screenshotData: pendingAddScreenshotData || "",
        createdAt: now,
        updatedAt: now,
        followupNotifiedAt: null,
        emailNotifiedAt: null
      };

      pendingReportsList.push(newReport);
      await pending.saveReports(pendingReportsList);
      clearPendingAddForm();
      renderPendingList();
      updatePendingSummary();
      showToast("Pending report added to queue.", "success");
    });

    el("btnClearPendingForm")?.addEventListener("click", clearPendingAddForm);

    const dropzone = el("pendingAddShotDropzone");
    const fileInput = el("pendingAddShotInput");

    dropzone?.addEventListener("click", (e) => {
      if (e.target !== el("btnRemovePendingShot")) {
        fileInput?.click();
      }
    });

    fileInput?.addEventListener("change", async () => {
      if (!fileInput.files || !fileInput.files.length) return;
      try {
        const compressed = await pending.compressImage(fileInput.files[0]);
        setPendingAddScreenshot(compressed);
        showToast("Proof screenshot loaded.", "info");
      } catch (err) {
        console.error("Pending screenshot load failed:", err);
        showToast(`Screenshot error: ${err.message}`, "error");
      }
    });

    el("btnRemovePendingShot")?.addEventListener("click", (e) => {
      e.stopPropagation();
      setPendingAddScreenshot("");
      if (fileInput) fileInput.value = "";
    });

    dropzone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    });
    dropzone?.addEventListener("dragleave", () => {
      dropzone.classList.remove("drag-over");
    });
    dropzone?.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith("image/")) {
          try {
            const compressed = await pending.compressImage(file);
            setPendingAddScreenshot(compressed);
            showToast("Proof screenshot loaded.", "info");
          } catch (err) {
            console.error("Drop image error:", err);
          }
        }
      }
    });

    document.addEventListener("paste", async (e) => {
      if (currentWorkspace !== "pending") return;
      const items = (e.clipboardData || window.clipboardData)?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            try {
              const compressed = await pending.compressImage(file);
              setPendingAddScreenshot(compressed);
              showToast("Screenshot pasted into form.", "info");
            } catch (err) {
              console.error("Paste image error:", err);
            }
          }
          break;
        }
      }
    });

    el("btnEnablePendingAlerts")?.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        showToast("Browser notifications are not supported in this browser.", "info");
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        updatePendingSummary();
        if (permission === "granted") {
          showToast("Browser alerts enabled for Pending Reports!", "success");
          pending.checkDueNotifications(pendingReportsList, false);
        } else {
          showToast("Notification permission was not granted.", "info");
        }
      } catch (err) {
        console.error("Request permission error:", err);
      }
    });
  }

  // =========================================================================
  // FOLLOW UP REPORTS CONTROLLER
  // =========================================================================
  let followupReportsList = [];
  let followupAddScreenshotData = "";
  let followupReplaceTargetId = "";
  let followupSaveTimer = null;

  function refreshFollowupOmOptions() {
    const list = el("followupOmOptions");
    if (!list) return;
    const master = edr.getOmNames ? edr.getOmNames() : [];
    const formatted = master.map(name => `CCTV OM ${String(name).toUpperCase()}`);
    const used = followupReportsList.map(r => String(r.om || "").trim()).filter(Boolean);
    const values = [...new Set([...formatted, ...used])].sort((a, b) => a.localeCompare(b));
    list.innerHTML = values.map(value => `<option value="${window.escapeHtml(value)}"></option>`).join("");
  }

  function updateFollowupSummary() {
    const openCount = followup.getOpenCount(followupReportsList);
    const resolvedCount = followupReportsList.filter(r => r.status === "Resolved").length;
    const totalCount = followupReportsList.length;

    if (el("followupOpenCount")) el("followupOpenCount").textContent = String(openCount);
    if (el("followupResolvedCount")) el("followupResolvedCount").textContent = String(resolvedCount);
    if (el("followupTotalCount")) el("followupTotalCount").textContent = String(totalCount);
    if (el("followupQueueBadge")) el("followupQueueBadge").textContent = `${totalCount} item${totalCount === 1 ? "" : "s"}`;
    if (el("railFollowupBadge")) el("railFollowupBadge").textContent = String(openCount);

    const legacySidebarBadge = el("followupSidebarBadge");
    if (legacySidebarBadge) {
      legacySidebarBadge.textContent = String(openCount);
      legacySidebarBadge.title = `${openCount} open follow-up report${openCount === 1 ? "" : "s"}`;
    }
  }

  function setFollowupAddScreenshot(dataUrl) {
    followupAddScreenshotData = dataUrl || "";
    const empty = el("followupAddShotEmpty");
    const wrap = el("followupAddShotPreviewWrap");
    const preview = el("followupAddShotPreview");

    if (followupAddScreenshotData) {
      if (preview) preview.src = followupAddScreenshotData;
      if (empty) empty.hidden = true;
      if (wrap) wrap.hidden = false;
    } else {
      if (preview) preview.removeAttribute("src");
      if (empty) empty.hidden = false;
      if (wrap) wrap.hidden = true;
    }
  }

  function clearFollowupAddForm() {
    if (el("followupDate")) el("followupDate").value = followup.todayLocal();
    if (el("followupOm")) el("followupOm").value = "";
    if (el("followupLabel")) el("followupLabel").value = "";
    if (el("followupCctvLink")) el("followupCctvLink").value = "";
    if (el("followupStatus")) el("followupStatus").value = "Waiting for TL";
    if (el("followupRemarks")) el("followupRemarks").value = "";
    setFollowupAddScreenshot("");
    const msg = el("followupMessage");
    if (msg) {
      msg.textContent = "";
      msg.className = "followup-form-message";
    }
  }

  function showFollowupMessage(text, kind = "") {
    const msg = el("followupMessage");
    if (!msg) return;
    msg.textContent = text || "";
    msg.style.color = kind === "error" ? "var(--accent-danger, #f87171)" : kind === "success" ? "var(--accent-success, #34d399)" : "var(--text-secondary)";
  }

  function scheduleFollowupSave() {
    clearTimeout(followupSaveTimer);
    followupSaveTimer = setTimeout(async () => {
      try {
        await followup.saveReports(followupReportsList);
        updateFollowupSummary();
      } catch (err) {
        console.error("Save follow-up reports error:", err);
      }
    }, 350);
  }

  function renderFollowupList() {
    refreshFollowupOmOptions();
    updateFollowupSummary();
    const listEl = el("followupReportList");
    if (!listEl) return;

    if (!followupReportsList.length) {
      listEl.innerHTML = '<div class="empty-state" style="padding:40px; text-align:center; color:var(--text-muted); font-size:12px;">No follow-up reports yet.</div>';
      return;
    }

    const sorted = followup.sortReports(followupReportsList);

    listEl.innerHTML = sorted.map(report => {
      const hasImage = Boolean(report.screenshotData);
      const safeLink = followup.safeWebUrl(report.cctvLink);
      const statusClass = followup.statusClass(report.status);

      return `
        <article class="followup-report-card" data-id="${window.escapeHtml(report.id)}">
          <div class="followup-card-head">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="followup-card-title">${window.escapeHtml(report.label || report.om || "Follow Up Report")}</span>
              <span class="followup-card-meta">${window.escapeHtml(followup.formatDate(report.date))} Â· ${window.escapeHtml(report.om || "OM not set")}</span>
            </div>
            <span class="followup-status-pill ${statusClass}">${window.escapeHtml(report.status || "Waiting for TL")}</span>
          </div>

          <div class="followup-card-layout">
            <button type="button" class="followup-large-shot ${hasImage ? "has-image" : "no-image"}" ${hasImage ? "" : "disabled"} title="${hasImage ? "Click to view full screenshot evidence" : "No screenshot attached"}">
              ${hasImage ? `<img src="${window.escapeHtml(report.screenshotData)}" alt="Evidence">` : `<span>No conversation proof</span>`}
            </button>

            <div class="followup-card-fields">
              <div class="followup-card-fields-row">
                <div class="form-group" style="margin:0;">
                  <label class="form-label" style="font-size:10px;">Date</label>
                  <input type="date" class="form-control form-control-sm followup-edit-date" value="${window.escapeHtml(report.date || "")}">
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="form-label" style="font-size:10px;">OM / Group Chat</label>
                  <input type="text" list="followupOmOptions" class="form-control form-control-sm followup-edit-om" value="${window.escapeHtml(report.om || "")}">
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="form-label" style="font-size:10px;">TL / Report Label</label>
                  <input type="text" class="form-control form-control-sm followup-edit-label" value="${window.escapeHtml(report.label || "")}" placeholder="Optional label">
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="form-label" style="font-size:10px;">Teams Link</label>
                  <div class="followup-link-row">
                    <input type="url" class="form-control form-control-sm followup-edit-link" value="${window.escapeHtml(report.cctvLink || "")}" placeholder="Paste URL">
                    <button type="button" class="btn btn-outline btn-sm followup-open-link-btn" ${safeLink ? "" : "disabled"} style="padding:2px 8px; font-size:10px;">Open</button>
                  </div>
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="form-label" style="font-size:10px;">Status</label>
                  <select class="form-control form-control-sm followup-edit-status">
                    ${followup.STATUSES.map(st => `<option value="${st}" ${st === report.status ? "selected" : ""}>${st}</option>`).join("")}
                  </select>
                </div>
              </div>

              <div class="form-group" style="margin:4px 0 0 0;">
                <label class="form-label" style="font-size:10px;">Remarks / TL Reply</label>
                <textarea class="form-control form-control-sm followup-edit-remarks" rows="2" placeholder="Record TL reply and OM verification notes...">${window.escapeHtml(report.remarks || "")}</textarea>
              </div>

              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; margin-top:4px;">
                <button type="button" class="btn btn-outline btn-sm followup-replace-btn" style="padding:2px 8px; font-size:10px;">Replace Screenshot</button>
                <button type="button" class="btn btn-danger-ghost btn-sm followup-delete-btn" style="padding:2px 8px; font-size:10px;">Delete</button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // Bind event handlers for cards
    listEl.querySelectorAll(".followup-report-card").forEach(card => {
      const cardId = card.dataset.id;
      const report = followupReportsList.find(r => r.id === cardId);
      if (!report) return;

      // Screenshot preview click
      card.querySelector(".followup-large-shot")?.addEventListener("click", () => {
        if (report.screenshotData) {
          openFullScreenshotViewer(report.screenshotData, `Evidence - ${report.label || report.om || "Follow Up"}`);
        }
      });

      // Field binds
      const bindField = (sel, key, evtName = "change") => {
        const inputEl = card.querySelector(sel);
        if (!inputEl) return;
        inputEl.addEventListener(evtName, () => {
          report[key] = inputEl.value;
          if (key === "status" || key === "om" || key === "label" || key === "date") {
            renderFollowupList();
          }
          scheduleFollowupSave();
        });
      };

      bindField(".followup-edit-date", "date");
      bindField(".followup-edit-om", "om");
      bindField(".followup-edit-label", "label");
      bindField(".followup-edit-status", "status");
      bindField(".followup-edit-remarks", "remarks", "input");

      const linkInput = card.querySelector(".followup-edit-link");
      const openBtn = card.querySelector(".followup-open-link-btn");
      if (linkInput && openBtn) {
        linkInput.addEventListener("input", () => {
          report.cctvLink = linkInput.value;
          openBtn.disabled = !followup.safeWebUrl(linkInput.value);
          scheduleFollowupSave();
        });
        openBtn.addEventListener("click", () => {
          const url = followup.safeWebUrl(report.cctvLink);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        });
      }

      // Replace screenshot
      card.querySelector(".followup-replace-btn")?.addEventListener("click", () => {
        followupReplaceTargetId = report.id;
        el("followupReplaceInput")?.click();
      });

      // Delete
      card.querySelector(".followup-delete-btn")?.addEventListener("click", async () => {
        const ok = window.appConfirm
          ? await window.appConfirm({
              title: "Delete follow-up report?",
              message: "This removes the screenshot, OM, date, status, and remarks from Follow Up Reports.",
              confirmText: "Delete",
              tone: "danger"
            })
          : window.confirm("Delete this follow-up report?");
        if (!ok) return;

        followupReportsList = followupReportsList.filter(r => r.id !== report.id);
        await followup.saveReports(followupReportsList);
        renderFollowupList();
        showToast("Follow-up report deleted.", "info");
      });
    });
  }

  async function loadFollowupReportsInitial() {
    try {
      followupReportsList = await followup.loadReports();
      const params = new URLSearchParams(window.location.search);
      if (params.has("demo") && !followupReportsList.length) {
        const samplePng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVHhe7c4BDQAACAMw9E/tUwwmFvw+yZptWc3MzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMxfmA0G6kFf2u/6fAAAAABJRU5ErkJggg==";
        followupReportsList = [
          followup.createReport({
            date: "2026-09-10",
            om: "CCTV OM MIRAH",
            label: "TL Sarah Connor (Shopee Team)",
            cctvLink: "https://teams.microsoft.com/l/message/19%3Ashopee%40thread.v2/0",
            status: "Waiting for TL",
            remarks: "Observed sleeping at workstation. Awaiting supervisor coaching form.",
            screenshotData: samplePng
          }),
          followup.createReport({
            date: "2026-09-10",
            om: "CCTV OM RENATO",
            label: "TL Christian Arcilla (AFP)",
            cctvLink: "https://teams.microsoft.com/l/message/19%3Aafp%40thread.v2/1",
            status: "TL Disputed",
            remarks: "TL claims device was 2FA token. Escalated for CCTV footage verification.",
            screenshotData: samplePng
          }),
          followup.createReport({
            date: "2026-09-09",
            om: "CCTV OM CRYSTAL",
            label: "TL Dante Tahuran (TEMU)",
            cctvLink: "https://teams.microsoft.com/l/message/19%3Atemu%40thread.v2/2",
            status: "Resolved",
            remarks: "Coaching session completed and notice of coaching signed.",
            screenshotData: samplePng
          })
        ];
        await followup.saveReports(followupReportsList);
      }
      renderFollowupList();
    } catch (err) {
      console.error("Initial load follow-up reports error:", err);
      followupReportsList = [];
      renderFollowupList();
    }
  }

  function renderFollowupWorkspace() {
    if (!followupReportsList.length) {
      loadFollowupReportsInitial();
    } else {
      renderFollowupList();
      updateFollowupSummary();
    }
  }

  function initFollowupController() {
    if (el("followupDate")) el("followupDate").value = followup.todayLocal();
    clearFollowupAddForm();
    loadFollowupReportsInitial();

    el("tabFollowup")?.addEventListener("click", refreshFollowupOmOptions);

    el("followupChooseShotBtn")?.addEventListener("click", () => el("followupAddShotInput")?.click());
    el("followupReplaceAddShotBtn")?.addEventListener("click", () => el("followupAddShotInput")?.click());
    el("followupRemoveAddShotBtn")?.addEventListener("click", () => {
      setFollowupAddScreenshot("");
      showFollowupMessage("Screenshot removed from new follow-up form.");
    });
    el("followupClearBtn")?.addEventListener("click", clearFollowupAddForm);

    el("followupAddShotInput")?.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        showFollowupMessage("Processing screenshot...");
        const compressed = await followup.compressImage(file);
        setFollowupAddScreenshot(compressed);
        showFollowupMessage("Screenshot ready.", "success");
      } catch (err) {
        showFollowupMessage(err.message || "Could not read image.", "error");
      }
    });

    // Drag & drop
    const dropZone = el("followupAddShotZone");
    ["dragenter", "dragover"].forEach(evType => dropZone?.addEventListener(evType, ev => {
      ev.preventDefault();
      dropZone.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach(evType => dropZone?.addEventListener(evType, ev => {
      ev.preventDefault();
      dropZone.classList.remove("dragover");
    }));
    dropZone?.addEventListener("drop", async ev => {
      const file = [...(ev.dataTransfer?.files || [])].find(f => String(f.type || "").startsWith("image/"));
      if (!file) return;
      try {
        showFollowupMessage("Processing screenshot...");
        const compressed = await followup.compressImage(file);
        setFollowupAddScreenshot(compressed);
        showFollowupMessage("Screenshot ready.", "success");
      } catch (err) {
        showFollowupMessage(err.message || "Could not read image.", "error");
      }
    });

    // Paste handler for screenshot
    document.addEventListener("paste", async ev => {
      const pane = el("paneFollowup");
      if (!pane || pane.hidden || !pane.classList.contains("active")) return;
      const target = ev.target;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName)) return;
      const file = [...(ev.clipboardData?.files || [])].find(f => String(f.type || "").startsWith("image/"));
      if (!file) return;
      ev.preventDefault();
      try {
        showFollowupMessage("Processing pasted screenshot...");
        const compressed = await followup.compressImage(file);
        setFollowupAddScreenshot(compressed);
        showFollowupMessage("Screenshot ready.", "success");
        showToast("Screenshot pasted into Follow Up form.", "info");
      } catch (err) {
        showFollowupMessage(err.message || "Could not read image.", "error");
      }
    });

    // Add button
    el("followupAddBtn")?.addEventListener("click", async () => {
      const om = String(el("followupOm")?.value || "").trim();
      const date = el("followupDate")?.value || followup.todayLocal();
      if (!followupAddScreenshotData) {
        showFollowupMessage("Add the TL conversation screenshot first.", "error");
        showToast("Add the TL conversation screenshot first.", "error");
        return;
      }
      if (!om) {
        showFollowupMessage("Select or type the OM / group chat.", "error");
        showToast("Select or type the OM / group chat.", "error");
        el("followupOm")?.focus();
        return;
      }

      const newReport = followup.createReport({
        date,
        om,
        label: el("followupLabel")?.value,
        cctvLink: el("followupCctvLink")?.value,
        status: el("followupStatus")?.value || "Waiting for TL",
        remarks: el("followupRemarks")?.value,
        screenshotData: followupAddScreenshotData
      });

      followupReportsList.unshift(newReport);
      try {
        await followup.saveReports(followupReportsList);
        clearFollowupAddForm();
        renderFollowupList();
        showFollowupMessage("Follow-up report saved.", "success");
        showToast("Follow-up report saved.", "success");
      } catch (err) {
        showFollowupMessage("Could not save report.", "error");
        showToast("Could not save follow-up report.", "error");
      }
    });

    // Replace input
    el("followupReplaceInput")?.addEventListener("change", async ev => {
      const file = ev.target.files?.[0];
      const report = followupReportsList.find(r => r.id === followupReplaceTargetId);
      ev.target.value = "";
      if (!file || !report) return;
      try {
        report.screenshotData = await followup.compressImage(file);
        await followup.saveReports(followupReportsList);
        renderFollowupList();
        showToast("Screenshot replaced.", "success");
      } catch (err) {
        showToast(err.message || "Could not replace screenshot.", "error");
      } finally {
        followupReplaceTargetId = "";
      }
    });
  }

  // =========================================================================
  // MASTERLIST WORKSPACE CONTROLLER
  // =========================================================================
  window.appConfirm = window.appConfirm || function({ title, message, confirmText, tone }) {
    return new Promise(resolve => {
      const modal = el("modalAppConfirm");
      if (!modal) {
        resolve(window.confirm(`${title || 'Confirm'}\n\n${message || ''}`));
        return;
      }
      const titleEl = el("confirmDialogTitle");
      const msgEl = el("confirmDialogMessage");
      const acceptBtn = el("btnConfirmDialogAccept");
      if (titleEl) titleEl.textContent = title || "Confirm Action";
      if (msgEl) msgEl.textContent = message || "Are you sure you want to proceed?";
      if (acceptBtn) {
        acceptBtn.textContent = confirmText || "Confirm";
        acceptBtn.className = tone === "danger" ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm";
      }
      modal.hidden = false;
      window.handleConfirmDialog = function(accepted) {
        modal.hidden = true;
        resolve(!!accepted);
      };
    });
  };

  // =========================================================================
  // =========================================================================
  // WORKSPACE 1: CCTV Report Composer
  // =========================================================================
  let cctvReportDraft = null;

  function renderCctvReportWorkspace() {
    if (!window.CCTV_REPORT_SERVICE) return;
    if (!cctvReportDraft) {
      cctvReportDraft = window.CCTV_REPORT_SERVICE.getDraft();
    }
    syncCctvReportFormFromDraft();
    renderCctvReportScreenshots();
    renderCctvReportPolicyBanner();
    updateCctvReportPreview();
  }

  let cctvReportLastGeneratedText = "";

  function syncCctvReportFormFromDraft() {
    if (!cctvReportDraft) return;
    if (el("quickComposeText")) el("quickComposeText").value = cctvReportDraft.rawInput || "";
    if (el("reportGreeting")) el("reportGreeting").value = cctvReportDraft.greeting || "Good morning TLs,";
    if (el("reportPersonInvolved")) el("reportPersonInvolved").value = cctvReportDraft.personInvolved || "";
    if (el("reportObservation")) el("reportObservation").value = cctvReportDraft.observation || "";
    if (el("reportSite")) el("reportSite").value = cctvReportDraft.site || "";
    if (el("reportDateRange")) el("reportDateRange").value = cctvReportDraft.dateRange || "";
    if (el("reportClipUrl")) el("reportClipUrl").value = cctvReportDraft.clipUrl || "";
  }

  function syncCctvReportDraftFromForm() {
    if (!cctvReportDraft) cctvReportDraft = window.CCTV_REPORT_SERVICE.getDraft();
    cctvReportDraft.rawInput = el("quickComposeText")?.value || "";
    cctvReportDraft.greeting = el("reportGreeting")?.value || "Good morning TLs,";
    cctvReportDraft.personInvolved = el("reportPersonInvolved")?.value || "";
    cctvReportDraft.observation = el("reportObservation")?.value || "";
    cctvReportDraft.site = el("reportSite")?.value || "";
    cctvReportDraft.dateRange = el("reportDateRange")?.value || "";
    cctvReportDraft.clipUrl = el("reportClipUrl")?.value || "";
    window.CCTV_REPORT_SERVICE.saveDraft(cctvReportDraft);
  }

  function renderCctvReportPolicyBanner() {
    const banner = el("reportPolicyBanner");
    const badge = el("reportPolicyBadge");
    const title = el("reportPolicyTitle");
    if (!banner || !badge || !title) return;

    if (cctvReportDraft && cctvReportDraft.referencedPolicy) {
      const pol = cctvReportDraft.referencedPolicy;
      banner.style.display = "flex";
      badge.textContent = `Internal Reference: Policy ${pol.num}`;
      title.textContent = `${pol.title} (${pol.severity}) â€” Internal Context Only (Not in final report)`;
    } else {
      banner.style.display = "none";
    }
  }

  function updateCctvReportPreview() {
    const box = el("teamsMessageBox");
    if (!box || !cctvReportDraft) return;

    const esc = (val) => String(val == null ? "" : val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const htmlParts = [];
    const greeting = (cctvReportDraft.greeting || "Good morning TLs,").trim();
    const observation = (cctvReportDraft.observation || "").trim();
    const person = (cctvReportDraft.personInvolved || "").trim();
    const site = (cctvReportDraft.site || "").trim();
    const dateRange = (cctvReportDraft.dateRange || "").trim();

    // Check if observation already starts with greeting
    const startsWithGreeting = /^\s*good\s+(?:morning|afternoon|evening)/i.test(observation);
    if (!startsWithGreeting && greeting) {
      htmlParts.push(`<div class="teams-preview-greeting" style="margin-bottom: 6px;">${esc(greeting)}</div>`);
    }

    if (observation) {
      const formattedBody = esc(observation).replace(/\r?\n/g, "<br>");
      htmlParts.push(`<div class="teams-preview-body" style="margin: 6px 0;">${formattedBody}</div>`);
    }

    const hasLocationInObs = /\bLocation\s*:/i.test(observation);
    const hasDateInObs = /\bDate\s*:/i.test(observation);

    const metaItems = [];
    if (person && !observation.includes(person)) {
      metaItems.push(`<div class="teams-preview-meta-line"><strong>Person/Agent Involved:</strong> ${esc(person)}</div>`);
    }
    if (site && !hasLocationInObs) {
      metaItems.push(`<div class="teams-preview-meta-line"><strong>Location:</strong> ${esc(site)}</div>`);
    }
    if (dateRange && !hasDateInObs) {
      metaItems.push(`<div class="teams-preview-meta-line"><strong>Date:</strong> ${esc(dateRange)}</div>`);
    }
    if (metaItems.length) {
      htmlParts.push(`<div class="teams-preview-meta" style="margin: 6px 0;">${metaItems.join("")}</div>`);
    }

    // Code of Conduct is kept strictly as internal supporting context.
    // By authoritative policy, policy numbers/titles/penalties must NOT appear in CCTV reports.

    if (Array.isArray(cctvReportDraft.screenshots) && cctvReportDraft.screenshots.length > 0) {
      const shotsHtml = cctvReportDraft.screenshots.map((s, idx) => {
        const src = typeof s === "string" ? s : (s.data || s.url || "");
        if (!src || !/^(data:image\/|https?:\/\/)/i.test(String(src).trim())) return "";
        return `<img src="${esc(String(src).trim())}" class="teams-preview-shot-img" alt="CCTV Screenshot ${idx + 1}">`;
      }).filter(Boolean).join("");
      htmlParts.push(`<div class="teams-preview-shots" style="margin: 6px 0;">${shotsHtml}</div>`);
    }

    const safeUrlFn = typeof window.safeUrl === "function" ? window.safeUrl : (u => /^https?:\/\//i.test(String(u||'').trim()) ? String(u).trim() : "");
    const clips = (cctvReportDraft.clipUrl || "")
      .split(/[\n,]+/)
      .map(u => u.trim())
      .map(u => safeUrlFn(u))
      .filter(u => !!u);

    if (clips.length === 1) {
      htmlParts.push(`<div class="teams-preview-clip" style="margin-top: 6px;"><strong>CCTV Clip:</strong> <a href="${esc(clips[0])}" target="_blank" rel="noopener noreferrer" style="color:#6366f1; text-decoration:underline; font-weight:600;">Click here!</a></div>`);
    } else if (clips.length > 1) {
      clips.forEach((c, idx) => {
        htmlParts.push(`<div class="teams-preview-clip" style="margin-top: 4px;"><strong>CCTV Clip ${idx + 1}:</strong> <a href="${esc(c)}" target="_blank" rel="noopener noreferrer" style="color:#6366f1; text-decoration:underline; font-weight:600;">Click here!</a></div>`);
      });
    } else {
      htmlParts.push(`<div class="teams-preview-clip" style="color:var(--text-muted); margin-top: 6px;"><strong>CCTV Clip:</strong> <em>Click here!</em></div>`);
    }

    box.innerHTML = htmlParts.join("");
  }

  function renderCctvReportScreenshots() {
    const gallery = el("reportShotGallery");
    const countEl = el("reportShotCount");
    if (!gallery || !cctvReportDraft) return;

    const count = Array.isArray(cctvReportDraft.screenshots) ? cctvReportDraft.screenshots.length : 0;
    if (countEl) countEl.textContent = String(count);

    if (!count) {
      gallery.innerHTML = "";
      return;
    }

    gallery.innerHTML = cctvReportDraft.screenshots.map((shot, idx) => {
      const src = typeof shot === "string" ? shot : (shot.data || shot.url || "");
      return `
        <div class="report-shot-item" data-index="${idx}" title="Click to view full image">
          <img src="${src}" alt="Screenshot ${idx + 1}">
          <button type="button" class="report-shot-remove" data-index="${idx}" title="Remove screenshot">âœ•</button>
        </div>
      `;
    }).join("");

    gallery.querySelectorAll(".report-shot-item").forEach(item => {
      const idx = parseInt(item.dataset.index, 10);
      const shot = cctvReportDraft.screenshots[idx];
      const src = typeof shot === "string" ? shot : (shot.data || shot.url || "");

      item.addEventListener("click", (e) => {
        if (e.target.closest(".report-shot-remove")) return;
        if (window.openFullScreenshotViewer) {
          window.openFullScreenshotViewer(src, "CCTV Report Evidence", `Screenshot #${idx + 1}`);
        }
      });

      item.querySelector(".report-shot-remove")?.addEventListener("click", (e) => {
        e.stopPropagation();
        cctvReportDraft.screenshots.splice(idx, 1);
        window.CCTV_REPORT_SERVICE.saveDraft(cctvReportDraft);
        renderCctvReportScreenshots();
        updateCctvReportPreview();
        showToast("Screenshot removed.", "info");
      });
    });
  }

  function handleReportImageFiles(files) {
    if (!files || !files.length || !cctvReportDraft) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        if (!Array.isArray(cctvReportDraft.screenshots)) cctvReportDraft.screenshots = [];
        cctvReportDraft.screenshots.push(dataUrl);
        window.CCTV_REPORT_SERVICE.saveDraft(cctvReportDraft);
        renderCctvReportScreenshots();
        updateCctvReportPreview();
        showToast("Screenshot added to report.", "success");
      };
      reader.readAsDataURL(file);
    });
  }

  function initCctvReportController() {
    if (!window.CCTV_REPORT_SERVICE) return;
    cctvReportDraft = window.CCTV_REPORT_SERVICE.getDraft();

    // Form field live binding
    const fieldIds = [
      "quickComposeText",
      "reportGreeting",
      "reportPersonInvolved",
      "reportObservation",
      "reportSite",
      "reportDateRange",
      "reportClipUrl"
    ];

    fieldIds.forEach(id => {
      el(id)?.addEventListener("input", () => {
        syncCctvReportDraftFromForm();
        updateCctvReportPreview();
      });
    });

    // Generate Report button
    el("btnGenerateReport")?.addEventListener("click", async () => {
      const rawText = el("quickComposeText")?.value || "";
      if (!rawText.trim()) {
        showToast("Please enter incident notes in Quick Compose first.", "warning");
        return;
      }
      syncCctvReportDraftFromForm();
      const generated = await window.CCTV_REPORT_SERVICE.generateReportAI(rawText, cctvReportDraft);
      cctvReportDraft = { ...cctvReportDraft, ...generated };
      cctvReportLastGeneratedText = cctvReportDraft.observation;
      window.CCTV_REPORT_SERVICE.saveDraft(cctvReportDraft);
      syncCctvReportFormFromDraft();
      updateCctvReportPreview();
      showToast("Report generated in established professional format.", "success");
    });

    // Regenerate button with manual edit check
    el("btnRegenerateReport")?.addEventListener("click", async () => {
      const rawText = el("quickComposeText")?.value || "";
      if (!rawText.trim()) {
        showToast("Please enter incident notes in Quick Compose first.", "warning");
        return;
      }

      const currentObs = el("reportObservation")?.value || "";
      if (cctvReportLastGeneratedText && currentObs !== cctvReportLastGeneratedText) {
        const ok = await window.appConfirm({
          title: "Overwrite Manual Edits?",
          message: "You have manually edited the report body. Regenerating will replace your manual edits with a freshly parsed report from Quick Compose. Proceed?",
          confirmText: "Regenerate",
          tone: "warning"
        });
        if (!ok) return;
      }

      syncCctvReportDraftFromForm();
      const generated = await window.CCTV_REPORT_SERVICE.generateReportAI(rawText, cctvReportDraft);
      cctvReportDraft = { ...cctvReportDraft, ...generated };
      cctvReportLastGeneratedText = cctvReportDraft.observation;
      window.CCTV_REPORT_SERVICE.saveDraft(cctvReportDraft);
      syncCctvReportFormFromDraft();
      updateCctvReportPreview();
      showToast(generated.aiUsed ? "AI Quick Compose regenerated the report." : "AI unavailable; standard Quick Compose was used.", generated.aiUsed ? "success" : "warning");
    });

    // Secondary action: Open Code of Conduct workspace
    el("btnOpenConductFromReport")?.addEventListener("click", () => {
      switchWorkspace("conduct");
    });

    // Remove referenced policy button
    el("btnRemoveReportPolicy")?.addEventListener("click", () => {
      if (!cctvReportDraft) return;
      cctvReportDraft.referencedPolicy = null;
      window.CCTV_REPORT_SERVICE.saveDraft(cctvReportDraft);
      renderCctvReportPolicyBanner();
      updateCctvReportPreview();
      showToast("Policy reference removed from report.", "info");
    });

    // Reset button
    el("btnResetCctvReport")?.addEventListener("click", async () => {
      const ok = await window.appConfirm({
        title: "Reset CCTV Report?",
        message: "Discard current report draft and reset fields to standard template?",
        confirmText: "Reset Draft",
        tone: "danger"
      });
      if (!ok) return;
      cctvReportDraft = window.CCTV_REPORT_SERVICE.resetDraft();
      cctvReportLastGeneratedText = "";
      syncCctvReportFormFromDraft();
      renderCctvReportScreenshots();
      renderCctvReportPolicyBanner();
      updateCctvReportPreview();
      showToast("Report composer reset to template.", "info");
    });

    // Screenshot file input & browse button
    el("btnBrowseReportShot")?.addEventListener("click", () => el("reportShotInput")?.click());
    el("reportShotInput")?.addEventListener("change", (e) => {
      handleReportImageFiles(e.target.files);
      e.target.value = "";
    });

    // Dropzone drag & drop
    const dropzone = el("reportDropzone");
    if (dropzone) {
      dropzone.addEventListener("click", () => el("reportShotInput")?.click());

      ["dragenter", "dragover"].forEach(evtName => {
        dropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add("drag-active");
        });
      });

      ["dragleave", "drop"].forEach(evtName => {
        dropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove("drag-active");
        });
      });

      dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) {
          handleReportImageFiles(dt.files);
        }
      });
    }

    // COPY ALL button
    el("btnCopyAllReport")?.addEventListener("click", async () => {
      try {
        syncCctvReportDraftFromForm();
        if (!cctvReportDraft.observation && !cctvReportDraft.personInvolved) {
          showToast("Please enter report details before copying.", "error");
          return;
        }

        const res = await window.CCTV_REPORT_SERVICE.copyAll(cctvReportDraft);
        const shotMsg = res.screenshotCount
          ? ` with ${res.screenshotCount} screenshot${res.screenshotCount === 1 ? '' : 's'}`
          : "";
        const clipMsg = res.hasClipLink
          ? ` and ${res.clipCount > 1 ? res.clipCount + ' clickable CCTV Clip links' : 'clickable CCTV Clip link'}`
          : "";
        showToast(`Copied complete report${shotMsg}${clipMsg} for Microsoft Teams!`, "success");
      } catch (err) {
        console.error("Copy report error:", err);
        showToast(err.message || "Failed to copy report to clipboard.", "error");
      }
    });

    // Global document paste handler for CCTV Report workspace
    document.addEventListener("paste", (e) => {
      if (currentWorkspace !== "report") return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") {
        const items = e.clipboardData?.items;
        if (!items) return;
        let hasImage = false;
        let hasText = false;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) hasImage = true;
          if (items[i].type === "text/plain") hasText = true;
        }
        if (hasImage && !hasText) {
          e.preventDefault();
          const files = e.clipboardData.files;
          handleReportImageFiles(files);
        }
        return;
      }

      const files = e.clipboardData?.files;
      if (files && files.length) {
        let hasImage = false;
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith("image/")) hasImage = true;
        }
        if (hasImage) {
          e.preventDefault();
          handleReportImageFiles(files);
        }
      }
    });

    window.renderCctvReportScreenshots = renderCctvReportScreenshots;
    window.updateCctvReportPreview = updateCctvReportPreview;
    window.syncCctvReportFormFromDraft = syncCctvReportFormFromDraft;
    window.syncCctvReportDraftFromForm = syncCctvReportDraftFromForm;
    window.getCctvReportDraft = () => cctvReportDraft;
    window.setCctvReportDraft = (d) => { cctvReportDraft = d; };
  }

  // =========================================================================
  // WORKSPACE 2: Code of Conduct Policy Reference (Standalone)
  // =========================================================================
  let conductFilterCategory = "all";
  let conductFilterSeverity = "all";
  let conductFilterMonitored = false;
  let conductCollapsedCategories = {};

  function renderCodeOfConductWorkspace() {
    renderCodeOfConductResults();
  }

  function renderCodeOfConductResults() {
    const container = el("conductResultsContainer");
    const countText = el("conductResultsCountText");
    const conductSvc = window.CCTV_CONDUCT || window.codeOfConductService || window.CCTV_REPORT_SERVICE;
    if (!container || !conductSvc) return;

    const query = el("conductSearchInput")?.value || "";
    const results = typeof conductSvc.searchCodeOfConduct === "function"
      ? conductSvc.searchCodeOfConduct(query, conductFilterCategory, conductFilterSeverity, conductFilterMonitored)
      : (typeof conductSvc.filterPolicies === "function" ? conductSvc.filterPolicies(conductFilterCategory, query) : []);

    let totalMatchingPolicies = 0;
    results.forEach(g => { totalMatchingPolicies += g.policies.length; });

    if (countText) {
      if (!query && conductFilterCategory === "all" && conductFilterSeverity === "all" && !conductFilterMonitored) {
        countText.textContent = `Showing All Policies (${totalMatchingPolicies} rules)`;
      } else {
        countText.textContent = `Showing ${totalMatchingPolicies} Matched Polic${totalMatchingPolicies === 1 ? 'y' : 'ies'}`;
      }
    }

    if (!results.length) {
      container.innerHTML = `<div style="padding:28px 16px;text-align:center;color:var(--text-muted);font-size:12px;">No Code of Conduct violations found matching "<strong>${escapeHtml(query)}</strong>". Try searching another term or resetting filters.</div>`;
      return;
    }

    const esc = (val) => String(val == null ? "" : val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Flatten matching policies across groups
    let flatPolicies = [];
    results.forEach(g => {
      g.policies.forEach(p => {
        flatPolicies.push({
          ...p,
          sectionName: p.category || g.category
        });
      });
    });

    // If there is a search query, sort flatPolicies globally by relevance score
    if (query) {
      flatPolicies.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));
    }

    // Render continuous flat list of policy cards with exact official section name
    container.innerHTML = flatPolicies.map(pol => {
      const sevClass = pol.severity === "GRAVE" ? "coc-sev-grave" : (pol.severity === "MAJOR" ? "coc-sev-major" : "coc-sev-minor");

      return `
        <div class="coc-rule-card" data-num="${esc(pol.num)}">
          <div class="coc-rule-card-top">
            <div class="coc-rule-title-group">
              <span class="coc-rule-num">${esc(pol.num)}</span>
              <strong class="coc-rule-title">${esc(pol.title)}</strong>
            </div>
            <span class="coc-sev-badge ${sevClass}">${esc(pol.severity)}</span>
          </div>
          <div class="coc-rule-desc">${esc(pol.description)}</div>
          <div class="coc-rule-section-tag" title="${esc(pol.sectionName)}">Section: ${esc(pol.sectionName)}</div>
        </div>
      `;
    }).join("");
  }

  function initCodeOfConductController() {
    const conductSvc = window.CCTV_CONDUCT || window.codeOfConductService || window.CCTV_REPORT_SERVICE;
    if (!conductSvc) return;

    // Search input
    const searchInput = el("conductSearchInput");
    const clearBtn = el("btnConductClearSearch");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        if (clearBtn) clearBtn.style.display = searchInput.value ? "inline-block" : "none";
        renderCodeOfConductResults();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
          clearBtn.style.display = "none";
          searchInput.focus();
        }
        renderCodeOfConductResults();
      });
    }

    // Category / Section dropdown filter
    el("conductCategorySelect")?.addEventListener("change", (e) => {
      conductFilterCategory = e.target.value;
      renderCodeOfConductResults();
    });
  }

  // =========================================================================
  // WORKSPACE: TRACKERS (Shared Authoritative Google Sheets Integration)
  // =========================================================================
  const TRACKER_CONFIGS = {
    audit: {
      key: "audit",
      label: "CCTV Audit",
      sheetTitle: "CCTV Audit (AUDIT 2026)",
      spreadsheetId: "1dhQKpRxZUFjQc-00a5SQXRRsIOMCjT_d-b-o36bYWzs",
      gid: "312942343",
      url: "https://docs.google.com/spreadsheets/d/1dhQKpRxZUFjQc-00a5SQXRRsIOMCjT_d-b-o36bYWzs/edit?gid=312942343#gid=312942343"
    },
    "2026": {
      key: "2026",
      label: "2026",
      sheetTitle: "2026 Tracker (QUERY)",
      spreadsheetId: "12o3O1u2xb3DbXW41jAen-8HSJhpJRzQLSIb_6o5JRc4",
      gid: "1589623984",
      url: "https://docs.google.com/spreadsheets/d/12o3O1u2xb3DbXW41jAen-8HSJhpJRzQLSIb_6o5JRc4/edit?gid=1589623984#gid=1589623984"
    },
    itsheet: {
      key: "itsheet",
      label: "IT Sheet",
      sheetTitle: "IT Sheet / Maintenance (MAA 4F/5F)",
      spreadsheetId: "1PBKIr7cACVcElX9YpAqshhTTsjlJz69dji7TiA0IlrE",
      gid: "484781158",
      url: "https://docs.google.com/spreadsheets/d/1PBKIr7cACVcElX9YpAqshhTTsjlJz69dji7TiA0IlrE/edit?gid=484781158#gid=484781158"
    },
    seatplan: {
      key: "seatplan",
      label: "Seatplan",
      sheetTitle: "SEAT PLAN 2026",
      spreadsheetId: "1XanmnE63XiyKyT7EZMahHd8E8uZJftQlwPihy1JF96E",
      gid: "",
      url: "https://docs.google.com/spreadsheets/d/1XanmnE63XiyKyT7EZMahHd8E8uZJftQlwPihy1JF96E/edit"
    }
  };

  const TRACKER_STORAGE_KEY = "cctv_ops_v2_active_tracker_tab";
  const TRACKER_DEFAULT_ZOOM = {
    audit: 80,
    "2026": 70,
    itsheet: 90,
    seatplan: 60
  };
  const TRACKER_ZOOM_LEVELS = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];

  let activeTrackerKey = "audit";

  function getSavedTrackerZoom(key) {
    const storageKey = `cctv_ops_v2_tracker_zoom_${key}`;
    try {
      const val = parseInt(localStorage.getItem(storageKey), 10);
      if (!isNaN(val) && val >= 50 && val <= 150) return val;
    } catch (_) {}
    return TRACKER_DEFAULT_ZOOM[key] || 100;
  }

  function saveTrackerZoom(key, zoom) {
    const storageKey = `cctv_ops_v2_tracker_zoom_${key}`;
    try {
      localStorage.setItem(storageKey, String(zoom));
    } catch (_) {}
  }

  function applyTrackerZoom(zoomPct) {
    const iframe = el("trackerFrame");
    const display = el("trackerZoomDisplay");
    if (display) display.textContent = `${zoomPct}%`;

    if (iframe) {
      const scale = zoomPct / 100;
      iframe.style.width = `${100 / scale}%`;
      iframe.style.height = `${100 / scale}%`;
      iframe.style.transform = `scale(${scale})`;
      iframe.style.transformOrigin = "0 0";
    }
  }

  function stepTrackerZoom(delta) {
    const current = getSavedTrackerZoom(activeTrackerKey);
    let newIdx = TRACKER_ZOOM_LEVELS.indexOf(current);
    if (newIdx === -1) {
      newIdx = TRACKER_ZOOM_LEVELS.findIndex(lvl => lvl >= current);
      if (newIdx === -1) newIdx = TRACKER_ZOOM_LEVELS.length - 1;
    }
    const nextIdx = Math.max(0, Math.min(TRACKER_ZOOM_LEVELS.length - 1, newIdx + delta));
    const nextZoom = TRACKER_ZOOM_LEVELS[nextIdx];
    saveTrackerZoom(activeTrackerKey, nextZoom);
    applyTrackerZoom(nextZoom);
  }

  function resetTrackerZoom() {
    const defaultZoom = TRACKER_DEFAULT_ZOOM[activeTrackerKey] || 100;
    saveTrackerZoom(activeTrackerKey, defaultZoom);
    applyTrackerZoom(defaultZoom);
  }

  function setTrackerWorkbook(key, forceReload = false) {
    if (!TRACKER_CONFIGS[key]) key = "audit";
    activeTrackerKey = key;
    try {
      localStorage.setItem(TRACKER_STORAGE_KEY, key);
    } catch (_) {}

    const cfg = TRACKER_CONFIGS[key];
    const iframe = el("trackerFrame");
    const labelEl = el("trackersActiveLabel");
    const openLink = el("linkOpenGoogleSheets");

    if (labelEl) labelEl.textContent = cfg.sheetTitle || cfg.label;
    if (openLink) openLink.href = cfg.url;

    // Update switcher tab buttons
    document.querySelectorAll(".tracker-switch-btn").forEach(btn => {
      const isCurrent = btn.dataset.tracker === key;
      btn.classList.toggle("active", isCurrent);
      btn.setAttribute("aria-selected", isCurrent ? "true" : "false");
    });

    // Apply saved independent zoom for this specific tracker workbook
    const savedZoom = getSavedTrackerZoom(key);
    applyTrackerZoom(savedZoom);

    if (iframe) {
      if (forceReload || iframe.src !== cfg.url) {
        iframe.src = cfg.url;
      }
    }
  }

  function renderTrackersWorkspace() {
    let savedKey = "audit";
    try {
      savedKey = localStorage.getItem(TRACKER_STORAGE_KEY) || "audit";
    } catch (_) {}
    if (!TRACKER_CONFIGS[savedKey]) savedKey = "audit";
    setTrackerWorkbook(savedKey, false);
  }

  function initTrackersController() {
    // Switcher buttons
    document.querySelectorAll(".tracker-switch-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.tracker;
        setTrackerWorkbook(key, false);
      });
    });

    // Reload button
    el("btnTrackerReload")?.addEventListener("click", () => {
      setTrackerWorkbook(activeTrackerKey, true);
      showToast(`Reloaded ${TRACKER_CONFIGS[activeTrackerKey]?.label || 'tracker'}.`, "info");
    });

    // Independent Tracker Zoom Controls
    el("btnTrackerZoomOut")?.addEventListener("click", () => stepTrackerZoom(-1));
    el("btnTrackerZoomIn")?.addEventListener("click", () => stepTrackerZoom(1));
    el("btnTrackerZoomReset")?.addEventListener("click", () => resetTrackerZoom());

    // Ctrl + Mouse Wheel listener over the tracker viewport container
    const frameContainer = el("trackersFrameContainer");
    if (frameContainer) {
      frameContainer.addEventListener("wheel", (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          stepTrackerZoom(e.deltaY < 0 ? 1 : -1);
        }
      }, { passive: false });
    }

    // Restore saved state
    let savedKey = "audit";
    try {
      savedKey = localStorage.getItem(TRACKER_STORAGE_KEY) || "audit";
    } catch (_) {}
    if (!TRACKER_CONFIGS[savedKey]) savedKey = "audit";
    setTrackerWorkbook(savedKey, false);

    window.setTrackerWorkbook = setTrackerWorkbook;
    window.renderTrackersWorkspace = renderTrackersWorkspace;
    window.TRACKER_CONFIGS = TRACKER_CONFIGS;
    window.applyTrackerZoom = applyTrackerZoom;
    window.getSavedTrackerZoom = getSavedTrackerZoom;
  }

  // =========================================================================
  // WORKSPACE: HRIS (SixEleven HRIS / Employee DTR Integration)
  // =========================================================================
  function initHrisController() {
    const reloadBtn = el("btnHrisReload");
    const reloadEmbeddedBtn = el("btnReloadEmbeddedHris");
    const hrisFrame = el("hrisFrame");

    const doReload = () => {
      if (hrisFrame) {
        hrisFrame.src = "https://611systems.com/hrsys/employee-dtr";
        showToast("Reloading HRIS Employee DTR...", "info");
      }
    };

    reloadBtn?.addEventListener("click", doReload);
    reloadEmbeddedBtn?.addEventListener("click", doReload);

    // Detect if iframe loading triggers standard error
    if (hrisFrame) {
      hrisFrame.addEventListener("error", () => {
        const blocked = el("hrisBlockedNotice");
        if (blocked) blocked.style.display = "flex";
      });
    }
  }

  function renderMasterlistWorkspace() {
    if (window._renderMasterlistWorkspaceFn) {
      window._renderMasterlistWorkspaceFn();
    }
  }

  function initMasterlistController() {
    const masterlist = window.masterlistService;
    if (!masterlist) return;

    const syncDot = el("masterlistSyncDot");
    const syncTitle = el("masterlistSyncTitle");
    const syncDetail = el("masterlistSyncDetail");
    const lastUpdated = el("masterlistLastUpdated");
    const refreshBtn = el("masterlistRefreshBtn");

    const pendingTitle = el("masterPendingTitle");
    const pendingMilesCount = el("masterPendingMilesCount");
    const pendingTabs = el("masterPendingTabs");
    const pendingTable = el("masterPendingMilesTable");

    const notepadTitle = el("masterPendingNotesTitle");
    const notepadStatus = el("masterNotepadStatus");
    const notepadText = el("masterPendingNotepad");
    const notepadClearBtn = el("masterNotepadClearBtn");

    const hrCount = el("masterAssignedHrCount");
    const hrEditId = el("masterHrEditId");
    const hrSiteInput = el("masterHrSiteInput");
    const hrTeamInput = el("masterHrTeamInput");
    const hrAssignedInput = el("masterHrAssignedInput");
    const hrSaveBtn = el("masterHrSaveBtn");
    const hrCancelBtn = el("masterHrCancelBtn");
    const hrStatus = el("masterHrCrudStatus");
    const hrSearch = el("masterHrSearch");
    const hrSearchClear = el("masterHrSearchClear");
    const hrTableBody = el("masterAssignedHrBody");

    function renderSyncStatus() {
      const state = masterlist.getSyncState();
      if (syncDot) {
        syncDot.className = "masterlist-sync-dot " + (state.kind === "live" ? "is-live" : (state.kind === "syncing" ? "is-syncing" : "is-error"));
      }
      if (syncTitle) syncTitle.textContent = state.title;
      if (syncDetail) syncDetail.textContent = state.detail;
      if (lastUpdated) lastUpdated.textContent = state.formattedTime;
    }

    function renderPendingTrackers() {
      const trackers = masterlist.getTrackers();
      const activeKey = masterlist.getActiveTrackerKey();
      const activeTracker = trackers.find(t => t.key === activeKey) || trackers[0];

      // Update tab badges
      trackers.forEach(t => {
        const badgeEl = el("badge" + t.label.replace(/[^a-zA-Z]/g, ""));
        if (badgeEl) badgeEl.textContent = String(t.count);
      });

      // Update active tab buttons
      pendingTabs?.querySelectorAll("[data-pending-key]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.pendingKey === activeKey);
      });

      if (pendingTitle) pendingTitle.textContent = `Pending ${activeTracker ? activeTracker.label : 'Miles'}`;
      if (pendingMilesCount) pendingMilesCount.textContent = String(activeTracker ? activeTracker.count : 0);

      // Render table
      if (pendingTable) {
        const thead = pendingTable.querySelector("thead");
        const tbody = pendingTable.querySelector("tbody");
        const columns = masterlist.getColumns();

        if (thead) {
          thead.innerHTML = `<tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join("")}</tr>`;
        }

        if (tbody) {
          const rows = masterlist.getPendingRows(activeKey);
          const sourceInfo = activeTracker?.sourceInfo;

          if (sourceInfo && sourceInfo.ok === false) {
            const errDetail = sourceInfo.error || "Sheet could not be read or was not found.";
            tbody.innerHTML = `<tr><td colspan="${columns.length}" class="masterlist-empty-cell is-error">âš ï¸ <strong>Source Error:</strong> Could not load ${escapeHtml(activeTracker.label)} tracker: ${escapeHtml(errDetail)}</td></tr>`;
          } else if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="${columns.length}" class="masterlist-empty-cell">No Pending ${escapeHtml(activeTracker ? activeTracker.label : 'Miles')} rows found.</td></tr>`;
          } else {
            tbody.innerHTML = rows.map(row => `
              <tr>
                ${columns.map(col => `<td>${escapeHtml(masterlist.valueForPendingColumn(row, col))}</td>`).join("")}
              </tr>
            `).join("");
          }
        }
      }

      // Update Notepad
      if (notepadTitle) notepadTitle.textContent = `Pending ${activeTracker ? activeTracker.label : 'Miles'} Notes`;
      if (notepadText) notepadText.value = masterlist.getNotepad(activeKey);
      if (notepadStatus) notepadStatus.textContent = "Saved locally";
    }

    function setHrStatus(msg, tone = "") {
      if (!hrStatus) return;
      if (!msg) {
        hrStatus.style.display = "none";
        hrStatus.textContent = "";
        return;
      }
      hrStatus.style.display = "block";
      hrStatus.textContent = msg;
      hrStatus.className = "masterlist-hr-status" + (tone ? ` is-${tone}` : "");
    }

    function clearHrForm() {
      if (hrEditId) hrEditId.value = "";
      if (hrSiteInput) hrSiteInput.value = "";
      if (hrTeamInput) hrTeamInput.value = "";
      if (hrAssignedInput) hrAssignedInput.value = "";
      if (hrSaveBtn) hrSaveBtn.textContent = "Add";
      setHrStatus("");
    }

    function renderHrAssignments() {
      const query = hrSearch?.value || "";
      const assignments = masterlist.getHrAssignments(query);

      if (hrCount) hrCount.textContent = String(assignments.length);

      if (!hrTableBody) return;

      if (!assignments.length) {
        hrTableBody.innerHTML = `<tr><td colspan="4" class="masterlist-empty-cell">No HR assignments found.</td></tr>`;
        return;
      }

      hrTableBody.innerHTML = assignments.map(item => `
        <tr data-id="${escapeHtml(item.id || "")}">
          <td>${escapeHtml(item.site)}</td>
          <td>${escapeHtml(item.omTeam)}</td>
          <td>${escapeHtml(item.hr)}</td>
          <td>
            <div class="masterlist-hr-actions-cell">
              <button type="button" class="btn btn-ghost btn-sm btn-hr-edit" data-id="${escapeHtml(item.id || "")}" style="padding:2px 6px; font-size:10px;">Edit</button>
              <button type="button" class="btn btn-danger-ghost btn-sm btn-hr-delete" data-id="${escapeHtml(item.id || "")}" style="padding:2px 6px; font-size:10px;">Delete</button>
            </div>
          </td>
        </tr>
      `).join("");

      // Wire edit buttons
      hrTableBody.querySelectorAll(".btn-hr-edit").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const item = assignments.find(a => a.id === id);
          if (!item) return;
          if (hrEditId) hrEditId.value = item.id || "";
          if (hrSiteInput) hrSiteInput.value = item.site || "";
          if (hrTeamInput) hrTeamInput.value = item.omTeam || "";
          if (hrAssignedInput) hrAssignedInput.value = item.hr || "";
          if (hrSaveBtn) hrSaveBtn.textContent = "Update";
          hrSiteInput?.focus();
          setHrStatus(`Editing assignment for ${item.site} Â· ${item.omTeam}`, "local");
        });
      });

      // Wire delete buttons
      hrTableBody.querySelectorAll(".btn-hr-delete").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const item = assignments.find(a => a.id === id);
          if (!item) return;

          const approved = await (window.appConfirm ? window.appConfirm({
            title: "Delete HR Assignment?",
            message: `Remove assignment for ${item.site} Â· ${item.omTeam} Â· ${item.hr}?`,
            confirmText: "Delete Assignment",
            tone: "danger"
          }) : window.confirm(`Delete assignment for ${item.site} Â· ${item.omTeam}?`));

          if (!approved) return;

          try {
            await masterlist.deleteHrAssignment(id);
            showToast("HR assignment removed.", "success");
            setHrStatus("Assignment removed.", "success");
          } catch (err) {
            showToast(err.message || "Could not delete assignment.", "error");
            setHrStatus(err.message || "Could not delete assignment.", "error");
          }
        });
      });
    }

    // Tracker sub-tab events
    pendingTabs?.querySelectorAll("[data-pending-key]").forEach(btn => {
      btn.addEventListener("click", () => {
        masterlist.setActiveTrackerKey(btn.dataset.pendingKey);
        renderPendingTrackers();
      });
    });

    // Refresh button event
    refreshBtn?.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      const origText = refreshBtn.innerHTML;
      refreshBtn.innerHTML = `<span>Updating...</span>`;
      try {
        await masterlist.loadMasterList(true);
        showToast("Master List refreshed from Google Sheets.", "success");
      } catch (err) {
        showToast("Refresh failed: " + (err.message || "Network error"), "error");
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = origText;
      }
    });

    // Debounced Notepad saving
    let noteTimer = null;
    notepadText?.addEventListener("input", () => {
      if (notepadStatus) notepadStatus.textContent = "Saving...";
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => {
        const text = notepadText.value;
        const activeKey = masterlist.getActiveTrackerKey();
        masterlist.saveNotepad(activeKey, text);
        if (notepadStatus) {
          notepadStatus.textContent = "Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
      }, 350);
    });

    // Clear Notepad button
    notepadClearBtn?.addEventListener("click", async () => {
      const activeKey = masterlist.getActiveTrackerKey();
      const approved = await (window.appConfirm ? window.appConfirm({
        title: `Clear Pending Notepad?`,
        message: "This will remove the saved notes for this pending tracker from this browser.",
        confirmText: "Clear Notepad",
        tone: "danger"
      }) : window.confirm("Clear notepad for this tracker?"));

      if (!approved) return;

      masterlist.clearNotepad(activeKey);
      if (notepadText) notepadText.value = "";
      if (notepadStatus) notepadStatus.textContent = "Notepad cleared";
      showToast("Notepad cleared.", "info");
    });

    // HR Form Add/Save
    hrSaveBtn?.addEventListener("click", async () => {
      const site = hrSiteInput?.value?.trim();
      const omTeam = hrTeamInput?.value?.trim();
      const hr = hrAssignedInput?.value?.trim();
      const id = hrEditId?.value?.trim();

      if (!site || !omTeam || !hr) {
        setHrStatus("Site, Team / OM / Campaign, and HR are required.", "error");
        showToast("Please fill in all required HR assignment fields.", "error");
        return;
      }

      try {
        const result = await masterlist.saveHrAssignment({ id, site, omTeam, hr });
        clearHrForm();
        setHrStatus(
          result.sent
            ? "Saved. Google Sheets sync will confirm it on refresh."
            : "Saved on this browser; Google Sheets write could not be confirmed.",
          result.sent ? "success" : "local"
        );
        showToast("HR assignment saved.", "success");
      } catch (err) {
        setHrStatus(err.message || "Failed to save assignment.", "error");
        showToast(err.message || "Failed to save assignment.", "error");
      }
    });

    // HR Form Cancel
    hrCancelBtn?.addEventListener("click", () => {
      clearHrForm();
    });

    // Search input & clear
    hrSearch?.addEventListener("input", () => {
      renderHrAssignments();
    });

    hrSearchClear?.addEventListener("click", () => {
      if (hrSearch) {
        hrSearch.value = "";
        hrSearch.focus();
        renderHrAssignments();
      }
    });

    // Masterlist service subscription
    masterlist.subscribe(() => {
      renderSyncStatus();
      renderPendingTrackers();
      renderHrAssignments();
    });

    window._renderMasterlistWorkspaceFn = function() {
      renderSyncStatus();
      renderPendingTrackers();
      renderHrAssignments();
    };

    // Initial render & boot
    renderSyncStatus();
    renderPendingTrackers();
    renderHrAssignments();
    masterlist.init();
  }

  // =========================================================================
  // ACTIVITY HISTORY WORKSPACE CONTROLLER
  // =========================================================================
  function renderHistoryWorkspace() {
    if (window._renderHistoryWorkspaceFn) {
      window._renderHistoryWorkspaceFn();
    }
  }

  function initHistoryController() {
    const history = window.historyService;
    if (!history) return;

    const undoBtn = el("historyUndoBtn");
    const redoBtn = el("historyRedoBtn");
    const restoreBtn = el("historyRestoreSelectedBtn");
    const clearBtn = el("historyClearBtn");
    const summaryText = el("historySummaryText");
    const countBadge = el("historyCountBadge");
    const listContainer = el("historyListContainer");
    const previewContainer = el("historyPreviewContainer");
    const selectedWsBadge = el("historySelectedWsBadge");

    function formatTime(iso) {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    function renderHistoryPreview(entry) {
      if (!previewContainer) return;
      if (!entry) {
        if (selectedWsBadge) selectedWsBadge.textContent = "â€”";
        previewContainer.innerHTML = '<div class="history-preview-empty">Select a history item to inspect affected reports or data.</div>';
        return;
      }

      if (selectedWsBadge) {
        selectedWsBadge.textContent = (entry.workspace || "Workspace").toUpperCase();
      }

      const summary = history.historyEntrySummary(entry);
      let previewHtml = `
        <div class="history-preview-box">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <strong style="color:var(--text-primary); font-size:12px;">${escapeHtml(entry.action)}</strong>
            <span style="color:var(--text-dim); font-size:10.5px;">${escapeHtml(formatTime(entry.at))}</span>
          </div>
          <div style="font-size:11.5px; color:var(--text-secondary); margin-bottom:8px;">
            ${escapeHtml(summary || "State snapshot captured.")}
          </div>
        </div>
      `;

      if (entry.before || entry.after) {
        previewHtml += `
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
            <div style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Snapshot Diff Detail</div>
            <div class="history-preview-box" style="font-family:var(--font-mono); font-size:10.5px; max-height:220px; overflow-y:auto; white-space:pre-wrap;">
${escapeHtml(JSON.stringify(entry.after || entry.before, null, 2))}
            </div>
          </div>
        `;
      }

      previewContainer.innerHTML = previewHtml;
    }

    function renderTimeline() {
      const timeline = history.getTimeline();

      if (undoBtn) undoBtn.disabled = !timeline.canUndo;
      if (redoBtn) redoBtn.disabled = !timeline.canRedo;
      if (restoreBtn) restoreBtn.disabled = !timeline.selectedId;

      if (countBadge) countBadge.textContent = String(timeline.total);
      if (summaryText) {
        summaryText.textContent = timeline.total
          ? `${timeline.total} saved change${timeline.total === 1 ? "" : "s"} recorded`
          : "No changes recorded yet.";
      }

      if (!listContainer) return;

      if (!timeline.entries.length) {
        listContainer.innerHTML = '<div class="history-preview-empty">No workspace changes recorded yet. Actions across all workspaces are automatically tracked here.</div>';
        renderHistoryPreview(null);
        return;
      }

      listContainer.innerHTML = timeline.entries
        .map((entry, index) => ({ entry, index }))
        .reverse()
        .map(({ entry, index }) => {
          const isSelected = entry.id === timeline.selectedId;
          const isCurrent = index === timeline.cursor;
          const wsLabel = (entry.workspace || "").toUpperCase();

          return `
            <div class="history-item ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}" data-id="${escapeHtml(entry.id)}">
              <input type="radio" class="history-radio" name="historyTimelineRadio" value="${escapeHtml(entry.id)}" ${isSelected ? 'checked' : ''}>
              <div class="history-item-body">
                <div class="history-item-top">
                  <span class="history-item-action">${escapeHtml(entry.action)}</span>
                  <span class="history-item-time">${escapeHtml(formatTime(entry.at))}</span>
                </div>
                <div class="history-item-meta">
                  <span class="history-ws-badge">${escapeHtml(wsLabel)}</span>
                  <span class="history-item-summary">${escapeHtml(history.historyEntrySummary(entry))}</span>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      listContainer.querySelectorAll(".history-item").forEach(itemEl => {
        itemEl.addEventListener("click", () => {
          const id = itemEl.dataset.id;
          history.setSelectedId(id);
        });
      });

      const selectedEntry = timeline.entries.find(e => e.id === timeline.selectedId);
      renderHistoryPreview(selectedEntry || null);
    }

    undoBtn?.addEventListener("click", async () => {
      const ok = await history.undo();
      if (ok) showToast("Undone last workspace change.", "info");
    });

    redoBtn?.addEventListener("click", async () => {
      const ok = await history.redo();
      if (ok) showToast("Redone workspace change.", "info");
    });

    // =========================================================================
    // GLOBAL KEYBOARD SHORTCUTS: Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
    // Items 11 and 12 â€” works from any workspace when not typing in an input field
    // =========================================================================
    document.addEventListener("keydown", async (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const active = document.activeElement;
      const isTyping = active && /^(INPUT|TEXTAREA|SELECT)$/i.test(active.tagName);
      // Allow undo/redo in contenteditable cells only when NOT in editing mode
      const isEditingCell = active && active.matches &&
        active.matches('[contenteditable="true"]') && active.dataset.editing === "true";
      if (isTyping || isEditingCell) return;

      const key = event.key;
      // Ctrl+Z: Undo
      if (!event.shiftKey && key === "z") {
        event.preventDefault();
        const ok = await history.undo();
        if (ok) showToast("Undone last workspace change.", "info");
        return;
      }
      // Ctrl+Y: Redo
      if (!event.shiftKey && key === "y") {
        event.preventDefault();
        const ok = await history.redo();
        if (ok) showToast("Redone workspace change.", "info");
        return;
      }
      // Ctrl+Shift+Z: Redo (alternate)
      if (event.shiftKey && key === "z") {
        event.preventDefault();
        const ok = await history.redo();
        if (ok) showToast("Redone workspace change.", "info");
        return;
      }
    });

    restoreBtn?.addEventListener("click", async () => {
      const timeline = history.getTimeline();

      if (!timeline.selectedId) return;

      const ok = await history.restoreSelectedEntry(timeline.selectedId);
      if (ok) {
        showToast("Selected workspace change restored.", "success");
      } else {
        showToast("Could not restore selected change.", "error");
      }
    });

    clearBtn?.addEventListener("click", async () => {
      const approved = await (window.appConfirm ? window.appConfirm({
        title: "Clear workspace history?",
        message: "Undo/redo snapshots from all workspaces will be removed. Current data will stay.",
        confirmText: "Clear History",
        tone: "danger"
      }) : window.confirm("Clear all workspace history snapshots?"));

      if (!approved) return;

      await history.clearHistory();
      showToast("Workspace history cleared.", "info");
    });

    history.subscribe(() => {
      renderTimeline();
    });

    window._renderHistoryWorkspaceFn = function() {
      renderTimeline();
    };

    renderTimeline();
    history.init();
  }

  // =========================================================================
  // ACCOUNTS / ADMIN OPERATIONS CONSOLE CONTROLLER
  // =========================================================================
  function initAccountsController() {
    const svc = window.CCTV_ACCOUNTS;
    if (!svc) { console.warn('[Accounts] CCTV_ACCOUNTS service not loaded.'); return; }
    svc.init();

    let accessEditingUser = null;

    // â”€â”€ Utility helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const $ = id => document.getElementById(id);
    const esc = t => String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dt = v => { if (!v) return 'â€”'; const d = new Date(v); if (isNaN(d)) return 'â€”'; return d.toLocaleString([],{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
    const cleanUsername = u => String(u||'').trim().replace(/^@+/,'');
    const usernameLabel = u => { const c = cleanUsername(u); return c ? `@${c}` : ''; };

    const statusPill = s => {
      const n = String(s||'').toLowerCase();
      if (n === 'approved' || n === 'active') return `<span class="admin-badge badge-active">Active</span>`;
      if (n === 'disabled' || n === 'suspended') return `<span class="admin-badge badge-disabled">Disabled</span>`;
      if (n === 'pending') return `<span class="admin-badge badge-pending">Pending</span>`;
      if (n === 'rejected') return `<span class="admin-badge badge-disabled">Rejected</span>`;
      return `<span class="admin-badge badge-user">${esc(s||'Unknown')}</span>`;
    };

    const permSummary = item => {
      if (item?.role === 'super_admin') return 'Super Admin (All Workspaces & Capabilities)';
      const p = item?.permissions || {};
      if (item?.role === 'admin') {
        const privs = [];
        if (p.accounts) privs.push('Accounts');
        if (p.manage_users) privs.push('Users');
        if (p.manage_permissions) privs.push('Perms');
        if (p.view_security_logs) privs.push('Audit');
        return `Admin (${privs.join(', ') || 'Custom'})`;
      }
      const list = [];
      if (p.report !== false && p.cctv !== false) list.push('Report');
      if (p.conduct !== false) list.push('Conduct');
      if (p.edr !== false) list.push('EDR');
      if (p.audit !== false && p.cctv !== false) list.push('Audit');
      if (p.trackers !== false) list.push('Trackers');
      if (p.hris === true) list.push('HRIS');
      if (p.sorter !== false && p.aiSorter !== false) list.push('Sorter');
      if (p.maintenance !== false) list.push('Maint');
      if (p.pending !== false) list.push('Pending');
      if (p.followup !== false) list.push('Followup');
      if (p.masterlist !== false) list.push('Master');
      if (p.history !== false) list.push('History');
      return list.join(', ') || 'No workspaces';
    };

    const setStatus = (text, kind = '') => {
      const s = $('adminCreateAccountStatus');
      if (!s) return;
      s.textContent = text;
      s.className = 'auth-create-status';
      if (kind) s.classList.add(`is-${kind}`);
    };

    async function copyText(text, btn, label = 'Copied!') {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand('copy'); ta.remove();
        }
        if (btn) {
          const oldHtml = btn.innerHTML;
          btn.classList.add('is-copied');
          const span = btn.querySelector('span');
          if (span) span.textContent = label; else btn.textContent = `âœ“ ${label}`;
          setTimeout(() => { btn.classList.remove('is-copied'); btn.innerHTML = oldHtml; }, 1800);
        }
        showToast('Copied to clipboard.');
      } catch (_) { showToast('Could not copy.'); }
    }

    // â”€â”€ KPI + System Status update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async function updateKpiDisplay() {
      const metrics = await svc.getMetrics();
      if ($('adminTotalUsers')) $('adminTotalUsers').textContent = metrics.totalUsers;
      if ($('adminCountAdmins')) $('adminCountAdmins').textContent = metrics.countAdmins;
      if ($('adminCountUsers')) $('adminCountUsers').textContent = metrics.countUsers;
      if ($('adminPendingUsers')) $('adminPendingUsers').textContent = metrics.pendingUsers;
      if ($('adminDisabledUsers')) $('adminDisabledUsers').textContent = metrics.disabledUsers;
      if ($('adminRecentUsers')) $('adminRecentUsers').textContent = metrics.recentUsers;
      if ($('adminEdrCount')) $('adminEdrCount').textContent = metrics.edrCount;
      if ($('adminCctvCount')) $('adminCctvCount').textContent = metrics.cctvCount;
      if ($('adminFollowupCount')) $('adminFollowupCount').textContent = metrics.followupCount;

      const sys = svc.getSystemStatus();
      if ($('adminSupabaseStatus')) $('adminSupabaseStatus').textContent = sys.supabase.label;
      if ($('adminSupabaseDot')) {
        $('adminSupabaseDot').classList.toggle('is-online', sys.supabase.isOnline);
        $('adminSupabaseDot').classList.toggle('is-warning', !sys.supabase.isOnline);
      }
      if ($('adminDocsStatus')) $('adminDocsStatus').textContent = sys.docs.label;
      if ($('adminDocsDot')) {
        $('adminDocsDot').classList.toggle('is-online', sys.docs.isOnline);
        $('adminDocsDot').classList.toggle('is-warning', !sys.docs.isOnline);
      }
      if ($('adminSheetsStatus')) $('adminSheetsStatus').textContent = sys.sheets.label;
      if ($('adminSheetsDot')) {
        $('adminSheetsDot').classList.toggle('is-online', sys.sheets.isOnline);
        $('adminSheetsDot').classList.toggle('is-warning', !sys.sheets.isOnline);
      }
    }

    // â”€â”€ Render Recent Credentials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function renderRecentCredentials() {
      const section = $('adminRecentCredsSection');
      const listEl = $('adminRecentCredsList');
      if (!section || !listEl) return;
      const list = svc.getRecentCredentials();
      if (!list.length) { section.hidden = true; listEl.innerHTML = ''; return; }
      section.hidden = false;
      listEl.innerHTML = list.map(item => `
        <div class="recent-cred-card" data-cred-id="${esc(item.id)}">
          <div class="recent-cred-top">
            <div class="recent-cred-identity">
              <span class="admin-badge badge-${esc(String(item.role||'user').toLowerCase())}">${esc(item.role||'User')}</span>
              <span class="recent-cred-name" title="${esc(item.name)}">${esc(item.name)}</span>
            </div>
            <button type="button" class="recent-cred-btn cred-remove-btn" data-id="${esc(item.id)}" title="Remove" aria-label="Remove">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="recent-cred-body">
            <div class="recent-cred-row">
              <span class="recent-cred-label">Username</span>
              <div class="recent-cred-val-wrap">
                <span class="recent-cred-val">${esc(cleanUsername(item.username))}</span>
                <button type="button" class="recent-cred-btn cred-copy-user-btn" data-username="${esc(cleanUsername(item.username))}" title="Copy Username">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>
            <div class="recent-cred-row">
              <span class="recent-cred-label">Temp Password</span>
              <div class="recent-cred-val-wrap">
                <span class="recent-cred-val recent-cred-pw-val is-masked" data-pw="${esc(item.password)}">â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢</span>
                <button type="button" class="recent-cred-btn cred-toggle-pw-btn" aria-label="Show password" title="Show password">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>Show</span>
                </button>
                <button type="button" class="recent-cred-btn cred-copy-pw-btn" data-password="${esc(item.password)}" title="Copy Password">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>
          <div class="recent-cred-footer">
            <button type="button" class="recent-cred-copy-all-btn cred-copy-all-btn" data-id="${esc(item.id)}" title="Copy all credentials">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy All Credentials</span>
            </button>
            <button type="button" class="recent-cred-btn-danger cred-remove-btn" data-id="${esc(item.id)}">Remove</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.cred-remove-btn').forEach(btn =>
        btn.addEventListener('click', () => { svc.removeRecentCredential(btn.dataset.id); renderRecentCredentials(); showToast('Credential removed.'); })
      );
      listEl.querySelectorAll('.cred-copy-user-btn').forEach(btn =>
        btn.addEventListener('click', () => copyText(btn.dataset.username || '', btn, 'Copied!'))
      );
      listEl.querySelectorAll('.cred-copy-pw-btn').forEach(btn =>
        btn.addEventListener('click', () => copyText(btn.dataset.password || '', btn, 'Copied!'))
      );
      listEl.querySelectorAll('.cred-toggle-pw-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const card = btn.closest('.recent-cred-card');
          const pw = card?.querySelector('.recent-cred-pw-val');
          if (!pw) return;
          const masked = pw.classList.contains('is-masked');
          if (masked) { pw.classList.remove('is-masked'); pw.textContent = pw.dataset.pw || ''; btn.querySelector('span').textContent = 'Hide'; }
          else { pw.classList.add('is-masked'); pw.textContent = 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'; btn.querySelector('span').textContent = 'Show'; }
        });
      });
      listEl.querySelectorAll('.cred-copy-all-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = list.find(x => x.id === btn.dataset.id);
          if (!item) return;
          copyText(svc.formatAllCredentialsText(item), btn, 'Copied All!');
        });
      });
    }

    // â”€â”€ Render User Accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function renderUsers(rows) {
      const body = $('adminUsersBody');
      if (!body) return;
      if (!rows || !rows.length) {
        body.innerHTML = '<div class="auth-admin-empty" style="grid-column:1/-1;">No accounts found.</div>';
        return;
      }
      const recentCreds = svc.getRecentCredentials();
      const activeUser = window.CCTV_AUTH?.getUser?.();
      const isCallerSuper = !!(window.CCTV_AUTH && typeof window.CCTV_AUTH.isSuperAdmin === "function" && window.CCTV_AUTH.isSuperAdmin());
      const approvedSuperCount = rows.filter(x => x.role === 'super_admin' && (x.status === 'approved' || !x.status)).length;

      body.innerHTML = rows.map(item => {
        const self = item.id === activeUser?.id;
        const search = ((item.display_name||'') + ' ' + (item.username||'') + ' ' + (item.email||'')).toLowerCase();
        const isSuperTarget = item.role === 'super_admin';
        const roleLabel = isSuperTarget ? 'Super Admin' : (item.role === 'admin' ? 'Admin' : 'User');
        const isApproved = item.status === 'approved';
        const isDisabled = item.status === 'disabled' || item.status === 'suspended';
        const isPending = item.status === 'pending';
        const permsText = isSuperTarget ? 'âš¡ Unrestricted Full Access' : permSummary(item);
        const uKey = cleanUsername(item.username).toLowerCase();
        const cred = recentCreds.find(c => cleanUsername(c.username).toLowerCase() === uKey);

        const isLastSuper = isSuperTarget && approvedSuperCount <= 1;
        const isAdminTarget = item.role === 'admin';
        const isPrivilegedTarget = isSuperTarget || isAdminTarget;
        const canManageTarget = isCallerSuper || (!isPrivilegedTarget && (window.CCTV_AUTH?.hasPermission?.('manage_users') || window.CCTV_AUTH?.hasPermission?.('manage_permissions')));

        const pwRowHtml = cred?.password ? `
          <div class="admin-user-card-pw-row">
            <span class="admin-user-meta-label">Temp Password</span>
            <div class="recent-cred-val-wrap">
              <span class="recent-cred-val recent-cred-pw-val is-masked" data-pw="${esc(cred.password)}">â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢</span>
              <button type="button" class="recent-cred-btn user-card-toggle-pw-btn" aria-label="Show password" title="Show password">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>Show</span>
              </button>
              <button type="button" class="recent-cred-btn user-card-copy-pw-btn" data-password="${esc(cred.password)}" title="Copy">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
          </div>` : `
          <div class="admin-user-card-pw-row">
            <span class="admin-user-meta-label">Password</span>
            <span style="font-size:11px; color:var(--text-dim);">Not available</span>
          </div>`;

        return `
        <div class="admin-user-card" data-id="${esc(item.id)}" data-search="${esc(search)}">
          <div class="admin-user-card-top">
            <div class="admin-user-card-identity">
              <div class="admin-user-avatar">${esc(svc.getInitials(item.display_name || item.username))}</div>
              <div class="admin-user-info">
                <strong class="admin-user-name" title="${esc(item.display_name||item.username||'User')}">${esc(item.display_name||item.username||'User')}</strong>
                <span class="admin-user-username">${esc(usernameLabel(item.username))}</span>
              </div>
            </div>
            <div class="admin-user-card-badges">
              ${statusPill(item.status)}
              <span class="admin-badge badge-${esc(String(item.role||'user').toLowerCase())}">${roleLabel}</span>
            </div>
          </div>
          <div class="admin-user-card-body">
            ${pwRowHtml}
            <div class="admin-user-meta-row">
              <span class="admin-user-meta-label">Permissions</span>
              <span class="admin-user-meta-val">${esc(permsText)}</span>
            </div>
            <div class="admin-user-card-dates">
              <div><span class="admin-user-meta-label">Created</span> <span>${esc(dt(item.created_at))}</span></div>
              <div><span class="admin-user-meta-label">Last Active</span> <span>${esc(dt(item.last_seen_at))}</span></div>
            </div>
          </div>
          <div class="admin-user-card-footer">
            <div class="admin-user-card-actions">
              ${isPending && canManageTarget ? `<button type="button" class="admin-action-btn auth-approve-btn" data-id="${esc(item.id)}">Approve</button>` : ''}
              ${isPending && canManageTarget ? `<button type="button" class="admin-action-btn auth-reject-btn" data-id="${esc(item.id)}">Reject</button>` : ''}
              ${canManageTarget ? `<button type="button" class="admin-action-btn auth-access-btn" data-id="${esc(item.id)}">Access</button>` : ''}
              ${!self && isApproved && canManageTarget && !isLastSuper ? `<button type="button" class="admin-action-btn auth-disable-btn" data-id="${esc(item.id)}">Disable</button>` : ''}
              ${!self && isDisabled && canManageTarget ? `<button type="button" class="admin-action-btn auth-reactivate-btn" data-id="${esc(item.id)}">Reactivate</button>` : ''}
              ${!self && canManageTarget && !isLastSuper ? `<button type="button" class="admin-action-btn auth-delete-danger auth-remove-user-btn" data-id="${esc(item.id)}">Delete</button>` : ''}
              ${self ? '<span class="auth-self-label">You</span>' : (!canManageTarget ? '<span class="auth-self-label" style="opacity:0.75;">Protected</span>' : (isLastSuper ? '<span class="auth-self-label" title="Final Super Admin cannot be removed">Protected</span>' : ''))}
            </div>
          </div>
        </div>`;
      }).join('');

      body.querySelectorAll('.auth-approve-btn').forEach(btn =>
        btn.addEventListener('click', () => doSetStatus(btn.dataset.id, 'approved'))
      );
      body.querySelectorAll('.auth-reject-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const item = svc.getCachedUsers().find(x => x.id === btn.dataset.id);
          const ok = await (window.appConfirm ? window.appConfirm({ title:'Reject signup?', message:`Reject request for ${item?.display_name || item?.username || 'this user'}?`, confirmText:'Reject', tone:'danger' }) : window.confirm('Reject this signup request?'));
          if (ok) doSetStatus(btn.dataset.id, 'rejected');
        })
      );
      body.querySelectorAll('.auth-access-btn').forEach(btn =>
        btn.addEventListener('click', () => openAccessEditor(btn.dataset.id))
      );
      body.querySelectorAll('.auth-disable-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const item = svc.getCachedUsers().find(x => x.id === btn.dataset.id);
          const ok = await (window.appConfirm ? window.appConfirm({ title:'Disable account?', message:`${item?.display_name || item?.username || 'This account'} will be locked out immediately.`, confirmText:'Disable Account', tone:'danger' }) : window.confirm('Disable this account?'));
          if (ok) doSetStatus(btn.dataset.id, 'disabled');
        })
      );
      body.querySelectorAll('.auth-reactivate-btn').forEach(btn =>
        btn.addEventListener('click', () => doSetStatus(btn.dataset.id, 'approved'))
      );
      body.querySelectorAll('.auth-remove-user-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const item = svc.getCachedUsers().find(x => x.id === btn.dataset.id);
          const ok = await (window.appConfirm ? window.appConfirm({ title:'Delete Account Permanently', message:`Permanently delete ${item?.display_name || item?.username || 'this user'}? This cannot be undone.`, confirmText:'Delete', tone:'danger' }) : window.confirm('Permanently delete this account?'));
          if (!ok) return;
          try { await svc.deleteAccount(btn.dataset.id); showToast('Account deleted.'); await loadAdmin(); } catch(e) { showToast(e.message || 'Could not delete.'); }
        })
      );
      body.querySelectorAll('.user-card-toggle-pw-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.admin-user-card-pw-row');
          const pw = row?.querySelector('.recent-cred-pw-val');
          if (!pw) return;
          const masked = pw.classList.contains('is-masked');
          if (masked) { pw.classList.remove('is-masked'); pw.textContent = pw.dataset.pw||''; btn.querySelector('span').textContent = 'Hide'; }
          else { pw.classList.add('is-masked'); pw.textContent = 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'; btn.querySelector('span').textContent = 'Show'; }
        });
      });
      body.querySelectorAll('.user-card-copy-pw-btn').forEach(btn =>
        btn.addEventListener('click', () => copyText(btn.dataset.password||'', btn, 'Copied!'))
      );

      filterUsers();
    }

    function filterUsers() {
      const q = String($('adminUserSearch')?.value||'').trim().toLowerCase();
      $('adminUsersBody')?.querySelectorAll('.admin-user-card[data-search]').forEach(card => {
        card.hidden = !!(q && !card.dataset.search.includes(q));
      });
    }

    async function doSetStatus(id, status) {
      try {
        await svc.setStatus(id, status);
        showToast(status === 'approved' ? 'Account active.' : (status === 'disabled' ? 'Account disabled.' : 'Status updated.'));
        await loadAdmin();
      } catch(e) { showToast(e.message||'Could not update status.'); }
    }

    async function loadAdmin() {
      const refreshBtn = $('adminRefreshBtn');
      if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = 'Refreshing...'; }
      try {
        await svc.fetchUsers(true);
        renderUsers(svc.getCachedUsers());
        renderRecentCredentials();
        await updateKpiDisplay();
        await loadAuditLogs();
      } catch(e) { showToast(e.message||'Could not load accounts.'); }
      finally { if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = 'Refresh'; } }
    }

    async function loadAuditLogs(forceRemote = false) {
      const body = $('adminSecurityAuditBody');
      if (!body) return;
      const logs = await svc.fetchAuditLogs(forceRemote);
      renderAuditLogs(logs);
    }

    function renderAuditLogs(logs) {
      const body = $('adminSecurityAuditBody');
      if (!body) return;
      if (!logs || !logs.length) {
        body.innerHTML = '<tr><td colspan="6" class="auth-admin-empty">No security audit events recorded yet.</td></tr>';
        return;
      }
      body.innerHTML = logs.map(item => {
        const search = ((item.actor_username||'') + ' ' + (item.action||'') + ' ' + (item.target_item||'')).toLowerCase();
        const detailsStr = typeof item.details === 'object' ? JSON.stringify(item.details) : String(item.details||'');
        return `<tr data-search="${esc(search)}">
          <td>${esc(dt(item.created_at))}</td>
          <td><strong>${esc(item.actor_username||'admin')}</strong></td>
          <td><span class="admin-badge badge-${esc(String(item.actor_role||'user').toLowerCase())}">${esc(item.actor_role||'admin')}</span></td>
          <td><strong>${esc(item.action||'event')}</strong></td>
          <td>${esc(item.target_item||'â€”')}</td>
          <td><code>${esc(detailsStr||'â€”')}</code></td>
        </tr>`;
      }).join('');
    }

    function filterAuditLogs() {
      const q = String($('adminAuditSearch')?.value||'').trim().toLowerCase();
      $('adminSecurityAuditBody')?.querySelectorAll('tr[data-search]').forEach(row => {
        row.hidden = !!(q && !row.dataset.search.includes(q));
      });
    }

    // â”€â”€ Account Creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async function createStaffAccount() {
      const name = String($('adminCreateName')?.value||'').trim();
      const username = String($('adminCreateUsername')?.value||'').trim().replace(/^@+/,'');
      const password = $('adminCreatePassword')?.value || '';
      const role = $('adminCreateRole')?.value || 'user';
      const btn = $('adminCreateAccountBtn');

      if (!name) { setStatus('Enter the staff member\'s name.', 'error'); $('adminCreateName')?.focus(); return; }
      if (!username || username.length < 2) { setStatus('Enter a valid username.', 'error'); $('adminCreateUsername')?.focus(); return; }
      if (password.length < 6) { setStatus('Temporary password must contain at least 6 characters.', 'error'); $('adminCreatePassword')?.focus(); return; }

      if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
      setStatus('Creating account...', 'info');

      try {
        const newAcc = await svc.createAccount({ name, username, password, role });
        const roleLabel = role === 'super_admin' ? 'Super Admin' : (role === 'admin' ? 'Admin' : 'User');
        setStatus(`${newAcc.display_name} created and approved Â· @${newAcc.username} Â· Role: ${roleLabel}`, 'success');
        showToast(`${newAcc.display_name} account created.`);
        if ($('adminCreateName')) $('adminCreateName').value = '';
        if ($('adminCreateUsername')) $('adminCreateUsername').value = '';
        if ($('adminCreatePassword')) { $('adminCreatePassword').value = ''; $('adminCreatePassword').type = 'password'; }
        if ($('adminCreateRole')) $('adminCreateRole').value = 'user';
        renderRecentCredentials();
        await loadAdmin();
      } catch(e) {
        setStatus(e.message || 'Could not create account.', 'error');
        showToast(e.message || 'Could not create account.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
      }
    }

    // â”€â”€ Access Editor Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function openAccessEditor(id) {
      const item = svc.getCachedUsers().find(x => x.id === id);
      if (!item) return;

      const isCallerSuper = !!(window.CCTV_AUTH && typeof window.CCTV_AUTH.isSuperAdmin === "function" && window.CCTV_AUTH.isSuperAdmin());
      const isSuper = item.role === 'super_admin';
      const isAdmin = item.role === 'admin';

      // Non-Super Admins cannot edit Super Admin or Admin accounts
      if ((isSuper || isAdmin) && !isCallerSuper) {
        showToast("Access Denied: Only a Super Administrator can modify an Administrator account.", "warning");
        return;
      }

      accessEditingUser = item;
      if ($('adminAccessTargetId')) $('adminAccessTargetId').value = item.id;
      if ($('adminAccessDisplayName')) $('adminAccessDisplayName').value = item.display_name || '';
      if ($('adminAccessUserLabel')) $('adminAccessUserLabel').textContent = `${item.display_name||item.username||'User'} Â· ${usernameLabel(item.username)}`;

      const roleSelect = $('adminAccessRole');
      const superBadge = $('superAdminActiveBadge');
      const promoBox = $('superAdminPromotionBox');
      const demoteBox = $('superAdminDemoteBox');
      const optAdmin = $('optAccessAdmin');

      const approvedSuperCount = svc.getCachedUsers().filter(x => x.role === 'super_admin' && (x.status === 'approved' || !x.status)).length;

      if (isSuper) {
        if (superBadge) superBadge.style.display = 'block';
        if (roleSelect) roleSelect.style.display = 'none';
        if (promoBox) promoBox.style.display = 'none';
        if (demoteBox) demoteBox.style.display = (isCallerSuper && approvedSuperCount > 1) ? 'block' : 'none';
      } else {
        if (superBadge) superBadge.style.display = 'none';
        if (roleSelect) {
          roleSelect.style.display = 'block';
          roleSelect.value = item.role || 'user';
        }
        if (demoteBox) demoteBox.style.display = 'none';
        if (optAdmin) {
          optAdmin.hidden = !isCallerSuper;
          optAdmin.disabled = !isCallerSuper;
        }
        if (promoBox) promoBox.style.display = isCallerSuper ? 'block' : 'none';
      }

      if ($('adminAccessStatus')) $('adminAccessStatus').value = (item.status === 'disabled'||item.status === 'suspended') ? 'disabled' : 'active';

      const perms = item.permissions || {};

      $('adminAccessGrid')?.querySelectorAll('[data-permission]').forEach(input => {
        const k = input.dataset.permission;
        if (isSuper) {
          input.checked = true;
        } else if (item.role === 'admin') {
          input.checked = perms[k] === true || (perms[k] !== false && (k === 'edr' || k === 'report' || k === 'cctv' || k === 'audit' || k === 'sorter' || k === 'maintenance' || k === 'followup' || k === 'pending' || k === 'masterlist' || k === 'history'));
        } else {
          input.checked = perms[k] !== false && k !== 'accounts' && k !== 'hris';
        }
      });

      $('adminPrivilegesGrid')?.querySelectorAll('[data-permission]').forEach(input => {
        const k = input.dataset.permission;
        input.checked = isSuper ? true : !!perms[k];
      });

      refreshAccessRoleUi();
      const modal = $('adminAccessModal');
      if (modal) { modal.hidden = false; document.body.classList.add('modal-open'); }
    }

    function closeAccessEditor() {
      const modal = $('adminAccessModal');
      if (modal) { modal.hidden = true; document.body.classList.remove('modal-open'); }
      accessEditingUser = null;
    }

    function refreshAccessRoleUi() {
      const authApi = window.CCTV_AUTH;

      const isCallerSuper = !!(
        authApi &&
        typeof authApi.isSuperAdmin === "function" &&
        authApi.isSuperAdmin()
      );

      const canManagePermissions = isCallerSuper || !!(
        authApi &&
        typeof authApi.hasPermission === "function" &&
        authApi.hasPermission("manage_permissions")
      );

      const isSuper = accessEditingUser?.role === 'super_admin';
      const role = isSuper ? 'super_admin' : ($('adminAccessRole')?.value || 'user');
      const isAdmin = role === 'admin';
      const isUser = role === 'user';

      const notice = $('superAdminUnrestrictedNotice');
      if (notice) notice.style.display = isSuper ? 'inline-block' : 'none';

      // Only Super Admin may change account roles.
      const roleSelect = $('adminAccessRole');
      if (roleSelect) {
        roleSelect.disabled = !isCallerSuper;
      }

      // Access-editor fields are read-only without manage_permissions.
      const displayNameInput = $('adminAccessDisplayName');
      if (displayNameInput) {
        displayNameInput.disabled = !canManagePermissions;
      }

      const statusSelect = $('adminAccessStatus');
      if (statusSelect) {
        statusSelect.disabled = !canManagePermissions;
      }

      // Workspace permissions
      $('adminAccessGrid')?.querySelectorAll('[data-permission]').forEach(input => {
        if (isSuper) {
          input.checked = true;
          input.disabled = true;
          return;
        }

        // Normal users can never receive the Accounts workspace.
        if (isUser && input.dataset.permission === 'accounts') {
          input.checked = false;
          input.disabled = true;
          return;
        }

        input.disabled = !canManagePermissions;
      });

      // Administrative capabilities
      $('adminPrivilegesGrid')?.querySelectorAll('[data-permission]').forEach(input => {
        if (isSuper) {
          input.checked = true;
          input.disabled = true;
        } else if (isAdmin) {
          input.disabled = !canManagePermissions;
        } else {
          input.checked = false;
          input.disabled = true;
        }

        input.closest('label')?.toggleAttribute('hidden', isUser);
      });

      // Prevent misleading Save attempts when the caller only has manage_users.
      const saveBtn = $('adminAccessSave');
      if (saveBtn) {
        saveBtn.disabled = !canManagePermissions;
        saveBtn.textContent = canManagePermissions ? 'Save Access' : 'Read Only';
        saveBtn.title = canManagePermissions
          ? ''
          : 'Modify Permissions permission is required to edit account access.';
      }
    }
    async function saveAccessEditor() {
      const id = $('adminAccessTargetId')?.value;
      if (!id) return;
      const isTargetSuper = accessEditingUser?.role === 'super_admin';
      const isCallerSuper = !!(window.CCTV_AUTH && typeof window.CCTV_AUTH.isSuperAdmin === "function" && window.CCTV_AUTH.isSuperAdmin());

      let role = isTargetSuper ? 'super_admin' : ($('adminAccessRole')?.value || 'user');
      if (role === 'admin' && !isCallerSuper) role = 'user';

      const status = $('adminAccessStatus')?.value === 'disabled' ? 'disabled' : 'approved';
      const displayName = String($('adminAccessDisplayName')?.value||'').trim();

      const permissions = {};
      if (role === 'super_admin') {
        permissions.all = true;
        permissions.super_admin = true;
      } else {
        $('adminAccessGrid')?.querySelectorAll('[data-permission]').forEach(input => {
          permissions[input.dataset.permission] = !!input.checked;
        });
        $('adminPrivilegesGrid')?.querySelectorAll('[data-permission]').forEach(input => {
          permissions[input.dataset.permission] = role === 'admin' ? !!input.checked : false;
        });
        if (role === 'user') {
          permissions.accounts = false;
          permissions.manage_users = false;
          permissions.manage_roles = false;
          permissions.manage_permissions = false;
          permissions.view_security_logs = false;
        }
      }

      const saveBtn = $('adminAccessSave');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
      try {
        await svc.saveUserAccess(id, { role, status, displayName, permissions });
        showToast(role === 'super_admin' ? 'Super Admin access saved.' : (role === 'admin' ? 'Admin access saved.' : 'User access updated.'));
        closeAccessEditor();
        await loadAdmin();
      } catch(e) { showToast(e.message||'Could not update access.'); }
      finally { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Access'; } }
    }

    // â”€â”€ Operational Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function loadOperationalSettings() {
      const s = svc.getOperationalSettings();
      if ($('adminSettingTheme')) $('adminSettingTheme').value = s.theme;
      if ($('adminSettingLanding')) $('adminSettingLanding').value = s.landing;
      if ($('adminSettingSubtitle')) $('adminSettingSubtitle').value = s.subtitle;
      if ($('adminSettingAutoTrim')) $('adminSettingAutoTrim').checked = s.autoTrim;
    }

    async function saveOperationalSettings() {
      const settings = {
        theme: $('adminSettingTheme')?.value || 'dark',
        landing: $('adminSettingLanding')?.value || 'cctv',
        subtitle: String($('adminSettingSubtitle')?.value||'').trim() || 'Secure operations workspace',
        autoTrim: !!$('adminSettingAutoTrim')?.checked
      };
      await svc.saveOperationalSettings(settings);
      const notice = $('adminSaveSettingsNotice');
      if (notice) { notice.textContent = 'âœ“ Settings saved successfully.'; setTimeout(() => { notice.textContent = ''; }, 3500); }
      showToast('Operational settings saved.');
    }

    // â”€â”€ Subnav Tab Switching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function initAdminSubnav() {
      document.querySelectorAll('.admin-subnav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.adminTab;
          document.querySelectorAll('.admin-subnav-btn').forEach(b => {
            b.classList.toggle('active', b === btn);
            b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
          });
          const tabUsers = $('adminTabUsers');
          const tabAudit = $('adminTabAudit');
          const tabSettings = $('adminTabSettings');
          if (tabUsers) tabUsers.hidden = target !== 'users';
          if (tabAudit) tabAudit.hidden = target !== 'audit';
          if (tabSettings) tabSettings.hidden = target !== 'settings';
          if (target === 'audit') loadAuditLogs(true);
          if (target === 'settings') loadOperationalSettings();
        });
      });
    }

    // â”€â”€ Password toggle for create form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function initPasswordToggles() {
      document.querySelectorAll('.auth-password-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          const input = document.getElementById(btn.dataset.target||'');
          if (!input) return;
          const showing = input.type === 'text';
          input.type = showing ? 'password' : 'text';
          btn.classList.toggle('is-visible', !showing);
          const label = showing ? 'Show password' : 'Hide password';
          btn.setAttribute('aria-label', label); btn.setAttribute('title', label);
        });
      });
    }

    // â”€â”€ Wire Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    $('adminCreateAccountBtn')?.addEventListener('click', createStaffAccount);
    $('adminCreateAccountForm')?.addEventListener('submit', e => { e.preventDefault(); createStaffAccount(); });
    $('adminRefreshBtn')?.addEventListener('click', () => loadAdmin());
    $('adminUserSearch')?.addEventListener('input', filterUsers);

    $('adminClearAllCredsBtn')?.addEventListener('click', () => {
      svc.clearRecentCredentials();
      renderRecentCredentials();
      showToast('Session credentials cleared.');
    });

    $('adminRefreshAuditBtn')?.addEventListener('click', () => loadAuditLogs(true));
    $('adminExportAuditBtn')?.addEventListener('click', () => { svc.exportAuditLogs(); showToast('Audit log exported.'); });
    $('adminAuditSearch')?.addEventListener('input', filterAuditLogs);

    $('adminSaveSettingsBtn')?.addEventListener('click', saveOperationalSettings);

    $('adminAccessRole')?.addEventListener('change', refreshAccessRoleUi);
    $('adminAccessSave')?.addEventListener('click', saveAccessEditor);
    $('adminAccessCancel')?.addEventListener('click', closeAccessEditor);
    $('adminAccessClose')?.addEventListener('click', closeAccessEditor);
    $('adminAccessModal')?.addEventListener('click', e => { if (e.target === $('adminAccessModal')) closeAccessEditor(); });

    $('btnPromoteSuperAdmin')?.addEventListener('click', async () => {
      if (!accessEditingUser) return;
      const name = accessEditingUser.display_name || accessEditingUser.username || 'this user';
      const ok = await (window.appConfirm ? window.appConfirm({
        title: 'Promote to Super Administrator?',
        message: `Are you sure you want to promote ${name} to Super Administrator?\n\nThis grants universal unrestricted access to all CCTV OPS workspaces and privileged administrative capabilities.`,
        confirmText: 'Promote to Super Admin',
        tone: 'danger'
      }) : window.confirm(`Promote ${name} to Super Administrator?\n\nThis grants universal unrestricted access.`));

      if (!ok) return;
      const btn = $('btnPromoteSuperAdmin');
      if (btn) { btn.disabled = true; btn.textContent = 'Promoting...'; }
      try {
        await svc.promoteToSuperAdmin(accessEditingUser.id);
        showToast(`${name} promoted to Super Administrator.`);
        closeAccessEditor();
        await loadAdmin();
      } catch (err) {
        showToast(err.message || 'Could not promote to Super Admin.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'âš¡ Promote to Super Admin'; }
      }
    });

    $('btnDemoteSuperAdmin')?.addEventListener('click', async () => {
      if (!accessEditingUser) return;
      const name = accessEditingUser.display_name || accessEditingUser.username || 'this user';
      const ok = await (window.appConfirm ? window.appConfirm({
        title: 'Demote Super Administrator?',
        message: `Are you sure you want to revoke Super Administrator status for ${name} and reassign them as Administrator?`,
        confirmText: 'Demote to Admin',
        tone: 'danger'
      }) : window.confirm(`Demote ${name} from Super Administrator to Admin?`));

      if (!ok) return;
      const btn = $('btnDemoteSuperAdmin');
      if (btn) { btn.disabled = true; btn.textContent = 'Demoting...'; }
      try {
        await svc.demoteSuperAdmin(accessEditingUser.id);
        showToast(`${name} demoted to Administrator.`);
        closeAccessEditor();
        await loadAdmin();
      } catch (err) {
        showToast(err.message || 'Could not demote Super Admin.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Demote to Admin'; }
      }
    });

    initAdminSubnav();
    initPasswordToggles();
    loadOperationalSettings();

    window._renderAccountsWorkspaceFn = async function() {
      const isCallerSuper = !!(window.CCTV_AUTH && typeof window.CCTV_AUTH.isSuperAdmin === "function" && window.CCTV_AUTH.isSuperAdmin());
      const optCreateAdmin = $('optCreateAdmin');
      if (optCreateAdmin) {
        optCreateAdmin.hidden = !isCallerSuper;
        optCreateAdmin.disabled = !isCallerSuper;
        if (!isCallerSuper && $('adminCreateRole')) $('adminCreateRole').value = 'user';
      }
      renderUsers(svc.getCachedUsers());
      renderRecentCredentials();
      await updateKpiDisplay();
      // Show Users tab by default
      const tabUsers = $('adminTabUsers');
      const tabAudit = $('adminTabAudit');
      const tabSettings = $('adminTabSettings');
      if (tabUsers) tabUsers.hidden = false;
      if (tabAudit) tabAudit.hidden = true;
      if (tabSettings) tabSettings.hidden = true;
      document.querySelectorAll('.admin-subnav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.adminTab === 'users');
      });
      // Lazy-load users if cache empty
      if (!svc.getCachedUsers().length) await loadAdmin();
    };

    // Initial load from local cache
    renderUsers(svc.getCachedUsers());
    renderRecentCredentials();
    updateKpiDisplay();
  }

  // App Initialization
  window.addEventListener("DOMContentLoaded", async () => {
    initWorkspaceNavigation();

    // Check initial workspace from URL param or hash
    const params = new URLSearchParams(window.location.search);
    const initialWorkspace = params.get("workspace") || (window.location.hash ? window.location.hash.slice(1).toLowerCase() : null);
    if (initialWorkspace && WORKSPACES[initialWorkspace]) {
      switchWorkspace(initialWorkspace);
    }

    initFormDropdowns();
    initChoiceButtons();
    initScreenshotDropzone();
    initEvents();

    if (params.get("edr") === "expanded" && typeof window.setDispatchExpanded === "function") {
      window.setDispatchExpanded(true);
    }

    // CCTV Audit & Smart Audit Guard Initialization
    initAuditEvents();
    initSmartAuditGuard();
    initLiveTrackerController();
    if (params.get("find") && liveTrackerGrid) {
      setTimeout(() => {
        liveTrackerGrid.openFind(params.get("find"));
      }, 300);
    }

    // AI Sorter Initialization
    initSorterController();

    // Maintenance Report Initialization
    initMaintenanceController();

    // Pending Reports Initialization
    initPendingController();

    // Follow Up Reports Initialization
    initFollowupController();

    // CCTV Report Workspace Initialization
    initCctvReportController();

    // Code of Conduct Reference Initialization
    initCodeOfConductController();

    // Trackers Workspace Initialization
    initTrackersController();

    // HRIS Workspace Initialization
    initHrisController();

    // Masterlist Workspace Initialization
    initMasterlistController();

    // Activity History Initialization
    initHistoryController();

    // Accounts / Admin Console Initialization
    initAccountsController();

    // Manila clock ticker
    updateManilaClock();
    setInterval(updateManilaClock, 1000);

    // Watch EDR updates
    edr.onChange(reports => {
      renderEdrList(reports);
    });

    // Watch Audit updates
    audit.onChange(() => {
      renderAuditTable();
    });

    // Watch Guard updates
    audit.onGuardChange(() => {
      renderGuardStatus();
    });

    // Initial load of existing EDR records from IndexedDB
    await edr.init();

    // Initial load of existing Audit entries & Guard snapshot
    await audit.init();
    await audit.initGuard();
    renderAuditTable();
    renderGuardStatus();

    // Optional demo seed for testing / visual verification if requested
    if (params.has("demo") && !audit.getEntries().length) {
      audit.addEntry({
        rawDate: "2026-09-10",
        site: "Mabini Site A - 1st Floor",
        tlName: "Abegail Llena",
        agentName: "Juan Dela Cruz",
        omName: "Abby",
        account: "Shopee - CB-SCS",
        cleanAccount: "Shopee - CB-SCS",
        reasonCode: "SLEEPING",
        noc: "YES",
        remarks: "CCTV observed sleeping at workstation. Supervisor coached on shift."
      });
      audit.addEntry({
        rawDate: "2026-09-10",
        site: "Mabini Site B - 2nd Floor",
        tlName: "Christian Arcilla",
        agentName: "Maria Santos",
        omName: "Renato",
        account: "AFP",
        cleanAccount: "AFP",
        reasonCode: "USING SMARTPHONE",
        noc: "Pending",
        remarks: "Device noted in production bay; pending verification with TL."
      });
      audit.addEntry({
        rawDate: "2026-09-09",
        site: "Ecoland Site",
        tlName: "Dante Tahuran",
        agentName: "Pedro Penduko",
        omName: "Crystal",
        account: "TEMU - 1404",
        cleanAccount: "TEMU - 1404",
        reasonCode: "BROWSING",
        noc: "YES",
        remarks: "Non-work streaming detected during call wrap-up.",
        sourceEdrId: "edr-demo-404"
      });
    }

    if (params.has("demo") && !edr.getReports().length) {
      const samplePng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVHhe7c4BDQAACAMw9E/tUwwmFvw+yZptWc3MzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMxfmA0G6kFf2u/6fAAAAABJRU5ErkJggg==";
      await edr.saveReport({
        date: "2026-09-10",
        site: "Mabini Site A - 1st Floor",
        account: "AFP",
        timeObserved: "14:30",
        supervisorRole: "Team Leader",
        supervisorName: "Sarah Connor",
        subjectType: "Agent/s",
        subjectName: "John Matrix",
        incident: "CCTV observed sleeping at workstation during production shift",
        action: "Verbal warning issued; documented incident in portal",
        clipLink: "http://122.54.123.45:8080/clip1",
        screenshotData: samplePng,
        selected: true,
        done: false
      });
      await edr.saveReport({
        date: "2026-09-10",
        site: "Shaw Site B - 2nd Floor",
        account: "Healthcare",
        timeObserved: "16:15",
        supervisorRole: "OM",
        supervisorName: "Dutch Schaefer",
        subjectType: "Agent/s",
        subjectName: "Kyle Reese",
        incident: "Unauthorized mobile device usage in secured production area",
        action: "Device surrendered to security desk; supervisor notified",
        clipLink: "",
        screenshotData: "",
        selected: false,
        done: false
      });
    }

    if (params.has("demo") && !followupReportsList.length) {
      const samplePng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVHhe7c4BDQAACAMw9E/tUwwmFvw+yZptWc3MzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMxfmA0G6kFf2u/6fAAAAABJRU5ErkJggg==";
      const demoFollowups = [
        followup.createReport({
          date: "2026-09-10",
          om: "CCTV OM MIRAH",
          label: "TL Sarah Connor (Shopee)",
          cctvLink: "https://teams.microsoft.com/l/message/19%3Ashopee%40thread.v2/0",
          status: "Waiting for TL",
          remarks: "Observed sleeping at workstation. Awaiting supervisor coaching form.",
          screenshotData: samplePng
        }),
        followup.createReport({
          date: "2026-09-10",
          om: "CCTV OM RENATO",
          label: "TL Christian Arcilla (AFP)",
          cctvLink: "https://teams.microsoft.com/l/message/19%3Aafp%40thread.v2/1",
          status: "TL Disputed",
          remarks: "TL claims device was 2FA token. Escalated for CCTV footage verification.",
          screenshotData: samplePng
        }),
        followup.createReport({
          date: "2026-09-09",
          om: "CCTV OM CRYSTAL",
          label: "TL Dante Tahuran (TEMU)",
          cctvLink: "https://teams.microsoft.com/l/message/19%3Atemu%40thread.v2/2",
          status: "Resolved",
          remarks: "Coaching session completed and notice of coaching signed.",
          screenshotData: samplePng
        })
      ];
      followupReportsList = demoFollowups;
      await followup.saveReports(demoFollowups);
      renderFollowupList();
    }

    // Restore draft form and Facebook text if present
    restoreDraftForm();
    const savedFb = edr.getFacebookText();
    if (savedFb && el("edrFacebookText")) {
      el("edrFacebookText").value = savedFb;
      updateLivePreview();
    }

    // Google Docs initial connection check
    const currentDocsUrl = edr.getDocsUrl();
    if (el("edrDocsStatusText")) {
      el("edrDocsStatusText").textContent = edr.isValidDocsUrl(currentDocsUrl) ? "Docs Connected" : "Local Storage";
    }

    // Live Integration Status Controller
    function updateIntegrationStatusPills() {
      // 1. Supabase Auth
      const pillAuth = el("pillSupabaseAuth");
      if (pillAuth) {
        const user = window.CCTV_AUTH?.getUser?.() || null;
        const isAuth = !!user;
        const val = el("valSupabaseAuth");
        if (isAuth) {
          pillAuth.className = "integration-pill is-connected";
          if (val) val.textContent = "Connected";
          pillAuth.title = `Supabase Auth: Connected (${user.email || user.id || "Active session"})`;
        } else {
          pillAuth.className = "integration-pill is-disconnected";
          if (val) val.textContent = "Disconnected";
          pillAuth.title = "Supabase Auth: Disconnected (Sign in to establish active session)";
        }
      }

      // 2. Google Docs EDR
      const pillDocs = el("pillGoogleDocs");
      if (pillDocs) {
        const docsUrl = edr?.getDocsUrl?.() || "";
        const isDocsConfigured = !!(edr?.isValidDocsUrl && edr.isValidDocsUrl(docsUrl));
        const val = el("valGoogleDocs");
        if (isDocsConfigured) {
          pillDocs.className = "integration-pill is-connected";
          if (val) val.textContent = "Connected";
          pillDocs.title = "Google Docs EDR: Connected and receiver configured";
        } else {
          pillDocs.className = "integration-pill is-disconnected";
          if (val) val.textContent = "Disconnected";
          pillDocs.title = "Google Docs EDR: Disconnected (No Web App URL configured)";
        }
      }

      // 3. Google Sheets Maintenance
      const pillSheets = el("pillGoogleSheets");
      if (pillSheets) {
        const sheetsUrl = localStorage.getItem("maintenance_google_sheets_web_app_url_v1") || "";
        const isSheetsConfigured = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/i.test(sheetsUrl.trim());
        const val = el("valGoogleSheets");
        if (isSheetsConfigured) {
          pillSheets.className = "integration-pill is-connected";
          if (val) val.textContent = "Configured";
          pillSheets.title = "Google Sheets Maintenance: Configured and ready";
        } else {
          pillSheets.className = "integration-pill is-disconnected";
          if (val) val.textContent = "Disconnected";
          pillSheets.title = "Google Sheets Maintenance: Disconnected (No Web App URL configured)";
        }
      }
    }
    window.updateIntegrationStatusPills = updateIntegrationStatusPills;
    window.renderEdrList = renderEdrList;
    window.renderAuditTable = renderAuditTable;

    // â”€â”€ Restored Authentication Gate & Session Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const loginModal = el("loginModal");
    const loginForm = el("loginForm");
    const loginBtn = el("loginBtn");
    const authMessage = el("authMessage");
    const loginUsername = el("loginUsername");
    const loginPassword = el("loginPassword");
    const btnLogoutTop = el("btnLogoutTop");

    // Rate-limiting & Anti-Abuse state (defense-in-depth)
    let failedLoginAttempts = 0;
    let lockoutUntil = 0;
    let lockoutTimer = null;

    function startLockoutCountdown() {
      if (lockoutTimer) clearInterval(lockoutTimer);
      const updateMessage = () => {
        const remainingMs = lockoutUntil - Date.now();
        if (remainingMs <= 0) {
          clearInterval(lockoutTimer);
          lockoutTimer = null;
          lockoutUntil = 0;
          showAuthMessage("");
          if (loginBtn) loginBtn.disabled = false;
          return;
        }
        const remainingSec = Math.ceil(remainingMs / 1000);
        showAuthMessage(`Too many failed attempts. Cooldown active: please wait ${remainingSec}s before retrying.`);
        if (loginBtn) loginBtn.disabled = true;
      };
      updateMessage();
      lockoutTimer = setInterval(updateMessage, 1000);
    }

    function showAuthMessage(msg, isSuccess = false) {
      if (!authMessage) return;
      if (!msg) {
        authMessage.style.display = "none";
        authMessage.textContent = "";
        authMessage.className = "auth-message";
      } else {
        authMessage.style.display = "block";
        authMessage.textContent = msg;
        authMessage.className = isSuccess ? "auth-message success" : "auth-message";
      }
    }

    function setAuthBusy(isBusy, busyText = "CONNECTING...") {
      if (!loginBtn) return;
      const label = loginBtn.querySelector(".btn-label") || loginBtn;
      if (isBusy) {
        loginBtn.dataset.origText = label.textContent;
        label.textContent = busyText;
        loginBtn.disabled = true;
      } else {
        label.textContent = loginBtn.dataset.origText || "INITIATE_CONNECTION";
        if (Date.now() >= lockoutUntil) {
          loginBtn.disabled = false;
        }
      }
    }

    function lockApp() {
      document.body.classList.add("auth-locked");
      document.body.classList.remove("auth-unlocked");
      if (loginModal) {
        loginModal.hidden = false;
        loginModal.style.display = "flex";
        loginModal.classList.remove("hidden");
      }
      const tabAccounts = el("tabAccounts");
      if (tabAccounts) tabAccounts.style.display = "none";
      if (currentWorkspace === "accounts") {
        currentWorkspace = "edr";
      }
    }

    function unlockApp(user, profile) {
      document.body.classList.remove("auth-locked");
      document.body.classList.add("auth-unlocked");
      if (loginModal) {
        loginModal.hidden = true;
        loginModal.style.display = "none";
        loginModal.classList.add("hidden");
      }
      showAuthMessage("");
      if (loginPassword) loginPassword.value = "";

      failedLoginAttempts = 0;
      lockoutUntil = 0;
      if (lockoutTimer) {
        clearInterval(lockoutTimer);
        lockoutTimer = null;
      }

      const isSuper = !!(auth && typeof auth.isSuperAdmin === "function" && auth.isSuperAdmin());
      const isAdmin = !!(auth && typeof auth.isAdmin === "function" && auth.isAdmin());
      const canAccessAccounts = !!(auth && typeof auth.canAccessWorkspace === "function" && auth.canAccessWorkspace("accounts"));

      const tabAccounts = el("tabAccounts");
      if (tabAccounts) {
        tabAccounts.style.display = canAccessAccounts ? "" : "none";
      }
      if (!canAccessAccounts && currentWorkspace === "accounts") {
        switchWorkspace("edr");
      }

      if (user) {
        if (el("userNameText")) el("userNameText").textContent = profile?.display_name || profile?.username || "Operator";
        const roleLabel = profile?.role === "super_admin" ? "Super Admin" : (profile?.role === "admin" ? "Admin" : "User");
        if (el("userRoleText")) el("userRoleText").textContent = roleLabel;
        if (el("userAvatarText")) el("userAvatarText").textContent = (profile?.username || "U")[0].toUpperCase();
      }

      // Dynamically toggle admin creation option for logged-in super admins only
      const optCreateAdmin = el("optCreateAdmin");
      if (optCreateAdmin) {
        optCreateAdmin.hidden = !isSuper;
        optCreateAdmin.disabled = !isSuper;
      }
    }

    // Bind login form submit
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        if (e) {
          e.preventDefault();
          if (typeof e.stopPropagation === "function") e.stopPropagation();
        }

        if (Date.now() < lockoutUntil) {
          startLockoutCountdown();
          return;
        }

        showAuthMessage("");
        const username = (loginUsername?.value || "").trim();
        const password = loginPassword?.value || "";

        if (!username) {
          showAuthMessage("Enter your operator ID, username or email.");
          loginUsername?.focus();
          return;
        }
        if (!password) {
          showAuthMessage("Enter your access key / password.");
          loginPassword?.focus();
          return;
        }

        setAuthBusy(true, "CONNECTING...");
        try {
          const res = await auth.signIn(username, password);
          unlockApp(res.user, res.profile);
          showToast("Authenticated successfully.", "success");
        } catch (err) {
          console.error("Sign in error:", err);
          failedLoginAttempts++;
          if (failedLoginAttempts >= 5) {
            lockoutUntil = Date.now() + 30000;
            failedLoginAttempts = 0;
            startLockoutCountdown();
            try {
              if (window.CCTV_ACCOUNTS && typeof window.CCTV_ACCOUNTS.logSecurityEvent === "function") {
                window.CCTV_ACCOUNTS.logSecurityEvent("login_rate_limit_triggered", username, { attempts: 5, cooldown_seconds: 30 });
              }
            } catch (_) {}
            return;
          }

          // Anti-enumeration generic error message
          showAuthMessage("Incorrect username or access key.");
        } finally {
          setAuthBusy(false);
        }
      });
    }

    // Bind topbar logout button
    if (btnLogoutTop) {
      btnLogoutTop.addEventListener("click", async () => {
        try {
          await auth.signOut();
        } catch (err) {
          console.warn("Sign out error:", err);
        }
        lockApp();
        showToast("Signed out safely.", "info");
      });
    }

    // User profile menu button
    el("btnUserMenu")?.addEventListener("click", () => {
      if (auth && typeof auth.canAccessWorkspace === "function" && auth.canAccessWorkspace("accounts")) {
        switchWorkspace("accounts");
      } else {
        const prof = auth?.getProfile();
        const roleLabel = prof?.role === "super_admin" ? "Super Admin" : (prof?.role === "admin" ? "Admin" : "User");
        showToast(`Signed in as ${prof?.display_name || prof?.username || "Operator"} (${roleLabel})`, "info");
      }
    });

    auth.onAuthChange(({ user, profile }) => {
      if (user) {
        unlockApp(user, profile);
      } else {
        lockApp();
      }
      updateIntegrationStatusPills();
      restoreSorterDraft().catch(console.error);
    });

    // Initial auth check on app startup
    const initialAuth = await auth.init();
    if (initialAuth && initialAuth.user) {
      unlockApp(initialAuth.user, initialAuth.profile);
    } else {
      lockApp();
    }
    updateIntegrationStatusPills();

    window.addEventListener("storage", (e) => {
      if (e.key === "maintenance_google_sheets_web_app_url_v1" || e.key === "cctv_edr_docs_url_v1") {
        updateIntegrationStatusPills();
      }
    });
  });
})();

// ============================================================
// JP_MATRIX_BACKGROUND
// Animated Katakana login background
// ============================================================
(() => {
  const initJapaneseMatrix = () => {
    const matrix = document.getElementById("jpMatrix");
    if (!matrix) return;

    const chars = Array.from(
      "ã‚¢ã‚¤ã‚¦ã‚¨ã‚ªã‚«ã‚­ã‚¯ã‚±ã‚³ã‚µã‚·ã‚¹ã‚»ã‚½ã‚¿ãƒãƒ„ãƒ†ãƒˆ" +
      "ãƒŠãƒ‹ãƒŒãƒãƒŽãƒãƒ’ãƒ•ãƒ˜ãƒ›ãƒžãƒŸãƒ ãƒ¡ãƒ¢ãƒ¤ãƒ¦ãƒ¨" +
      "ãƒ©ãƒªãƒ«ãƒ¬ãƒ­ãƒ¯ãƒ²ãƒ³ã‚¬ã‚®ã‚°ã‚²ã‚´ã‚¶ã‚¸ã‚ºã‚¼ã‚¾" +
      "ãƒ€ãƒ‚ãƒ…ãƒ‡ãƒ‰ãƒãƒ“ãƒ–ãƒ™ãƒœãƒ‘ãƒ”ãƒ—ãƒšãƒ"
    );

    const render = () => {
      const width = Math.max(window.innerWidth, 1920);
      const height = Math.max(window.innerHeight, 1080);

      const columns = Math.ceil(width / 40);
      const rows = Math.ceil(height / 40);
      const total = columns * rows;

      const fragment = document.createDocumentFragment();

      for (let i = 0; i < total; i++) {
        const span = document.createElement("span");
        span.textContent = chars[i % chars.length];
        fragment.appendChild(span);
      }

      matrix.replaceChildren(fragment);
    };

    render();

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initJapaneseMatrix);
  } else {
    initJapaneseMatrix();
  }
})();
/* =========================================================
   REPORT HEADER POLISH V1
   Auto-detect CCTV REPORT / REPORT PREVIEW headers and
   turn header buttons into aligned text actions
   ========================================================= */
(function () {
  if (window.__reportHeaderPolishInit) return;
  window.__reportHeaderPolishInit = true;

  function normalize(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function findTitleNode(label) {
    const selector = [
      "h1","h2","h3","h4","h5",
      ".section-title",".panel-title",".card-title",
      "[class*='title']"
    ].join(",");

    return Array.from(document.querySelectorAll(selector)).find(el => {
      return normalize(el.textContent) === normalize(label);
    });
  }

  function findHeaderContainer(titleEl, actionLabels) {
    let node = titleEl ? titleEl.parentElement : null;

    while (node && node !== document.body) {
      const actionTexts = Array.from(node.querySelectorAll("button,a"))
        .map(el => normalize(el.textContent))
        .filter(Boolean);

      const hasExpectedAction = actionLabels.some(label =>
        actionTexts.includes(normalize(label))
      );

      const hasFormControl = !!node.querySelector("input, textarea, select");

      if (hasExpectedAction && !hasFormControl) {
        return node;
      }

      node = node.parentElement;
    }

    return titleEl ? titleEl.parentElement : null;
  }

  function findCardContainer(headerEl) {
    let node = headerEl ? headerEl.parentElement : null;

    while (node && node !== document.body) {
      if (node.querySelector("textarea, input, select, [contenteditable='true']")) {
        return node;
      }
      node = node.parentElement;
    }

    return headerEl ? headerEl.parentElement : null;
  }

  function decorateOne(config) {
    const titleEl = findTitleNode(config.title);
    if (!titleEl) return;

    const header = findHeaderContainer(titleEl, config.actions);
    if (!header) return;

    titleEl.classList.add("report-clean-title");
    header.classList.add("report-clean-header");

    let actionsWrap = header.querySelector(".report-clean-actions");
    if (!actionsWrap) {
      actionsWrap = document.createElement("div");
      actionsWrap.className = "report-clean-actions";
      header.appendChild(actionsWrap);
    }

    Array.from(header.querySelectorAll("button,a")).forEach(el => {
      const txt = normalize(el.textContent);
      if (config.actions.some(action => normalize(action) === txt)) {
        el.classList.add("report-clean-action");
        actionsWrap.appendChild(el);
      }
    });

    const card = findCardContainer(header);
    if (card) {
      card.classList.add("report-clean-card");
      card.classList.add(config.cardClass);
    }
  }

  function applyReportHeaderPolish() {
    decorateOne({
      title: "CCTV REPORT",
      actions: ["Open Code of Conduct", "Reset"],
      cardClass: "report-clean-card--compose"
    });

    decorateOne({
      title: "REPORT PREVIEW",
      actions: ["Copy All"],
      cardClass: "report-clean-card--preview"
    });
  }

  let timer = null;
  function scheduleApply() {
    clearTimeout(timer);
    timer = setTimeout(applyReportHeaderPolish, 40);
  }

  document.addEventListener("DOMContentLoaded", scheduleApply);
  window.addEventListener("load", scheduleApply);
  document.addEventListener("click", scheduleApply, true);

  setTimeout(applyReportHeaderPolish, 200);
  setTimeout(applyReportHeaderPolish, 700);
  setTimeout(applyReportHeaderPolish, 1200);
})();
