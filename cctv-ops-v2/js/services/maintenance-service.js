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

  const DEFAULT_QUICK_REMARKS = [
    "Maintenance observed wiping these lanes.",
    "Maintenance observed sweeping in these lanes.",
    "No maintenance observed wiping in these stations."
  ];
  const QUICK_REMARKS_STORAGE_KEY = "cctv_maintenance_quick_remarks_v1";

  function uid() {
    return "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function getQuickRemarks() {
    try {
      const raw = localStorage.getItem(QUICK_REMARKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.map(s => String(s || "").trim()).filter(Boolean);
          if (clean.length > 0) {
            return clean;
          }
        }
      }
    } catch (e) {
      console.warn("Could not load custom quick remarks", e);
    }
    return [...DEFAULT_QUICK_REMARKS];
  }

  function saveQuickRemarks(list) {
    try {
      localStorage.setItem(QUICK_REMARKS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Could not save quick remarks", e);
    }
  }

  function addQuickRemark(text) {
    const clean = String(text || "").trim();
    if (!clean) return { ok: false, error: "Choice cannot be empty." };
    const current = getQuickRemarks();
    const exists = current.some(item => item.toLowerCase() === clean.toLowerCase());
    if (exists) {
      return { ok: false, error: "This choice already exists." };
    }
    current.push(clean);
    saveQuickRemarks(current);
    return { ok: true, list: current };
  }

  function deleteQuickRemark(text) {
    const clean = String(text || "").trim();
    if (DEFAULT_QUICK_REMARKS.includes(clean)) {
      return { ok: false, error: "Default choices cannot be deleted." };
    }
    const current = getQuickRemarks().filter(item => item !== clean);
    saveQuickRemarks(current);
    return { ok: true, list: current };
  }

  function restoreDefaultQuickRemarks() {
    saveQuickRemarks([...DEFAULT_QUICK_REMARKS]);
    return [...DEFAULT_QUICK_REMARKS];
  }

  function getEffectiveBlockRemarks(block) {
    if (!block) return [];
    const manual = Array.isArray(block.remarks)
      ? block.remarks.map(item => String(item || "").trim()).filter(Boolean)
      : (String(block.remarks || "").trim() ? [String(block.remarks).trim()] : []);

    if (manual.length > 0) {
      return manual;
    }

    const preset = String(block.selectedPreset || "").trim();
    if (preset) {
      return [preset];
    }

    return [];
  }

  function makeBlock() {
    return {
      id: uid(),
      lanesText: "",
      remarks: [""],
      screenshots: [],
      dataHidden: false,
      selectedPreset: ""
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
            dataHidden: !!block.dataHidden,
            selectedPreset: String(block.selectedPreset || "").trim()
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
      remarks: getEffectiveBlockRemarks(block)
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

  async function maintenanceJsonpWithRetry(
    url,
    params,
    timeoutMs = 60000,
    attempts = 3
  ) {
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await maintenanceJsonp(
          url,
          params,
          timeoutMs
        );
      } catch (error) {
        lastError = error;

        if (attempt >= attempts) {
          throw error;
        }

        const delay =
          attempt === 1
            ? 1500
            : 3000;

        await new Promise(resolve =>
          setTimeout(resolve, delay)
        );
      }
    }

    throw lastError || new Error("Upload failed.");
  }

  async function uploadMaintenanceChunks(url, submissionId, chunks, onProgress) {
    const concurrency = 2;
    let nextIndex = 0;
    let completed = 0;

    async function worker() {
      while (true) {
        const index = nextIndex++;
        if (index >= chunks.length) return;

        const response = await maintenanceJsonpWithRetry(url, {
          action: "uploadChunk",
          submissionId,
          index,
          total: chunks.length,
          data: chunks[index]
        }, 60000, 3);

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

  async function uploadEncodedMaintenancePayload(
    url,
    transportId,
    payload,
    onProgress,
    commitTimeout = 240000
  ) {
    const encoded = utf8ToBase64(
      JSON.stringify(payload)
    );

    const chunkSize = 4200;
    const chunks = [];

    for (
      let i = 0;
      i < encoded.length;
      i += chunkSize
    ) {
      chunks.push(
        encoded.slice(
          i,
          i + chunkSize
        )
      );
    }

    if (!chunks.length) {
      throw new Error(
        "Nothing to send."
      );
    }

    await uploadMaintenanceChunks(
      url,
      transportId,
      chunks,
      onProgress
    );

    return maintenanceJsonp(
      url,
      {
        action: "commit",
        submissionId: transportId,
        total: chunks.length
      },
      commitTimeout
    );
  }


  async function buildMaintenanceEvidencePayload(
    sourcePayload
  ) {
    const evidenceBlocks = [];

    for (
      const block of sourcePayload.blocks || []
    ) {
      const screenshots =
        Array.isArray(block.screenshots)
          ? block.screenshots
          : [];

      const compressed = [];

      for (
        let i = 0;
        i < screenshots.length;
        i++
      ) {
        compressed.push(
          await compressBase64(
            screenshots[i]
          )
        );
      }

      evidenceBlocks.push({
        blockNumber:
          block.blockNumber,
        screenshots:
          compressed
      });
    }

    return {
      action:
        "attachMaintenanceEvidence",

      submissionId:
        sourcePayload.submissionId,

      destinationKey:
        sourcePayload.destinationKey,

      blocks:
        evidenceBlocks
    };
  }


  async function sendMaintenanceReportToGoogleSheets(
    url,
    state,
    onProgress
  ) {
    if (
      !isValidAppsScriptWebAppUrl(url)
    ) {
      throw new Error(
        "Invalid Google Sheets Apps Script Web App URL."
      );
    }

    const payload =
      buildMaintenanceSheetsPayload(
        state
      );

    const rowCount =
      payload.blocks.reduce(
        (sum, block) =>
          sum +
          block.rows.length,
        0
      );

    if (!rowCount) {
      throw new Error(
        "No maintenance data to send. Paste lanes/data first."
      );
    }


    // ========================================================
    // PHASE 1
    // FAST REPORT COMMIT
    //
    // Do NOT send image data yet.
    // Only rows, remarks, and screenshot counts are sent.
    // ========================================================

    const fastPayload = {
      action:
        "appendMaintenanceReportFast",

      submissionId:
        payload.submissionId,

      destinationKey:
        payload.destinationKey,

      sheetId:
        payload.sheetId,

      reportTitle:
        payload.reportTitle,

      reportDate:
        payload.reportDate,

      date:
        payload.date,

      sentAt:
        payload.sentAt,

      blocks:
        payload.blocks.map(
          block => ({
            blockNumber:
              block.blockNumber,

            rows:
              block.rows,

            remarks:
              block.remarks,

            screenshotCount:
              Array.isArray(
                block.screenshots
              )
                ? block.screenshots.length
                : 0
          })
        )
    };


    const fastTransportId =
      payload.submissionId +
      "_fast";


    const committed =
      await uploadEncodedMaintenancePayload(
        url,
        fastTransportId,
        fastPayload,
        onProgress,
        120000
      );


    if (
      !committed?.ok ||
      committed?.state !==
        "success"
    ) {
      throw new Error(
        committed?.error ||
        `Receiver state: ${
          committed?.state ||
          "unknown"
        }.`
      );
    }


    const screenshotCount =
      payload.blocks.reduce(
        (total, block) =>
          total +
          (
            Array.isArray(
              block.screenshots
            )
              ? block.screenshots.length
              : 0
          ),
        0
      );


    // ========================================================
    // PHASE 2
    // BACKGROUND SCREENSHOT UPLOAD
    //
    // Do NOT await this.
    // The report is already visible in Google Sheets.
    // ========================================================

    if (screenshotCount > 0) {
      Promise.resolve()
        .then(async () => {

          const evidencePayload =
            await buildMaintenanceEvidencePayload(
              payload
            );

          const evidenceTransportId =
            payload.submissionId +
            "_evidence";

          const evidenceResult =
            await uploadEncodedMaintenancePayload(
              url,
              evidenceTransportId,
              evidencePayload,
              null,
              240000
            );

          if (
            !evidenceResult?.ok ||
            evidenceResult?.state !==
              "success"
          ) {
            throw new Error(
              evidenceResult?.error ||
              "Background screenshot upload failed."
            );
          }

          console.info(
            "[Maintenance Fast Send] Screenshot evidence upload complete.",
            evidenceResult
          );

          if (
            typeof window.showToast ===
            "function"
          ) {
            window.showToast(
              `Maintenance evidence upload complete (${screenshotCount} screenshot${screenshotCount === 1 ? "" : "s"}).`,
              "success"
            );
          }

          if (
            typeof window.onMaintenanceEvidenceComplete ===
            "function"
          ) {
            window.onMaintenanceEvidenceComplete(screenshotCount);
          }

        })
        .catch(error => {

          console.error(
            "[Maintenance Fast Send] Background evidence upload failed:",
            error
          );

          if (
            typeof window.showToast ===
            "function"
          ) {
            window.showToast(
              "Maintenance report was sent, but screenshot evidence is still pending. Please keep this page open and retry if needed.",
              "warning"
            );
          }

          if (
            typeof window.onMaintenanceEvidenceError ===
            "function"
          ) {
            window.onMaintenanceEvidenceError(error);
          }

        });
    }


    return {
      ...committed,

      fastSend:
        true,

      submissionId:
        payload.submissionId,

      screenshotCount:
        screenshotCount,

      evidencePending:
        screenshotCount > 0
    };
  }

  function maintenanceReportPlainTextForSheets(state) {
    const s = state || {};
    const cleanTitle = String(s.title || "Mabini Site A - 1st & 2nd Floor")
      .replace(/\s*Maintenance\s+Report\s*$/i, "")
      .trim();
    const dateText = s.date || todayLocal();
    const titleLine = `${cleanTitle} (${dateText})`;
    const blocks = Array.isArray(s.blocks) ? s.blocks : [];

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

    blocks.forEach((block, blockIndex) => {
      const rows = maintenanceRowsForSheets(block.lanesText || "");
      rows.forEach(row => lines.push(row.join("\t")));

      const remarks = getEffectiveBlockRemarks(block);
      if (remarks.length) {
        lines.push(`Remarks:\t${remarks.join(" | ")}`);
      }
      if (blockIndex < blocks.length - 1) {
        lines.push("");
      }
    });

    return lines.join("\n");
  }

  function maintenanceReportHtmlForSheets(state) {
    const s = state || {};
    const cleanTitle = String(s.title || "Mabini Site A - 1st & 2nd Floor")
      .replace(/\s*Maintenance\s+Report\s*$/i, "")
      .trim();
    const dateText = s.date || todayLocal();
    const titleLine = `${cleanTitle} (${dateText})`;
    const blocks = Array.isArray(s.blocks) ? s.blocks : [];

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

    const blockHtml = blocks.map((block, blockIndex) => {
      const rows = maintenanceRowsForSheets(block.lanesText || "");
      const screenshots = Array.isArray(block.screenshots) ? block.screenshots : [];
      const remarks = getEffectiveBlockRemarks(block);
      const blockLabel = "";

      const dataRows = rows.map(row => `
        <tr style="page-break-inside:avoid; break-inside:avoid;">
          ${row.map((cell, idx) => `
            <td style="border:1px solid #e5e7eb; padding:5px 7px; background:#ffffff; color:#202124; font-family:Arial,sans-serif; font-size:10px; vertical-align:top; ${idx === 6 ? "text-align:left;" : "text-align:center;"}">
              ${esc(cell)}
            </td>
          `).join("")}
        </tr>
      `).join("");

      // 1. DATA TABLE
      const tableHtml = rows.length ? `
        <table class="maintenance-pdf-table" style="border-collapse:collapse; width:100%; margin-bottom:8px; background:#ffffff; page-break-inside:auto; break-inside:auto;">
          <thead style="display:table-header-group;">
            <tr style="page-break-inside:avoid; break-inside:avoid;">${headerCells}</tr>
          </thead>
          <tbody style="display:table-row-group;">
            ${dataRows}
          </tbody>
        </table>
      ` : `
        <div style="font-family:Arial,sans-serif; font-size:10.5px; color:#6b7280; font-style:italic; padding:6px 0 8px 0;">No station issues recorded for this section.</div>
      `;

      // 2. PROOF SCREENSHOTS
      const screenshotsHtml = screenshots.length ? `
        <div class="maintenance-pdf-screenshots" style="page-break-inside:avoid; break-inside:avoid; margin:8px 0 10px 0; padding:8px; background:#fafafa; border:1px solid #e5e7eb; border-radius:4px;">
          
          <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start;">
            ${screenshots.map((shot, shotIdx) => `
              <div style="display:inline-block; border:1px solid #d1d5db; border-radius:3px; overflow:hidden; background:#000000; line-height:0;">
                <img src="${esc(maintenanceScreenshotSource(shot))}" alt="CCTV Screenshot ${shotIdx + 1}" style="max-width:240px; max-height:144px; width:auto; height:auto; object-fit:contain; display:block; background:#ffffff;">
              </div>
            `).join("")}
          </div>
        </div>
      ` : "";

      // 3. REMARKS
      const remarksHtml = remarks.length ? `
        <div class="maintenance-pdf-remarks" style="page-break-inside:avoid; break-inside:avoid; border-left:4px solid #16a34a; padding:8px 12px; background:#f0fdf4; color:#14532d; font-family:Arial,sans-serif; font-size:10.5px; margin:8px 0 14px 0; border-radius:0 4px 4px 0;">
          <div style="font-weight:700; color:#16a34a; font-size:11px; margin-bottom:3px; page-break-after:avoid; break-after:avoid;">Remarks:</div>
          ${remarks.map(item => `<div style="line-height:1.45;">${esc(item)}</div>`).join("")}
        </div>
      ` : "";

      return `
        <div class="maintenance-pdf-block" style="margin-bottom:20px; page-break-inside:auto; break-inside:auto;">
          ${blockLabel}
          ${tableHtml}
          ${screenshotsHtml}
          ${remarksHtml}
        </div>
      `;
    }).join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${esc(titleLine)}</title>
          <style>
            @media print {
              @page { size: A4 landscape; margin: 15mm; }
              body { margin: 0; padding: 0; background: #ffffff; }
              thead { display: table-header-group !important; }
              tbody { display: table-row-group !important; }
              tr { page-break-inside: avoid !important; break-inside: avoid !important; }
              .maintenance-pdf-block { page-break-inside: auto; break-inside: auto; }
              .maintenance-pdf-block-title { page-break-after: avoid !important; break-after: avoid !important; }
              .maintenance-pdf-table { page-break-inside: auto; break-inside: auto; margin-bottom: 8px; }
              .maintenance-pdf-screenshots { page-break-inside: avoid !important; break-inside: avoid !important; }
              .maintenance-pdf-remarks { page-break-inside: avoid !important; break-inside: avoid !important; }
            }
            @page { size: A4 landscape; margin: 15mm; }
            body { margin: 0; padding: 12px; background: #ffffff; font-family: Arial, sans-serif; color: #111827; }
            table { border-collapse: collapse; width: 100%; }
            thead { display: table-header-group; }
            tbody { display: table-row-group; }
            tr { page-break-inside: avoid; break-inside: avoid; }
            .maintenance-pdf-block { page-break-inside: auto; break-inside: auto; }
            .maintenance-pdf-block-title { page-break-after: avoid; break-after: avoid; }
            .maintenance-pdf-screenshots { page-break-inside: avoid; break-inside: avoid; }
            .maintenance-pdf-remarks { page-break-inside: avoid; break-inside: avoid; }
          </style>
        </head>
        <body>
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
    DEFAULT_QUICK_REMARKS,
    getQuickRemarks,
    saveQuickRemarks,
    addQuickRemark,
    deleteQuickRemark,
    restoreDefaultQuickRemarks,
    getEffectiveBlockRemarks,
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




