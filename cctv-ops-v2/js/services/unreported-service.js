/**
 * CCTV OPS V2 - Unreported Workspace Service
 * Durable persistent holding area for unfiled CCTV violations.
 * Database: cctv_unreported_v1 | Store: workspace | Key: records
 */
(function (root) {
  "use strict";

  const DB_NAME = "cctv_unreported_v1";
  const STORE_NAME = "workspace";
  const STATE_KEY = "records";

  let itemsList = [];
  let activeCardId = "";
  let isInitialized = false;
  let debounceSaveTimer = null;
  const changeListeners = [];

  function emitChange(items) {
    changeListeners.forEach(fn => {
      try { fn(items); } catch (e) { console.error("Unreported change listener error:", e); }
    });
  }

  function uid() {
    return "unrep_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function clone(val) {
    try {
      return structuredClone(val);
    } catch (_) {
      return JSON.parse(JSON.stringify(val));
    }
  }

  function escapeHtml(val) {
    return String(val == null ? "" : val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDateTime(iso) {
    if (!iso) return "Just now";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
        ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch (_) {
      return iso;
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadItems() {
    try {
      const db = await openDb();
      try {
        const saved = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        return Array.isArray(saved) ? saved : [];
      } finally {
        db.close();
      }
    } catch (err) {
      console.warn("Unreported load from IndexedDB failed, checking localStorage fallback:", err);
      try {
        const fallback = localStorage.getItem("cctv_unreported_fallback_v1");
        return fallback ? JSON.parse(fallback) : [];
      } catch (_) {
        return [];
      }
    }
  }

  async function saveItems(items) {
    const list = Array.isArray(items) ? clone(items) : [];
    itemsList = list;
    try {
      const db = await openDb();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put(list, STATE_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    } catch (err) {
      console.warn("Unreported save to IndexedDB failed, storing in localStorage fallback:", err);
      try {
        localStorage.setItem("cctv_unreported_fallback_v1", JSON.stringify(list));
      } catch (fallbackErr) {
        console.error("Unreported fallback storage failed:", fallbackErr);
      }
    }
    emitChange(list);
    updateNavBadges();
    return true;
  }

  function scheduleDebounceSave() {
    if (debounceSaveTimer) clearTimeout(debounceSaveTimer);
    debounceSaveTimer = setTimeout(() => {
      saveItems(itemsList);
    }, 350);
  }

  function compressImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
      if (!fileOrBlob) {
        reject(new Error("No image file provided."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("Could not read image."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not decode image."));
        img.onload = () => {
          const maxW = 1920;
          const maxH = 1080;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (width > maxW || height > maxH) {
            const scale = Math.min(maxW / width, maxH / height);
            width = Math.max(1, Math.round(width * scale));
            height = Math.max(1, Math.round(height * scale));
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.88));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(fileOrBlob);
    });
  }

  function createItem({ screenshots = [], blueIrisUrl = "", remarks = "" } = {}) {
    return {
      id: uid(),
      createdAt: new Date().toISOString(),
      screenshots: Array.isArray(screenshots) ? screenshots : [],
      activeShotIndex: 0,
      blueIrisUrl: String(blueIrisUrl || "").trim(),
      remarks: String(remarks || "").trim()
    };
  }

  function updateNavBadges() {
    const count = itemsList.length;
    const pill = document.getElementById("unreportedCountPill");
    if (pill) {
      pill.textContent = `${count} item${count === 1 ? "" : "s"}`;
    }
    const railBadge = document.getElementById("railUnreportedBadge");
    if (railBadge) {
      railBadge.textContent = String(count);
      railBadge.style.display = count > 0 ? "inline-flex" : "none";
    }
  }

  function renderWorkspace() {
    updateNavBadges();
    const container = document.getElementById("unreportedCardsList");
    if (!container) return;

    if (!itemsList.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:48px 20px; text-align:center; color:var(--text-muted); font-size:12.5px;">
          <svg class="icon icon-lg" viewBox="0 0 24 24" style="margin-bottom:12px; opacity:0.4; color:var(--text-muted); width:36px; height:36px;" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div style="font-weight:600; color:var(--text-secondary); margin-bottom:4px;">No unreported items in holding area.</div>
          <div>Click <strong>+ Add Unreported</strong> above to quickly capture an agent violation.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = itemsList.map((item, itemIdx) => {
      const shots = Array.isArray(item.screenshots) ? item.screenshots : [];
      const shotCount = shots.length;
      let activeIdx = typeof item.activeShotIndex === "number" ? item.activeShotIndex : 0;
      if (activeIdx < 0 || activeIdx >= shotCount) activeIdx = 0;
      const activeShot = shots[activeIdx] || "";
      const isActiveCard = item.id === activeCardId;

      return `
        <article class="unreported-card ${isActiveCard ? "is-active-card" : ""}" data-item-id="${escapeHtml(item.id)}" tabindex="0">
          <div class="unreported-card-header">
            <div class="unreported-card-title-group">
              <span class="unreported-card-title">UNREPORTED ITEM</span>
              <span class="unreported-card-timestamp">Created: ${escapeHtml(formatDateTime(item.createdAt))}</span>
            </div>
            <span class="unreported-shot-count-badge">
              ${shotCount} ${shotCount === 1 ? "Screenshot" : "Screenshots"}
            </span>
          </div>

          <!-- Screenshots Evidence Area -->
          <div class="unreported-screenshot-section">
            ${shotCount === 0 ? `
              <div class="unreported-dropzone" data-item-id="${escapeHtml(item.id)}" tabindex="0" title="Click or drop screenshot">
                <svg class="icon" viewBox="0 0 24 24" style="color:var(--ws-unreported, #f59e0b); width:28px; height:28px; margin-bottom:6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <div style="font-size:12px; font-weight:600; color:var(--text-primary); margin-bottom:2px;">
                  Drop image, Ctrl+V, or click to add screenshot
                </div>
                <span style="font-size:10.5px; color:var(--text-muted);">Multiple screenshots supported</span>
                <input type="file" class="unreported-file-picker" multiple accept="image/*" hidden>
              </div>
            ` : `
              <div class="unreported-shots-container" data-item-id="${escapeHtml(item.id)}">
                <!-- Large Main Preview -->
                <div class="unreported-main-preview" data-item-id="${escapeHtml(item.id)}" title="Click to view full-resolution screenshot">
                  <img src="${escapeHtml(activeShot)}" alt="Violation Evidence Preview">
                  <div class="unreported-preview-overlay">
                    <span class="unreported-preview-badge">
                      <svg class="icon icon-xs" viewBox="0 0 24 24" style="width:12px; height:12px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                      <span>Click for full resolution (${activeIdx + 1}/${shotCount})</span>
                    </span>
                    <button type="button" class="unreported-main-del-btn" data-item-id="${escapeHtml(item.id)}" data-shot-idx="${activeIdx}" title="Remove this screenshot">✕</button>
                  </div>
                </div>

                <!-- Thumbnails Strip & Add More Button -->
                <div class="unreported-thumbs-strip" data-item-id="${escapeHtml(item.id)}">
                  ${shots.map((src, sIdx) => `
                    <div class="unreported-thumb-wrapper ${sIdx === activeIdx ? "is-active" : ""}" data-item-id="${escapeHtml(item.id)}" data-shot-idx="${sIdx}" title="Screenshot ${sIdx + 1}">
                      <img src="${escapeHtml(src)}" alt="Thumb ${sIdx + 1}">
                      <button type="button" class="unreported-thumb-del-btn" data-item-id="${escapeHtml(item.id)}" data-shot-idx="${sIdx}" title="Remove screenshot">✕</button>
                    </div>
                  `).join("")}
                  <button type="button" class="btn btn-outline btn-xs unreported-add-shot-btn" data-item-id="${escapeHtml(item.id)}" title="Add another screenshot">
                    <svg class="icon icon-xs" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>+ Add Screenshot</span>
                  </button>
                  <input type="file" class="unreported-file-picker" multiple accept="image/*" hidden>
                </div>
              </div>
            `}
          </div>

          <!-- Blue Iris Link -->
          <div class="form-group" style="margin: 4px 0 0 0;">
            <label class="form-label" style="font-size:11px; font-weight:600; color:var(--text-primary); margin-bottom:4px;">Blue Iris Link</label>
            <div class="unreported-link-row">
              <input type="url" class="form-control form-control-sm unreported-url-input" data-item-id="${escapeHtml(item.id)}" placeholder="Paste Blue Iris URL (http://... or https://...)" value="${escapeHtml(item.blueIrisUrl || "")}">
              <button type="button" class="btn btn-outline btn-sm unreported-open-link-btn" data-item-id="${escapeHtml(item.id)}" ${item.blueIrisUrl ? "" : "disabled"} style="white-space:nowrap; flex-shrink:0;">
                <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                <span>Open in Blue Iris</span>
              </button>
            </div>
          </div>

          <!-- Remarks -->
          <div class="form-group" style="margin: 4px 0 0 0;">
            <label class="form-label" style="font-size:11px; font-weight:600; color:var(--text-primary); margin-bottom:4px;">Remarks</label>
            <textarea class="form-control form-control-sm unreported-remarks-input" data-item-id="${escapeHtml(item.id)}" rows="4" placeholder="Enter violation details, timestamps, observed behaviors, notes before creating official report...">${escapeHtml(item.remarks || "")}</textarea>
          </div>

          <!-- Card Footer Actions -->
          <div class="unreported-card-footer">
            <button type="button" class="btn btn-primary btn-sm unreported-move-btn" data-item-id="${escapeHtml(item.id)}" style="gap:6px;">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
              <strong>Move to CCTV Report</strong>
            </button>
            <button type="button" class="btn btn-danger-ghost btn-sm unreported-delete-btn" data-item-id="${escapeHtml(item.id)}" style="gap:4px;">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>Delete</span>
            </button>
          </div>
        </article>
      `;
    }).join("");

    bindCardEvents(container);
  }

  function bindCardEvents(container) {
    // Card focus / selection
    container.querySelectorAll(".unreported-card").forEach(card => {
      const id = card.dataset.itemId;
      card.addEventListener("click", () => {
        activeCardId = id;
        container.querySelectorAll(".unreported-card").forEach(c => {
          c.classList.toggle("is-active-card", c.dataset.itemId === activeCardId);
        });
      });
      card.addEventListener("focusin", () => {
        activeCardId = id;
        container.querySelectorAll(".unreported-card").forEach(c => {
          c.classList.toggle("is-active-card", c.dataset.itemId === activeCardId);
        });
      });
    });

    // Dropzone click -> file picker
    container.querySelectorAll(".unreported-dropzone").forEach(dropzone => {
      const id = dropzone.dataset.itemId;
      const fileInput = dropzone.querySelector(".unreported-file-picker");
      dropzone.addEventListener("click", () => {
        activeCardId = id;
        fileInput?.click();
      });

      // Drag and drop onto empty dropzone
      ["dragenter", "dragover"].forEach(evType => dropzone.addEventListener(evType, ev => {
        ev.preventDefault();
        dropzone.classList.add("dragover");
      }));
      ["dragleave", "drop"].forEach(evType => dropzone.addEventListener(evType, ev => {
        ev.preventDefault();
        dropzone.classList.remove("dragover");
      }));
      dropzone.addEventListener("drop", async (ev) => {
        const item = itemsList.find(x => x.id === id);
        if (!item) return;
        const files = Array.from(ev.dataTransfer?.files || []).filter(f => f.type.startsWith("image/"));
        if (!files.length) return;
        for (const file of files) {
          const comp = await compressImage(file);
          item.screenshots.push(comp);
        }
        item.activeShotIndex = item.screenshots.length - 1;
        await saveItems(itemsList);
        renderWorkspace();
        if (typeof window.showToast === "function") {
          window.showToast(`${files.length} screenshot${files.length > 1 ? "s" : ""} added.`, "success");
        }
      });
    });

    // File input changes
    container.querySelectorAll(".unreported-file-picker").forEach(fileInput => {
      const card = fileInput.closest(".unreported-card");
      const id = card?.dataset.itemId;
      fileInput.addEventListener("change", async (e) => {
        const item = itemsList.find(x => x.id === id);
        if (!item) return;
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
        fileInput.value = "";
        if (!files.length) return;
        for (const file of files) {
          const comp = await compressImage(file);
          item.screenshots.push(comp);
        }
        item.activeShotIndex = item.screenshots.length - 1;
        await saveItems(itemsList);
        renderWorkspace();
        if (typeof window.showToast === "function") {
          window.showToast(`${files.length} screenshot${files.length > 1 ? "s" : ""} added.`, "success");
        }
      });
    });

    // Add screenshot button in populated card
    container.querySelectorAll(".unreported-add-shot-btn").forEach(btn => {
      const id = btn.dataset.itemId;
      const card = btn.closest(".unreported-card");
      const fileInput = card?.querySelector(".unreported-file-picker");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        activeCardId = id;
        fileInput?.click();
      });
    });

    // Drag and drop onto existing shots container / preview
    container.querySelectorAll(".unreported-main-preview").forEach(preview => {
      const id = preview.dataset.itemId;
      const item = itemsList.find(x => x.id === id);
      if (!item) return;

      // Click to open full-resolution viewer
      preview.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const activeIdx = typeof item.activeShotIndex === "number" ? item.activeShotIndex : 0;
        if (window.openFullScreenshotViewer) {
          window.openFullScreenshotViewer(item.screenshots, "Unreported Violation Evidence", `Evidence Preview (${activeIdx + 1}/${item.screenshots.length})`, activeIdx);
        } else if (window.openScreenshotViewer) {
          window.openScreenshotViewer(item.screenshots, "Unreported Violation Evidence", `Evidence Preview (${activeIdx + 1}/${item.screenshots.length})`, activeIdx);
        }
      });

      // Drag and drop onto preview
      ["dragenter", "dragover"].forEach(evType => preview.addEventListener(evType, ev => {
        ev.preventDefault();
        preview.style.borderColor = "var(--ws-unreported, #f59e0b)";
      }));
      ["dragleave", "drop"].forEach(evType => preview.addEventListener(evType, ev => {
        ev.preventDefault();
        preview.style.borderColor = "";
      }));
      preview.addEventListener("drop", async (ev) => {
        const files = Array.from(ev.dataTransfer?.files || []).filter(f => f.type.startsWith("image/"));
        if (!files.length) return;
        for (const file of files) {
          const comp = await compressImage(file);
          item.screenshots.push(comp);
        }
        item.activeShotIndex = item.screenshots.length - 1;
        await saveItems(itemsList);
        renderWorkspace();
        if (typeof window.showToast === "function") {
          window.showToast(`${files.length} screenshot${files.length > 1 ? "s" : ""} added.`, "success");
        }
      });
    });

    // Delete single shot from main preview overlay
    container.querySelectorAll(".unreported-main-del-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.itemId;
        const sIdx = parseInt(btn.dataset.shotIdx, 10);
        const item = itemsList.find(x => x.id === id);
        if (!item) return;
        item.screenshots.splice(sIdx, 1);
        item.activeShotIndex = Math.max(0, Math.min(item.activeShotIndex, item.screenshots.length - 1));
        await saveItems(itemsList);
        renderWorkspace();
        if (typeof window.showToast === "function") {
          window.showToast("Screenshot removed.", "info");
        }
      });
    });

    // Thumbnail selection
    container.querySelectorAll(".unreported-thumb-wrapper").forEach(thumb => {
      thumb.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        e.stopPropagation();
        const id = thumb.dataset.itemId;
        const sIdx = parseInt(thumb.dataset.shotIdx, 10);
        const item = itemsList.find(x => x.id === id);
        if (!item) return;
        item.activeShotIndex = sIdx;
        activeCardId = id;
        renderWorkspace();
      });
    });

    // Thumbnail individual delete
    container.querySelectorAll(".unreported-thumb-del-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.itemId;
        const sIdx = parseInt(btn.dataset.shotIdx, 10);
        const item = itemsList.find(x => x.id === id);
        if (!item) return;
        item.screenshots.splice(sIdx, 1);
        item.activeShotIndex = Math.max(0, Math.min(item.activeShotIndex, item.screenshots.length - 1));
        await saveItems(itemsList);
        renderWorkspace();
        if (typeof window.showToast === "function") {
          window.showToast("Screenshot removed.", "info");
        }
      });
    });

    // Blue Iris URL Input
    container.querySelectorAll(".unreported-url-input").forEach(input => {
      const id = input.dataset.itemId;
      const card = input.closest(".unreported-card");
      const openBtn = card?.querySelector(".unreported-open-link-btn");
      input.addEventListener("input", () => {
        const item = itemsList.find(x => x.id === id);
        if (!item) return;
        item.blueIrisUrl = input.value.trim();
        if (openBtn) openBtn.disabled = !item.blueIrisUrl;
        scheduleDebounceSave();
      });
    });

    // Open in Blue Iris button
    container.querySelectorAll(".unreported-open-link-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.itemId;
        const item = itemsList.find(x => x.id === id);
        const url = (item?.blueIrisUrl || "").trim();
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else if (typeof window.showToast === "function") {
          window.showToast("Please enter a Blue Iris URL first.", "warning");
        }
      });
    });

    // Remarks textarea
    container.querySelectorAll(".unreported-remarks-input").forEach(textarea => {
      const id = textarea.dataset.itemId;
      textarea.addEventListener("input", () => {
        const item = itemsList.find(x => x.id === id);
        if (!item) return;
        item.remarks = textarea.value;
        scheduleDebounceSave();
      });
    });

    // Move to CCTV Report button
    container.querySelectorAll(".unreported-move-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.itemId;
        await moveToCctvReport(id);
      });
    });

    // Delete block button
    container.querySelectorAll(".unreported-delete-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.itemId;
        const ok = window.appConfirm
          ? await window.appConfirm({
              title: "Delete this unreported item permanently?",
              message: "This will permanently delete this item and its stored evidence. This action cannot be undone.",
              confirmText: "Delete",
              tone: "danger"
            })
          : window.confirm("Delete this unreported item permanently?");
        if (!ok) return;

        itemsList = itemsList.filter(x => x.id !== id);
        if (activeCardId === id) activeCardId = "";
        await saveItems(itemsList);
        renderWorkspace();
        if (typeof window.showToast === "function") {
          window.showToast("Unreported item deleted.", "info");
        }
      });
    });
  }

  // Move to CCTV Report logic
  async function moveToCctvReport(id) {
    const item = itemsList.find(x => x.id === id);
    if (!item) return;

    // 1. Preserve exact current Unreported block data first
    const snapshot = JSON.parse(JSON.stringify(item));
    const rawUrl = (snapshot.blueIrisUrl || "").trim();

    // 5. Open Blue Iris in new tab directly from the user's click gesture (prevents popup block)
    if (rawUrl) {
      try {
        window.open(rawUrl, "_blank", "noopener,noreferrer");
      } catch (openErr) {
        console.warn("Could not open Blue Iris tab directly:", openErr);
      }
    }

    try {
      // Test hook for simulating failed handoff safety
      if (root.__simulateUnreportedHandoffFailure === true) {
        throw new Error("Simulated handoff failure for safety verification.");
      }

      if (!window.CCTV_REPORT_SERVICE) {
        throw new Error("CCTV Report service is not available.");
      }

      // 2, 3, 4. Transfer screenshots, remarks, and CCTV clip URL into CCTV Report
      let draft = window.CCTV_REPORT_SERVICE.getDraft();
      if (!draft) {
        draft = {
          greeting: "Good morning TLs,",
          observation: "",
          personInvolved: "",
          site: "Mabini Site A - Ground Floor",
          dateRange: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          clipUrl: "",
          screenshots: [],
          referencedPolicy: null,
          rawInput: ""
        };
      }

      // Transfer ALL screenshots in exact order
      draft.screenshots = Array.isArray(snapshot.screenshots) ? snapshot.screenshots.slice() : [];

      // Transfer Unreported remarks into Observation / Report Body exactly
      draft.observation = snapshot.remarks || "";

      // Transfer Blue Iris URL into CCTV Clip field
      if (rawUrl) {
        draft.clipUrl = rawUrl;
      }

      // Save draft into CCTV Report
      window.CCTV_REPORT_SERVICE.saveDraft(draft);

      // Sync state and DOM elements
      if (typeof window.setCctvReportDraft === "function") {
        window.setCctvReportDraft(draft);
      }
      if (typeof window.syncCctvReportFormFromDraft === "function") {
        window.syncCctvReportFormFromDraft();
      }
      if (typeof window.renderCctvReportScreenshots === "function") {
        window.renderCctvReportScreenshots();
      }
      if (typeof window.updateCctvReportPreview === "function") {
        window.updateCctvReportPreview();
      }

      // 6. Navigate CCTV OPS to CCTV Report workspace
      if (typeof window.switchWorkspace === "function") {
        window.switchWorkspace("report");
      }

      // 7. DELETE the source Unreported block automatically ONLY AFTER transfer succeeded
      itemsList = itemsList.filter(x => x.id !== id);
      if (activeCardId === id) activeCardId = "";
      await saveItems(itemsList);
      renderWorkspace();

      if (typeof window.showToast === "function") {
        window.showToast("Moved to CCTV Report successfully.", "success");
      }
    } catch (err) {
      console.error("Move to CCTV Report failed:", err);
      if (typeof window.showToast === "function") {
        window.showToast("Failed to move to CCTV Report. Original item preserved.", "error");
      }
      // CRITICAL SAFETY: Item remains in itemsList and storage!
    }
  }

  // Central Paste Router Handler for Unreported workspace
  async function handlePaste(imageFiles, e) {
    if (!imageFiles || !imageFiles.length) return;
    const imageFile = imageFiles[0];

    try {
      if (typeof window.showToast === "function") {
        window.showToast("Processing pasted screenshot...", "info");
      }
      const compressed = await compressImage(imageFile);

      const target = e?.target;
      const cardEl = target?.closest ? target.closest(".unreported-card") : null;
      let targetItem = null;

      if (cardEl && cardEl.dataset.itemId) {
        targetItem = itemsList.find(x => x.id === cardEl.dataset.itemId);
      }
      if (!targetItem && activeCardId) {
        targetItem = itemsList.find(x => x.id === activeCardId);
      }
      if (!targetItem && itemsList.length > 0) {
        targetItem = itemsList[0];
      }

      // If no items exist, automatically create one with this screenshot
      if (!targetItem) {
        targetItem = createItem({ screenshots: [compressed] });
        itemsList.unshift(targetItem);
        activeCardId = targetItem.id;
        await saveItems(itemsList);
        renderWorkspace();
        if (typeof window.showToast === "function") {
          window.showToast("Created new unreported item with pasted screenshot.", "success");
        }
        return;
      }

      if (!Array.isArray(targetItem.screenshots)) targetItem.screenshots = [];
      targetItem.screenshots.push(compressed);
      targetItem.activeShotIndex = targetItem.screenshots.length - 1;
      activeCardId = targetItem.id;
      await saveItems(itemsList);
      renderWorkspace();
      if (typeof window.showToast === "function") {
        window.showToast("Screenshot added from clipboard.", "success");
      }
    } catch (err) {
      console.error("Paste error in Unreported:", err);
      if (typeof window.showToast === "function") {
        window.showToast(err.message || "Could not paste screenshot.", "error");
      }
    }
  }

  function initGlobalPaste() {
    if (window.CCTV_PASTE_ROUTER) {
      window.CCTV_PASTE_ROUTER.register("unreported", handlePaste);
    }
  }

  async function init() {
    if (isInitialized) return;
    isInitialized = true;

    try {
      itemsList = await loadItems();
    } catch (e) {
      console.warn("Could not load initial unreported items:", e);
      itemsList = [];
    }

    // Bind Top Button "+ Add Unreported"
    const btnAdd = document.getElementById("btnAddUnreported");
    if (btnAdd) {
      btnAdd.addEventListener("click", async () => {
        const newItem = createItem();
        itemsList.unshift(newItem);
        activeCardId = newItem.id;
        await saveItems(itemsList);
        renderWorkspace();

        // Scroll top card into view
        const container = document.getElementById("unreportedCardsList");
        const firstCard = container?.querySelector(".unreported-card");
        if (firstCard) {
          firstCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        if (typeof window.showToast === "function") {
          window.showToast("New unreported item added.", "info");
        }
      });
    }

    initGlobalPaste();
    renderWorkspace();
  }

  const unreportedService = {
    DB_NAME,
    STORE_NAME,
    STATE_KEY,
    openDb,
    loadItems,
    saveItems,
    compressImage,
    createItem,
    moveToCctvReport,
    renderWorkspace,
    handlePaste,
    init,
    getItems() {
      return itemsList;
    },
    onChange(fn) {
      if (typeof fn === "function") changeListeners.push(fn);
      return () => {
        const idx = changeListeners.indexOf(fn);
        if (idx !== -1) changeListeners.splice(idx, 1);
      };
    }
  };

  // Register history adapter
  root.__workspaceHistoryAdapters = root.__workspaceHistoryAdapters || {};
  const unreportedAdapter = {
    label: "Unreported Items",
    async snapshot() {
      return await loadItems();
    },
    async restore(snapshot) {
      const restored = Array.isArray(snapshot) ? clone(snapshot) : [];
      await saveItems(restored);
      itemsList = restored;
      renderWorkspace();
      return restored;
    }
  };
  root.__workspaceHistoryAdapters.unreportedItems = unreportedAdapter;
  root.__workspaceHistoryAdapters.unreported = unreportedAdapter;

  root.unreportedService = unreportedService;
  root.CCTV_UNREPORTED = unreportedService;
})(window);
