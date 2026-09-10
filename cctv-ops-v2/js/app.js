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
  function initFormDropdowns() {
    // Site select
    const siteSelect = el("edrSite");
    const sites = storage.getItem(cfg.KEYS.DROPDOWN_SITE, cfg.DEFAULTS.SITES);
    if (siteSelect) {
      siteSelect.innerHTML = sites.map(s => `<option value="${s}">${s}</option>`).join("");
    }

    // OM datalist
    const omList = el("listOms");
    const oms = storage.getItem(cfg.KEYS.DROPDOWN_OM, cfg.DEFAULTS.OMS);
    if (omList) {
      omList.innerHTML = oms.map(o => `<option value="${o}"></option>`).join("");
    }

    // Respondent datalist
    const respList = el("listRespondents");
    if (respList) {
      respList.innerHTML = oms.map(o => `<option value="${o}"></option>`).join("");
    }

    // Account / Campaign datalist
    const accList = el("listAccounts");
    const accounts = storage.getItem(cfg.KEYS.DROPDOWN_ACCOUNT, []);
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
    if (btnTl && btnOm) {
      btnTl.addEventListener("click", () => {
        btnTl.classList.add("active");
        btnOm.classList.remove("active");
        supervisorRole = "Team Leader";
      });
      btnOm.addEventListener("click", () => {
        btnOm.classList.add("active");
        btnTl.classList.remove("active");
        supervisorRole = "OM";
      });
    }

    const btnAgent = el("btnSubjAgent");
    const btnSubjTl = el("btnSubjTl");
    if (btnAgent && btnSubjTl) {
      btnAgent.addEventListener("click", () => {
        btnAgent.classList.add("active");
        btnSubjTl.classList.remove("active");
        subjectType = "Agent/s";
      });
      btnSubjTl.addEventListener("click", () => {
        btnSubjTl.classList.add("active");
        btnAgent.classList.remove("active");
        subjectType = "Team Leader";
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
      listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:30px 10px;">No EDR records found. Create an EDR on the left.</div>';
      updateLivePreview();
      return;
    }

    listContainer.innerHTML = reports.map((r, idx) => {
      const isDone = !!r.done;
      const isSelected = !!r.selected && !isDone;
      return `
        <div class="edr-item-card ${isSelected ? 'is-selected' : ''} ${isDone ? 'is-done' : ''}" data-id="${r.id}">
          <div class="edr-item-header">
            <input type="checkbox" class="edr-check" ${isSelected ? 'checked' : ''} ${isDone ? 'disabled' : ''} style="cursor:pointer;">
            <div class="edr-item-title">${r.date || 'No Date'} · ${r.site || 'Site'}</div>
            <span class="badge ${isDone ? 'badge-success' : 'badge-neutral'}">${isDone ? 'Done' : (r.account || 'EDR')}</span>
          </div>
          <div class="edr-item-meta">
            <span>${r.supervisorRole || 'TL'}: <strong>${r.supervisorName || 'N/A'}</strong></span>
            <span>·</span>
            <span>Subj: <strong>${r.subjectName || 'N/A'}</strong></span>
          </div>
          <div class="edr-item-actions">
            <button type="button" class="btn btn-outline btn-sm btn-done-toggle">${isDone ? 'Reopen' : 'Done'}</button>
            <button type="button" class="btn btn-outline btn-sm btn-edit">Edit</button>
            <button type="button" class="btn btn-outline btn-sm btn-delete" style="color:var(--accent-danger);">Delete</button>
          </div>
        </div>
      `;
    }).join("");

    // Attach Event Listeners to Cards
    listContainer.querySelectorAll(".edr-item-card").forEach(card => {
      const id = card.dataset.id;
      const report = reports.find(r => r.id === id);
      if (!report) return;

      card.querySelector(".edr-check")?.addEventListener("change", (e) => {
        edr.toggleSelect(id, e.target.checked);
      });

      card.querySelector(".btn-done-toggle")?.addEventListener("click", () => {
        edr.toggleDone(id);
      });

      card.querySelector(".btn-edit")?.addEventListener("click", () => {
        populateFormForEdit(report);
      });

      card.querySelector(".btn-delete")?.addEventListener("click", () => {
        if (confirm(`Delete EDR for ${report.subjectName || 'this record'}?`)) {
          edr.deleteReport(id);
          showToast("EDR deleted.", "info");
        }
      });
    });

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
      el("btnRoleOm").click();
    } else {
      el("btnRoleTl").click();
    }
    el("edrSupervisorName").value = report.supervisorName || "";
    el("edrOmName").value = report.omName || "";

    subjectType = report.subjectType || "Agent/s";
    if (subjectType === "Team Leader") {
      el("btnSubjTl").click();
    } else {
      el("btnSubjAgent").click();
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
    initFormDropdowns();
    if (window.setCctvScreenshot) window.setCctvScreenshot("");
    el("edrFormTitle").textContent = "Manual EDR Entry";
    el("btnEdrSubmitText").textContent = "Create EDR";
    el("btnEdrCancelEdit").style.display = "none";
  }

  // Update Live Preview in Column 3
  function updateLivePreview() {
    const previewBox = el("edrPreviewBox");
    if (!previewBox) return;
    const fbText = el("edrFacebookText")?.value || "";
    const plainText = edr.buildTeamsOutput(fbText);
    previewBox.textContent = plainText || "Select active EDRs in the list to generate output.";
  }

  // Initialize UI Events
  function initEvents() {
    // Form submit
    el("edrForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
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

      await edr.createOrUpdate(data);
      resetForm();
      showToast("EDR saved successfully.", "success");
    });

    el("btnEdrClear")?.addEventListener("click", resetForm);
    el("btnEdrCancelEdit")?.addEventListener("click", resetForm);

    // Select all / Clear selection
    el("btnSelectAll")?.addEventListener("click", () => edr.selectAll(true));
    el("btnUnselectAll")?.addEventListener("click", () => edr.selectAll(false));

    // Facebook textarea input
    el("edrFacebookText")?.addEventListener("input", updateLivePreview);

    // Copy All Teams Button
    el("btnCopyAllTeams")?.addEventListener("click", async () => {
      try {
        const fb = el("edrFacebookText")?.value || "";
        const count = await edr.copyAllToTeams(fb);
        showToast(`Copied ${count} EDR(s) to Teams clipboard (Plain Text). Marked as Done.`, "success");
      } catch (err) {
        showToast(err.message || "Failed to copy.", "error");
      }
    });

    // Rail Toggle
    el("btnToggleRail")?.addEventListener("click", () => {
      el("navRail")?.classList.toggle("collapsed");
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

    el("btnSaveDocsSetup")?.addEventListener("click", () => {
      const url = el("inputDocsUrl").value;
      edr.setDocsUrl(url);
      el("modalDocsSetup").hidden = true;
      el("edrDocsStatusText").textContent = url ? "Docs Connected" : "Local Storage";
      showToast("Google Docs receiver configured.", "success");
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
