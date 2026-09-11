/**
 * CCTV OPS V2 - Maintenance Service
 * Authoritative 1:1 Functional Parity with V1 Maintenance Report
 * Multi-block incident reports, side-by-side incident/remarks,
 * per-block screenshot upload/paste/preview, IndexedDB continuous autosave,
 * named drafts, chunked Google Sheets Apps Script sync, and PDF export.
 */
(function (root) {
  "use strict";

  const DB_NAME = "maintenance_report_db";
  const DB_VERSION = 2;
  const STORE = "drafts";
  const NAMED_STORE = "namedDrafts";
  const DRAFT_KEY = "current";

  const MAINTENANCE_SHEETS_WEB_APP_KEY = "maintenance_google_sheets_web_app_url_v1";

  const MAINTENANCE_DESTINATIONS = {
    mabini_a: {
      label: "Mabini Site A - 1st & 2nd Floor",
      sheetId: 484781158
    },
    mabini_b: {
      label: "Mabini Site B - 2nd, 3rd & 4th Floor",
      sheetId: 1670996421
    },
    gensan: {
      label: "Gensan Site",
      sheetId: 219168917
    },
    maa_4_5: {
      label: "MAA 4th & 5th Floor",
      sheetId: 0
    },
    maa_6: {
      label: "MAA 6th Floor",
      sheetId: 11380648
    },
    digos: {
      label: "Digos Site",
      sheetId: 1812673001
    },
    ecoland: {
      label: "Ecoland Site",
      sheetId: 429979469
    },
    cdo: {
      label: "CDO Site",
      sheetId: 1535793826
    }
  };

  function uid() {
    return "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function makeBlock() {
    return {
      id: uid(),
      lanesText: "",
      remarks: [""],
      screenshots: [],
      dataHidden: false
    };
  }

  function todayLocal() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function getMaintenanceSheetsWebAppUrl() {
    return String(localStorage.getItem(MAINTENANCE_SHEETS_WEB_APP_KEY) || "").trim();
  }

  function saveMaintenanceSheetSetup(url) {
    const cleanUrl = String(url || "").trim();
    localStorage.setItem(MAINTENANCE_SHEETS_WEB_APP_KEY, cleanUrl);
  }

  function clearMaintenanceSheetSetup() {
    localStorage.removeItem(MAINTENANCE_SHEETS_WEB_APP_KEY);
  }

  function isValidAppsScriptWebAppUrl(value) {
    const url = String(value || "").trim();
    return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/i.test(url);
  }

  function detectMaintenanceDestinationFromRows(text) {
    if (!text) return null;
    const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const cols = line.split("\t").map(c => c.trim());
      const siteVal = (cols.length >= 5 ? cols[4] : "").toLowerCase();
      if (siteVal) {
        if (siteVal.includes("digos")) return "digos";
        if (siteVal.includes("gensan")) return "gensan";
        if (siteVal.includes("ecoland")) return "ecoland";
        if (siteVal.includes("cdo")) return "cdo";
        if (siteVal.includes("maa 6") || siteVal.includes("maa site 6") || siteVal.includes("maa 6th")) return "maa_6";
        if (siteVal.includes("maa 4") || siteVal.includes("maa 5") || siteVal.includes("maa 4f") || siteVal.includes("maa 5f") || siteVal.includes("maa 4th") || siteVal.includes("maa 5th")) return "maa_4_5";
        if (siteVal.includes("mabini site b") || siteVal.includes("mabini b")) return "mabini_b";
        if (siteVal.includes("mabini site a") || siteVal.includes("mabini a")) return "mabini_a";
      }
    }
    return null;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(NAMED_STORE)) {
          db.createObjectStore(NAMED_STORE, { keyPath: "id" });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveDraft(state) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(state, DRAFT_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async function loadDraft() {
    let draft = null;
    try {
      const db = await openDb();
      try {
        draft = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get(DRAFT_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    } catch (e) {
      console.warn("Could not load maintenance draft from IndexedDB", e);
    }

    if (draft && typeof draft === "object") {
      if (Array.isArray(draft.blocks)) {
        draft.blocks = draft.blocks.map(block => {
          const existingRemarks = Array.isArray(block.remarks)
            ? block.remarks
            : (block.customNote ? [block.customNote] : [""]);

          return {
            id: block.id || uid(),
            lanesText: block.lanesText || "",
            remarks: existingRemarks.length ? existingRemarks : [""],
            screenshots: Array.isArray(block.screenshots) ? block.screenshots : [],
            dataHidden: !!block.dataHidden
          };
        });
      }
      return draft;
    }

    return {
      date: todayLocal(),
      destinationKey: "mabini_a",
      title: "Mabini Site A - 1st & 2nd Floor",
      blocks: [makeBlock()]
    };
  }

  async function clearAllDraft() {
    try {
      const db = await openDb();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(DRAFT_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    } catch (e) {
      console.warn("Could not clear maintenance draft from IndexedDB", e);
    }

    return {
      date: todayLocal(),
      destinationKey: "mabini_a",
      title: "Mabini Site A - 1st & 2nd Floor",
      blocks: [makeBlock()]
    };
  }

  async function saveNamedDraft(name, state) {
    const record = {
      id: "draft_" + Date.now(),
      name: String(name || "").trim() || `${state.title || "Maintenance Report"} - ${state.date || todayLocal()}`,
      savedAt: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(state)),
      data: JSON.parse(JSON.stringify(state))
    };

    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(NAMED_STORE, "readwrite");
        tx.objectStore(NAMED_STORE).put(record);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    return record;
  }

  async function getNamedDrafts() {
    const db = await openDb();
    try {
      const drafts = await new Promise((resolve, reject) => {
        const tx = db.transaction(NAMED_STORE, "readonly");
        const req = tx.objectStore(NAMED_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      return drafts
        .map(d => ({
          ...d,
          state: d.state || d.data,
          data: d.data || d.state
        }))
        .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    } finally {
      db.close();
    }
  }

  async function loadNamedDraft(idOrRecord) {
    const id = typeof idOrRecord === "object" && idOrRecord !== null ? idOrRecord.id : idOrRecord;
    const db = await openDb();
    try {
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(NAMED_STORE, "readonly");
        const req = tx.objectStore(NAMED_STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (!record) return null;
      return {
        ...record,
        state: record.state || record.data,
        data: record.data || record.state
      };
    } finally {
      db.close();
    }
  }

  async function deleteNamedDraft(idOrRecord) {
    const id = typeof idOrRecord === "object" && idOrRecord !== null ? idOrRecord.id : idOrRecord;
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(NAMED_STORE, "readwrite");
        tx.objectStore(NAMED_STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxWidth = 900;
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.65));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function compressBase64(dataUrl, maxWidth = 960, maxHeight = 680, quality = 0.62) {
    const raw = String(dataUrl || "");
    if (!/^data:image\//i.test(raw)) return raw;

    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not prepare image"));
        image.src = raw;
      });

      const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      return canvas.toDataURL("image/jpeg", quality);
    } catch (e) {
      console.warn("Base64 compression fallback", e);
      return raw;
    }
  }

  function maintenanceScreenshotSource(shot) {
    if (!shot) return "";
    if (typeof shot === "string") return shot;

    const candidates = [
      shot.dataUrl,
      shot.src,
      shot.imageData,
      shot.url,
      shot.preview,
      shot.data,
      shot.content
    ];

    return String(candidates.find(value => /^data:image\//i.test(String(value || ""))) || "");
  }

  function maintenanceRowsForSheets(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split("\t");
        while (parts.length < 7) parts.push("");
        return parts.slice(0, 7);
      });
  }

  function buildMaintenanceSheetsPayload(state) {
    const destKey = state.destinationKey || "mabini_a";
    const destInfo = MAINTENANCE_DESTINATIONS[destKey] || MAINTENANCE_DESTINATIONS.mabini_a;

    const blocks = (state.blocks || []).map((block, index) => ({
      blockNumber: index + 1,
      rows: maintenanceRowsForSheets(block.lanesText || ""),
      screenshots: Array.isArray(block.screenshots)
        ? block.screenshots.map(maintenanceScreenshotSource).filter(Boolean)
        : [],
      remarks: Array.isArray(block.remarks)
        ? block.remarks.map(item => String(item || "").trim()).filter(Boolean)
        : []
    }));

    return {
      action: "appendMaintenanceReport",
      submissionId: `maintenance_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      destinationKey: destKey,
      sheetId: destInfo.sheetId,
      reportTitle: destInfo.label,
      reportDate: state.date || todayLocal(),
      date: state.date || todayLocal(),
      sentAt: new Date().toISOString(),
      blocks,
      rows: blocks.flatMap(b => b.rows),
      screenshots: blocks.flatMap(b => b.screenshots),
      remarks: blocks.flatMap(b => b.remarks)
    };
  }

  function maintenanceJsonp(url, params = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const callbackName = `__maintenanceSheetsCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      let settled = false;

      const cleanup = () => {
        try { delete window[callbackName]; } catch {}
        script.remove();
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Connection timed out."));
      }, timeoutMs);

      window[callbackName] = data => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(data || {});
      };

      const target = new URL(url);
      Object.entries(params || {}).forEach(([key, value]) => {
        target.searchParams.set(key, String(value ?? ""));
      });
      target.searchParams.set("callback", callbackName);
      target.searchParams.set("_", String(Date.now()));

      script.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error("Could not reach the Apps Script receiver."));
      };

      script.src = target.toString();
      document.head.appendChild(script);
    });
  }

  async function testMaintenanceSheetsConnection(url, destKey = "mabini_a") {
    if (!isValidAppsScriptWebAppUrl(url)) {
      throw new Error("Invalid Apps Script Web App URL ending in /exec.");
    }
    const data = await maintenanceJsonp(url, { action: "health", destinationKey: destKey }, 30000);
    if (!data || data.ok !== true) {
      throw new Error(data?.error || "Receiver health check failed.");
    }
    return data;
  }

  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(String(text || ""));
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return btoa(binary);
  }

  async function uploadMaintenanceChunks(url, submissionId, chunks, onProgress) {
    const concurrency = 4;
    let nextIndex = 0;
    let completed = 0;

    async function worker() {
      while (true) {
        const index = nextIndex++;
        if (index >= chunks.length) return;

        const response = await maintenanceJsonp(url, {
          action: "uploadChunk",
          submissionId,
          index,
          total: chunks.length,
          data: chunks[index]
        }, 30000);

        if (!response?.ok) {
          throw new Error(response?.error || `Chunk ${index + 1} upload failed.`);
        }

        completed++;
        if (typeof onProgress === "function") {
          onProgress(completed, chunks.length);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker())
    );
  }

  async function sendMaintenanceReportToGoogleSheets(url, state, onProgress) {
    if (!isValidAppsScriptWebAppUrl(url)) {
      throw new Error("Invalid Google Sheets Apps Script Web App URL.");
    }

    const payload = buildMaintenanceSheetsPayload(state);
    const rowCount = payload.blocks.reduce((sum, b) => sum + b.rows.length, 0);
    if (!rowCount) {
      throw new Error("No maintenance data to send. Paste lanes/data first.");
    }

    // Compress screenshots in payload
    for (const block of payload.blocks) {
      if (Array.isArray(block.screenshots)) {
        for (let i = 0; i < block.screenshots.length; i++) {
          block.screenshots[i] = await compressBase64(block.screenshots[i]);
        }
      }
    }

    const encoded = utf8ToBase64(JSON.stringify(payload));
    const chunkSize = 4200;
    const chunks = [];

    for (let i = 0; i < encoded.length; i += chunkSize) {
      chunks.push(encoded.slice(i, i + chunkSize));
    }

    if (!chunks.length) throw new Error("Nothing to send.");

    await uploadMaintenanceChunks(url, payload.submissionId, chunks, onProgress);

    const committed = await maintenanceJsonp(url, {
      action: "commit",
      submissionId: payload.submissionId,
      total: chunks.length
    }, 90000);

    if (!committed?.ok || committed?.state !== "success") {
      throw new Error(committed?.error || `Receiver state: ${committed?.state || "unknown"}.`);
    }

    return committed;
  }

  function maintenanceReportPlainTextForSheets(state) {
    const cleanTitle = String(state.title || "Mabini Site A - 1st & 2nd Floor")
      .replace(/\s*Maintenance\s+Report\s*$/i, "")
      .trim();
    const dateText = state.date || todayLocal();
    const titleLine = `${cleanTitle} (${dateText})`;

    const headers = [
      "TIMESTAMP",
      "DATE",
      "TL",
      "ACCOUNT",
      "SITE",
      "STATION NO.",
      "STATION ISSUE"
    ].join("\t");

    const lines = [titleLine, headers];

    state.blocks.forEach((block, blockIndex) => {
      const rows = maintenanceRowsForSheets(block.lanesText || "");
      rows.forEach(row => lines.push(row.join("\t")));

      const remarks = Array.isArray(block.remarks) ? block.remarks.filter(Boolean) : [];
      if (remarks.length) {
        lines.push(`Remarks:\t${remarks.join(" | ")}`);
      }
      if (blockIndex < state.blocks.length - 1) {
        lines.push("");
      }
    });

    return lines.join("\n");
  }

  function maintenanceReportHtmlForSheets(state) {
    const cleanTitle = String(state.title || "Mabini Site A - 1st & 2nd Floor")
      .replace(/\s*Maintenance\s+Report\s*$/i, "")
      .trim();
    const dateText = state.date || todayLocal();
    const titleLine = `${cleanTitle} (${dateText})`;

    const headers = [
      "TIMESTAMP",
      "DATE",
      "TL",
      "ACCOUNT",
      "SITE",
      "STATION NO.",
      "STATION ISSUE"
    ];

    const esc = value => String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const headerCells = headers.map(h => `
      <th style="border:1px solid #d0d7de; padding:6px 8px; background:#31495f; color:#ffffff; font-family:Arial,sans-serif; font-size:11px; font-weight:700; text-align:center;">
        ${esc(h)}
      </th>
    `).join("");

    const blockHtml = state.blocks.map((block, blockIndex) => {
      const rows = maintenanceRowsForSheets(block.lanesText || "");
      const screenshots = Array.isArray(block.screenshots) ? block.screenshots : [];
      const remarks = Array.isArray(block.remarks) ? block.remarks.filter(Boolean) : [];

      const imageRow = screenshots.length ? `
        <tr class="maintenance-pdf-image-row" style="page-break-inside:avoid;">
          <td colspan="7" style="padding:8px 4px; border:0; background:#ffffff; text-align:left;">
            <div style="white-space:nowrap;">
              ${screenshots.map((shot, shotIdx) => `
                <img src="${esc(maintenanceScreenshotSource(shot))}" alt="CCTV Screenshot ${shotIdx + 1}" style="display:inline-block; width:220px; height:132px; object-fit:contain; vertical-align:top; margin:0 8px 6px 0; background:#ffffff;">
              `).join("")}
            </div>
          </td>
        </tr>
      ` : "";

      const remarksRow = remarks.length ? `
        <tr class="maintenance-pdf-remarks-row" style="page-break-inside:avoid;">
          <td colspan="7" style="border:0; border-left:4px solid #278914; padding:7px 9px; background:#f5faf3; color:#1f3b24; font-family:Arial,sans-serif; font-size:10px; text-align:left;">
            <strong style="color:#278914;">Remarks:</strong>
            ${remarks.map(item => `<div>${esc(item)}</div>`).join("")}
          </td>
        </tr>
      ` : "";

      const blockLabel = state.blocks.length > 1
        ? `<div style="font-family:Arial,sans-serif; font-size:12px; font-weight:700; color:#31495f; padding:8px 0 4px 0;">Block #${blockIndex + 1}</div>`
        : "";

      const dataRows = rows.map(row => `
          <tr style="page-break-inside:avoid;">
            ${row.map((cell, idx) => `
              <td style="border:1px solid #e5e7eb; padding:5px 7px; background:#ffffff; color:#202124; font-family:Arial,sans-serif; font-size:10px; vertical-align:top; ${idx === 6 ? "text-align:left;" : "text-align:center;"}">
                ${esc(cell)}
              </td>
            `).join("")}
          </tr>
        `).join("");

      return `
        <div class="maintenance-pdf-block" style="margin-bottom:16px;">
          ${blockLabel}
          <table class="maintenance-pdf-table" style="border-collapse:collapse; width:100%; background:#ffffff; page-break-inside:auto;">
            <thead style="display:table-header-group;">
              <tr style="page-break-inside:avoid;">${headerCells}</tr>
            </thead>
            <tbody style="display:table-row-group;">
              ${dataRows}
              ${imageRow}
              ${remarksRow}
            </tbody>
          </table>
        </div>
      `;
    }).join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @media print {
              thead { display: table-header-group !important; }
              tbody { display: table-row-group !important; }
              tr { page-break-inside: avoid !important; }
              .maintenance-pdf-image-row { page-break-inside: avoid !important; }
              .maintenance-pdf-remarks-row { page-break-inside: avoid !important; }
              .maintenance-pdf-block { page-break-inside: auto; }
            }
            @page { size: A4 landscape; margin: 1in; }
            body { margin: 0; padding: 0; background: #ffffff; }
            table { border-collapse: collapse; width: 100%; }
            thead { display: table-header-group; }
            tbody { display: table-row-group; }
            tr { page-break-inside: avoid; }
            .maintenance-pdf-image-row { page-break-inside: avoid; }
            .maintenance-pdf-remarks-row { page-break-inside: avoid; }
          </style>
        </head>
        <body style="margin:0; padding:10px; background:#ffffff;">
          <div style="padding:0 0 10px 0; color:#111827; font-family:Arial,sans-serif; font-size:16px; font-weight:700; text-align:left;">
            ${esc(titleLine)}
          </div>
          ${blockHtml}
        </body>
      </html>
    `;
  }

  const maintenanceService = {
    DB_NAME,
    DB_VERSION,
    STORE,
    NAMED_STORE,
    DRAFT_KEY,
    MAINTENANCE_DESTINATIONS,
    uid,
    makeBlock,
    todayLocal,
    getMaintenanceSheetsWebAppUrl,
    saveMaintenanceSheetSetup,
    clearMaintenanceSheetSetup,
    isValidAppsScriptWebAppUrl,
    detectMaintenanceDestinationFromRows,
    saveDraft,
    loadDraft,
    clearAllDraft,
    saveNamedDraft,
    getNamedDrafts,
    loadNamedDraft,
    deleteNamedDraft,
    compressImage,
    compressBase64,
    maintenanceScreenshotSource,
    maintenanceRowsForSheets,
    buildMaintenanceSheetsPayload,
    testMaintenanceSheetsConnection,
    sendMaintenanceReportToGoogleSheets,
    maintenanceReportPlainTextForSheets,
    maintenanceReportHtmlForSheets,
    getBlocks() {
      if (Array.isArray(root.maintenanceService?._currentBlocks)) {
        return root.maintenanceService._currentBlocks.map(b => ({ ...b }));
      }
      return [];
    },
    async saveBlocks(blocks) {
      if (root.maintenanceService) {
        root.maintenanceService._currentBlocks = Array.isArray(blocks) ? blocks.map(b => ({ ...b })) : [];
      }
      const draft = await loadDraft();
      draft.blocks = Array.isArray(blocks) ? blocks.map(b => ({ ...b })) : [];
      await saveDraft(draft);
      return draft.blocks;
    }
  };

  root.maintenanceService = maintenanceService;
})(window);

