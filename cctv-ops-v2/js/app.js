/**
 * CCTV OPS V2 - Main Application Orchestrator & Prototype Controller
 */

(function () {
  "use strict";

  const cfg = window.CCTV_V2_CONFIG;
  const storage = window.CCTV_STORAGE;
  const edr = window.CCTV_EDR;
  const auth = window.CCTV_AUTH;

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

  // App Initialization
  window.addEventListener("DOMContentLoaded", async () => {
    initFormDropdowns();
    initChoiceButtons();
    initScreenshotDropzone();
    initEvents();

    // Manila clock ticker
    updateManilaClock();
    setInterval(updateManilaClock, 1000);

    // Watch EDR updates
    edr.onChange(reports => {
      renderEdrList(reports);
    });

    // Initial load of existing EDR records from IndexedDB
    await edr.init();

    // Optional demo seed for testing / visual verification if requested
    const params = new URLSearchParams(window.location.search);
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
