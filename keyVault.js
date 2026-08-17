/**
 * keyVault.js — AlgoSync AI
 *
 * Handles all storage of the user's personal Gemini API key.
 *
 * Design (per project decisions):
 *  - The key is encrypted with AES-GCM before it ever touches
 *    chrome.storage.local. The ciphertext + IV live there.
 *  - The actual CryptoKey used to encrypt/decrypt is generated once,
 *    marked non-extractable, and stored separately in IndexedDB.
 *    Neither storage location alone is enough to recover the plaintext key.
 *  - userId = GitHub username (same value already stored as
 *    `githubUsername` elsewhere in the extension).
 *
 * Public API (only these four functions should be called from outside):
 *   saveApiKey(userId, plaintextKey)
 *   getApiKey(userId)
 *   hasApiKey(userId)
 *   deleteApiKey(userId)
 *
 * Everything else in this file is a private helper — do not call directly.
 */

const KEYVAULT_DB_NAME = "algosync-keyvault";
const KEYVAULT_DB_VERSION = 1;
const KEYVAULT_STORE_NAME = "cryptoKeys";
const KEYVAULT_CRYPTOKEY_ID = "gemini-key-encryption-key"; // fixed id, one key for the whole extension

/* =========================================================================
 * INDEXEDDB — stores the non-extractable AES-GCM CryptoKey
 * ========================================================================= */

function openKeyVaultDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEYVAULT_DB_NAME, KEYVAULT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEYVAULT_STORE_NAME)) {
        db.createObjectStore(KEYVAULT_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open keyvault DB"));
  });
}

function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
  });
}

function idbPut(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("IndexedDB put failed"));
  });
}

function idbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("IndexedDB delete failed"));
  });
}

/**
 * Returns the AES-GCM CryptoKey used to encrypt/decrypt saved API keys.
 * Generates it once (non-extractable) and reuses it after that.
 *
 * Non-extractable means: even with full access to IndexedDB's contents,
 * the raw key bytes can never be pulled out — it can only be *used* via
 * the Web Crypto API, never read.
 */
async function getOrCreateEncryptionKey() {
  const db = await openKeyVaultDb();

  const existing = await idbGet(db, KEYVAULT_STORE_NAME, KEYVAULT_CRYPTOKEY_ID);
  if (existing) {
    return existing;
  }

  const newKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"]
  );

  await idbPut(db, KEYVAULT_STORE_NAME, KEYVAULT_CRYPTOKEY_ID, newKey);
  return newKey;
}

/* =========================================================================
 * chrome.storage.local — stores ciphertext + IV per user
 * ========================================================================= */

function storageKeyFor(userId) {
  return `geminiKeyVault:${userId}`;
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/* =========================================================================
 * PUBLIC API
 * ========================================================================= */

/**
 * Encrypts and saves the user's Gemini API key.
 * Overwrites any previously saved key for this userId.
 * `createdAt` is set only if this is the first time a key is saved for
 * this userId — rotating an existing key does NOT reset it.
 */
async function saveApiKey(userId, plaintextKey) {
  if (!userId) throw new Error("saveApiKey: userId is required");
  if (!plaintextKey || !plaintextKey.trim()) throw new Error("saveApiKey: plaintextKey is required");

  const cryptoKey = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV, standard for AES-GCM

  const encoded = new TextEncoder().encode(plaintextKey.trim());
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoded
  );

  const key = storageKeyFor(userId);
  const existingRecord = await chrome.storage.local.get(key);
  const existing = existingRecord[key];

  const now = new Date().toISOString();

  const record = {
    userId,
    encryptedKey: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
    createdAt: existing?.createdAt || now, // never reset on rotation
    lastValidated: now,
  };

  await chrome.storage.local.set({ [key]: record });
}

/**
 * Decrypts and returns the plaintext Gemini API key for this user.
 * Returns null if no key is saved.
 * Only call this right before sending the key to the Worker — never
 * log or persist the plaintext anywhere.
 */
async function getApiKey(userId) {
  if (!userId) return null;

  const key = storageKeyFor(userId);
  const result = await chrome.storage.local.get(key);
  const record = result[key];
  if (!record) return null;

  try {
    const cryptoKey = await getOrCreateEncryptionKey();
    const iv = new Uint8Array(base64ToBuffer(record.iv));
    const encryptedBuffer = base64ToBuffer(record.encryptedKey);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encryptedBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    // Decryption failure here almost always means the IndexedDB CryptoKey
    // and the chrome.storage.local ciphertext have gone out of sync
    // (e.g. IndexedDB was cleared independently of storage.local).
    // Treat this the same as "no key" rather than throwing — the normal
    // hasApiKey() -> key-entry-screen flow will recover from this cleanly.
    console.error("keyVault: failed to decrypt saved API key:", error.message);
    return null;
  }
}

/**
 * Quick existence check — does NOT decrypt anything.
 * Use this to decide whether to show the key-entry screen.
 */
async function hasApiKey(userId) {
  if (!userId) return false;
  const key = storageKeyFor(userId);
  const result = await chrome.storage.local.get(key);
  return !!result[key];
}

/**
 * Deletes the saved key for this user.
 * Note: the shared AES-GCM CryptoKey in IndexedDB is intentionally NOT
 * deleted here — it's reused across key rotations for any user, and
 * deleting it would silently break decryption for other stored records
 * (not a concern today with a single local user, but keeps this function
 * correct if that ever changes).
 */
async function deleteApiKey(userId) {
  if (!userId) return;
  const key = storageKeyFor(userId);
  await chrome.storage.local.remove(key);
}

// Exposed for use by background.js / popup.js
// (No module system in use elsewhere in this extension, so attach to
// self/window the same way toast.js exposes window.algosyncToast.)
self.AlgoSyncKeyVault = {
  saveApiKey,
  getApiKey,
  hasApiKey,
  deleteApiKey,
};