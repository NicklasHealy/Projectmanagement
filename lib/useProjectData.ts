"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { Database } from "sql.js";
import type { Task, Milestone, TrackMeta, Responsible, Project } from "./types";
import {
  getTasks, insertTask, updateTask as dbUpdateTask, deleteTask as dbDeleteTask,
  getMilestones, insertMilestone, updateMilestone as dbUpdateMilestone, deleteMilestone as dbDeleteMilestone,
  getTracks, getResponsible, insertResponsible,
  getProject, saveDatabase,
  insertTaskNote, deleteTaskNote,
} from "./sqlite";
import { saveHandle } from "./fileHandle";

const DEBOUNCE_MS = 800;

export function useProjectData(db: Database | null, fileHandle: FileSystemFileHandle | null) {
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [milestones, setMilestones]   = useState<Milestone[]>([]);
  const [tracks, setTracks]           = useState<TrackMeta[]>([]);
  const [responsible, setResponsible] = useState<Responsible[]>([]);
  const [project, setProject]         = useState<Project | null>(null);
  const [autoSaving, setAutoSaving]   = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

  const dirtyRef      = useRef(false);
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all data from DB when db changes
  useEffect(() => {
    if (!db) {
      setTasks([]); setMilestones([]); setTracks([]); setResponsible([]); setProject(null);
      return;
    }
    setTasks(getTasks(db));
    setMilestones(getMilestones(db));
    setTracks(getTracks(db));
    setResponsible(getResponsible(db));
    setProject(getProject(db));
  }, [db]);

  const scheduleSave = useCallback(() => {
    if (!db || !fileHandle) return;
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setAutoSaving(true);
      try {
        await saveDatabase(db, fileHandle);
        await saveHandle(fileHandle);
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Gem fejlede");
      }
      setAutoSaving(false);
    }, DEBOUNCE_MS);
  }, [db, fileHandle]);

  // Gem øjeblikkeligt og annullér eventuel ventende debounce-timer.
  // Bruges f.eks. ved checkin/Fjern link, så DB gemmes én gang med den
  // seneste tilstand (inkl. checkin-record) og timeren ikke kører bagefter.
  const flushAndCancel = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    dirtyRef.current = false;
    if (!db || !fileHandle) return;
    try {
      await saveDatabase(db, fileHandle);
      setSaveError(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gem fejlede");
    }
  }, [db, fileHandle]);

  // ---------------------------------------------------------------------------
  // Responsible
  // ---------------------------------------------------------------------------

  const ensureResponsible = useCallback((name: string): Responsible => {
    if (!db) throw new Error("No database");
    const existing = getResponsible(db).find(r => r.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const newR = insertResponsible(db, name);
    setResponsible(getResponsible(db));
    scheduleSave();
    return newR;
  }, [db, scheduleSave]);

  const addResponsible = useCallback((name: string): Responsible => {
    if (!db) throw new Error("No database");
    const r = insertResponsible(db, name);
    setResponsible(getResponsible(db));
    scheduleSave();
    return r;
  }, [db, scheduleSave]);

  const renameResponsible = useCallback((id: string, name: string) => {
    if (!db) return;
    db.run("UPDATE responsible SET name=? WHERE id=?", [name, id]);
    setResponsible(getResponsible(db));
    // update in-memory tasks
    setTasks(prev => prev.map(t => ({
      ...t,
      owners: t.owners.map(o => o.id === id ? { ...o, name } : o),
    })));
    scheduleSave();
  }, [db, scheduleSave]);

  const removeResponsible = useCallback((id: string) => {
    if (!db) return;
    db.run("DELETE FROM responsible WHERE id=?", [id]);
    setResponsible(getResponsible(db));
    setTasks(prev => prev.map(t => ({ ...t, owners: t.owners.filter(o => o.id !== id) })));
    scheduleSave();
  }, [db, scheduleSave]);

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  const addTask = useCallback((task: Omit<Task, "id">) => {
    if (!db) return;
    const newTask: Task = { ...task, id: crypto.randomUUID() };
    insertTask(db, newTask);
    setTasks(getTasks(db));
    setResponsible(getResponsible(db));
    scheduleSave();
  }, [db, scheduleSave]);

  const updateTask = useCallback((task: Task) => {
    if (!db) return;
    dbUpdateTask(db, task);
    setTasks(getTasks(db));
    setResponsible(getResponsible(db));
    scheduleSave();
  }, [db, scheduleSave]);

  const deleteTask = useCallback((id: string) => {
    if (!db) return;
    dbDeleteTask(db, id);
    setTasks(getTasks(db));
    scheduleSave();
  }, [db, scheduleSave]);

  const toggleTask = useCallback((id: string) => {
    if (!db) return;
    const task = getTasks(db).find(t => t.id === id);
    if (!task) return;
    dbUpdateTask(db, { ...task, done: !task.done });
    setTasks(getTasks(db));
    scheduleSave();
  }, [db, scheduleSave]);

  const addNote = useCallback((taskId: string, text: string) => {
    if (!db) return;
    insertTaskNote(db, taskId, text);
    setTasks(getTasks(db));
    scheduleSave();
  }, [db, scheduleSave]);

  const removeNote = useCallback((noteId: number) => {
    if (!db) return;
    deleteTaskNote(db, noteId);
    setTasks(getTasks(db));
    scheduleSave();
  }, [db, scheduleSave]);

  // ---------------------------------------------------------------------------
  // Milestones
  // ---------------------------------------------------------------------------

  const addMilestone = useCallback((ms: Omit<Milestone, "id">) => {
    if (!db) return;
    const newMs: Milestone = { ...ms, id: crypto.randomUUID() };
    insertMilestone(db, newMs);
    setMilestones(getMilestones(db));
    scheduleSave();
  }, [db, scheduleSave]);

  const updateMilestone = useCallback((ms: Milestone) => {
    if (!db) return;
    dbUpdateMilestone(db, ms);
    setMilestones(getMilestones(db));
    scheduleSave();
  }, [db, scheduleSave]);

  const deleteMilestone = useCallback((id: string) => {
    if (!db) return;
    dbDeleteMilestone(db, id);
    setMilestones(getMilestones(db));
    scheduleSave();
  }, [db, scheduleSave]);

  const toggleMilestone = useCallback((id: string) => {
    if (!db) return;
    const ms = getMilestones(db).find(m => m.id === id);
    if (!ms) return;
    dbUpdateMilestone(db, { ...ms, done: !ms.done });
    setMilestones(getMilestones(db));
    scheduleSave();
  }, [db, scheduleSave]);

  // ---------------------------------------------------------------------------
  // Tracks
  // ---------------------------------------------------------------------------

  const reloadTracks = useCallback(() => {
    if (!db) return;
    setTracks(getTracks(db));
  }, [db]);

  return {
    project, tasks, milestones, tracks, responsible, autoSaving, saveError, setSaveError,
    setTasks, setMilestones,
    addTask, updateTask, deleteTask, toggleTask,
    addNote, removeNote,
    addMilestone, updateMilestone, deleteMilestone, toggleMilestone,
    ensureResponsible, addResponsible, renameResponsible, removeResponsible,
    reloadTracks, flushAndCancel,
  };
}
