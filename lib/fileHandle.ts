const DB_NAME  = "norddjurs-budget";
const STORE    = "handles";
const FILE_KEY = "xlsx-file";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(handle, FILE_KEY);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function loadHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(FILE_KEY);
    req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function clearHandle(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(FILE_KEY);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
