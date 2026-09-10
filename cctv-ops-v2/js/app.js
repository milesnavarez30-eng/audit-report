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

  let currentScreenshot = "";
  let supervisorRole = "Team Leader";
  let subjectType = "Agent/s";

  // Elements
  const el = id => document.getElementById(id);

  // Toast notifications
  function showToast(message, type = "info") {
    const container = el("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 200ms ease";
      setTimeout(() => toast.remove(), 220);
    }, 3200);
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

  // Render EDR Cards in Column 2
  function renderEdrList(reports) {
    const listContainer = el("edrListContainer");
    if (!listContainer) return;

    const total = reports.length;
    const selected = reports.filter(r => r.selected && !r.done).length;
    const done = reports.filter(r => r.done).length;

    el("badgeTotalCount").textContent = total;
    el("badgeSelectedCount").textContent = `${selected} selected`;
    el("badgeDoneCount").textContent = `${done} done`;
    el("railEdrBadge").textContent = total;

    if (!reports.length) {
      listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:11.5px; text-align:center; padding:30px 10px;">No EDR records found. Complete the form on the left to save an incident.</div>';
      updateLivePreview();
      return;
    }

    listContainer.innerHTML = reports.map((r) => {
      const isDone = !!r.done;
      const isSelected = !!r.selected && !isDone;
      const isLinked = !!edr.isReportInAudit(r.id);
      const hasRealImage = !!(r.screenshotData && r.screenshotData.trim().length > 10);
      const hasRemoteOnly = !hasRealImage && !!r.screenshotFileId;
      const hasShot = hasRealImage || hasRemoteOnly;
      const formattedDate = formatDisplayDate(r.date);

      // Status chips: SS, AUDIT, DONE, DOCS
      const chips = [];
      if (hasShot) {
        chips.push('<span class="status-chip chip-ss" title="Screenshot attached">SS</span>');
      }
      if (isLinked) {
        chips.push('<span class="status-chip chip-audit" title="Present in CCTV Audit">AUDIT</span>');
      }
      if (isDone) {
        chips.push('<span class="status-chip chip-done" title="Completed">DONE</span>');
      }
      if (hasRemoteOnly || r.docsSynced) {
        chips.push('<span class="status-chip chip-docs" title="Synced to Google Docs">DOCS</span>');
      }
      const chipsHtml = chips.length ? `<span class="status-chips-wrap">${chips.join('')}</span>` : '';

      return `
        <div class="record-row ${isSelected ? 'is-selected' : ''} ${isDone ? 'is-done' : ''}" data-id="${r.id}">
          <div class="record-select-col">
            <input type="checkbox" class="edr-check" ${isSelected ? 'checked' : ''} ${isDone ? 'disabled' : ''} style="cursor:pointer;" title="${isDone ? 'Completed (uncheck Done to select)' : 'Select for export'}">
          </div>

          <div class="record-info">
            <div class="record-main-line">
              <span class="record-date">${formattedDate}</span>
              <span class="record-sep">·</span>
              <span class="record-site" title="${r.site || 'Site'}">${r.site || 'Site'}</span>
              ${chipsHtml}
            </div>
            <div class="record-sub-line">
              <span class="record-campaign" title="${r.account || 'General'}">${r.account || 'General'}</span>
              <span class="record-sep">·</span>
              <span class="record-resp" title="${r.supervisorRole || 'TL'}: ${r.supervisorName || 'N/A'}">
                <span class="sub-label">${r.supervisorRole || 'TL'}:</span> <strong>${r.supervisorName || 'N/A'}</strong>
              </span>
              ${r.subjectName ? `
                <span class="record-sep">·</span>
                <span class="record-subj" title="Subject: ${r.subjectName}"><span class="sub-label">Subj:</span> ${r.subjectName}</span>
              ` : ''}
            </div>
          </div>

          <div class="record-actions">
            ${hasShot ? `
              <button type="button" class="btn-action btn-shot-view" title="View CCTV screenshot">View SS</button>
            ` : `
              <button type="button" class="btn-action btn-shot-add" title="Add screenshot">Add SS</button>
            `}
            <button type="button" class="btn-action btn-audit-send ${isLinked ? 'is-linked' : ''}" title="${isLinked ? 'Update in CCTV Audit' : 'Send to CCTV Audit'}">
              <span class="label-long">${isLinked ? 'In Audit' : 'Send to Audit'}</span>
              <span class="label-short">${isLinked ? 'In Audit' : 'Audit'}</span>
            </button>
            <button type="button" class="btn-action btn-done-toggle ${isDone ? 'is-done-btn' : ''}" title="${isDone ? 'Reopen EDR' : 'Mark as Done'}">
              ${isDone ? 'Reopen' : 'Done'}
            </button>
            <button type="button" class="btn-action btn-edit" title="Edit EDR">Edit</button>

            <!-- Compact More Menu for Screenshot & Deletion Actions -->
            <div class="record-more-menu-wrap">
              <button type="button" class="btn-action btn-more-trigger" title="More options">⋯</button>
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

      card.querySelector(".edr-check")?.addEventListener("change", (e) => {
        edr.toggleSelect(id, e.target.checked);
      });

      // View SS
      const triggerView = async () => {
        if (!report.screenshotData && report.screenshotFileId) {
          showToast("Loading remote screenshot...", "info");
          await edr.ensureRemoteScreenshot(report);
        }
        if (window.openFullScreenshotViewer) {
          window.openFullScreenshotViewer(
            report.screenshotData,
            `${report.site || 'Site'} · ${report.account || 'EDR'}`,
            `Observed: ${report.date || ''} ${report.timeObserved || ''} · Supervisor: ${report.supervisorName || 'N/A'}`
          );
        } else {
          openScreenshotViewer(
            report.screenshotData,
            `${report.site || 'Site'} · ${report.account || 'EDR'}`,
            `Observed: ${report.date || ''} ${report.timeObserved || ''} · Supervisor: ${report.supervisorName || 'N/A'}`
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
        card.querySelector(".record-dropdown-menu")?.classList.remove("is-open");
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
        document.querySelectorAll(".record-dropdown-menu.is-open").forEach(m => m.classList.remove("is-open"));
        if (!isOpen && moreMenu) {
          moreMenu.classList.add("is-open");
        }
      });

      // Replace SS (in More menu)
      card.querySelector(".btn-action-replace")?.addEventListener("click", (e) => {
        e.stopPropagation();
        moreMenu?.classList.remove("is-open");
        triggerAddReplace();
      });

      // Remove SS (in More menu)
      card.querySelector(".btn-action-remove")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        moreMenu?.classList.remove("is-open");
        if (confirm("Remove CCTV screenshot from this saved EDR?")) {
          await edr.removeScreenshotFromReport(id);
          showToast("CCTV screenshot removed.", "info");
        }
      });

      // Delete EDR (in More menu)
      card.querySelector(".btn-action-delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        moreMenu?.classList.remove("is-open");
        if (confirm(`Delete EDR for ${report.subjectName || 'this record'}?`)) {
          edr.deleteReport(id);
          showToast("EDR deleted.", "info");
        }
      });
    });

    // Global listener for closing dropdowns on outside click
    if (!window._edrMoreMenuGlobalBound) {
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".record-more-menu-wrap")) {
          document.querySelectorAll(".record-dropdown-menu.is-open").forEach(m => m.classList.remove("is-open"));
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

  // Update Live Preview in Column 3
  function updateLivePreview() {
    const previewBox = el("edrPreviewBox");
    if (!previewBox) return;
    const fbText = el("edrFacebookText")?.value || "";
    const plainText = edr.buildTeamsOutput(fbText);
    previewBox.textContent = plainText || "Select active EDRs in the list to generate output.";
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

      if (result.action === "created") {
        showToast(
          "Added to CCTV Audit. NOC starts as Pending; Remarks can be edited anytime.",
          "success"
        );
      } else {
        showToast(
          "CCTV Audit updated. Existing NOC and Remarks were kept.",
          "success"
        );
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Could not send EDR to CCTV Audit.", "error");
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
      if (selected.length === 1) {
        await sendSingleReportToAudit(selected[0]);
        return;
      }
      if (selected.length > 1) {
        showToast("Please select only ONE EDR to send to CCTV Audit.", "warning");
        return;
      }

      showToast("Complete the EDR form or select a saved record from the list.", "info");
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
      if (selected.length === 1) {
        await sendSingleReportToAudit(selected[0]);
        return;
      }
      if (selected.length > 1) {
        showToast("Please select only ONE EDR to send to CCTV Audit.", "warning");
        return;
      }

      const editing = edr.getEditingReport();
      if (editing) {
        await sendSingleReportToAudit(editing);
        return;
      }

      showToast("Select one EDR from the saved list to send to CCTV Audit.", "info");
    });

    // Select all / Clear selection
    el("btnSelectAll")?.addEventListener("click", () => edr.selectAll(true));
    el("btnUnselectAll")?.addEventListener("click", () => edr.selectAll(false));

    // Facebook textarea input
    el("edrFacebookText")?.addEventListener("input", updateLivePreview);

    // Copy Screenshot Button (Teams Dispatch Header)
    el("btnCopyScreenshot")?.addEventListener("click", async () => {
      try {
        const selectedWithShot = edr.getReports().find(r => r.selected && !r.done && r.screenshotData);
        const editing = edr.getEditingReport();
        const target = selectedWithShot || (editing && editing.screenshotData ? editing : null) || (currentScreenshot ? currentScreenshot : null);

        if (!target) {
          showToast("No screenshot found in active selection or form.", "info");
          return;
        }
        await edr.copyScreenshot(target);
        showToast("CCTV screenshot copied to clipboard (native PNG).", "success");
      } catch (err) {
        showToast(err.message || "Could not copy screenshot.", "error");
      }
    });

    // Copy All Teams Button
    el("btnCopyAllTeams")?.addEventListener("click", async () => {
      try {
        const fb = el("edrFacebookText")?.value || "";
        const res = await edr.copyAllToTeams(fb);
        if (res.hasScreenshot && res.wroteWithImage) {
          showToast(`Copied ${res.count} EDR(s) with hyperlinks + screenshot. Marked as Done.`, "success");
        } else if (res.hasScreenshot && !res.wroteWithImage) {
          showToast(`Copied ${res.count} EDR(s) (Formatted Hyperlinks). Use "Copy Screenshot" for image. Marked as Done.`, "info");
        } else {
          showToast(`Copied ${res.count} EDR(s) to Teams (Formatted Hyperlinks). Marked as Done.`, "success");
        }
      } catch (err) {
        showToast(err.message || "Failed to copy.", "error");
      }
    });

    // Rail Toggle
    el("btnToggleRail")?.addEventListener("click", () => {
      el("navRail")?.classList.toggle("collapsed");
    });

    // Reload Saved EDRs from Google Docs
    el("btnReloadDocs")?.addEventListener("click", async () => {
      try {
        showToast("Loading saved EDRs from Google Docs...", "info");
        const res = await edr.loadSavedEdrsFromDocs();
        showToast(`Loaded ${res.count} saved EDR(s) from Google Docs.`, "success");
      } catch (err) {
        showToast(err.message || "Failed to load from Google Docs.", "error");
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
      el("edrDocsStatusText").textContent = "Local Storage";
      el("edrDocsUrlHint").textContent = "URL must end in /exec.";
      el("edrDocsUrlHint").className = "docs-url-hint";
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
        el("edrDocsStatusText").textContent = "Docs Connected";
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
    edr: {
      tabId: "tabEdr",
      paneId: "paneEdr",
      title: "End of the Day Report",
      subtitle: "Manual Operations"
    },
    audit: {
      tabId: "tabAudit",
      paneId: "paneAudit",
      title: "CCTV Audit",
      subtitle: "Daily Operations Tracker"
    },
    sorter: {
      tabId: "tabSorter",
      paneId: "paneSorter",
      title: "AI Sorter",
      subtitle: "Floor Assignment & Shift Sorting"
    },
    maintenance: {
      tabId: "tabMaintenance",
      paneId: "paneMaintenance",
      title: "Maintenance",
      subtitle: "Daily Inspection & Equipment Report"
    },
    pending: {
      tabId: "tabPending",
      paneId: "panePending",
      title: "Pending Reports",
      subtitle: "Follow-Up & Escalation Tracker"
    },
    masterlist: {
      tabId: "tabMasterlist",
      paneId: "paneMasterlist",
      title: "Masterlist",
      subtitle: "Tracker Hub & HR Assignment"
    },
    followup: {
      tabId: "tabFollowup",
      paneId: "paneFollowup",
      title: "Follow Up Reports",
      subtitle: "Resolution Queue"
    },
    history: {
      tabId: "tabHistory",
      paneId: "paneHistory",
      title: "Activity History",
      subtitle: "Audit Log & Snapshots"
    },
    accounts: {
      tabId: "tabAccounts",
      paneId: "paneAccounts",
      title: "Account Management",
      subtitle: "Access Control & Security"
    }
  };

  function switchWorkspace(targetKey) {
    if (!WORKSPACES[targetKey]) return;
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

    // Update topbar titles
    const titleEl = document.querySelector(".workspace-main-title");
    const subBadge = document.querySelector(".workspace-title-wrap .badge");
    if (titleEl) titleEl.textContent = WORKSPACES[targetKey].title;
    if (subBadge) subBadge.textContent = WORKSPACES[targetKey].subtitle;

    // Activate hooks
    if (targetKey === "audit") {
      renderAuditTable();
      renderGuardStatus();
    } else if (targetKey === "sorter") {
      renderSorterWorkspace();
    } else if (targetKey === "maintenance") {
      renderMaintenanceWorkspace();
    } else if (targetKey === "pending") {
      renderPendingWorkspace();
    }
  }

  function initWorkspaceNavigation() {
    Object.keys(WORKSPACES).forEach(wsKey => {
      const btn = el(WORKSPACES[wsKey].tabId);
      if (btn) {
        btn.addEventListener("click", () => switchWorkspace(wsKey));
      }
    });

    // Rail collapse toggle
    el("btnToggleRail")?.addEventListener("click", () => {
      el("navRail")?.classList.toggle("collapsed");
    });
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

    const entries = audit.getEntries();

    // Update Badges
    const totalBadge = el("auditTotalRowsBadge");
    if (totalBadge) {
      totalBadge.textContent = `${entries.length} ${entries.length === 1 ? "row" : "rows"}`;
    }

    const linkedCount = entries.filter(e => e.sourceEdrId).length;
    const linkedBadge = el("auditLinkedBadge");
    if (linkedBadge) {
      linkedBadge.textContent = `${linkedCount} from EDR`;
    }

    const railBadge = el("railAuditBadge");
    if (railBadge) {
      railBadge.textContent = entries.length;
    }

    if (!entries.length) {
      tableBody.innerHTML = "";
      if (emptyNotice) emptyNotice.style.display = "block";
      return;
    }

    if (emptyNotice) emptyNotice.style.display = "none";

    tableBody.innerHTML = entries.map((entry, idx) => {
      const rowNum = idx + 1;
      const dateDisplay = entry.formattedDate || entry.rawDate || "—";
      const auditor = entry.name || entry.auditorName || "Miles";
      const nocLower = String(entry.noc || "").toLowerCase();
      let nocBadgeClass = "badge-info";
      if (nocLower === "yes") nocBadgeClass = "badge-success";
      else if (nocLower === "no") nocBadgeClass = "badge-danger";
      else if (nocLower === "pending") nocBadgeClass = "badge-warning";
      else if (nocLower === "disputed") nocBadgeClass = "badge-neutral";

      const hasEdr = !!entry.sourceEdrId;
      const isEditing = auditEditingIndex === idx;

      return `
        <tr class="audit-row ${isEditing ? 'is-editing' : ''}" data-idx="${idx}">
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
              <button type="button" class="btn btn-ghost btn-sm btn-edit-audit" data-idx="${idx}" title="Edit this entry" style="padding:2px 5px; height:24px;">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn btn-ghost btn-sm btn-delete-audit text-danger" data-idx="${idx}" title="Delete this entry" style="padding:2px 5px; height:24px;">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

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
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        const rep = entries[idx];
        const agreed = await window.appConfirm({
          title: "Delete Audit Entry?",
          message: `Delete audit entry for ${rep?.agentName || rep?.tlName || "entry"} (${rep?.site || ""})?`,
          confirmText: "Delete",
          tone: "danger"
        });
        if (agreed) {
          audit.deleteEntry(idx);
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
        showToast("Audit entry added to list.", "success");
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
        ? `Snapshot: ${snap.importedAt ? new Date(snap.importedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "Active"} (${rows.length} rows)`
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
          ${iss.suggestion ? `<div style="color:#38bdf8; font-weight:600; margin-top:2px;">↳ ${window.escapeHtml(iss.suggestion)}</div>` : ''}
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
        selectMiniSheetRow(Number(tr.dataset.rowIndex), event);
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
              <option value="" ${manual === "" ? "selected" : ""}>Auto — ${window.escapeHtml(detected)}</option>
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
        if (el("maintenanceInput")?.value.trim()) analyzeMaintenance(false);
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
          message: `Remove "${shownName}" from the Team Leader Floor Assignment list?`,
          confirmText: "Remove",
          tone: "danger"
        });

        if (!approved) return;

        const hiddenNames = new Set(sorter.loadHiddenTLs());
        hiddenNames.add(originalName);
        sorter.saveHiddenTLs([...hiddenNames]);
        renderTlSummaryTable();
        showToast(`${shownName} removed from assignment list.`, "info");
      });
    });
  }

  function initSorterController() {
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
      showToast("Team Leader Floor Assignment was reset. Auto-learning will be used again.", "info");
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

    document.addEventListener("mouseup", () => {
      if (!miniSheetCellDragging) return;
      miniSheetCellDragging = false;
      el("maintenanceMiniSheet")?.classList.remove("cell-range-dragging");
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
    updateMaintenanceAutosaveIndicator("● Saving...", "saving");
    if (maintenanceAutosaveTimer) clearTimeout(maintenanceAutosaveTimer);
    maintenanceAutosaveTimer = setTimeout(async () => {
      try {
        await maintenance.saveDraft(maintenanceState);
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        updateMaintenanceAutosaveIndicator(`● Auto-saved (${timeStr})`, "saved");
      } catch (err) {
        console.error("Autosave draft error:", err);
        updateMaintenanceAutosaveIndicator("● Autosave error", "error");
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
      blockEl.className = "eod-block-card";
      blockEl.id = `block_${block.id}`;
      blockEl.dataset.blockId = block.id;

      // Header row
      const headerRow = document.createElement("div");
      headerRow.className = "eod-block-header";

      const titleWrap = document.createElement("div");
      titleWrap.style.display = "flex";
      titleWrap.style.alignItems = "center";
      titleWrap.style.gap = "8px";

      const badge = document.createElement("span");
      badge.className = "badge badge-neutral";
      badge.textContent = `Block #${index + 1}`;

      const titleSpan = document.createElement("span");
      titleSpan.style.fontWeight = "600";
      titleSpan.style.fontSize = "12px";
      titleSpan.style.color = "var(--text-primary)";
      titleSpan.textContent = `Report Section ${index + 1}`;

      titleWrap.appendChild(badge);
      titleWrap.appendChild(titleSpan);

      const actionsWrap = document.createElement("div");
      actionsWrap.style.display = "flex";
      actionsWrap.style.alignItems = "center";
      actionsWrap.style.gap = "8px";

      // Hide Data Checkbox
      const hideLabel = document.createElement("label");
      hideLabel.style.display = "inline-flex";
      hideLabel.style.alignItems = "center";
      hideLabel.style.gap = "4px";
      hideLabel.style.fontSize = "11px";
      hideLabel.style.color = "var(--text-secondary)";
      hideLabel.style.cursor = "pointer";

      const hideCheck = document.createElement("input");
      hideCheck.type = "checkbox";
      hideCheck.checked = !!block.dataHidden;
      hideCheck.addEventListener("change", () => {
        block.dataHidden = hideCheck.checked;
        queueMaintenanceAutosave();
      });
      hideLabel.appendChild(hideCheck);
      hideLabel.appendChild(document.createTextNode("Exclude rows from send"));
      actionsWrap.appendChild(hideLabel);

      // Remove block button
      if (maintenanceState.blocks.length > 1) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-danger-ghost btn-sm";
        removeBtn.textContent = "Remove Block";
        removeBtn.addEventListener("click", async () => {
          const ok = await window.appConfirm({
            title: `Remove Block #${index + 1}?`,
            message: "Remove this block and its incident issues, remarks, and screenshots?",
            confirmText: "Remove",
            tone: "danger"
          });
          if (!ok) return;
          maintenanceState.blocks.splice(index, 1);
          renderMaintenanceBlocks();
          queueMaintenanceAutosave();
          showToast(`Block #${index + 1} removed.`, "info");
        });
        actionsWrap.appendChild(removeBtn);
      }

      headerRow.appendChild(titleWrap);
      headerRow.appendChild(actionsWrap);
      blockEl.appendChild(headerRow);

      // Desktop side-by-side grid
      const grid = document.createElement("div");
      grid.className = "maintenance-incident-action-grid";

      // Left column: Lanes / Incidents
      const leftCol = document.createElement("div");
      leftCol.className = "form-group";
      leftCol.style.marginBottom = "0";

      const leftLabel = document.createElement("label");
      leftLabel.className = "form-label";
      leftLabel.textContent = "Station Issues / Incident (Lanes)";
      leftCol.appendChild(leftLabel);

      const lanesArea = document.createElement("textarea");
      lanesArea.className = "form-control eod-lanes-textarea";
      lanesArea.rows = 6;
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

      const rightLabel = document.createElement("label");
      rightLabel.className = "form-label";
      rightLabel.textContent = "Action Taken / Remarks";
      rightCol.appendChild(rightLabel);

      const remarksArea = document.createElement("textarea");
      remarksArea.className = "form-control eod-remarks-textarea";
      remarksArea.rows = 6;
      remarksArea.placeholder = "Enter action taken or remarks (one per line)...";
      remarksArea.value = Array.isArray(block.remarks) ? block.remarks.join("\n") : (block.remarks || "");
      remarksArea.addEventListener("focus", () => {
        activePasteBlockId = block.id;
      });
      remarksArea.addEventListener("input", () => {
        block.remarks = remarksArea.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (!block.remarks.length) block.remarks = [""];
        queueMaintenanceAutosave();
      });
      rightCol.appendChild(remarksArea);
      grid.appendChild(rightCol);

      blockEl.appendChild(grid);

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
        updateMaintenanceAutosaveIndicator("● Processing images...", "saving");
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
        removeBtn.innerHTML = "✕";
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

      // Drag and drop handlers
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
          updateMaintenanceAutosaveIndicator("● Processing images...", "saving");
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

      // Ctrl+V Paste handler on the block
      blockEl.addEventListener("paste", async (e) => {
        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              updateMaintenanceAutosaveIndicator("● Processing pasted image...", "saving");
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

      blockEl.appendChild(proofZone);
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

  async function copyFullMaintenanceReportToSheets() {
    try {
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

      if (result && result.success) {
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
    try {
      if (typeof window.html2pdf !== "function") {
        window.print();
        return;
      }
      const element = document.createElement("div");
      element.innerHTML = maintenance.maintenanceReportHtmlForSheets(maintenanceState);
      element.style.padding = "20px";
      element.style.background = "#ffffff";
      element.style.color = "#111827";

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Maintenance_Report_${maintenanceState.destinationKey}_${maintenanceState.date}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
      };

      showToast("Generating PDF export...", "info");
      await window.html2pdf().from(element).set(opt).save();
      showToast("PDF downloaded successfully.", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      window.print();
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
        meta.textContent = `${d.savedAt || ""} · ${dDate} · ${blocksCount} block(s)`;

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
        if (res && res.success) {
          if (testRes) {
            testRes.textContent = `Connection successful! Destination: ${res.destination || "OK"}`;
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
    el("simpleEodPreviewBtn")?.addEventListener("click", () => window.print());

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
          pieces.push(`<strong>${email}</strong> report${email === 1 ? "" : "s"} reached 4 days — send email`);
        }
        banner.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24" style="stroke:currentColor; flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> <span>${pieces.join(" · ")}</span>`;
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
          openScreenshotViewer(report.screenshotData, "Pending Incident Evidence", `${report.label || "Report"} · OM: ${report.om || "N/A"}`);
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
      metaRow.textContent = `Reported ${report.reportDate || "N/A"} · Age ${ageStr} · Pending ${ageStr}`;
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

    // CCTV Audit & Smart Audit Guard Initialization
    initAuditEvents();
    initSmartAuditGuard();

    // AI Sorter Initialization
    initSorterController();

    // Maintenance Report Initialization
    initMaintenanceController();

    // Pending Reports Initialization
    initPendingController();

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

    // Restore draft form and Facebook text if present
    restoreDraftForm();
    const savedFb = edr.getFacebookText();
    if (savedFb && el("edrFacebookText")) {
      el("edrFacebookText").value = savedFb;
      updateLivePreview();
    }

    // Google Docs initial connection check
    const currentDocsUrl = edr.getDocsUrl();
    if (edr.isValidDocsUrl(currentDocsUrl)) {
      el("edrDocsStatusText").textContent = "Docs Connected";
    } else {
      el("edrDocsStatusText").textContent = "Local Storage";
    }

    // Auth check
    await auth.init();
    auth.onAuthChange(({ user, profile }) => {
      if (user) {
        el("userNameText").textContent = profile?.display_name || profile?.username || "Operator";
        el("userRoleText").textContent = profile?.role || "User";
        el("userAvatarText").textContent = (profile?.username || "U")[0].toUpperCase();
      }
    });
  });
})();
