// sql.js SQLite wrapper — client-only (browser WASM)
import type { SqlJsStatic, Database } from "sql.js";
import type { Task, Milestone, TrackMeta, Responsible, TaskNote, Project, Session } from "./types";

let SQL: SqlJsStatic | null = null;

export async function initSqlJs(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  const initSqlJsFn = (await import("sql.js")).default;
  SQL = await initSqlJsFn({ locateFile: () => "/sql-wasm.wasm" });
  return SQL;
}

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📋',
  color TEXT NOT NULL DEFAULT '#007AA1',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS responsible (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  text TEXT NOT NULL,
  deadline TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_responsible (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  responsible_id TEXT NOT NULL REFERENCES responsible(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, responsible_id)
);

CREATE TABLE IF NOT EXISTS task_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  label TEXT NOT NULL,
  date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name TEXT NOT NULL,
  checked_out_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_in_at TEXT
);
`;

/** Kør schema på en eksisterende Database-instans — bruges i tests og migration. */
export function applySchema(db: Database): void {
  db.run(SCHEMA);
}

// ---------------------------------------------------------------------------
// Open / Create
// ---------------------------------------------------------------------------

export async function openDatabase(fileHandle: FileSystemFileHandle): Promise<Database> {
  const sql = await initSqlJs();
  const file = await fileHandle.getFile();
  const buffer = await file.arrayBuffer();
  return new sql.Database(new Uint8Array(buffer));
}

export async function createDatabase(
  projectName: string,
  tracks: { id: string; label: string; icon: string; color: string }[],
  responsible: string[],
  fileHandle: FileSystemFileHandle,
): Promise<Database> {
  const sql = await initSqlJs();
  const db = new sql.Database();
  db.run(SCHEMA);
  db.run("INSERT INTO project (id, name) VALUES (1, ?)", [projectName]);
  tracks.forEach((t, i) => {
    db.run("INSERT INTO tracks (id, label, icon, color, sort_order) VALUES (?,?,?,?,?)", [
      t.id, t.label, t.icon, t.color, i,
    ]);
  });
  responsible.forEach((name) => {
    db.run("INSERT INTO responsible (id, name) VALUES (?,?)", [crypto.randomUUID(), name]);
  });
  await saveDatabase(db, fileHandle);
  return db;
}

// Mutex: File System Access API tillader kun ét åbent writable stream ad gangen.
// Vi kæder skrivningerne sekventielt via saveChain.
// Den interne chain-fejl fanges så kæden ikke bryder, men kalderen får fejlen kastet videre.
let saveChain: Promise<void> = Promise.resolve();

export function saveDatabase(db: Database, fileHandle: FileSystemFileHandle): Promise<void> {
  let resolveCurrent!: () => void;
  let rejectCurrent!: (err: unknown) => void;
  const callerPromise = new Promise<void>((res, rej) => {
    resolveCurrent = res;
    rejectCurrent = rej;
  });

  saveChain = saveChain.then(async () => {
    const data = db.export();
    // OneDrive og andre sync-drev kan holde filen låst kortvarigt.
    // Forsøg én gang til efter 350 ms hvis createWritable() fejler første gang.
    let writable: FileSystemWritableFileStream;
    try {
      writable = await fileHandle.createWritable();
    } catch {
      await new Promise(r => setTimeout(r, 350));
      writable = await fileHandle.createWritable();
    }
    await writable.write(data.buffer as ArrayBuffer);
    await writable.close();
    resolveCurrent();
  }).catch((err) => {
    // Kæden fortsætter selv om dette led fejler, men fejlen sendes til kalderen
    rejectCurrent(err);
  });

  return callerPromise;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export function getProject(db: Database): Project | null {
  const res = db.exec("SELECT name, created_at FROM project WHERE id = 1");
  if (!res.length || !res[0].values.length) return null;
  const [name, createdAt] = res[0].values[0] as [string, string];
  return { name, createdAt };
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export function getTracks(db: Database): TrackMeta[] {
  const res = db.exec("SELECT id, label, icon, color, sort_order FROM tracks ORDER BY sort_order");
  if (!res.length) return [];
  return res[0].values.map(([id, label, icon, color, sortOrder]) => ({
    id: id as string,
    label: label as string,
    icon: icon as string,
    color: color as string,
    sortOrder: sortOrder as number,
  }));
}

export function insertTrack(db: Database, track: Omit<TrackMeta, "sortOrder"> & { sortOrder?: number }): void {
  db.run("INSERT INTO tracks (id, label, icon, color, sort_order) VALUES (?,?,?,?,?)", [
    track.id, track.label, track.icon, track.color, track.sortOrder ?? 0,
  ]);
}

export function updateTrack(db: Database, track: TrackMeta): void {
  db.run("UPDATE tracks SET label=?, icon=?, color=?, sort_order=? WHERE id=?", [
    track.label, track.icon, track.color, track.sortOrder, track.id,
  ]);
}

export function deleteTrack(db: Database, trackId: string): void {
  db.run("DELETE FROM tracks WHERE id=?", [trackId]);
}

// ---------------------------------------------------------------------------
// Responsible
// ---------------------------------------------------------------------------

export function getResponsible(db: Database): Responsible[] {
  const res = db.exec("SELECT id, name FROM responsible ORDER BY name");
  if (!res.length) return [];
  return res[0].values.map(([id, name]) => ({ id: id as string, name: name as string }));
}

export function insertResponsible(db: Database, name: string): Responsible {
  const id = crypto.randomUUID();
  db.run("INSERT INTO responsible (id, name) VALUES (?,?)", [id, name]);
  return { id, name };
}

export function updateResponsible(db: Database, id: string, name: string): void {
  db.run("UPDATE responsible SET name=? WHERE id=?", [name, id]);
}

export function deleteResponsible(db: Database, id: string): void {
  db.run("DELETE FROM responsible WHERE id=?", [id]);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function getTasks(db: Database): Task[] {
  const res = db.exec(`
    SELECT t.id, t.track_id, t.text, t.deadline, t.done,
           r.id AS r_id, r.name AS r_name
    FROM tasks t
    LEFT JOIN task_responsible tr ON tr.task_id = t.id
    LEFT JOIN responsible r ON r.id = tr.responsible_id
    ORDER BY t.created_at, t.id
  `);
  if (!res.length) return [];

  const taskMap = new Map<string, Task>();
  for (const row of res[0].values) {
    const [id, track_id, text, deadline, done, r_id, r_name] = row as [
      string, string, string, string | null, number, string | null, string | null
    ];
    if (!taskMap.has(id)) {
      taskMap.set(id, {
        id,
        track: track_id,
        text,
        deadline: deadline ?? "",
        done: done === 1,
        owners: [],
      });
    }
    if (r_id && r_name) {
      taskMap.get(id)!.owners.push({ id: r_id, name: r_name });
    }
  }

  // Load notes
  const notesRes = db.exec("SELECT id, task_id, ts, text FROM task_notes ORDER BY ts");
  if (notesRes.length) {
    for (const row of notesRes[0].values) {
      const [nid, task_id, ts, ntext] = row as [number, string, string, string];
      const task = taskMap.get(task_id);
      if (task) {
        if (!task.notes) task.notes = [];
        task.notes.push({ id: nid, taskId: task_id, ts, text: ntext });
      }
    }
  }

  return Array.from(taskMap.values());
}

export function insertTask(db: Database, task: Omit<Task, "notes">): void {
  db.run(
    "INSERT INTO tasks (id, track_id, text, deadline, done) VALUES (?,?,?,?,?)",
    [task.id, task.track, task.text, task.deadline || null, task.done ? 1 : 0]
  );
  syncTaskResponsible(db, task.id, task.owners);
}

export function updateTask(db: Database, task: Omit<Task, "notes">): void {
  db.run(
    "UPDATE tasks SET track_id=?, text=?, deadline=?, done=? WHERE id=?",
    [task.track, task.text, task.deadline || null, task.done ? 1 : 0, task.id]
  );
  syncTaskResponsible(db, task.id, task.owners);
}

export function deleteTask(db: Database, id: string): void {
  db.run("DELETE FROM tasks WHERE id=?", [id]);
}

function syncTaskResponsible(db: Database, taskId: string, owners: Responsible[]): void {
  db.run("DELETE FROM task_responsible WHERE task_id=?", [taskId]);
  for (const owner of owners) {
    db.run("INSERT OR IGNORE INTO task_responsible (task_id, responsible_id) VALUES (?,?)", [taskId, owner.id]);
  }
}

// ---------------------------------------------------------------------------
// Task Notes
// ---------------------------------------------------------------------------

export function insertTaskNote(db: Database, taskId: string, text: string): TaskNote {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  db.run("INSERT INTO task_notes (task_id, ts, text) VALUES (?,?,?)", [taskId, ts, text]);
  const res = db.exec("SELECT last_insert_rowid()");
  const id = res[0].values[0][0] as number;
  return { id, taskId, ts, text };
}

export function deleteTaskNote(db: Database, id: number): void {
  db.run("DELETE FROM task_notes WHERE id=?", [id]);
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export function getMilestones(db: Database): Milestone[] {
  const res = db.exec("SELECT id, track_id, label, date, done FROM milestones ORDER BY date, created_at");
  if (!res.length) return [];
  return res[0].values.map(([id, track_id, label, date, done]) => ({
    id: id as string,
    track: track_id as string,
    label: label as string,
    date: (date ?? "") as string,
    done: done === 1,
  }));
}

export function insertMilestone(db: Database, ms: Milestone): void {
  db.run("INSERT INTO milestones (id, track_id, label, date, done) VALUES (?,?,?,?,?)", [
    ms.id, ms.track, ms.label, ms.date || null, ms.done ? 1 : 0,
  ]);
}

export function updateMilestone(db: Database, ms: Milestone): void {
  db.run("UPDATE milestones SET track_id=?, label=?, date=?, done=? WHERE id=?", [
    ms.track, ms.label, ms.date || null, ms.done ? 1 : 0, ms.id,
  ]);
}

export function deleteMilestone(db: Database, id: string): void {
  db.run("DELETE FROM milestones WHERE id=?", [id]);
}

// ---------------------------------------------------------------------------
// Sessions (checkout / checkin)
// ---------------------------------------------------------------------------

// Kør ved åbning af eksisterende DB for at sikre tabellen findes
export function migrateDatabase(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      checked_out_at TEXT NOT NULL DEFAULT (datetime('now')),
      checked_in_at TEXT
    )
  `);
}

function nowUtc(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/** Returnerer den aktive (ikke-indcheckede) session, eller null. */
export function getActiveSession(db: Database): Session | null {
  const res = db.exec(
    "SELECT id, user_name, checked_out_at FROM sessions WHERE checked_in_at IS NULL ORDER BY checked_out_at DESC LIMIT 1"
  );
  if (!res.length || !res[0].values.length) return null;
  const [id, userName, checkedOutAt] = res[0].values[0] as [number, string, string];
  return { id, userName, checkedOutAt, checkedInAt: null };
}

/** Checker ud — returnerer session-id. */
export function checkOut(db: Database, userName: string): number {
  const ts = nowUtc();
  db.run("INSERT INTO sessions (user_name, checked_out_at) VALUES (?,?)", [userName, ts]);
  const res = db.exec("SELECT last_insert_rowid()");
  return res[0].values[0][0] as number;
}

/** Checker ind — afslutter den aktive session. */
export function checkIn(db: Database, sessionId: number): void {
  db.run("UPDATE sessions SET checked_in_at=? WHERE id=?", [nowUtc(), sessionId]);
}

/** Returnerer hele log-historikken, nyeste øverst. */
export function getSessionLog(db: Database): Session[] {
  const res = db.exec(
    "SELECT id, user_name, checked_out_at, checked_in_at FROM sessions ORDER BY checked_out_at DESC LIMIT 50"
  );
  if (!res.length) return [];
  return res[0].values.map(([id, userName, checkedOutAt, checkedInAt]) => ({
    id: id as number,
    userName: userName as string,
    checkedOutAt: checkedOutAt as string,
    checkedInAt: (checkedInAt ?? null) as string | null,
  }));
}
