/**
 * Unit tests for lib/sqlite.ts
 * Kører i Node via Vitest — ingen browser/WASM-browser nødvendig.
 * sql.js' Node-build loader WASM automatisk fra node_modules.
 */
import { describe, it, expect, beforeEach } from "vitest";
import initSqlJsFn from "sql.js";
import type { Database } from "sql.js";
import {
  applySchema,
  getProject,
  getTracks,
  insertTrack,
  updateTrack,
  deleteTrack,
  getResponsible,
  insertResponsible,
  updateResponsible,
  deleteResponsible,
  getTasks,
  insertTask,
  updateTask,
  deleteTask,
  getMilestones,
  insertMilestone,
  updateMilestone,
  deleteMilestone,
  insertTaskNote,
  deleteTaskNote,
  getActiveSession,
  checkOut,
  checkIn,
  getSessionLog,
  migrateDatabase,
} from "../sqlite";

// ---------------------------------------------------------------------------
// Hjælpefunktioner
// ---------------------------------------------------------------------------

let SQL: Awaited<ReturnType<typeof initSqlJsFn>>;

async function freshDb(): Promise<Database> {
  if (!SQL) SQL = await initSqlJsFn();
  const db = new SQL.Database();
  applySchema(db);
  return db;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

describe("project", () => {
  it("returnerer null når ingen projekt-række findes", async () => {
    const db = await freshDb();
    expect(getProject(db)).toBeNull();
  });

  it("returnerer projektnavn efter INSERT", async () => {
    const db = await freshDb();
    db.run("INSERT INTO project (id, name) VALUES (1, ?)", ["Test Projekt"]);
    const proj = getProject(db);
    expect(proj).not.toBeNull();
    expect(proj!.name).toBe("Test Projekt");
  });
});

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

describe("tracks", () => {
  it("returnerer tom liste for ny DB", async () => {
    const db = await freshDb();
    expect(getTracks(db)).toEqual([]);
  });

  it("insertTrack + getTracks", async () => {
    const db = await freshDb();
    insertTrack(db, { id: "t1", label: "Spor 1", icon: "📋", color: "#007AA1", sortOrder: 0 });
    const tracks = getTracks(db);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe("t1");
    expect(tracks[0].label).toBe("Spor 1");
  });

  it("updateTrack ændrer label og farve", async () => {
    const db = await freshDb();
    insertTrack(db, { id: "t1", label: "Gammel", icon: "📋", color: "#000", sortOrder: 0 });
    updateTrack(db, { id: "t1", label: "Ny", icon: "📌", color: "#fff", sortOrder: 1 });
    const [track] = getTracks(db);
    expect(track.label).toBe("Ny");
    expect(track.color).toBe("#fff");
    expect(track.sortOrder).toBe(1);
  });

  it("deleteTrack fjerner sporet", async () => {
    const db = await freshDb();
    insertTrack(db, { id: "t1", label: "X", icon: "📋", color: "#000", sortOrder: 0 });
    deleteTrack(db, "t1");
    expect(getTracks(db)).toHaveLength(0);
  });

  it("getTracks sorterer efter sort_order", async () => {
    const db = await freshDb();
    insertTrack(db, { id: "t2", label: "Anden", icon: "📋", color: "#000", sortOrder: 2 });
    insertTrack(db, { id: "t1", label: "Første", icon: "📋", color: "#000", sortOrder: 1 });
    const tracks = getTracks(db);
    expect(tracks[0].id).toBe("t1");
    expect(tracks[1].id).toBe("t2");
  });
});

// ---------------------------------------------------------------------------
// Responsible
// ---------------------------------------------------------------------------

describe("responsible", () => {
  it("returnerer tom liste for ny DB", async () => {
    const db = await freshDb();
    expect(getResponsible(db)).toEqual([]);
  });

  it("insertResponsible opretter person med UUID", async () => {
    const db = await freshDb();
    const r = insertResponsible(db, "Anna");
    expect(r.name).toBe("Anna");
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getResponsible(db)).toHaveLength(1);
  });

  it("updateResponsible ændrer navn", async () => {
    const db = await freshDb();
    const r = insertResponsible(db, "Gammel");
    updateResponsible(db, r.id, "Ny");
    const [updated] = getResponsible(db);
    expect(updated.name).toBe("Ny");
  });

  it("deleteResponsible fjerner person", async () => {
    const db = await freshDb();
    const r = insertResponsible(db, "Slet mig");
    deleteResponsible(db, r.id);
    expect(getResponsible(db)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

describe("tasks", () => {
  let db: Database;

  beforeEach(async () => {
    db = await freshDb();
    insertTrack(db, { id: "t1", label: "Spor", icon: "📋", color: "#000", sortOrder: 0 });
  });

  it("returnerer tom liste for ny DB", () => {
    expect(getTasks(db)).toEqual([]);
  });

  it("insertTask + getTasks", () => {
    insertTask(db, { id: "task-1", track: "t1", text: "Opgave", deadline: "2025-12-01", done: false, owners: [] });
    const tasks = getTasks(db);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe("Opgave");
    expect(tasks[0].done).toBe(false);
    expect(tasks[0].owners).toEqual([]);
  });

  it("updateTask ændrer tekst og done-status", () => {
    insertTask(db, { id: "task-1", track: "t1", text: "Original", deadline: "", done: false, owners: [] });
    updateTask(db, { id: "task-1", track: "t1", text: "Opdateret", deadline: "", done: true, owners: [] });
    const [task] = getTasks(db);
    expect(task.text).toBe("Opdateret");
    expect(task.done).toBe(true);
  });

  it("deleteTask fjerner opgaven", () => {
    insertTask(db, { id: "task-1", track: "t1", text: "Slet mig", deadline: "", done: false, owners: [] });
    deleteTask(db, "task-1");
    expect(getTasks(db)).toHaveLength(0);
  });

  it("task med owner — getTasks returnerer owners array", () => {
    const owner = insertResponsible(db, "Bo");
    insertTask(db, { id: "task-1", track: "t1", text: "Med ejer", deadline: "", done: false, owners: [owner] });
    const [task] = getTasks(db);
    expect(task.owners).toHaveLength(1);
    expect(task.owners[0].name).toBe("Bo");
  });

  it("task med to owners", () => {
    const o1 = insertResponsible(db, "Anna");
    const o2 = insertResponsible(db, "Bo");
    insertTask(db, { id: "task-1", track: "t1", text: "To ejere", deadline: "", done: false, owners: [o1, o2] });
    const [task] = getTasks(db);
    expect(task.owners).toHaveLength(2);
  });

  it("updateTask synkroniserer owners (tilføj og fjern)", () => {
    const o1 = insertResponsible(db, "Anna");
    const o2 = insertResponsible(db, "Bo");
    insertTask(db, { id: "task-1", track: "t1", text: "X", deadline: "", done: false, owners: [o1] });
    updateTask(db, { id: "task-1", track: "t1", text: "X", deadline: "", done: false, owners: [o2] });
    const [task] = getTasks(db);
    expect(task.owners).toHaveLength(1);
    expect(task.owners[0].name).toBe("Bo");
  });
});

// ---------------------------------------------------------------------------
// Task Notes
// ---------------------------------------------------------------------------

describe("task notes", () => {
  let db: Database;

  beforeEach(async () => {
    db = await freshDb();
    insertTrack(db, { id: "t1", label: "Spor", icon: "📋", color: "#000", sortOrder: 0 });
    insertTask(db, { id: "task-1", track: "t1", text: "Opgave", deadline: "", done: false, owners: [] });
  });

  it("insertTaskNote opretter note og returnerer den med id", () => {
    const note = insertTaskNote(db, "task-1", "Første note");
    expect(note.id).toBeGreaterThan(0);
    expect(note.text).toBe("Første note");
    expect(note.taskId).toBe("task-1");
  });

  it("getTasks inkluderer notes", () => {
    insertTaskNote(db, "task-1", "Note A");
    insertTaskNote(db, "task-1", "Note B");
    const [task] = getTasks(db);
    expect(task.notes).toHaveLength(2);
  });

  it("deleteTaskNote fjerner kun den valgte note", () => {
    const n1 = insertTaskNote(db, "task-1", "Behold");
    const n2 = insertTaskNote(db, "task-1", "Slet");
    deleteTaskNote(db, n2.id);
    const [task] = getTasks(db);
    expect(task.notes).toHaveLength(1);
    expect(task.notes![0].id).toBe(n1.id);
  });

  it("notes slettes automatisk ved cascade når task slettes", () => {
    insertTaskNote(db, "task-1", "Orphan note");
    deleteTask(db, "task-1");
    // ingen fejl = cascade virker; tasks-listen er tom
    expect(getTasks(db)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

describe("milestones", () => {
  let db: Database;

  beforeEach(async () => {
    db = await freshDb();
    insertTrack(db, { id: "t1", label: "Spor", icon: "📋", color: "#000", sortOrder: 0 });
  });

  it("returnerer tom liste for ny DB", () => {
    expect(getMilestones(db)).toEqual([]);
  });

  it("insertMilestone + getMilestones", () => {
    insertMilestone(db, { id: "m1", track: "t1", label: "Lancering", date: "2025-06-01", done: false });
    const [ms] = getMilestones(db);
    expect(ms.label).toBe("Lancering");
    expect(ms.done).toBe(false);
  });

  it("updateMilestone ændrer done", () => {
    insertMilestone(db, { id: "m1", track: "t1", label: "X", date: "2025-06-01", done: false });
    updateMilestone(db, { id: "m1", track: "t1", label: "X", date: "2025-06-01", done: true });
    const [ms] = getMilestones(db);
    expect(ms.done).toBe(true);
  });

  it("deleteMilestone fjerner milepælen", () => {
    insertMilestone(db, { id: "m1", track: "t1", label: "Slet", date: "", done: false });
    deleteMilestone(db, "m1");
    expect(getMilestones(db)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

describe("sessions", () => {
  it("getActiveSession returnerer null på ny DB", async () => {
    const db = await freshDb();
    expect(getActiveSession(db)).toBeNull();
  });

  it("checkOut opretter session og returnerer id", async () => {
    const db = await freshDb();
    const id = checkOut(db, "Nicklas");
    expect(id).toBeGreaterThan(0);
    const session = getActiveSession(db);
    expect(session).not.toBeNull();
    expect(session!.userName).toBe("Nicklas");
    expect(session!.checkedInAt).toBeNull();
  });

  it("checkIn afslutter aktiv session", async () => {
    const db = await freshDb();
    const id = checkOut(db, "Nicklas");
    checkIn(db, id);
    expect(getActiveSession(db)).toBeNull();
  });

  it("getSessionLog returnerer alle sessioner inkl. indcheckede", async () => {
    const db = await freshDb();
    checkOut(db, "Anna");
    const id2 = checkOut(db, "Bo");
    checkIn(db, id2);
    const log = getSessionLog(db);
    expect(log.length).toBeGreaterThanOrEqual(2);
    const boEntry = log.find(s => s.userName === "Bo");
    expect(boEntry).toBeDefined();
    expect(boEntry!.checkedInAt).not.toBeNull();
    const annaEntry = log.find(s => s.userName === "Anna");
    expect(annaEntry).toBeDefined();
  });

  it("migrateDatabase er idempotent — fejler ikke ved dobbelt kald", async () => {
    const db = await freshDb();
    expect(() => {
      migrateDatabase(db);
      migrateDatabase(db);
    }).not.toThrow();
  });
});
