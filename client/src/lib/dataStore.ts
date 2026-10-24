/**
 * Glitch — Private data store
 * All personal data is encrypted with AES-GCM before it touches storage. The key is generated
 * on-device as a *non-extractable* WebCrypto key and kept in IndexedDB, so the raw key can't be
 * read out by scripts or copied off the device, and the stored blob is unreadable on its own.
 *
 * `DataStore` is the seam for a cloud backend (e.g. DynamoDB behind Cognito): implement the same
 * three methods and swap `dataStore` below — callers don't change.
 */

export interface DataStore {
  load<T>(): Promise<T | null>;
  save<T>(snapshot: T): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "glitch-keys";
const KEY_ID = "snapshot-key";
const BLOB_KEY = "glitch.snapshot.v1";

function idb<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("keys");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("keys", mode);
      const req = fn(tx.objectStore("keys"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}

let keyPromise: Promise<CryptoKey> | null = null;
function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const existing = await idb<CryptoKey | undefined>("readonly", (s) => s.get(KEY_ID));
      if (existing) return existing;
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await idb("readwrite", (s) => s.put(key, KEY_ID));
      return key;
    })();
    keyPromise.catch(() => { keyPromise = null; });
  }
  return keyPromise;
}

function toB64(buf: ArrayBuffer | Uint8Array) {
  // Chunked: spreading a large array into fromCharCode overflows the call stack
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

class EncryptedLocalStore implements DataStore {
  async load<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem(BLOB_KEY);
      if (!raw) return null;
      const { iv, data } = JSON.parse(raw) as { iv: string; data: string };
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await getKey(), fromB64(data));
      return JSON.parse(new TextDecoder().decode(plain)) as T;
    } catch (err) {
      // Wrong/missing key (e.g. site data partially cleared) — treat as a fresh start
      console.warn("Could not restore saved data:", err);
      return null;
    }
  }

  async save<T>(snapshot: T): Promise<void> {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), new TextEncoder().encode(JSON.stringify(snapshot)));
      localStorage.setItem(BLOB_KEY, JSON.stringify({ iv: toB64(iv), data: toB64(data) }));
    } catch (err) {
      console.warn("Could not save data:", err);
    }
  }

  async clear(): Promise<void> {
    try { localStorage.removeItem(BLOB_KEY); } catch { /* storage unavailable */ }
    try { await idb("readwrite", (s) => s.delete(KEY_ID)); } catch { /* idb unavailable */ }
    keyPromise = null;
  }
}

export const dataStore: DataStore = new EncryptedLocalStore();

/** Download everything we hold about the user as JSON (data portability). */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
