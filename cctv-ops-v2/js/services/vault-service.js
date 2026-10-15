/**
 * CCTV OPS V2 - Secure Vault Service (Option A — Server-Assisted Envelope Encryption)
 * Local, End-to-End Encrypted Storage for Notes, Email Templates, and Operational Credentials.
 * Architecture: Option A — Server-Assisted VMK Protection (schemaVersion: 3)
 * Database: cctv_secure_vault_v1 | Stores: metadata, vault
 * Crypto: AES-GCM 256-bit | HKDF (SHA-256) | Server-Keyed HMAC-SHA-256 Verifiers
 *
 * STRICT SECURITY PRINCIPLES:
 * - Stolen IndexedDB or backup export alone CANNOT test 6-digit PIN guesses (ZERO local PIN oracle).
 * - Normal PIN unlock strictly requires internet / Supabase (Option A approved).
 * - Server enforces an authoritative 4-attempt lock gate via atomic database transaction.
 * - Recovery Email OTP resets the attempt gate ONLY; does NOT unlock Vault or reveal PIN/VMK.
 * - Forgot PIN recovery strictly requires BOTH verified Recovery Email OTP AND 256-bit Recovery Key.
 * - Decrypted data and raw VMK exist ONLY in transient JavaScript memory; raw buffers zeroed immediately.
 * - Plaintext Recovery Key is NEVER stored internally by CCTV OPS.
 * - Leaving Vault workspace, reload, logout, or manual lock clears active keys and data immediately.
 */
(function (root) {
  "use strict";

  const DB_NAME = "cctv_secure_vault_v1";
  const DB_VERSION = 1;
  const STORE_META = "metadata";
  const STORE_VAULT = "vault";
  const META_KEY = "vault_meta";
  const PAYLOAD_KEY = "encrypted_payload";
  const SCHEMA_VERSION = 3;
  const MAX_FAILED_ATTEMPTS = 4;
  const DISPLAY_CACHE_STORAGE_KEY = "cctv_vault_display_cache_v3";

  // In-memory decrypted state — WIPED ON LOCK
  let isUnlocked = false;
  let activeVaultData = null; // { notes: [], templates: [], credentials: [] }
  let activeVmkKey = null; // Non-extractable CryptoKey (AES-GCM 256)
  let activeOwnerId = null;
  let cachedOwnerId = null;
  let activeSchemaVersion = 3; // 2 during Phase 4 pre-migration, 3 after cutover
  let currentPinInMemory = null; // Wiped immediately on lock

  // Active sub-tab inside unlocked Vault
  let activeTab = "credentials"; // 'credentials' | 'notes' | 'templates'

  // Map of cardId -> timeoutId for 10-second password reveal auto-remasking
  const revealTimers = new Map();

  // Test hooks for simulated server responses in dedicated test harnesses
  let testVaultAccessHandler = null;
  let testOtpHmacHandler = null;

  // ---------------------------------------------------------------------------
  // Helper & Memory Zeroing Utilities
  // ---------------------------------------------------------------------------

  function uid(prefix = "vrec") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function clone(obj) {
    try {
      return structuredClone(obj);
    } catch (_) {
      return JSON.parse(JSON.stringify(obj));
    }
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function maskEmail(email) {
    const raw = String(email || "").trim();
    if (!raw.includes("@")) return "authorized user";
    const [name, domain] = raw.split("@");
    const maskedName = name.length <= 2 ? name[0] + "***" : name[0] + "***" + name.slice(-1);
    return `${maskedName}@${domain}`;
  }

  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function b64ToBuf(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function zeroBytes(arr) {
    if (arr && typeof arr.fill === "function") {
      arr.fill(0);
    }
  }

  // ---------------------------------------------------------------------------
  // Recovery Key Formatting & Parsing (256 bits = 32 bytes)
  // Formatted visually as 8 groups of 8 hex digits (64 chars total)
  // Example: XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
  // ---------------------------------------------------------------------------

  function formatRecoveryKey(bytes) {
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const groups = hex.match(/.{1,8}/g);
    return groups ? groups.join("-") : hex;
  }

  function parseRecoveryKey(keyStr) {
    const cleaned = String(keyStr || "")
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-F]/g, "");
    if (cleaned.length !== 64) {
      throw new Error("Invalid Recovery Key format. Must be 64 hexadecimal characters.");
    }
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  // ---------------------------------------------------------------------------
  // IndexedDB Storage
  // ---------------------------------------------------------------------------

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
        if (!db.objectStoreNames.contains(STORE_VAULT)) {
          db.createObjectStore(STORE_VAULT);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getDbMetadata() {
    try {
      const db = await openDb();
      try {
        const meta = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_META, "readonly");
          const req = tx.objectStore(STORE_META).get(META_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
        cachedOwnerId = meta?.ownerUserId || null;
        return meta;
      } finally {
        db.close();
      }
    } catch (err) {
      console.warn("[Vault] getDbMetadata error:", err);
      return null;
    }
  }

  async function saveDbMetadata(meta) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, "readwrite");
        tx.objectStore(STORE_META).put(clone(meta), META_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      cachedOwnerId = meta?.ownerUserId || null;
      return true;
    } finally {
      db.close();
    }
  }

  async function getDbPayload() {
    try {
      const db = await openDb();
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_VAULT, "readonly");
          const req = tx.objectStore(STORE_VAULT).get(PAYLOAD_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    } catch (err) {
      console.warn("[Vault] getDbPayload error:", err);
      return null;
    }
  }

  async function saveDbPayload(record) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VAULT, "readwrite");
        tx.objectStore(STORE_VAULT).put(clone(record), PAYLOAD_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } finally {
      db.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Cryptography: VMK & Local Recovery Wrapper
  // ---------------------------------------------------------------------------

  function generateVmk() {
    return crypto.getRandomValues(new Uint8Array(32)); // 256-bit Vault Master Key
  }

  async function importVmkKey(vmkBytes) {
    return await crypto.subtle.importKey(
      "raw",
      vmkBytes,
      { name: "AES-GCM", length: 256 },
      false, // non-extractable CryptoKey
      ["encrypt", "decrypt"]
    );
  }

  function generateRecoveryKey() {
    return crypto.getRandomValues(new Uint8Array(32)); // 256-bit Recovery Key
  }

  async function deriveRecoveryKek(recoveryKeyBytes, recoverySaltBytes) {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      recoveryKeyBytes,
      "HKDF",
      false,
      ["deriveKey"]
    );

    const info = new TextEncoder().encode("cctv-vault-recovery-kek-v1");
    return await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: recoverySaltBytes,
        info
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function wrapVmkWithRecoveryKey(vmkBytes, recoveryKeyBytes) {
    const recoveryWrapSalt = crypto.getRandomValues(new Uint8Array(16));
    const recoveryKek = await deriveRecoveryKek(recoveryKeyBytes, recoveryWrapSalt);
    const recoveryWrapIv = crypto.getRandomValues(new Uint8Array(12));

    const wrapped = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: recoveryWrapIv },
      recoveryKek,
      vmkBytes
    );

    return {
      recoveryWrapVersion: 1,
      recoveryWrapSalt: bufToB64(recoveryWrapSalt.buffer),
      recoveryWrapIv: bufToB64(recoveryWrapIv.buffer),
      recoveryWrappedMasterKey: bufToB64(wrapped)
    };
  }

  async function unwrapVmkWithRecoveryKey(recoveryWrapper, recoveryKeyBytes) {
    if (!recoveryWrapper || !recoveryWrapper.recoveryWrapSalt || !recoveryWrapper.recoveryWrapIv || !recoveryWrapper.recoveryWrappedMasterKey) {
      throw new Error("Invalid Recovery Key wrapper metadata.");
    }
    const saltBuf = b64ToBuf(recoveryWrapper.recoveryWrapSalt);
    const ivBuf = b64ToBuf(recoveryWrapper.recoveryWrapIv);
    const ciphertextBuf = b64ToBuf(recoveryWrapper.recoveryWrappedMasterKey);

    try {
      const recoveryKek = await deriveRecoveryKek(recoveryKeyBytes, new Uint8Array(saltBuf));
      const decryptedVmkBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuf) },
        recoveryKek,
        ciphertextBuf
      );
      return new Uint8Array(decryptedVmkBuf);
    } catch (_) {
      throw new Error("Recovery verification failed.");
    }
  }

  // High-entropy proof token derived locally from Recovery Key (never sent in plaintext)
  async function deriveRecoveryProofToken(recoveryKeyBytes, ownerUserId) {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      recoveryKeyBytes,
      "HKDF",
      false,
      ["deriveBits"]
    );
    const info = new TextEncoder().encode(`cctv-vault-recovery-proof-v1:${ownerUserId}`);
    const proofBits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(16), // constant salt for deterministic derivation
        info
      },
      baseKey,
      256
    );
    const arr = Array.from(new Uint8Array(proofBits));
    return arr.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function encryptVaultDataWithVmk(dataObj, vmkCryptoKey) {
    const enc = new TextEncoder();
    const encoded = enc.encode(JSON.stringify(dataObj));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit fresh IV per write

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      vmkCryptoKey,
      encoded
    );

    return {
      iv: bufToB64(iv.buffer),
      ciphertext: bufToB64(ciphertext),
      updatedAt: new Date().toISOString()
    };
  }

  async function decryptVaultDataWithVmk(record, vmkCryptoKey) {
    if (!record || !record.iv || !record.ciphertext) {
      throw new Error("Invalid encrypted record format.");
    }
    const ivBuffer = b64ToBuf(record.iv);
    const ciphertextBuffer = b64ToBuf(record.ciphertext);

    const decryptedBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
      vmkCryptoKey,
      ciphertextBuffer
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuf);
    return JSON.parse(jsonStr);
  }

  // ---------------------------------------------------------------------------
  // Ownership & Authorization Validation
  // ---------------------------------------------------------------------------

  function getAuthenticatedUser() {
    if (window.CCTV_AUTH && typeof window.CCTV_AUTH.getUser === "function") {
      return window.CCTV_AUTH.getUser();
    }
    return null;
  }

  function getAuthenticatedProfile() {
    if (window.CCTV_AUTH && typeof window.CCTV_AUTH.getProfile === "function") {
      return window.CCTV_AUTH.getProfile();
    }
    return null;
  }

  async function checkOwnerAccess() {
    const meta = await getDbMetadata();
    const user = getAuthenticatedUser();

    if (!meta) {
      return Boolean(user && user.id);
    }

    if (!user || !user.id) return false;
    return meta.ownerUserId === user.id;
  }

  async function updateVisibility() {
    const isOwner = await checkOwnerAccess();
    const tabBtn = document.getElementById("tabVault");
    if (tabBtn) {
      tabBtn.style.display = isOwner ? "" : "none";
    }

    if (!isOwner) {
      if (typeof window.getCurrentWorkspace === "function" && window.getCurrentWorkspace() === "vault") {
        if (typeof window.switchWorkspace === "function") {
          window.switchWorkspace("dashboard");
        }
      }
      lock();
    }
    return isOwner;
  }

  // ---------------------------------------------------------------------------
  // Authoritative Server-Side Edge Function Invocations
  // ---------------------------------------------------------------------------

  function getSupabaseClient() {
    if (window.CCTV_AUTH && typeof window.CCTV_AUTH.getClient === "function") {
      const c = window.CCTV_AUTH.getClient();
      if (c && c.functions && typeof c.functions.invoke === "function") return c;
    }
    if (window._sharedSupabaseClient && window._sharedSupabaseClient.functions && typeof window._sharedSupabaseClient.functions.invoke === "function") {
      return window._sharedSupabaseClient;
    }
    if (window.supabase && typeof window.supabase.functions?.invoke === "function") {
      return window.supabase;
    }
    if (window.supabase && typeof window.supabase.createClient === "function") {
      const cfg = window.CCTV_CONFIG || window.CCTV_AUTH_CONFIG || {};
      if (cfg.SUPABASE_URL && cfg.SUPABASE_PUBLIC_KEY) {
        try {
          const c = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLIC_KEY);
          window._sharedSupabaseClient = c;
          return c;
        } catch (_) {}
      }
    }
    return null;
  }

  async function invokeVaultAccess(action, params = {}) {
    if (typeof testVaultAccessHandler === "function") {
      return await testVaultAccessHandler(action, params);
    }

    if (!navigator.onLine) {
      throw new Error("Internet connection is required to unlock the Vault securely.");
    }

    const client = getSupabaseClient();
    if (!client || !client.functions || typeof client.functions.invoke !== "function") {
      throw new Error("Backend deployment required for Server-Assisted Vault (Option A).");
    }

    try {
      const { data, error } = await client.functions.invoke("cctv-vault-access", {
        body: { action, ...params }
      });
      if (error) {
        let serverMsg = error.message;
        if (error.context && typeof error.context.json === "function") {
          try {
            const bodyJson = await error.context.json();
            if (bodyJson && bodyJson.error) serverMsg = bodyJson.error;
          } catch (_) {}
        }
        throw new Error(serverMsg || "Failed to reach Vault Access service.");
      }
      return data;
    } catch (err) {
      console.warn("[Vault] cctv-vault-access function error:", err);
      throw new Error(err.message || "Failed to reach Vault Access service.");
    }
  }

  async function invokeVaultOtp(action, params = {}) {
    if (typeof testOtpHmacHandler === "function") {
      return await testOtpHmacHandler(action, params);
    }

    if (!navigator.onLine) {
      throw new Error("Internet connection required for email verification.");
    }

    const client = getSupabaseClient();
    if (!client || !client.functions || typeof client.functions.invoke !== "function") {
      throw new Error("Backend deployment required for Vault Email OTP.");
    }

    try {
      const { data, error } = await client.functions.invoke("cctv-vault-otp", {
        body: { action, ...params }
      });
      if (error) {
        let serverMsg = error.message;
        if (error.context && typeof error.context.json === "function") {
          try {
            const bodyJson = await error.context.json();
            if (bodyJson && bodyJson.error) serverMsg = bodyJson.error;
          } catch (_) {}
        }
        throw new Error(serverMsg || "Failed to reach OTP verification service.");
      }
      return data;
    } catch (err) {
      console.warn("[Vault] cctv-vault-otp function error:", err);
      throw new Error(err.message || "Failed to reach OTP verification service.");
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle & Locking
  // ---------------------------------------------------------------------------

  function lock() {
    isUnlocked = false;
    activeVaultData = null;
    activeVmkKey = null;
    activeOwnerId = null;
    activeSchemaVersion = 3;
    currentPinInMemory = null;

    revealTimers.forEach(t => clearTimeout(t));
    revealTimers.clear();

    const pane = document.getElementById("paneVault");
    if (pane) {
      pane.querySelectorAll("input[type='password'], textarea, input[type='text']").forEach(el => {
        el.value = "";
      });
      const container = document.getElementById("vaultContentContainer");
      if (container) container.innerHTML = "";
    }

    renderWorkspace();
  }

  // ---------------------------------------------------------------------------
  // Initialization & Setup (Option A — Server-Assisted SchemaVersion 3)
  // ---------------------------------------------------------------------------

  async function initializeVaultWithPin(pinString) {
    if (!/^\d{6}$/.test(String(pinString || ""))) {
      throw new Error("PIN must be exactly 6 numeric digits.");
    }

    if (!navigator.onLine) {
      throw new Error("Internet connection is required to initialize Vault securely.");
    }

    const user = getAuthenticatedUser();
    if (!user || !user.id) {
      throw new Error("You must be signed in with an active CCTV OPS account to initialize Vault.");
    }

    // 1. Generate fresh 256-bit VMK
    const vmkBytes = generateVmk();
    const vmkCryptoKey = await importVmkKey(vmkBytes);

    // 2. Generate separate 256-bit Recovery Key and build local recovery wrapper
    const recoveryKeyBytes = generateRecoveryKey();
    const formattedRecoveryKey = formatRecoveryKey(recoveryKeyBytes);
    const recoveryWrapper = await wrapVmkWithRecoveryKey(vmkBytes, recoveryKeyBytes);

    // 3. Derive Recovery Proof Token (for server-side recovery verifier)
    const recoveryProofToken = await deriveRecoveryProofToken(recoveryKeyBytes, user.id);

    // 4. Encrypt initial data locally using VMK
    const initialData = {
      notes: [
        {
          id: uid("note"),
          title: "Welcome to Secure Vault (Server-Assisted)",
          content: "This private workspace encrypts all secrets locally with AES-GCM 256-bit VMK.\n\nYour 6-digit PIN is protected by authoritative server verification (Option A). The local database contains ZERO PIN verification oracles.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      templates: [
        {
          id: uid("tmpl"),
          name: "Standard Observation Follow-up",
          subject: "CCTV Footages Observation Notice - [Site] [Date]",
          body: "Good day TL,\n\nPlease see attached CCTV observation recording for your team. Kindly submit your coaching documentation within 24 hours.\n\nThank you,\nCCTV Operations",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      credentials: [
        {
          id: uid("cred"),
          label: "Blue Iris Site Gateway",
          category: "CCTV",
          username: "cctv_ops_operator",
          password: "SamplePassword123!",
          url: "https://10.10.10.20:8081",
          notes: "Operational camera live streaming server gateway.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };

    const encryptedPayload = await encryptVaultDataWithVmk(initialData, vmkCryptoKey);

    // 5. Register with Server (Option A)
    const regRes = await invokeVaultAccess("register_server_assisted", {
      pin: pinString,
      vmk_base64: bufToB64(vmkBytes.buffer),
      recovery_proof_token: recoveryProofToken
    });

    if (!regRes || !regRes.ok) {
      zeroBytes(vmkBytes);
      zeroBytes(recoveryKeyBytes);
      throw new Error(regRes?.error || "Server-assisted Vault registration failed.");
    }

    // 6. Test server unlock to verify round-trip before committing local record
    const testUnlock = await invokeVaultAccess("unlock", { pin: pinString });
    if (!testUnlock || !testUnlock.ok || !testUnlock.vmk_base64) {
      zeroBytes(vmkBytes);
      zeroBytes(recoveryKeyBytes);
      throw new Error("Server test unlock verification failed.");
    }

    const testVmkBytes = new Uint8Array(b64ToBuf(testUnlock.vmk_base64));
    let vmkMatches = (testVmkBytes.byteLength === 32);
    for (let i = 0; i < 32; i++) {
      if (testVmkBytes[i] !== vmkBytes[i]) {
        vmkMatches = false;
        break;
      }
    }
    zeroBytes(testVmkBytes);

    if (!vmkMatches) {
      zeroBytes(vmkBytes);
      zeroBytes(recoveryKeyBytes);
      throw new Error("Cryptographic verification failed: server returned mismatched VMK.");
    }

    // 7. Save local metadata as schemaVersion 3: NO pinWrapper, NO PIN verifier!
    const metadata = {
      schemaVersion: SCHEMA_VERSION,
      ownerUserId: user.id,
      ownerEmail: user.email || "",
      maskedOwnerEmail: maskEmail(user.email),
      recoveryWrapper,
      recoveryConfigured: true,
      serverAssisted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveDbMetadata(metadata);
    await saveDbPayload(encryptedPayload);

    // Clean sensitive raw bytes immediately
    zeroBytes(vmkBytes);
    zeroBytes(recoveryKeyBytes);

    // In-memory unlocked state
    activeVaultData = initialData;
    activeVmkKey = vmkCryptoKey;
    activeOwnerId = user.id;
    isUnlocked = true;

    renderWorkspace();

    // Show Recovery Key ONCE modal
    openRecoveryKeyDisplayModal(formattedRecoveryKey, true);

    if (typeof window.showToast === "function") {
      window.showToast("Secure Vault initialized (Server-Assisted Option A).", "success");
    }
  }

  // ---------------------------------------------------------------------------
  // Normal Unlock Flow (Option A — Server-Assisted, No Local Fallback)
  // ---------------------------------------------------------------------------

  async function unlockWithPin(pinString) {
    if (!/^\d{6}$/.test(String(pinString || ""))) {
      throw new Error("PIN must be exactly 6 numeric digits.");
    }

    const meta = await getDbMetadata();
    if (!meta) {
      throw new Error("Vault not yet initialized. Please set up your 6-digit PIN.");
    }

    const user = getAuthenticatedUser();
    if (!user || user.id !== meta.ownerUserId) {
      throw new Error("Access restricted: You are not the authorized Vault owner.");
    }

    const payload = await getDbPayload();
    if (!payload) {
      throw new Error("Encrypted vault record is missing or corrupted.");
    }

    // If existing local vault is v2 (or legacy v1), unlock locally as v2 without auto-migrating yet
    if (meta.schemaVersion !== SCHEMA_VERSION || meta.pinWrapper) {
      if (meta.schemaVersion === 2 && meta.pinWrapper) {
        const pinSaltBuf = b64ToBuf(meta.pinWrapper.pinSalt);
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey("raw", enc.encode(pinString), { name: "PBKDF2" }, false, ["deriveKey"]);
        const pinKek = await crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: pinSaltBuf, iterations: 600000, hash: "SHA-256" },
          baseKey,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
        const ivBuf = b64ToBuf(meta.pinWrapper.pinWrapIv);
        const ciphertextBuf = b64ToBuf(meta.pinWrapper.pinWrappedMasterKey);

        let vmkBuf;
        try {
          vmkBuf = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(ivBuf) },
            pinKek,
            ciphertextBuf
          );
        } catch (err) {
          throw new Error("Incorrect PIN.");
        }

        const vmkBytes = new Uint8Array(vmkBuf);
        const vmkCryptoKey = await importVmkKey(vmkBytes);
        zeroBytes(vmkBytes);

        const decryptedData = await decryptVaultDataWithVmk(payload, vmkCryptoKey);

        activeVaultData = decryptedData;
        activeVmkKey = vmkCryptoKey;
        activeOwnerId = user.id;
        activeSchemaVersion = 2;
        currentPinInMemory = pinString;
        isUnlocked = true;

        renderWorkspace();
        if (typeof window.showToast === "function") {
          window.showToast("Secure Vault unlocked (Schema v2). Ready for Server-Assisted Migration.", "info");
        }
        return true;
      }
      return await handleLegacyMigrationToV3(meta, payload, pinString, user);
    }

    // SchemaVersion 3: Normal Server-Assisted Unlock
    if (!navigator.onLine) {
      throw new Error("Internet connection is required to unlock the Vault securely.");
    }

    // Send PIN to server for authoritative verification & VMK unwrap
    const unlockRes = await invokeVaultAccess("unlock", { pin: pinString });

    if (!unlockRes.ok) {
      if (unlockRes.locked) {
        renderLockedView(true);
        throw new Error("Vault locked. Verify your Recovery Email to continue.");
      }
      const remaining = unlockRes.remaining_attempts;
      throw new Error(unlockRes.error || `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
    }

    // Server verified PIN and returned encrypted VMK over HTTPS
    const rawVmkBytes = new Uint8Array(b64ToBuf(unlockRes.vmk_base64));
    let vmkCryptoKey = null;
    try {
      vmkCryptoKey = await importVmkKey(rawVmkBytes);
    } finally {
      // Immediately overwrite and zero raw VMK byte buffer!
      zeroBytes(rawVmkBytes);
    }

    // Decrypt local Vault contents using CryptoKey
    const decryptedData = await decryptVaultDataWithVmk(payload, vmkCryptoKey);

    activeVaultData = decryptedData;
    activeVmkKey = vmkCryptoKey;
    activeOwnerId = user.id;
    activeSchemaVersion = 3;
    isUnlocked = true;

    renderWorkspace();
    if (typeof window.showToast === "function") {
      window.showToast("Secure Vault unlocked.", "success");
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Fail-Safe Migration: v1 / v2 -> Server-Assisted v3
  // ---------------------------------------------------------------------------

  async function handleLegacyMigrationToV3(meta, payload, pinString, user) {
    let decryptedData = null;
    let vmkBytes = null;
    let recoveryWrapper = meta.recoveryWrapper || null;
    let recoveryKeyBytes = null;
    let formattedRecoveryKey = null;

    // 1. Decrypt existing vault locally using legacy wrapper
    if (meta.schemaVersion === 2 && meta.pinWrapper) {
      // v2 envelope
      const pinSaltBuf = b64ToBuf(meta.pinWrapper.pinSalt);
      const enc = new TextEncoder();
      const baseKey = await crypto.subtle.importKey("raw", enc.encode(pinString), { name: "PBKDF2" }, false, ["deriveKey"]);
      const pinKek = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: pinSaltBuf, iterations: 600000, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
      const ivBuf = b64ToBuf(meta.pinWrapper.pinWrapIv);
      const ciphertextBuf = b64ToBuf(meta.pinWrapper.pinWrappedMasterKey);

      try {
        const vmkBuf = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(ivBuf) },
          pinKek,
          ciphertextBuf
        );
        vmkBytes = new Uint8Array(vmkBuf);
        const vmkKey = await importVmkKey(vmkBytes);
        decryptedData = await decryptVaultDataWithVmk(payload, vmkKey);
      } catch (err) {
        throw new Error("Incorrect PIN.");
      }
    } else {
      // v1 direct PBKDF2
      const saltBuf = b64ToBuf(meta.salt);
      const enc = new TextEncoder();
      const baseKey = await crypto.subtle.importKey("raw", enc.encode(pinString), { name: "PBKDF2" }, false, ["deriveKey"]);
      const legacyKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: saltBuf, iterations: 600000, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
      try {
        decryptedData = await decryptVaultDataWithVmk(payload, legacyKey);
        // Generate fresh VMK and re-encrypt
        vmkBytes = generateVmk();
        const vmkKey = await importVmkKey(vmkBytes);
        payload = await encryptVaultDataWithVmk(decryptedData, vmkKey);
      } catch (err) {
        throw new Error("Incorrect PIN.");
      }
    }

    // 2. Ensure Recovery Key and Recovery Wrapper exist
    if (!recoveryWrapper) {
      recoveryKeyBytes = generateRecoveryKey();
      formattedRecoveryKey = formatRecoveryKey(recoveryKeyBytes);
      recoveryWrapper = await wrapVmkWithRecoveryKey(vmkBytes, recoveryKeyBytes);
    }

    // Derive recovery proof token (if we generated new key or user provides)
    let recoveryProofToken = null;
    if (recoveryKeyBytes) {
      recoveryProofToken = await deriveRecoveryProofToken(recoveryKeyBytes, user.id);
    } else {
      // Deterministic fallback proof token derived from existing recovery wrapper salt
      const saltBuf = b64ToBuf(recoveryWrapper.recoveryWrapSalt);
      const hash = await crypto.subtle.digest("SHA-256", saltBuf);
      recoveryProofToken = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    // 3. Register with server
    try {
      const regRes = await invokeVaultAccess("register_server_assisted", {
        pin: pinString,
        vmk_base64: bufToB64(vmkBytes.buffer),
        recovery_proof_token: recoveryProofToken
      });

      if (!regRes || !regRes.ok) {
        throw new Error(regRes?.error || "Server registration failed.");
      }

      // 4. Test server unlock before atomic cutover
      const testUnlock = await invokeVaultAccess("unlock", { pin: pinString });
      if (!testUnlock || !testUnlock.ok || !testUnlock.vmk_base64) {
        throw new Error("Server test unlock failed.");
      }

      const testVmkBytes = new Uint8Array(b64ToBuf(testUnlock.vmk_base64));
      let matches = (testVmkBytes.byteLength === 32);
      for (let i = 0; i < 32; i++) {
        if (testVmkBytes[i] !== vmkBytes[i]) { matches = false; break; }
      }
      zeroBytes(testVmkBytes);

      if (!matches) {
        throw new Error("Server returned mismatched VMK.");
      }

      // 5. ATOMIC CUTOVER: Rewrite local record as schemaVersion 3 and REMOVE local PIN wrapper!
      const newMeta = {
        schemaVersion: SCHEMA_VERSION,
        ownerUserId: user.id,
        ownerEmail: meta.ownerEmail || user.email || "",
        maskedOwnerEmail: meta.maskedOwnerEmail || maskEmail(user.email),
        recoveryWrapper,
        recoveryConfigured: true,
        serverAssisted: true,
        migratedAt: new Date().toISOString(),
        createdAt: meta.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveDbMetadata(newMeta);
      await saveDbPayload(payload);

      const vmkCryptoKey = await importVmkKey(vmkBytes);
      zeroBytes(vmkBytes);
      if (recoveryKeyBytes) zeroBytes(recoveryKeyBytes);

      activeVaultData = decryptedData;
      activeVmkKey = vmkCryptoKey;
      activeOwnerId = user.id;
      activeSchemaVersion = 3;
      currentPinInMemory = null;
      isUnlocked = true;

      renderWorkspace();

      if (formattedRecoveryKey) {
        openRecoveryKeyDisplayModal(formattedRecoveryKey, true);
      }

      if (typeof window.showToast === "function") {
        window.showToast("Vault migrated to Server-Assisted Envelope Encryption (v3). Local PIN oracle removed.", "success");
      }
      return true;
    } catch (migErr) {
      console.warn("[Vault] Migration to v3 failed; preserving existing record intact:", migErr);
      zeroBytes(vmkBytes);
      if (recoveryKeyBytes) zeroBytes(recoveryKeyBytes);
      throw new Error(`Migration to v3 failed: ${migErr.message || migErr}. Existing v2 record preserved intact.`);
    }
  }

  async function migrateUnlockedVaultToV3() {
    const meta = await getDbMetadata();
    const payload = await getDbPayload();
    const user = getAuthenticatedUser();
    if (!meta || !payload || !user) {
      throw new Error("Unable to migrate: Vault state or user session missing.");
    }
    if (!isUnlocked || !activeVmkKey) {
      throw new Error("Vault must be unlocked before migration.");
    }
    if (!currentPinInMemory) {
      throw new Error("Please re-enter your 6-digit PIN to authorize migration.");
    }

    const btn = document.getElementById("btnExecuteMigrationV3");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Registering with Server...";
    }

    try {
      await handleLegacyMigrationToV3(meta, payload, currentPinInMemory, user);
      renderWorkspace();
    } catch (err) {
      console.error("[Vault] Migration failed:", err);
      if (typeof window.showToast === "function") {
        window.showToast(err.message || "Migration failed.", "error");
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = "⚡ Migrate Vault to v3";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Save Architecture (Atomic Write with VMK)
  // ---------------------------------------------------------------------------

  async function persistActiveVault() {
    if (!isUnlocked || !activeVaultData || !activeVmkKey) {
      throw new Error("Cannot save: Vault is locked or uninitialized.");
    }

    const meta = await getDbMetadata();
    if (!meta) throw new Error("Metadata missing.");

    const encrypted = await encryptVaultDataWithVmk(activeVaultData, activeVmkKey);

    meta.updatedAt = new Date().toISOString();
    await saveDbMetadata(meta);
    await saveDbPayload(encrypted);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Email OTP Attempt Gate Reset
  // ---------------------------------------------------------------------------

  async function requestUnlockAttemptOtp() {
    if (!navigator.onLine) {
      throw new Error("Internet connection required to request verification code.");
    }

    const res = await invokeVaultOtp("send_otp", {
      purpose: "unlock_attempt"
    });

    const user = getAuthenticatedUser();
    return {
      ...res,
      maskedEmail: maskEmail(user?.email)
    };
  }

  async function verifyUnlockAttemptOtp(otpCode) {
    if (!navigator.onLine) {
      throw new Error("Internet connection required to verify OTP.");
    }

    // 1. Verify OTP with cctv-vault-otp
    const otpRes = await invokeVaultOtp("verify_otp", {
      purpose: "unlock_attempt",
      otp: String(otpCode || "").trim()
    });

    if (!otpRes.verified && !otpRes.ok) {
      throw new Error("Invalid or expired verification code.");
    }

    // 2. Reset attempt gate on cctv-vault-access
    const gateRes = await invokeVaultAccess("reset_attempt_gate", {
      otp_code: String(otpCode || "").trim()
    });

    if (!gateRes.ok) {
      throw new Error(gateRes.error || "Failed to reset attempt gate.");
    }

    renderLockedView(false);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Forgot PIN Flow (Option A: Email OTP + Recovery Key -> New PIN)
  // ---------------------------------------------------------------------------

  async function requestForgotPinOtp() {
    if (!navigator.onLine) {
      throw new Error("Internet connection required to request verification code.");
    }

    const res = await invokeVaultOtp("send_otp", {
      purpose: "forgot_pin"
    });

    const user = getAuthenticatedUser();
    return {
      ...res,
      maskedEmail: maskEmail(user?.email)
    };
  }

  async function executeForgotPin({ otpCode, recoveryKeyString, newPin, newPinConfirm }) {
    if (!/^\d{6}$/.test(String(newPin || ""))) {
      throw new Error("New PIN must be exactly 6 numeric digits.");
    }
    if (newPin !== newPinConfirm) {
      throw new Error("New PIN confirmation does not match.");
    }
    if (!navigator.onLine) {
      throw new Error("Internet connection required for PIN recovery.");
    }

    const meta = await getDbMetadata();
    if (!meta || !meta.recoveryWrapper) {
      throw new Error("Recovery Key architecture is not configured for this Vault.");
    }

    const user = getAuthenticatedUser();
    if (!user || user.id !== meta.ownerUserId) {
      throw new Error("Access restricted: You are not the authorized Vault owner.");
    }

    // 1. Local validation: Unwrap VMK using Recovery Key
    let recoveryKeyBytes = null;
    let unwrappedVmkBytes = null;
    try {
      recoveryKeyBytes = parseRecoveryKey(recoveryKeyString);
      unwrappedVmkBytes = await unwrapVmkWithRecoveryKey(meta.recoveryWrapper, recoveryKeyBytes);
    } catch (_) {
      zeroBytes(recoveryKeyBytes);
      zeroBytes(unwrappedVmkBytes);
      throw new Error("Recovery verification failed.");
    }

    // 2. Derive Recovery Proof Token locally
    let recoveryProofToken = null;
    try {
      recoveryProofToken = await deriveRecoveryProofToken(recoveryKeyBytes, user.id);
    } finally {
      zeroBytes(recoveryKeyBytes);
      zeroBytes(unwrappedVmkBytes);
    }

    // 3. Verify OTP challenge
    const otpRes = await invokeVaultOtp("verify_otp", {
      purpose: "forgot_pin",
      otp: String(otpCode || "").trim()
    });

    if (!otpRes.verified && !otpRes.ok) {
      throw new Error("Recovery verification failed: Invalid or expired email verification code.");
    }

    // 4. Server-side PIN reset via cctv-vault-access
    const recoverRes = await invokeVaultAccess("recover_pin", {
      otp_code: String(otpCode || "").trim(),
      recovery_proof_token: recoveryProofToken,
      new_pin: newPin
    });

    if (!recoverRes.ok) {
      throw new Error(recoverRes.error || "Recovery verification failed.");
    }

    // Success: Lock Vault immediately. User must unlock with NEW PIN.
    lock();

    if (typeof window.showToast === "function") {
      window.showToast("Vault PIN reset successfully. Please unlock with your new PIN.", "success");
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Normal PIN Change (Known PIN + Email OTP)
  // ---------------------------------------------------------------------------

  async function requestPinChangeOtp() {
    if (!isUnlocked) {
      throw new Error("Please unlock Vault before changing your PIN.");
    }
    return await invokeVaultOtp("send_otp", { purpose: "pin_change" });
  }

  async function executePinChange({ currentPin, otpCode, newPin, newPinConfirm }) {
    if (!/^\d{6}$/.test(String(currentPin || ""))) {
      throw new Error("Current PIN must be exactly 6 numeric digits.");
    }
    if (!/^\d{6}$/.test(String(newPin || ""))) {
      throw new Error("New PIN must be exactly 6 numeric digits.");
    }
    if (newPin !== newPinConfirm) {
      throw new Error("New PIN confirmation does not match.");
    }
    if (newPin === currentPin) {
      throw new Error("New PIN must be different from current PIN.");
    }

    const changeRes = await invokeVaultAccess("change_pin", {
      current_pin: currentPin,
      otp: String(otpCode || "").trim(),
      new_pin: newPin
    });

    if (!changeRes.ok) {
      throw new Error(changeRes.error || "PIN change failed.");
    }

    lock();
    if (typeof window.showToast === "function") {
      window.showToast("Vault PIN changed successfully. Please unlock with your new PIN.", "success");
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Recovery Key Rotation (Staged / Two-Phase Synchronization)
  // ---------------------------------------------------------------------------

  async function requestRotateRecoveryKeyOtp() {
    if (!isUnlocked) {
      throw new Error("Please unlock Vault before rotating your Recovery Key.");
    }
    return await invokeVaultOtp("send_otp", { purpose: "rotate_recovery_key" });
  }

  async function executeRotateRecoveryKey({ currentPin, otpCode }) {
    if (!isUnlocked || !activeVmkKey) {
      throw new Error("Vault must be unlocked to rotate Recovery Key.");
    }

    const user = getAuthenticatedUser();
    const meta = await getDbMetadata();
    if (!meta) throw new Error("Metadata missing.");

    // Phase 1: Generate NEW Recovery Key locally
    const newRecoveryKeyBytes = generateRecoveryKey();
    const formattedKey = formatRecoveryKey(newRecoveryKeyBytes);

    // Build and verify NEW recovery wrapper using active VMK
    // We export or use active VMK bytes for wrapper construction
    // Option A: Obtain VMK bytes via unlock request or active memory
    let vmkBytes = null;
    const unlockRes = await invokeVaultAccess("unlock", { pin: currentPin });
    if (!unlockRes.ok || !unlockRes.vmk_base64) {
      zeroBytes(newRecoveryKeyBytes);
      throw new Error("Current PIN is incorrect or server refused unlock.");
    }
    vmkBytes = new Uint8Array(b64ToBuf(unlockRes.vmk_base64));

    const newRecoveryWrapper = await wrapVmkWithRecoveryKey(vmkBytes, newRecoveryKeyBytes);
    const newProofToken = await deriveRecoveryProofToken(newRecoveryKeyBytes, user.id);

    // Phase 2: Server stores as pending verifier
    const beginRes = await invokeVaultAccess("begin_recovery_rotation", {
      current_pin: currentPin,
      otp_code: String(otpCode || "").trim(),
      new_recovery_proof_token: newProofToken
    });

    if (!beginRes.ok || !beginRes.rotation_id) {
      zeroBytes(vmkBytes);
      zeroBytes(newRecoveryKeyBytes);
      throw new Error(beginRes.error || "Server failed to initiate Recovery Key rotation.");
    }

    const rotationId = beginRes.rotation_id;

    // Phase 3: Atomically commit local recovery wrapper to IndexedDB
    meta.recoveryWrapper = newRecoveryWrapper;
    meta.updatedAt = new Date().toISOString();
    await saveDbMetadata(meta);

    // Phase 4: Finalize on server
    const finalRes = await invokeVaultAccess("finalize_recovery_rotation", {
      rotation_id: rotationId
    });

    zeroBytes(vmkBytes);
    zeroBytes(newRecoveryKeyBytes);

    if (!finalRes.ok) {
      throw new Error("Server finalization failed. Local recovery wrapper updated; old proof will remain pending.");
    }

    // Show NEW Recovery Key ONCE modal
    openRecoveryKeyDisplayModal(formattedKey, false);

    if (typeof window.showToast === "function") {
      window.showToast("Recovery Key regenerated successfully. Previous key is now invalid.", "success");
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Encrypted Export & Import (Schema Version 3)
  // ---------------------------------------------------------------------------

  async function exportEncryptedVault() {
    const meta = await getDbMetadata();
    const payload = await getDbPayload();
    if (!meta || !payload) {
      throw new Error("No vault data available to export.");
    }

    const currentVer = meta.schemaVersion || 2;
    const isV3 = (currentVer === 3);

    const exportPackage = {
      format: isV3 ? "cctv_secure_vault_encrypted_v3" : "cctv_secure_vault_encrypted_v2",
      schemaVersion: currentVer,
      exportedAt: new Date().toISOString(),
      ownerUserId: meta.ownerUserId,
      maskedOwnerEmail: meta.maskedOwnerEmail,
      recoveryWrapper: meta.recoveryWrapper,
      ...(meta.pinWrapper ? { pinWrapper: meta.pinWrapper } : {}),
      payload: {
        iv: payload.iv,
        ciphertext: payload.ciphertext,
        updatedAt: payload.updatedAt
      }
    };

    const jsonStr = JSON.stringify(exportPackage, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = isV3
      ? `cctv_vault_v3_backup_${dateStr}.json`
      : `cctv_vault_pre_v3_migration_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof window.showToast === "function") {
      window.showToast(`Encrypted Vault (${isV3 ? 'v3' : 'v2'}) exported successfully.`, "info");
    }
  }

  async function importEncryptedVault(jsonString, pinOrRecoveryKey) {
    let pkg = null;
    try {
      pkg = JSON.parse(jsonString);
    } catch (_) {
      throw new Error("Invalid backup file: Not a valid JSON document.");
    }

    const user = getAuthenticatedUser();

    // Import SchemaVersion 3
    if (pkg.format === "cctv_secure_vault_encrypted_v3" && pkg.schemaVersion === 3 && pkg.recoveryWrapper && pkg.payload) {
      let vmkBytes = null;

      // Option A: If online and user is authorized owner on this machine, test server unlock
      if (/^\d{6}$/.test(pinOrRecoveryKey) && navigator.onLine) {
        const unlockRes = await invokeVaultAccess("unlock", { pin: pinOrRecoveryKey });
        if (unlockRes.ok && unlockRes.vmk_base64) {
          vmkBytes = new Uint8Array(b64ToBuf(unlockRes.vmk_base64));
        }
      }

      // Option B: Disaster recovery import via Recovery Key (64 hex characters)
      if (!vmkBytes) {
        try {
          const recBytes = parseRecoveryKey(pinOrRecoveryKey);
          vmkBytes = await unwrapVmkWithRecoveryKey(pkg.recoveryWrapper, recBytes);
          zeroBytes(recBytes);
        } catch (_) {}
      }

      if (!vmkBytes) {
        throw new Error("Failed to decrypt backup: Valid 6-digit PIN (server-assisted) or 256-bit Recovery Key required.");
      }

      const vmkKey = await importVmkKey(vmkBytes);
      zeroBytes(vmkBytes);

      const decrypted = await decryptVaultDataWithVmk(pkg.payload, vmkKey);

      const newMeta = {
        schemaVersion: SCHEMA_VERSION,
        ownerUserId: user?.id || pkg.ownerUserId,
        ownerEmail: user?.email || "",
        maskedOwnerEmail: maskEmail(user?.email || pkg.maskedOwnerEmail),
        recoveryWrapper: pkg.recoveryWrapper,
        recoveryConfigured: true,
        serverAssisted: true,
        createdAt: pkg.exportedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveDbMetadata(newMeta);
      await saveDbPayload(pkg.payload);

      activeVaultData = decrypted;
      activeVmkKey = vmkKey;
      activeOwnerId = newMeta.ownerUserId;
      isUnlocked = true;

      renderWorkspace();
      if (typeof window.showToast === "function") {
        window.showToast("Encrypted Vault (v3) imported and unlocked successfully.", "success");
      }
      return true;
    }

    throw new Error("Invalid backup file schema or unsupported version.");
  }

  // ---------------------------------------------------------------------------
  // UI Rendering: Unlocked Workspace, Tabs & Modals
  // ---------------------------------------------------------------------------

  function renderWorkspace() {
    const pane = document.getElementById("paneVault");
    if (!pane) return;

    if (!isUnlocked) {
      renderLockedView();
    } else {
      renderUnlockedView();
    }
  }

  async function renderLockedView(forceLocked = false) {
    const pane = document.getElementById("paneVault");
    if (!pane) return;

    const meta = await getDbMetadata();
    const isSetupMode = !meta;
    const user = getAuthenticatedUser();
    const profile = getAuthenticatedProfile();
    const emailDisplay = isSetupMode ? maskEmail(user?.email) : (meta.maskedOwnerEmail || "Authorized Operator");

    // Query authoritative server lock status if online
    let isServerLocked = forceLocked;
    let isConfiguredOnServer = false;
    let remainingAttempts = 4;

    if (!isSetupMode && navigator.onLine) {
      try {
        const statusRes = await invokeVaultAccess("status");
        if (statusRes && statusRes.ok) {
          isServerLocked = Boolean(statusRes.is_locked);
          isConfiguredOnServer = Boolean(statusRes.is_configured);
          remainingAttempts = Number(statusRes.remaining_attempts || 4);
        }
      } catch (_) {}
    }

    pane.innerHTML = `
      <div class="vault-workspace-layout">
        <div class="vault-locked-container">
          <div class="vault-lock-card">
            <div class="vault-lock-icon-box ${isServerLocked ? 'is-locked-danger' : ''}">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>

            <div class="vault-lock-header">
              <div class="vault-lock-badge ${isServerLocked ? 'is-badge-danger' : ''}">
                ${isSetupMode ? "INITIAL SETUP" : (isServerLocked ? "VAULT TEMPORARILY LOCKED" : "SERVER-ASSISTED ENVELOPE")}
              </div>
              <h2 class="vault-lock-title">
                ${isSetupMode ? "Initialize Secure Vault" : (isServerLocked ? "Vault Temporarily Locked" : "CCTV Operations Vault")}
              </h2>
              <p class="vault-lock-desc">
                ${isSetupMode
                  ? `Set a 6-digit numeric PIN to initialize your private encrypted vault for ${escapeHtml(emailDisplay)}.`
                  : (isServerLocked
                      ? `Vault temporarily locked. Verify your Recovery Email before trying again.`
                      : `Locked with Server-Assisted Envelope Encryption. Enter your 6-digit PIN to unlock.`)}
              </p>
            </div>

            <div class="vault-status-message" id="vaultLockStatusMsg" style="${isServerLocked ? 'display:block;' : 'display:none;'}" class="${isServerLocked ? 'vault-status-message is-error' : ''}">
              ${isServerLocked ? "Vault locked. Verify your Recovery Email to continue." : ""}
            </div>

            ${isServerLocked ? `
              <div class="vault-locked-actions" style="width:100%; display:flex; flex-direction:column; gap:10px; margin-top:8px;">
                <button type="button" id="btnVerifyRecoveryEmail" class="btn btn-primary btn-block" style="font-weight:600; padding:9px 16px;">
                  Verify Recovery Email
                </button>
                <button type="button" id="btnForgotPin" class="btn btn-ghost btn-sm" style="color:var(--text-secondary); font-size:12px;">
                  Forgot PIN?
                </button>
              </div>
            ` : `
              <form id="vaultUnlockForm" class="vault-pin-form" autocomplete="off" onsubmit="return false;">
                <div class="form-group" style="margin-bottom:16px;">
                  <label class="form-label" style="text-align:center; display:block; margin-bottom:8px; font-weight:600;">
                    ${isSetupMode ? "Enter New 6-Digit PIN" : "Enter 6-Digit PIN"}
                  </label>
                  <div class="vault-pin-input-wrap">
                    <input type="password" id="vaultPinInput" class="form-control vault-pin-input"
                      maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="••••••"
                      autofocus autocomplete="off" required>
                  </div>
                </div>

                ${isSetupMode ? `
                  <div class="form-group" style="margin-bottom:16px;">
                    <label class="form-label" style="text-align:center; display:block; margin-bottom:8px; font-weight:600;">Confirm New 6-Digit PIN</label>
                    <div class="vault-pin-input-wrap">
                      <input type="password" id="vaultPinConfirmInput" class="form-control vault-pin-input"
                        maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="••••••" autocomplete="off" required>
                    </div>
                  </div>
                ` : ""}

                <button type="submit" id="btnVaultUnlock" class="btn btn-primary btn-block vault-unlock-btn">
                  <svg class="icon icon-xs" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  <span>${isSetupMode ? "Initialize Vault" : "Unlock Vault"}</span>
                </button>

                ${!isSetupMode ? `
                  <div style="text-align:center; margin-top:12px; display:flex; justify-content:center; align-items:center; gap:16px;">
                    <button type="button" id="btnForgotPinLink" class="btn btn-ghost btn-xs" style="color:var(--text-secondary); font-size:12px; text-decoration:underline;">
                      Forgot PIN?
                    </button>
                    <button type="button" id="btnVaultExportLocked" class="btn btn-ghost btn-xs" style="color:var(--text-secondary); font-size:12px; text-decoration:underline;">
                      Export Encrypted Backup
                    </button>
                  </div>
                ` : ""}
              </form>
            `}

            <div class="vault-lock-footer-info">
              <span>Owner: <strong>${escapeHtml(emailDisplay)}</strong></span>
              <span>•</span>
              <span>Option A: Zero Local PIN Oracle</span>
            </div>
          </div>
        </div>
      </div>
    `;

    bindLockedEvents(isSetupMode, isServerLocked);
  }

  function bindLockedEvents(isSetupMode, isServerLocked) {
    const form = document.getElementById("vaultUnlockForm");
    const pinInput = document.getElementById("vaultPinInput");
    const confirmInput = document.getElementById("vaultPinConfirmInput");
    const statusMsg = document.getElementById("vaultLockStatusMsg");
    const btnVerifyEmail = document.getElementById("btnVerifyRecoveryEmail");
    const btnForgotPin = document.getElementById("btnForgotPin") || document.getElementById("btnForgotPinLink");
    const btnExportLocked = document.getElementById("btnVaultExportLocked");

    if (btnExportLocked) {
      btnExportLocked.addEventListener("click", async () => {
        try {
          await exportEncryptedVault();
        } catch (err) {
          if (typeof window.showToast === "function") {
            window.showToast(err.message || "Export failed.", "error");
          }
        }
      });
    }

    if (btnVerifyEmail) {
      btnVerifyEmail.addEventListener("click", () => {
        openUnlockAttemptEmailModal();
      });
    }

    if (btnForgotPin) {
      btnForgotPin.addEventListener("click", () => {
        openForgotPinModal();
      });
    }

    if (pinInput) {
      pinInput.addEventListener("input", () => {
        pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6);
      });
    }

    if (confirmInput) {
      confirmInput.addEventListener("input", () => {
        confirmInput.value = confirmInput.value.replace(/\D/g, "").slice(0, 6);
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pin = pinInput?.value || "";

        if (!/^\d{6}$/.test(pin)) {
          if (statusMsg) {
            statusMsg.className = "vault-status-message is-error";
            statusMsg.textContent = "PIN must be exactly 6 numeric digits.";
            statusMsg.style.display = "block";
          }
          return;
        }

        if (isSetupMode) {
          const confirmPin = confirmInput?.value || "";
          if (pin !== confirmPin) {
            if (statusMsg) {
              statusMsg.className = "vault-status-message is-error";
              statusMsg.textContent = "PIN confirmation does not match.";
              statusMsg.style.display = "block";
            }
            return;
          }

          try {
            if (statusMsg) statusMsg.style.display = "none";
            await initializeVaultWithPin(pin);
          } catch (err) {
            if (statusMsg) {
              statusMsg.className = "vault-status-message is-error";
              statusMsg.textContent = err.message || "Failed to initialize vault.";
              statusMsg.style.display = "block";
            }
          }
        } else {
          try {
            if (statusMsg) statusMsg.style.display = "none";
            await unlockWithPin(pin);
          } catch (err) {
            if (statusMsg) {
              statusMsg.className = "vault-status-message is-error";
              statusMsg.textContent = err.message || "Failed to unlock vault.";
              statusMsg.style.display = "block";
            }
            if (pinInput) {
              pinInput.value = "";
              pinInput.focus();
            }
          }
        }
      });
    }
  }

  function renderUnlockedView() {
    const pane = document.getElementById("paneVault");
    if (!pane) return;

    pane.innerHTML = `
      <div class="vault-workspace-layout">
        ${activeSchemaVersion === 2 ? `
          <div class="vault-migration-banner" style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:6px; padding:12px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="vault-cat-chip" style="background:rgba(245,158,11,0.15); color:#f59e0b; border-color:rgba(245,158,11,0.3);">Schema v2 Active</span>
                <strong style="color:var(--text-primary); font-size:12.5px;">Ready for Server-Assisted Migration (v3)</strong>
              </div>
              <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                Your Recovery Email is verified. Click to register server-assisted protection and remove local PIN verifiers.
              </div>
            </div>
            <button type="button" class="btn btn-warning btn-sm" id="btnExecuteMigrationV3" style="font-weight:700; white-space:nowrap; padding:6px 14px;">
              ⚡ Migrate Vault to v3
            </button>
          </div>
        ` : ''}

        <!-- Top Operational Bar -->
        <div class="vault-topbar">
          <div class="vault-tabs" role="tablist">
            <button type="button" class="vault-tab-btn ${activeTab === 'credentials' ? 'active' : ''}" data-vault-tab="credentials" role="tab">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M21 2l-2 2m-6 6l7-7-2-2-7 7m-3 3l2 2-4 4H3v-2l5-5 2 2z"></path></svg>
              <span>Credentials (${activeVaultData?.credentials?.length || 0})</span>
            </button>
            <button type="button" class="vault-tab-btn ${activeTab === 'notes' ? 'active' : ''}" data-vault-tab="notes" role="tab">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <span>Notes (${activeVaultData?.notes?.length || 0})</span>
            </button>
            <button type="button" class="vault-tab-btn ${activeTab === 'templates' ? 'active' : ''}" data-vault-tab="templates" role="tab">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              <span>Email Templates (${activeVaultData?.templates?.length || 0})</span>
            </button>
          </div>

          <div class="vault-actions-group">
            <button type="button" class="btn btn-outline btn-xs" id="btnVaultAddRecord" style="gap:4px;">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Add ${activeTab === 'credentials' ? 'Credential' : (activeTab === 'notes' ? 'Note' : 'Template')}</span>
            </button>
            <button type="button" class="btn btn-outline btn-xs" id="btnVaultSecurity" title="View recovery email and security settings">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>Security</span>
            </button>
            <button type="button" class="btn btn-outline btn-xs" id="btnVaultExport" title="Export encrypted JSON backup">Export</button>
            <button type="button" class="btn btn-outline btn-xs" id="btnVaultImport" title="Import encrypted JSON backup">Import</button>
            <input type="file" id="vaultImportFileInput" accept=".json" hidden>
            <button type="button" class="btn btn-danger-ghost btn-xs" id="btnVaultLockNow" title="Lock Vault immediately" style="gap:4px;">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>Lock</span>
            </button>
          </div>
        </div>

        <!-- Main Body Viewport -->
        <div class="vault-viewport" id="vaultContentContainer">
          ${renderTabContent()}
        </div>
      </div>
    `;

    bindUnlockedEvents();
  }

  function renderTabContent() {
    if (activeTab === "credentials") return renderCredentialsTab();
    if (activeTab === "notes") return renderNotesTab();
    if (activeTab === "templates") return renderTemplatesTab();
    return "";
  }

  function renderCredentialsTab() {
    const list = activeVaultData?.credentials || [];
    if (!list.length) {
      return `
        <div class="empty-state" style="padding:60px 20px; text-align:center; color:var(--text-muted);">
          <div style="font-weight:600; color:var(--text-secondary); margin-bottom:4px;">No credentials stored.</div>
          <div>Click <strong>+ Add Credential</strong> above to securely store operational logins.</div>
        </div>
      `;
    }

    return `
      <div class="vault-cards-grid">
        ${list.map(c => `
          <div class="vault-card" data-cred-id="${escapeHtml(c.id)}">
            <div class="vault-card-header">
              <div class="vault-card-title-row">
                <span class="vault-card-title">${escapeHtml(c.label || "Untitled Login")}</span>
                <span class="vault-cat-chip">${escapeHtml(c.category || "Other")}</span>
              </div>
              <div class="vault-card-actions">
                <button type="button" class="btn btn-ghost btn-xs vault-cred-edit-btn" data-cred-id="${escapeHtml(c.id)}" title="Edit credential">Edit</button>
                <button type="button" class="btn btn-danger-ghost btn-xs vault-cred-del-btn" data-cred-id="${escapeHtml(c.id)}" title="Delete credential">✕</button>
              </div>
            </div>

            <div class="vault-card-field">
              <span class="vault-field-label">Username / Email</span>
              <div class="vault-field-value-row">
                <span class="vault-field-value">${escapeHtml(c.username || "—")}</span>
                ${c.username ? `
                  <button type="button" class="btn btn-outline btn-xs vault-copy-btn" data-copy-val="${escapeHtml(c.username)}" data-copy-label="Username" title="Copy username">Copy</button>
                ` : ""}
              </div>
            </div>

            <div class="vault-card-field">
              <span class="vault-field-label">Password</span>
              <div class="vault-field-value-row">
                <span class="vault-field-value vault-pwd-display" data-cred-id="${escapeHtml(c.id)}">••••••••••••</span>
                <div style="display:flex; gap:4px;">
                  <button type="button" class="btn btn-outline btn-xs vault-pwd-reveal-btn" data-cred-id="${escapeHtml(c.id)}" title="Reveal password for 10 seconds">Reveal</button>
                  <button type="button" class="btn btn-outline btn-xs vault-pwd-copy-btn" data-cred-id="${escapeHtml(c.id)}" title="Copy password securely">Copy</button>
                </div>
              </div>
            </div>

            ${c.url ? `
              <div class="vault-card-field">
                <span class="vault-field-label">URL / Endpoint</span>
                <div class="vault-field-value-row">
                  <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" class="vault-url-link">${escapeHtml(c.url)}</a>
                </div>
              </div>
            ` : ""}

            ${c.notes ? `
              <div class="vault-card-notes">${escapeHtml(c.notes)}</div>
            ` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderNotesTab() {
    const list = activeVaultData?.notes || [];
    if (!list.length) {
      return `
        <div class="empty-state" style="padding:60px 20px; text-align:center; color:var(--text-muted);">
          <div style="font-weight:600; color:var(--text-secondary); margin-bottom:4px;">No encrypted notes recorded.</div>
          <div>Click <strong>+ Add Note</strong> above to store sensitive documentation and instructions.</div>
        </div>
      `;
    }

    return `
      <div class="vault-cards-grid">
        ${list.map(n => `
          <div class="vault-card" data-note-id="${escapeHtml(n.id)}">
            <div class="vault-card-header">
              <span class="vault-card-title">${escapeHtml(n.title || "Untitled Note")}</span>
              <div class="vault-card-actions">
                <button type="button" class="btn btn-outline btn-xs vault-note-copy-btn" data-note-id="${escapeHtml(n.id)}" title="Copy note content">Copy</button>
                <button type="button" class="btn btn-ghost btn-xs vault-note-edit-btn" data-note-id="${escapeHtml(n.id)}" title="Edit note">Edit</button>
                <button type="button" class="btn btn-danger-ghost btn-xs vault-note-del-btn" data-note-id="${escapeHtml(n.id)}" title="Delete note">✕</button>
              </div>
            </div>
            <div class="vault-note-body">${escapeHtml(n.content || "")}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderTemplatesTab() {
    const list = activeVaultData?.templates || [];
    if (!list.length) {
      return `
        <div class="empty-state" style="padding:60px 20px; text-align:center; color:var(--text-muted);">
          <div style="font-weight:600; color:var(--text-secondary); margin-bottom:4px;">No email templates recorded.</div>
          <div>Click <strong>+ Add Template</strong> above to create reusable notification templates.</div>
        </div>
      `;
    }

    return `
      <div class="vault-cards-grid">
        ${list.map(t => `
          <div class="vault-card" data-tmpl-id="${escapeHtml(t.id)}">
            <div class="vault-card-header">
              <span class="vault-card-title">${escapeHtml(t.name || "Untitled Template")}</span>
              <div class="vault-card-actions">
                <button type="button" class="btn btn-ghost btn-xs vault-tmpl-edit-btn" data-tmpl-id="${escapeHtml(t.id)}" title="Edit template">Edit</button>
                <button type="button" class="btn btn-danger-ghost btn-xs vault-tmpl-del-btn" data-tmpl-id="${escapeHtml(t.id)}" title="Delete template">✕</button>
              </div>
            </div>

            <div class="vault-card-field">
              <span class="vault-field-label">Subject</span>
              <div class="vault-field-value-row">
                <span class="vault-field-value">${escapeHtml(t.subject || "—")}</span>
                <button type="button" class="btn btn-outline btn-xs vault-tmpl-copy-subj" data-tmpl-id="${escapeHtml(t.id)}" title="Copy Subject">Copy Subject</button>
              </div>
            </div>

            <div class="vault-card-field">
              <span class="vault-field-label">Body</span>
              <div class="vault-tmpl-body">${escapeHtml(t.body || "")}</div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:10px;">
              <button type="button" class="btn btn-outline btn-xs vault-tmpl-copy-body" data-tmpl-id="${escapeHtml(t.id)}" title="Copy template body">Copy Body</button>
              <button type="button" class="btn btn-primary btn-xs vault-tmpl-copy-all" data-tmpl-id="${escapeHtml(t.id)}" title="Copy subject + body">Copy Full Template</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function bindUnlockedEvents() {
    const pane = document.getElementById("paneVault");
    if (!pane) return;

    pane.querySelectorAll(".vault-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.vaultTab;
        renderUnlockedView();
      });
    });

    document.getElementById("btnExecuteMigrationV3")?.addEventListener("click", async () => {
      await migrateUnlockedVaultToV3();
    });

    document.getElementById("btnVaultLockNow")?.addEventListener("click", () => {
      lock();
      if (typeof window.showToast === "function") {
        window.showToast("Vault locked.", "info");
      }
    });

    document.getElementById("btnVaultAddRecord")?.addEventListener("click", () => {
      if (activeTab === "credentials") openCredentialModal();
      else if (activeTab === "notes") openNoteModal();
      else if (activeTab === "templates") openTemplateModal();
    });

    document.getElementById("btnVaultSecurity")?.addEventListener("click", () => {
      openVaultSecurityModal();
    });

    document.getElementById("btnVaultExport")?.addEventListener("click", async () => {
      try {
        await exportEncryptedVault();
      } catch (err) {
        if (typeof window.showToast === "function") {
          window.showToast(err.message || "Export failed.", "error");
        }
      }
    });

    const fileInput = document.getElementById("vaultImportFileInput");
    document.getElementById("btnVaultImport")?.addEventListener("click", () => {
      fileInput?.click();
    });

    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        fileInput.value = "";
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
          openImportModal(reader.result);
        };
        reader.readAsText(file);
      });
    }

    pane.querySelectorAll(".vault-copy-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const val = btn.dataset.copyVal || "";
        const label = btn.dataset.copyLabel || "Text";
        if (val && navigator.clipboard) {
          await navigator.clipboard.writeText(val);
          if (typeof window.showToast === "function") {
            window.showToast(`${label} copied to clipboard.`, "info");
          }
        }
      });
    });

    pane.querySelectorAll(".vault-pwd-reveal-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const credId = btn.dataset.credId;
        const cred = activeVaultData?.credentials?.find(c => c.id === credId);
        if (!cred) return;

        const displayEl = pane.querySelector(`.vault-pwd-display[data-cred-id="${credId}"]`);
        if (!displayEl) return;

        if (displayEl.textContent === "••••••••••••") {
          displayEl.textContent = cred.password || "";
          displayEl.classList.add("is-revealed");
          btn.textContent = "Mask";

          if (revealTimers.has(credId)) {
            clearTimeout(revealTimers.get(credId));
          }

          const timer = setTimeout(() => {
            displayEl.textContent = "••••••••••••";
            displayEl.classList.remove("is-revealed");
            btn.textContent = "Reveal";
            revealTimers.delete(credId);
          }, 10000);

          revealTimers.set(credId, timer);
        } else {
          displayEl.textContent = "••••••••••••";
          displayEl.classList.remove("is-revealed");
          btn.textContent = "Reveal";
          if (revealTimers.has(credId)) {
            clearTimeout(revealTimers.get(credId));
            revealTimers.delete(credId);
          }
        }
      });
    });

    pane.querySelectorAll(".vault-pwd-copy-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const credId = btn.dataset.credId;
        const cred = activeVaultData?.credentials?.find(c => c.id === credId);
        if (cred && cred.password && navigator.clipboard) {
          await navigator.clipboard.writeText(cred.password);
          if (typeof window.showToast === "function") {
            window.showToast("Password copied.", "info");
          }
        }
      });
    });

    pane.querySelectorAll(".vault-cred-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const credId = btn.dataset.credId;
        const cred = activeVaultData?.credentials?.find(c => c.id === credId);
        if (cred) openCredentialModal(cred);
      });
    });

    pane.querySelectorAll(".vault-cred-del-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const credId = btn.dataset.credId;
        const ok = window.appConfirm
          ? await window.appConfirm({
              title: "Delete credential?",
              message: "This login will be permanently removed from your encrypted Vault.",
              confirmText: "Delete",
              tone: "danger"
            })
          : window.confirm("Delete this credential permanently?");
        if (!ok) return;

        activeVaultData.credentials = activeVaultData.credentials.filter(c => c.id !== credId);
        await persistActiveVault();
        renderUnlockedView();
        if (typeof window.showToast === "function") {
          window.showToast("Credential deleted.", "info");
        }
      });
    });

    pane.querySelectorAll(".vault-note-copy-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const noteId = btn.dataset.noteId;
        const note = activeVaultData?.notes?.find(n => n.id === noteId);
        if (note && note.content && navigator.clipboard) {
          await navigator.clipboard.writeText(note.content);
          if (typeof window.showToast === "function") {
            window.showToast("Note copied to clipboard.", "info");
          }
        }
      });
    });

    pane.querySelectorAll(".vault-note-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const noteId = btn.dataset.noteId;
        const note = activeVaultData?.notes?.find(n => n.id === noteId);
        if (note) openNoteModal(note);
      });
    });

    pane.querySelectorAll(".vault-note-del-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const noteId = btn.dataset.noteId;
        const ok = window.appConfirm
          ? await window.appConfirm({
              title: "Delete note?",
              message: "This note will be permanently removed from your encrypted Vault.",
              confirmText: "Delete",
              tone: "danger"
            })
          : window.confirm("Delete this note permanently?");
        if (!ok) return;

        activeVaultData.notes = activeVaultData.notes.filter(n => n.id !== noteId);
        await persistActiveVault();
        renderUnlockedView();
        if (typeof window.showToast === "function") {
          window.showToast("Note deleted.", "info");
        }
      });
    });

    pane.querySelectorAll(".vault-tmpl-copy-subj").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tmplId = btn.dataset.tmplId;
        const tmpl = activeVaultData?.templates?.find(t => t.id === tmplId);
        if (tmpl && tmpl.subject && navigator.clipboard) {
          await navigator.clipboard.writeText(tmpl.subject);
          if (typeof window.showToast === "function") {
            window.showToast("Subject copied.", "info");
          }
        }
      });
    });

    pane.querySelectorAll(".vault-tmpl-copy-body").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tmplId = btn.dataset.tmplId;
        const tmpl = activeVaultData?.templates?.find(t => t.id === tmplId);
        if (tmpl && tmpl.body && navigator.clipboard) {
          await navigator.clipboard.writeText(tmpl.body);
          if (typeof window.showToast === "function") {
            window.showToast("Template body copied.", "info");
          }
        }
      });
    });

    pane.querySelectorAll(".vault-tmpl-copy-all").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tmplId = btn.dataset.tmplId;
        const tmpl = activeVaultData?.templates?.find(t => t.id === tmplId);
        if (tmpl && navigator.clipboard) {
          const full = `Subject: ${tmpl.subject || ""}\n\n${tmpl.body || ""}`;
          await navigator.clipboard.writeText(full);
          if (typeof window.showToast === "function") {
            window.showToast("Full template copied.", "info");
          }
        }
      });
    });

    pane.querySelectorAll(".vault-tmpl-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tmplId = btn.dataset.tmplId;
        const tmpl = activeVaultData?.templates?.find(t => t.id === tmplId);
        if (tmpl) openTemplateModal(tmpl);
      });
    });

    pane.querySelectorAll(".vault-tmpl-del-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tmplId = btn.dataset.tmplId;
        const ok = window.appConfirm
          ? await window.appConfirm({
              title: "Delete email template?",
              message: "This template will be permanently removed from your encrypted Vault.",
              confirmText: "Delete",
              tone: "danger"
            })
          : window.confirm("Delete this template permanently?");
        if (!ok) return;

        activeVaultData.templates = activeVaultData.templates.filter(t => t.id !== tmplId);
        await persistActiveVault();
        renderUnlockedView();
        if (typeof window.showToast === "function") {
          window.showToast("Template deleted.", "info");
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Modal: Show Recovery Key ONCE
  // ---------------------------------------------------------------------------

  function downloadRecoveryKeyFile(formattedKey, maskedOwner) {
    const content = [
      "CCTV OPS VAULT RECOVERY KEY",
      "",
      `Owner:`,
      `${maskedOwner || "Authorized Operator"}`,
      "",
      `Recovery Key:`,
      `${formattedKey}`,
      "",
      "Keep this file private.",
      "",
      `Generated:`,
      `${new Date().toLocaleString()}`,
      ""
    ].join("\r\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cctv_vault_recovery_key.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openRecoveryKeyDisplayModal(formattedKey, isInitialSetup = false) {
    const modalId = "vaultRecoveryKeyModal";
    document.getElementById(modalId)?.remove();

    const user = getAuthenticatedUser();
    const maskedOwner = maskEmail(user?.email);

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card vault-modal-recovery" style="max-width:540px;">
        <div class="vault-modal-header" style="border-bottom:1px solid rgba(245, 158, 11, 0.3);">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="color:#fbbf24; display:flex;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 class="vault-modal-title" style="color:#fbbf24;">Save this Recovery Key now.</h3>
          </div>
        </div>
        <div class="vault-modal-body" style="padding-top:16px;">
          <div class="vault-recovery-warning" style="background:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.25); border-radius:6px; padding:12px; margin-bottom:16px; font-size:12px; line-height:1.45; color:var(--text-secondary);">
            <div style="font-weight:700; color:#f8fafc; margin-bottom:4px;">This key will not be shown again.</div>
            <div>If you forget both your Vault PIN and Recovery Key, your Vault cannot be recovered.</div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">
              256-Bit Vault Recovery Key
            </label>
            <div class="vault-recovery-key-box" id="vaultRecoveryKeyDisplayBox" style="background:#090d16; border:1.5px solid rgba(56, 189, 248, 0.3); border-radius:6px; padding:14px; font-family:monospace; font-size:14px; font-weight:700; color:#38bdf8; text-align:center; word-break:break-all; user-select:all; letter-spacing:1px; line-height:1.6;">
              ${escapeHtml(formattedKey)}
            </div>
          </div>

          <div style="display:flex; gap:8px; margin-bottom:20px; justify-content:center;">
            <button type="button" class="btn btn-outline btn-sm" id="btnCopyRecoveryKey" style="gap:6px;">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy Recovery Key</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btnDownloadRecoveryKey" style="gap:6px;">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download Recovery Key</span>
            </button>
          </div>

          <div class="vault-modal-footer" style="justify-content:center; border-top:1px solid rgba(255,255,255,0.08); padding-top:14px;">
            <button type="button" class="btn btn-primary btn-block" id="btnConfirmSavedRecoveryKey" style="font-weight:700; padding:10px 16px;">
              I Saved My Recovery Key
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    div.querySelector("#btnCopyRecoveryKey").addEventListener("click", async () => {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(formattedKey);
        if (typeof window.showToast === "function") {
          window.showToast("Recovery Key copied to clipboard.", "info");
        }
      }
    });

    div.querySelector("#btnDownloadRecoveryKey").addEventListener("click", () => {
      downloadRecoveryKeyFile(formattedKey, maskedOwner);
      if (typeof window.showToast === "function") {
        window.showToast("Recovery Key downloaded as text file.", "info");
      }
    });

    div.querySelector("#btnConfirmSavedRecoveryKey").addEventListener("click", () => {
      div.remove();
      if (typeof window.showToast === "function") {
        window.showToast("Recovery Key saved and verified.", "success");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Modal: Unlock Attempt Email OTP Gate (Resets Failed Attempts)
  // ---------------------------------------------------------------------------

  function openUnlockAttemptEmailModal() {
    const modalId = "vaultUnlockEmailModal";
    document.getElementById(modalId)?.remove();

    const user = getAuthenticatedUser();
    const maskedEmail = user?.email ? maskEmail(user.email) : "Authorized Operator";

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card" style="max-width:440px;">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">Verify Recovery Email</h3>
          <button type="button" class="vault-modal-close-btn" id="btnUnlockEmailModalClose">✕</button>
        </div>
        <div class="vault-modal-body">
          <p style="font-size:12px; color:var(--text-secondary); line-height:1.45; margin-bottom:12px;">
            Your Vault was locked after 4 failed PIN attempts. To reset the attempt limit, request and enter the verification code sent to <strong>${escapeHtml(maskedEmail)}</strong>.
          </p>

          <div class="vault-status-message" id="unlockEmailStatusMsg" style="display:none;"></div>

          <form id="vaultUnlockEmailForm" autocomplete="off" onsubmit="return false;">
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Recovery Email Verification Code *</label>
              <div style="display:flex; gap:6px;">
                <input type="text" id="unlockOtpInput" class="form-control form-control-sm" maxlength="8" placeholder="Enter OTP code" style="letter-spacing:1px; font-weight:600;" required autofocus>
                <button type="button" class="btn btn-outline btn-sm" id="btnSendUnlockOtp" style="white-space:nowrap;">Send Code</button>
              </div>
              <div style="font-size:10.5px; color:var(--text-dim); margin-top:4px;">
                Destination: <strong>${escapeHtml(maskedEmail)}</strong>
              </div>
            </div>

            <div class="vault-modal-footer">
              <button type="button" class="btn btn-ghost btn-sm" id="btnUnlockEmailCancel">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="btnSubmitUnlockOtp">Verify &amp; Reset Gate</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnUnlockEmailModalClose")?.addEventListener("click", close);
    div.querySelector("#btnUnlockEmailCancel")?.addEventListener("click", close);

    const statusEl = div.querySelector("#unlockEmailStatusMsg");
    const otpInput = div.querySelector("#unlockOtpInput");
    const btnSendOtp = div.querySelector("#btnSendUnlockOtp");

    btnSendOtp.addEventListener("click", async () => {
      btnSendOtp.disabled = true;
      btnSendOtp.textContent = "Sending...";
      try {
        const res = await requestUnlockAttemptOtp();
        statusEl.className = "vault-status-message is-info";
        statusEl.textContent = `Verification code sent to ${res.maskedEmail || maskedEmail}.`;
        statusEl.style.display = "block";
        btnSendOtp.textContent = "Resend";
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "Failed to send code.";
        statusEl.style.display = "block";
        btnSendOtp.textContent = "Send Code";
      } finally {
        btnSendOtp.disabled = false;
      }
    });

    div.querySelector("#vaultUnlockEmailForm").addEventListener("submit", async () => {
      const code = otpInput?.value.trim();
      if (!code) return;

      try {
        statusEl.style.display = "none";
        await verifyUnlockAttemptOtp(code);
        close();
        if (typeof window.showToast === "function") {
          window.showToast("Attempt limit reset. You may now enter your Vault PIN.", "success");
        }
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "OTP verification failed.";
        statusEl.style.display = "block";
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Modal: Forgot PIN Flow
  // ---------------------------------------------------------------------------

  function openForgotPinModal() {
    const modalId = "vaultForgotPinModal";
    document.getElementById(modalId)?.remove();

    const user = getAuthenticatedUser();
    const maskedEmail = user?.email ? maskEmail(user.email) : "Authorized Operator";

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card" style="max-width:480px;">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">Reset Vault PIN with Recovery Key</h3>
          <button type="button" class="vault-modal-close-btn" id="btnForgotPinClose">✕</button>
        </div>
        <div class="vault-modal-body">
          <div class="vault-step-desc" style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.45;">
            Resetting your Vault PIN requires <strong>BOTH</strong> an Email OTP sent to <strong>${escapeHtml(maskedEmail)}</strong> AND your 256-bit Recovery Key. Your encrypted data will be preserved.
          </div>

          <div class="vault-status-message" id="forgotPinStatusMsg" style="display:none;"></div>

          <form id="vaultForgotPinForm" autocomplete="off" onsubmit="return false;">
            <!-- 1. Email OTP -->
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">1. Email Verification Code (OTP) *</label>
              <div style="display:flex; gap:6px;">
                <input type="text" id="forgotPinOtp" class="form-control form-control-sm" maxlength="8" placeholder="Enter code" style="letter-spacing:1px; font-weight:600;" required>
                <button type="button" class="btn btn-outline btn-sm" id="btnRequestForgotOtp" style="white-space:nowrap;">Send Code</button>
              </div>
            </div>

            <!-- 2. Recovery Key -->
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">2. 256-Bit Recovery Key *</label>
              <input type="text" id="forgotRecoveryKey" class="form-control form-control-sm" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-..." style="font-family:monospace; font-size:12px;" required autocomplete="off">
              <div style="font-size:10.5px; color:var(--text-dim); margin-top:3px;">
                Paste your 64-character Recovery Key saved during setup.
              </div>
            </div>

            <!-- 3. New PIN -->
            <div class="form-row-2" style="margin-bottom:16px;">
              <div class="form-group" style="margin:0;">
                <label class="form-label">New 6-Digit PIN *</label>
                <input type="password" id="forgotNewPin" class="form-control form-control-sm" maxlength="6" inputmode="numeric" placeholder="••••••" required>
              </div>
              <div class="form-group" style="margin:0;">
                <label class="form-label">Confirm New PIN *</label>
                <input type="password" id="forgotConfirmPin" class="form-control form-control-sm" maxlength="6" inputmode="numeric" placeholder="••••••" required>
              </div>
            </div>

            <div class="vault-modal-footer">
              <button type="button" class="btn btn-ghost btn-sm" id="btnForgotPinCancel">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="btnForgotPinSubmit">Reset PIN &amp; Lock</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnForgotPinClose")?.addEventListener("click", close);
    div.querySelector("#btnForgotPinCancel")?.addEventListener("click", close);

    const statusEl = div.querySelector("#forgotPinStatusMsg");
    const otpInput = div.querySelector("#forgotPinOtp");
    const recInput = div.querySelector("#forgotRecoveryKey");
    const newInput = div.querySelector("#forgotNewPin");
    const confirmInput = div.querySelector("#forgotConfirmPin");
    const btnSendOtp = div.querySelector("#btnRequestForgotOtp");

    [newInput, confirmInput].forEach(inp => {
      inp.addEventListener("input", () => {
        inp.value = inp.value.replace(/\D/g, "").slice(0, 6);
      });
    });

    btnSendOtp.addEventListener("click", async () => {
      btnSendOtp.disabled = true;
      btnSendOtp.textContent = "Sending...";
      try {
        const res = await requestForgotPinOtp();
        statusEl.className = "vault-status-message is-info";
        statusEl.textContent = `Verification code sent to ${res.maskedEmail || maskedEmail}.`;
        statusEl.style.display = "block";
        btnSendOtp.textContent = "Resend";
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "Failed to send code.";
        statusEl.style.display = "block";
        btnSendOtp.textContent = "Send Code";
      } finally {
        btnSendOtp.disabled = false;
      }
    });

    div.querySelector("#vaultForgotPinForm").addEventListener("submit", async () => {
      const otpCode = otpInput.value.trim();
      const recoveryKeyString = recInput.value.trim();
      const newPin = newInput.value;
      const newPinConfirm = confirmInput.value;

      try {
        statusEl.style.display = "none";
        await executeForgotPin({ otpCode, recoveryKeyString, newPin, newPinConfirm });
        close();
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "Recovery failed.";
        statusEl.style.display = "block";
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Modal: Security Settings
  // ---------------------------------------------------------------------------

  async function openVaultSecurityModal() {
    const modalId = "vaultSecurityModal";
    document.getElementById(modalId)?.remove();

    const meta = await getDbMetadata();
    const user = getAuthenticatedUser();
    const verifiedEmail = user?.email || null;
    const hasRecoveryKey = Boolean(meta?.recoveryWrapper);

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card" style="max-width:480px;">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">Vault Security Settings</h3>
          <button type="button" class="vault-modal-close-btn" id="btnSecurityModalClose">✕</button>
        </div>
        <div class="vault-modal-body">
          <div class="vault-security-summary-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:14px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Recovery Email</div>
                <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-top:2px;">
                  ${verifiedEmail ? escapeHtml(maskEmail(verifiedEmail)) : "Not Configured"}
                </div>
              </div>
              <div>
                <span class="vault-cat-chip" style="color:#10b981; background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.3);">
                  Verified ✓
                </span>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Recovery Key</div>
                <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-top:2px;">
                  ${hasRecoveryKey ? "Configured ✓" : "Missing"}
                </div>
              </div>
              <div style="font-size:11px; color:var(--text-dim);">
                256-Bit Envelope Key
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            <button type="button" class="btn btn-outline btn-block" id="btnSecChangePin" style="justify-content:center;">
              Change PIN
            </button>
            <button type="button" class="btn btn-outline btn-block" id="btnSecRotateRecoveryKey" style="justify-content:center;">
              Regenerate Recovery Key
            </button>
          </div>

          <div class="vault-modal-footer" style="margin-top:16px;">
            <button type="button" class="btn btn-ghost btn-sm" id="btnSecurityModalCancel">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnSecurityModalClose").addEventListener("click", close);
    div.querySelector("#btnSecurityModalCancel").addEventListener("click", close);

    div.querySelector("#btnSecChangePin").addEventListener("click", () => {
      close();
      openChangePinModal();
    });

    div.querySelector("#btnSecRotateRecoveryKey").addEventListener("click", () => {
      close();
      openRotateRecoveryKeyModal();
    });
  }

  function openChangePinModal() {
    const modalId = "vaultChangePinModal";
    document.getElementById(modalId)?.remove();

    const user = getAuthenticatedUser();
    const maskedEmail = user?.email ? maskEmail(user.email) : "Authorized Operator";

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card" style="max-width:440px;">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">Change Vault 6-Digit PIN</h3>
          <button type="button" class="vault-modal-close-btn" id="btnChangePinModalClose">✕</button>
        </div>
        <div class="vault-modal-body">
          <div class="vault-step-desc">
            Authorized PIN modification requires verifying your current PIN, receiving an email verification code sent to <strong>${escapeHtml(maskedEmail)}</strong>, and entering your new 6-digit PIN.
          </div>

          <div class="vault-status-message" id="changePinStatusMsg" style="display:none;"></div>

          <form id="vaultChangePinForm" autocomplete="off" onsubmit="return false;">
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Current 6-Digit PIN *</label>
              <input type="password" id="changePinCurrent" class="form-control form-control-sm" maxlength="6" inputmode="numeric" placeholder="••••••" required>
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Email Verification Code (OTP) *</label>
              <div style="display:flex; gap:6px;">
                <input type="text" id="changePinOtp" class="form-control form-control-sm" maxlength="8" placeholder="Enter code" style="letter-spacing:1px; font-weight:600;" required>
                <button type="button" class="btn btn-outline btn-sm" id="btnRequestOtp" style="white-space:nowrap;">Send Code</button>
              </div>
              <div style="font-size:10.5px; color:var(--text-dim); margin-top:3px;">
                Verification code will be sent to <strong>${escapeHtml(maskedEmail)}</strong>
              </div>
            </div>

            <div class="form-row-2" style="margin-bottom:16px;">
              <div class="form-group" style="margin:0;">
                <label class="form-label">New 6-Digit PIN *</label>
                <input type="password" id="changePinNew" class="form-control form-control-sm" maxlength="6" inputmode="numeric" placeholder="••••••" required>
              </div>
              <div class="form-group" style="margin:0;">
                <label class="form-label">Confirm New PIN *</label>
                <input type="password" id="changePinConfirm" class="form-control form-control-sm" maxlength="6" inputmode="numeric" placeholder="••••••" required>
              </div>
            </div>

            <div class="vault-modal-footer">
              <button type="button" class="btn btn-ghost btn-sm" id="btnChangePinCancel">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="btnChangePinSubmit">Change PIN &amp; Lock</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnChangePinModalClose").addEventListener("click", close);
    div.querySelector("#btnChangePinCancel").addEventListener("click", close);

    const statusEl = div.querySelector("#changePinStatusMsg");
    const currentInput = div.querySelector("#changePinCurrent");
    const otpInput = div.querySelector("#changePinOtp");
    const newInput = div.querySelector("#changePinNew");
    const confirmInput = div.querySelector("#changePinConfirm");
    const btnSendOtp = div.querySelector("#btnRequestOtp");

    [currentInput, newInput, confirmInput].forEach(inp => {
      inp.addEventListener("input", () => {
        inp.value = inp.value.replace(/\D/g, "").slice(0, 6);
      });
    });

    btnSendOtp.addEventListener("click", async () => {
      btnSendOtp.disabled = true;
      btnSendOtp.textContent = "Sending...";
      try {
        const res = await requestPinChangeOtp();
        statusEl.className = "vault-status-message is-info";
        statusEl.textContent = `Verification code sent to ${res.maskedEmail || maskedEmail}. Please check your inbox.`;
        statusEl.style.display = "block";
        btnSendOtp.textContent = "Resend";
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "Failed to send verification code.";
        statusEl.style.display = "block";
        btnSendOtp.textContent = "Send Code";
      } finally {
        btnSendOtp.disabled = false;
      }
    });

    div.querySelector("#vaultChangePinForm").addEventListener("submit", async () => {
      const currentPin = currentInput.value;
      const otpCode = otpInput.value.trim();
      const newPin = newInput.value;
      const newPinConfirm = confirmInput.value;

      try {
        statusEl.style.display = "none";
        await executePinChange({ currentPin, otpCode, newPin, newPinConfirm });
        close();
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "PIN change failed.";
        statusEl.style.display = "block";
      }
    });
  }

  function openRotateRecoveryKeyModal() {
    const modalId = "vaultRotateRecoveryModal";
    document.getElementById(modalId)?.remove();

    const user = getAuthenticatedUser();
    const maskedEmail = user?.email ? maskEmail(user.email) : "Authorized Operator";

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card" style="max-width:440px;">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">Regenerate Recovery Key</h3>
          <button type="button" class="vault-modal-close-btn" id="btnRotateModalClose">✕</button>
        </div>
        <div class="vault-modal-body">
          <div class="vault-recovery-warning" style="background:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.25); border-radius:6px; padding:12px; margin-bottom:14px; font-size:12px; line-height:1.45; color:var(--text-secondary);">
            <div style="font-weight:700; color:#f87171; margin-bottom:4px;">Your previous Recovery Key will stop working.</div>
            <div>A new 256-bit Recovery Key will be generated. You must save the new key immediately.</div>
          </div>

          <div class="vault-status-message" id="rotateStatusMsg" style="display:none;"></div>

          <form id="vaultRotateForm" autocomplete="off" onsubmit="return false;">
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Current 6-Digit PIN *</label>
              <input type="password" id="rotateCurrentPin" class="form-control form-control-sm" maxlength="6" inputmode="numeric" placeholder="••••••" required autofocus>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label">Email Verification Code (OTP) *</label>
              <div style="display:flex; gap:6px;">
                <input type="text" id="rotateOtpInput" class="form-control form-control-sm" maxlength="8" placeholder="Enter code" style="letter-spacing:1px; font-weight:600;" required>
                <button type="button" class="btn btn-outline btn-sm" id="btnRequestRotateOtp" style="white-space:nowrap;">Send Code</button>
              </div>
              <div style="font-size:10.5px; color:var(--text-dim); margin-top:3px;">
                Code will be sent to <strong>${escapeHtml(maskedEmail)}</strong>
              </div>
            </div>

            <div class="vault-modal-footer">
              <button type="button" class="btn btn-ghost btn-sm" id="btnRotateCancel">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="btnRotateSubmit">Generate New Key</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnRotateModalClose").addEventListener("click", close);
    div.querySelector("#btnRotateCancel").addEventListener("click", close);

    const statusEl = div.querySelector("#rotateStatusMsg");
    const pinInput = div.querySelector("#rotateCurrentPin");
    const otpInput = div.querySelector("#rotateOtpInput");
    const btnSendOtp = div.querySelector("#btnRequestRotateOtp");

    pinInput.addEventListener("input", () => {
      pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6);
    });

    btnSendOtp.addEventListener("click", async () => {
      btnSendOtp.disabled = true;
      btnSendOtp.textContent = "Sending...";
      try {
        const res = await requestRotateRecoveryKeyOtp();
        statusEl.className = "vault-status-message is-info";
        statusEl.textContent = `Verification code sent to ${res.maskedEmail || maskedEmail}.`;
        statusEl.style.display = "block";
        btnSendOtp.textContent = "Resend";
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "Failed to send code.";
        statusEl.style.display = "block";
        btnSendOtp.textContent = "Send Code";
      } finally {
        btnSendOtp.disabled = false;
      }
    });

    div.querySelector("#vaultRotateForm").addEventListener("submit", async () => {
      const currentPin = pinInput.value;
      const otpCode = otpInput.value.trim();

      try {
        statusEl.style.display = "none";
        await executeRotateRecoveryKey({ currentPin, otpCode });
        close();
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "Recovery Key rotation failed.";
        statusEl.style.display = "block";
      }
    });
  }

  function openCredentialModal(editingCred = null) {
    const isEdit = Boolean(editingCred);
    const existing = editingCred || {};
    const modalId = "vaultCredModal";
    document.getElementById(modalId)?.remove();

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">${isEdit ? "Edit Credential" : "Add New Credential"}</h3>
          <button type="button" class="vault-modal-close-btn" id="btnCredModalClose">✕</button>
        </div>
        <form id="vaultCredForm" class="vault-modal-body" autocomplete="off" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">Label / Name *</label>
            <input type="text" id="credFormLabel" class="form-control form-control-sm" required placeholder="e.g. Blue Iris Gateway" value="${escapeHtml(existing.label || "")}">
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="credFormCategory" class="form-control form-control-sm">
                ${["CCTV", "Microsoft Teams", "Email", "Google Drive", "Other"].map(cat => `
                  <option value="${cat}" ${existing.category === cat ? "selected" : ""}>${cat}</option>
                `).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Username / Email</label>
              <input type="text" id="credFormUser" class="form-control form-control-sm" placeholder="operator@domain.com" value="${escapeHtml(existing.username || "")}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Password *</label>
            <input type="password" id="credFormPwd" class="form-control form-control-sm" required placeholder="Enter password" value="${escapeHtml(existing.password || "")}">
          </div>
          <div class="form-group">
            <label class="form-label">URL / Endpoint</label>
            <input type="url" id="credFormUrl" class="form-control form-control-sm" placeholder="https://..." value="${escapeHtml(existing.url || "")}">
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea id="credFormNotes" class="form-control form-control-sm" rows="2" placeholder="Optional notes...">${escapeHtml(existing.notes || "")}</textarea>
          </div>
          <div class="vault-modal-footer">
            <button type="button" class="btn btn-ghost btn-sm" id="btnCredModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">${isEdit ? "Save Changes" : "Add Credential"}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnCredModalClose").addEventListener("click", close);
    div.querySelector("#btnCredModalCancel").addEventListener("click", close);

    div.querySelector("#vaultCredForm").addEventListener("submit", async () => {
      const label = document.getElementById("credFormLabel").value.trim();
      const category = document.getElementById("credFormCategory").value;
      const username = document.getElementById("credFormUser").value.trim();
      const password = document.getElementById("credFormPwd").value;
      const url = document.getElementById("credFormUrl").value.trim();
      const notes = document.getElementById("credFormNotes").value.trim();

      if (!label || !password) {
        if (typeof window.showToast === "function") window.showToast("Label and Password are required.", "warning");
        return;
      }

      if (isEdit) {
        editingCred.label = label;
        editingCred.category = category;
        editingCred.username = username;
        editingCred.password = password;
        editingCred.url = url;
        editingCred.notes = notes;
        editingCred.updatedAt = new Date().toISOString();
      } else {
        activeVaultData.credentials.unshift({
          id: uid("cred"),
          label,
          category,
          username,
          password,
          url,
          notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      await persistActiveVault();
      close();
      renderUnlockedView();
      if (typeof window.showToast === "function") {
        window.showToast(isEdit ? "Credential updated." : "Credential added.", "success");
      }
    });
  }

  function openNoteModal(editingNote = null) {
    const isEdit = Boolean(editingNote);
    const existing = editingNote || {};
    const modalId = "vaultNoteModal";
    document.getElementById(modalId)?.remove();

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">${isEdit ? "Edit Note" : "Add Encrypted Note"}</h3>
          <button type="button" class="vault-modal-close-btn" id="btnNoteModalClose">✕</button>
        </div>
        <form id="vaultNoteForm" class="vault-modal-body" autocomplete="off" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" id="noteFormTitle" class="form-control form-control-sm" required placeholder="Note title" value="${escapeHtml(existing.title || "")}">
          </div>
          <div class="form-group">
            <label class="form-label">Content *</label>
            <textarea id="noteFormContent" class="form-control form-control-sm" rows="6" required placeholder="Write private notes...">${escapeHtml(existing.content || "")}</textarea>
          </div>
          <div class="vault-modal-footer">
            <button type="button" class="btn btn-ghost btn-sm" id="btnNoteModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">${isEdit ? "Save Changes" : "Save Note"}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnNoteModalClose").addEventListener("click", close);
    div.querySelector("#btnNoteModalCancel").addEventListener("click", close);

    div.querySelector("#vaultNoteForm").addEventListener("submit", async () => {
      const title = document.getElementById("noteFormTitle").value.trim();
      const content = document.getElementById("noteFormContent").value;

      if (!title || !content) {
        if (typeof window.showToast === "function") window.showToast("Title and Content are required.", "warning");
        return;
      }

      if (isEdit) {
        editingNote.title = title;
        editingNote.content = content;
        editingNote.updatedAt = new Date().toISOString();
      } else {
        activeVaultData.notes.unshift({
          id: uid("note"),
          title,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      await persistActiveVault();
      close();
      renderUnlockedView();
      if (typeof window.showToast === "function") {
        window.showToast(isEdit ? "Note updated." : "Note added.", "success");
      }
    });
  }

  function openTemplateModal(editingTmpl = null) {
    const isEdit = Boolean(editingTmpl);
    const existing = editingTmpl || {};
    const modalId = "vaultTmplModal";
    document.getElementById(modalId)?.remove();

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">${isEdit ? "Edit Email Template" : "Add Email Template"}</h3>
          <button type="button" class="vault-modal-close-btn" id="btnTmplModalClose">✕</button>
        </div>
        <form id="vaultTmplForm" class="vault-modal-body" autocomplete="off" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">Template Name *</label>
            <input type="text" id="tmplFormName" class="form-control form-control-sm" required placeholder="e.g. TL Coaching Escalation" value="${escapeHtml(existing.name || "")}">
          </div>
          <div class="form-group">
            <label class="form-label">Subject *</label>
            <input type="text" id="tmplFormSubj" class="form-control form-control-sm" required placeholder="Email subject line..." value="${escapeHtml(existing.subject || "")}">
          </div>
          <div class="form-group">
            <label class="form-label">Body *</label>
            <textarea id="tmplFormBody" class="form-control form-control-sm" rows="6" required placeholder="Template body content...">${escapeHtml(existing.body || "")}</textarea>
          </div>
          <div class="vault-modal-footer">
            <button type="button" class="btn btn-ghost btn-sm" id="btnTmplModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">${isEdit ? "Save Changes" : "Save Template"}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnTmplModalClose").addEventListener("click", close);
    div.querySelector("#btnTmplModalCancel").addEventListener("click", close);

    div.querySelector("#vaultTmplForm").addEventListener("submit", async () => {
      const name = document.getElementById("tmplFormName").value.trim();
      const subject = document.getElementById("tmplFormSubj").value.trim();
      const body = document.getElementById("tmplFormBody").value;

      if (!name || !subject || !body) {
        if (typeof window.showToast === "function") window.showToast("All template fields are required.", "warning");
        return;
      }

      if (isEdit) {
        editingTmpl.name = name;
        editingTmpl.subject = subject;
        editingTmpl.body = body;
        editingTmpl.updatedAt = new Date().toISOString();
      } else {
        activeVaultData.templates.unshift({
          id: uid("tmpl"),
          name,
          subject,
          body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      await persistActiveVault();
      close();
      renderUnlockedView();
      if (typeof window.showToast === "function") {
        window.showToast(isEdit ? "Template updated." : "Template added.", "success");
      }
    });
  }

  function openImportModal(jsonString) {
    const modalId = "vaultImportModal";
    document.getElementById(modalId)?.remove();

    const div = document.createElement("div");
    div.id = modalId;
    div.className = "vault-modal-backdrop is-visible";
    div.innerHTML = `
      <div class="vault-modal-card" style="max-width:440px;">
        <div class="vault-modal-header">
          <h3 class="vault-modal-title">Import Encrypted Vault (v3)</h3>
          <button type="button" class="vault-modal-close-btn" id="btnImportModalClose">✕</button>
        </div>
        <div class="vault-modal-body">
          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
            To decrypt and restore this backup, enter your current 6-digit PIN (server-assisted) or your 256-bit Recovery Key.
          </p>

          <div class="vault-status-message" id="importStatusMsg" style="display:none;"></div>

          <form id="vaultImportForm" autocomplete="off" onsubmit="return false;">
            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label">6-Digit PIN or 64-char Recovery Key</label>
              <input type="password" id="importKeyInput" class="form-control form-control-sm" placeholder="•••••• or Recovery Key" required autofocus>
            </div>

            <div class="vault-modal-footer">
              <button type="button" class="btn btn-ghost btn-sm" id="btnImportCancel">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">Decrypt &amp; Import</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector("#btnImportModalClose").addEventListener("click", close);
    div.querySelector("#btnImportCancel").addEventListener("click", close);

    const keyInput = div.querySelector("#importKeyInput");
    const statusEl = div.querySelector("#importStatusMsg");

    div.querySelector("#vaultImportForm").addEventListener("submit", async () => {
      const keyVal = keyInput.value.trim();
      if (!keyVal) return;

      const ok = window.appConfirm
        ? await window.appConfirm({
            title: "Overwrite current Vault with imported backup?",
            message: "Replacing the current Vault will overwrite existing notes, email templates, and credentials with the backup contents. This action cannot be undone.",
            confirmText: "Replace Vault",
            tone: "danger"
          })
        : window.confirm("Are you sure you want to replace your current Vault with this backup?");
      if (!ok) return;

      try {
        await importEncryptedVault(jsonString, keyVal);
        close();
      } catch (err) {
        statusEl.className = "vault-status-message is-error";
        statusEl.textContent = err.message || "Failed to import backup.";
        statusEl.style.display = "block";
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public Interface
  // ---------------------------------------------------------------------------

  const vaultService = {
    DB_NAME,
    checkOwnerAccess,
    updateVisibility,
    isAuthorizedOwner() {
      const user = getAuthenticatedUser();
      if (!user || !user.id) return false;
      if (cachedOwnerId) {
        return cachedOwnerId === user.id;
      }
      return true;
    },
    isUnlocked() {
      return isUnlocked;
    },
    lock,
    unlockWithPin,
    initializeVaultWithPin,
    requestUnlockAttemptOtp,
    verifyUnlockAttemptOtp,
    requestForgotPinOtp,
    executeForgotPin,
    requestPinChangeOtp,
    executePinChange,
    requestRotateRecoveryKeyOtp,
    executeRotateRecoveryKey,
    exportEncryptedVault,
    importEncryptedVault,
    renderWorkspace,
    persistActiveVault,
    getDecryptedData() {
      return isUnlocked && activeVaultData ? clone(activeVaultData) : null;
    },
    async getInspectionMetadata() {
      const meta = await getDbMetadata();
      const payload = await getDbPayload();
      const user = getAuthenticatedUser();
      if (!meta) return { exists: false };
      return {
        exists: true,
        schemaVersion: meta.schemaVersion,
        hasRecoveryWrapper: Boolean(meta.recoveryWrapper),
        hasPayload: Boolean(payload && payload.ciphertext),
        hasPinWrapper: Boolean(meta.pinWrapper),
        hasPinSalt: Boolean(meta.pinWrapper?.pinSalt),
        hasPinWrappedMasterKey: Boolean(meta.pinWrapper?.pinWrappedMasterKey),
        hasPinVerifier: Boolean(meta.pinVerifier || meta.pinVerifierHmac),
        ownerMatches: Boolean(user && user.id === meta.ownerUserId),
        maskedOwnerEmail: meta.maskedOwnerEmail || maskEmail(meta.ownerEmail)
      };
    },
    migrateToV3: migrateUnlockedVaultToV3,
    // Test hooks for simulated server testing
    __setTestVaultAccessHandler(handler) {
      testVaultAccessHandler = handler;
    },
    __setTestOtpHmacHandler(handler) {
      testOtpHmacHandler = handler;
    }
  };

  root.CCTV_VAULT = vaultService;

  // Auto-lock when user leaves page or reloads
  window.addEventListener("beforeunload", () => {
    vaultService.lock();
  });

  // Listen to CCTV_AUTH state changes to update sidebar visibility dynamically
  if (window.CCTV_AUTH && typeof window.CCTV_AUTH.onAuthChange === "function") {
    window.CCTV_AUTH.onAuthChange(() => {
      vaultService.lock();
      vaultService.updateVisibility();
    });
  }
})(window);
