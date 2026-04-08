"use client";
import { useState, useCallback } from "react";
import { Task, Milestone } from "./types";
import { INITIAL_TASKS, INITIAL_MILESTONES } from "./data";
import { ENABLE_SHAREPOINT, ENABLE_MILESTONES } from "./paConfig";
import {
  paGetTasks, paCreateTask, paUpdateTask, paDeleteTask,
  paGetMilestones, paCreateMilestone, paUpdateMilestone, paDeleteMilestone,
} from "./powerautomate";

let _nextId = 200;
function newId() { return `local-${_nextId++}`; }

export function useProjectData() {
  const [tasks, setTasks]           = useState<Task[]>(INITIAL_TASKS);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [syncing, setSyncing]       = useState(false);
  const [syncError, setSyncError]   = useState<string | null>(null);
  const [synced, setSynced]         = useState(false);

  const syncFromSharePoint = useCallback(async () => {
    if (!ENABLE_SHAREPOINT) {
      setSyncError("SharePoint-sync er ikke aktiveret. Udfyld lib/paConfig.ts og sæt ENABLE_SHAREPOINT til true.");
      return;
    }
    setSyncing(true); setSyncError(null);
    try {
      const [spTasks, spMs] = await Promise.all([
        paGetTasks(),
        ENABLE_MILESTONES ? paGetMilestones() : Promise.resolve([]),
      ]);
      setTasks(spTasks); setMilestones(spMs); setSynced(true);
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : "Ukendt fejl");
    } finally { setSyncing(false); }
  }, []);

  const addTask = useCallback(async (task: Omit<Task, "id">) => {
    const newTask: Task = { ...task, id: newId() };
    setTasks(p => [...p, newTask]);
    if (ENABLE_SHAREPOINT) {
      try {
        const spId = await paCreateTask(newTask);
        setTasks(p => p.map(t => t.id === newTask.id ? { ...t, id: `sp-${spId}`, spId } : t));
      } catch { /* silent */ }
    }
  }, []);

  const updateTask = useCallback(async (task: Task) => {
    setTasks(p => p.map(t => t.id === task.id ? task : t));
    if (ENABLE_SHAREPOINT && task.spId) { try { await paUpdateTask(task); } catch { /* silent */ } }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    setTasks(p => p.filter(t => t.id !== id));
    if (ENABLE_SHAREPOINT && task?.spId) { try { await paDeleteTask(task.spId); } catch { /* silent */ } }
  }, [tasks]);

  const toggleTask = useCallback((id: string) => {
    setTasks(p => {
      const updated = p.map(t => t.id === id ? { ...t, done: !t.done } : t);
      if (ENABLE_SHAREPOINT) {
        const task = updated.find(t => t.id === id);
        if (task?.spId) paUpdateTask(task).catch(() => {});
      }
      return updated;
    });
  }, []);

  const addMilestone = useCallback(async (ms: Omit<Milestone, "id">) => {
    const newMs: Milestone = { ...ms, id: newId() };
    setMilestones(p => [...p, newMs]);
    if (ENABLE_SHAREPOINT && ENABLE_MILESTONES) {
      try {
        const spId = await paCreateMilestone(newMs);
        setMilestones(p => p.map(m => m.id === newMs.id ? { ...m, id: `sp-${spId}`, spId } : m));
      } catch { /* silent */ }
    }
  }, []);

  const updateMilestone = useCallback(async (ms: Milestone) => {
    setMilestones(p => p.map(m => m.id === ms.id ? ms : m));
    if (ENABLE_SHAREPOINT && ENABLE_MILESTONES && ms.spId) { try { await paUpdateMilestone(ms); } catch { /* silent */ } }
  }, []);

  const deleteMilestone = useCallback(async (id: string) => {
    const ms = milestones.find(m => m.id === id);
    setMilestones(p => p.filter(m => m.id !== id));
    if (ENABLE_SHAREPOINT && ENABLE_MILESTONES && ms?.spId) { try { await paDeleteMilestone(ms.spId); } catch { /* silent */ } }
  }, [milestones]);

  const toggleMilestone = useCallback((id: string) => {
    setMilestones(p => {
      const updated = p.map(m => m.id === id ? { ...m, done: !m.done } : m);
      if (ENABLE_SHAREPOINT && ENABLE_MILESTONES) {
        const ms = updated.find(m => m.id === id);
        if (ms?.spId) paUpdateMilestone(ms).catch(() => {});
      }
      return updated;
    });
  }, []);

  return {
    tasks, milestones, setTasks, setMilestones,
    addTask, updateTask, deleteTask, toggleTask,
    addMilestone, updateMilestone, deleteMilestone, toggleMilestone,
    syncFromSharePoint, syncing, syncError, synced,
    sharepointEnabled: ENABLE_SHAREPOINT,
  };
}
