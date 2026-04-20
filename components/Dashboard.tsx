"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Database } from "sql.js";
import { useProjectData } from "@/lib/useProjectData";
import { loadHandle, clearHandle } from "@/lib/fileHandle";
import {
  openDatabase, initSqlJs, updateTrack, deleteTrack, insertTrack,
  migrateDatabase, getActiveSession, checkOut, checkIn, getSessionLog,
  saveDatabase,
} from "@/lib/sqlite";
import { Task, Milestone, TrackMeta, Session } from "@/lib/types";
import TaskModal from "@/components/TaskModal";
import MilestoneModal from "@/components/MilestoneModal";
import ProjectSetup from "@/components/ProjectSetup";
import IconPicker from "@/components/IconPicker";

const C = {
  dark: "#1D3E47", teal: "#006564", yellow: "#EEC32B",
  bordeaux: "#992B30", light: "#f0f4f4", mid: "#e2eaeb", muted: "#6b8b90",
};

const MS_PER_DAY = 86400000;
function toMs(s: string) { return s ? new Date(s).getTime() : null; }
type ViewType = "tasks" | "timeline" | "milestones" | "owners";

const LANE_H = 28;
const LANE_PAD = 8;

function assignLanes<T>(items: T[], getPct: (t: T) => number, thresholdPct = 13): { item: T; lane: number }[] {
  const sorted = [...items].sort((a, b) => getPct(a) - getPct(b));
  const laneEnds: number[] = [];
  return sorted.map(item => {
    const pos = getPct(item);
    let lane = laneEnds.findIndex(end => pos - end >= thresholdPct);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = pos;
    return { item, lane };
  });
}

export default function Dashboard() {
  const [db, setDb]                   = useState<Database | null>(null);
  const [fileHandle, setFileHandle]   = useState<FileSystemFileHandle | null>(null);
  const [loading, setLoading]         = useState(true);
  const [needsPermission, setNeedsPermission] = useState(false);

  const {
    project, tasks, milestones, tracks, responsible, autoSaving, saveError, setSaveError,
    addTask, updateTask, deleteTask, toggleTask,
    addNote, removeNote,
    addMilestone, updateMilestone, deleteMilestone, toggleMilestone,
    ensureResponsible, addResponsible, renameResponsible, removeResponsible,
    reloadTracks, flushAndCancel,
  } = useProjectData(db, fileHandle);

  const [activeTrack, setActiveTrack]       = useState<string>("");
  const [view, setView]                     = useState<ViewType>("tasks");
  const [editTask, setEditTask]             = useState<(Partial<Task> & { id: string }) | null>(null);
  const [editMS, setEditMS]                 = useState<(Partial<Milestone> & { id: string }) | null>(null);
  const [showDoneTl, setShowDoneTl]         = useState(false);
  const [selectedOwner, setSelectedOwner]   = useState<string>("");
  const [groupByTrack, setGroupByTrack]     = useState(true);
  const [showSettings, setShowSettings]     = useState(false);
  const [showSessionLog, setShowSessionLog] = useState(false);
  const [editTrackId, setEditTrackId]       = useState<string | null>(null);
  const [editTrackDraft, setEditTrackDraft] = useState<TrackMeta | null>(null);
  const [showAddTrack, setShowAddTrack]     = useState(false);
  const [newTrackDraft, setNewTrackDraft]   = useState({ id: "", label: "", icon: "📋", color: "#007AA1" });
  const [renameResponsibleId, setRenameResponsibleId] = useState<string | null>(null);
  const [renameResponsibleVal, setRenameResponsibleVal] = useState("");
  const [newResponsibleVal, setNewResponsibleVal] = useState("");

  // Checkout-state
  const [sessionId, setSessionId]         = useState<number | null>(null);
  const [userName, setUserName]           = useState<string>("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput]         = useState("");
  const [occupiedBy, setOccupiedBy]       = useState<Session | null>(null);
  const [sessionLog, setSessionLog]       = useState<Session[]>([]);
  // DB + handle der venter på at blive åbnet efter navn er bekræftet
  const pendingOpen = useRef<{ database: Database; handle: FileSystemFileHandle } | null>(null);

  // Læs gemt brugernavn fra localStorage
  useEffect(() => {
    const stored = localStorage.getItem("norddjurs-username");
    if (stored) setUserName(stored);
  }, []);

  /** Kør efter DB er klar: migration, tjek aktiv session, checkout eller vis prompt */
  const activateDatabase = useCallback(async (database: Database, handle: FileSystemFileHandle, name: string) => {
    migrateDatabase(database);
    const active = getActiveSession(database);
    if (active) {
      setOccupiedBy(active);
      pendingOpen.current = { database, handle };
      return;
    }
    const sid = checkOut(database, name);
    try {
      await saveDatabase(database, handle);
    } catch { /* initial save fejlede (f.eks. OneDrive sync) — åbn DB alligevel; saveError vises i UI */ }
    setSessionId(sid);
    setDb(database);
    setFileHandle(handle);
    setNeedsPermission(false);
  }, []);

  /** Åbn DB — hvis ingen brugernavn er sat, vis prompt først */
  const openWithName = useCallback(async (database: Database, handle: FileSystemFileHandle) => {
    const stored = localStorage.getItem("norddjurs-username") ?? "";
    if (stored) {
      await activateDatabase(database, handle, stored);
    } else {
      pendingOpen.current = { database, handle };
      setShowNamePrompt(true);
    }
  }, [activateDatabase]);

  // Forsøg at gendanne handle fra IndexedDB ved opstart
  useEffect(() => {
    let ignore = false; // forhindrer dobbelt-aktivering i React StrictMode
    (async () => {
      await initSqlJs();
      if (ignore) return;
      const handle = await loadHandle().catch(() => null);
      if (!handle || ignore) { setLoading(false); return; }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perm = await (handle as any).queryPermission({ mode: "readwrite" });
        if (perm === "granted" && !ignore) {
          const database = await openDatabase(handle);
          if (!ignore) await openWithName(database, handle);
        } else if (!ignore) {
          setNeedsPermission(true);
          setFileHandle(handle);
        }
      } catch { /* fil slettet/flyttet */ }
      if (!ignore) setLoading(false);
    })();
    return () => { ignore = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sæt første track som aktiv når tracks indlæses
  useEffect(() => {
    if (tracks.length && !activeTrack) setActiveTrack(tracks[0].id);
  }, [tracks, activeTrack]);

  // Opdatér session-log når indstillinger åbnes
  useEffect(() => {
    if (showSettings && db) setSessionLog(getSessionLog(db));
  }, [showSettings, db]);

  const handleProjectReady = useCallback(async (database: Database, fh: FileSystemFileHandle) => {
    await openWithName(database, fh);
    setNeedsPermission(false);
  }, [openWithName]);

  /** Checkin + gem + ryd state */
  const handleUnlink = async () => {
    if (db && fileHandle && sessionId !== null) {
      checkIn(db, sessionId);
      await flushAndCancel(); // gemmer DB (inkl. checkin) og annullerer timer
    }
    await clearHandle();
    setDb(null);
    setFileHandle(null);
    setActiveTrack("");
    setSessionId(null);
    setOccupiedBy(null);
    setNeedsPermission(false);
  };

  const handleRequestPermission = async () => {
    if (!fileHandle) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (fileHandle as any).requestPermission({ mode: "readwrite" });
      const database = await openDatabase(fileHandle);
      await openWithName(database, fileHandle);
    } catch { /* bruger annullerede */ }
  };

  /** Bekræft brugernavn fra prompt */
  const handleConfirmName = async (override = false) => {
    const name = nameInput.trim() || userName;
    if (!name) return;
    if (nameInput.trim()) {
      localStorage.setItem("norddjurs-username", nameInput.trim());
      setUserName(nameInput.trim());
    }
    setShowNamePrompt(false);
    setNameInput("");
    if (!pendingOpen.current) return;
    const { database, handle } = pendingOpen.current;
    pendingOpen.current = null;
    if (override) {
      // Tving checkout selvom nogen er tjekket ud
      migrateDatabase(database);
      const sid = checkOut(database, name);
      await saveDatabase(database, handle).catch(() => {});
      setSessionId(sid);
      setDb(database);
      setFileHandle(handle);
      setOccupiedBy(null);
      setNeedsPermission(false);
    } else {
      await activateDatabase(database, handle, name);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: C.muted, fontSize: 14 }}>Indlæser…</span>
      </div>
    );
  }

  if (needsPermission) {
    return (
      <div style={{ minHeight: "100vh", background: C.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "40px 36px", maxWidth: 400, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <p style={{ color: C.dark, fontWeight: 600, marginBottom: 8 }}>Klik for at genaktivere adgang til projektfilen</p>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>{fileHandle?.name}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={handleRequestPermission} style={{ padding: "10px 20px", background: C.dark, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
              Genaktivér
            </button>
            <button onClick={handleUnlink} style={{ padding: "10px 20px", background: "#fff", color: C.muted, border: `1px solid ${C.mid}`, borderRadius: 8, cursor: "pointer" }}>
              Vælg en anden
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Navneprompt ──
  if (showNamePrompt) {
    return (
      <div style={{ minHeight: "100vh", background: C.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "40px 36px", maxWidth: 380, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Hvem er du?</div>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Dit navn registreres i databasens checkout-log, så andre kan se hvem der arbejder i projektet.</p>
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleConfirmName(); }}
            placeholder="Dit navn"
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.mid}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none", color: C.dark, marginBottom: 16 }}
          />
          <button
            onClick={() => handleConfirmName()}
            disabled={!nameInput.trim()}
            style={{ width: "100%", padding: "10px", background: C.dark, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: nameInput.trim() ? "pointer" : "not-allowed", opacity: nameInput.trim() ? 1 : 0.5 }}
          >
            Fortsæt
          </button>
        </div>
      </div>
    );
  }

  // ── Optaget-overlay ──
  if (occupiedBy) {
    const since = new Date(occupiedBy.checkedOutAt).toLocaleString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return (
      <div style={{ minHeight: "100vh", background: C.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "40px 36px", maxWidth: 420, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Projektet er i brug</div>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>
            <strong style={{ color: C.dark }}>{occupiedBy.userName}</strong> checkede ud {since}.
          </p>
          <p style={{ color: C.muted, fontSize: 12, marginBottom: 28 }}>
            Vent til vedkommende checker ind igen, eller åbn alligevel (risiko for at overskrive hinandens ændringer).
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setOccupiedBy(null); pendingOpen.current = null; }}
              style={{ flex: 1, padding: "10px", background: "#fff", color: C.dark, border: `1px solid ${C.mid}`, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
            >
              Gå tilbage
            </button>
            <button
              onClick={() => {
                if (!nameInput && !userName) { setShowNamePrompt(true); return; }
                handleConfirmName(true);
              }}
              style={{ flex: 1, padding: "10px", background: C.bordeaux, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
            >
              Åbn alligevel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!db) {
    return <ProjectSetup onProjectReady={handleProjectReady} />;
  }

  // ── Helpers ──
  const activeTrackMeta = tracks.find(t => t.id === activeTrack) ?? tracks[0];
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  const currentTasks = tasks
    .filter(t => t.track === activeTrack)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1; if (!b.deadline) return -1;
      return a.deadline < b.deadline ? -1 : 1;
    });

  const allTasksSorted = tasks
    .filter(t => selectedOwner === "" || t.owners.some(o => o.name === selectedOwner))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1; if (!b.deadline) return -1;
      return a.deadline < b.deadline ? -1 : 1;
    });

  // Timeline
  const todayStr = new Date().toISOString().slice(0, 10);
  const allDated = [...tasks.filter(t => t.deadline), ...milestones.filter(m => m.date)];
  const allMs = allDated.map(x => toMs((x as Task).deadline || (x as Milestone).date)).filter(Boolean) as number[];
  const minD  = allMs.length ? Math.min(...allMs) - 5 * MS_PER_DAY : Date.now();
  const maxD  = allMs.length ? Math.max(...allMs) + 10 * MS_PER_DAY : Date.now() + 120 * MS_PER_DAY;
  const span  = maxD - minD;
  const toPct = (d: string) => (((toMs(d) ?? 0) - minD) / span) * 100;
  const months: Date[] = [];
  const cur = new Date(minD); cur.setDate(1);
  while (cur.getTime() < maxD) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }

  const trackColor = (trackId: string) => tracks.find(t => t.id === trackId)?.color ?? C.teal;
  const trackIcon  = (trackId: string) => tracks.find(t => t.id === trackId)?.icon ?? "📋";

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${C.mid}`, borderRadius: 6, padding: "5px 9px",
    fontSize: 13, outline: "none", background: "#fff", color: C.dark,
  };

  return (
    <div style={{ fontFamily: "'Trebuchet MS', sans-serif", background: C.light, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: C.dark, color: "white", padding: "16px 24px 12px", flexShrink: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", opacity: 0.5, marginBottom: 2 }}>Norddjurs Kommune</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{project?.name ?? "Projekt"}</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 1 }}>
              {new Date().toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {autoSaving && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>💾 Gemmer…</span>}
            {saveError && (
              <span
                onClick={() => setSaveError(null)}
                title="Klik for at lukke"
                style={{ fontSize: 11, color: "#fff", background: "#c0392b", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
              >
                ⚠ Gem fejlede: {saveError}
              </span>
            )}
            {!autoSaving && !saveError && fileHandle && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>📄 {fileHandle.name}</span>}
            {userName && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)", borderRadius: 5, padding: "3px 8px" }}>👤 {userName}</span>}
            <button onClick={handleUnlink} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Fjern link
            </button>
            <button onClick={() => setShowSettings(s => !s)} style={{ padding: "7px 14px", background: showSettings ? C.yellow : "rgba(255,255,255,0.1)", color: showSettings ? C.dark : "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ⚙ Indstillinger
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 999, height: 7 }}>
            <div style={{ width: `${pct}%`, background: C.yellow, height: 7, borderRadius: 999, transition: "width 0.5s" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.yellow, minWidth: 110 }}>{done}/{total} opgaver · {pct}%</span>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ background: "white", borderBottom: `1px solid ${C.mid}`, padding: "16px 24px" }}>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>

            {/* Track management */}
            <div style={{ flex: "1 1 300px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Spor</div>
              {tracks.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {editTrackId === t.id && editTrackDraft ? (
                    <>
                      <IconPicker value={editTrackDraft.icon} onChange={icon => setEditTrackDraft(d => d ? { ...d, icon } : d)} />
                      <input value={editTrackDraft.label} onChange={e => setEditTrackDraft(d => d ? { ...d, label: e.target.value } : d)} style={{ ...inputStyle, flex: 1 }} />
                      <input type="color" value={editTrackDraft.color} onChange={e => setEditTrackDraft(d => d ? { ...d, color: e.target.value } : d)} style={{ width: 32, height: 28, border: `1px solid ${C.mid}`, borderRadius: 4, padding: 1, cursor: "pointer" }} />
                      <button onClick={() => { if (editTrackDraft && db) { updateTrack(db, editTrackDraft); reloadTracks(); setEditTrackId(null); } }} style={{ ...inputStyle, padding: "4px 10px", background: C.teal, color: "#fff", border: "none", cursor: "pointer" }}>OK</button>
                      <button onClick={() => setEditTrackId(null)} style={{ ...inputStyle, padding: "4px 10px", cursor: "pointer" }}>×</button>
                    </>
                  ) : (
                    <>
                      <span style={{ width: 24, textAlign: "center" }}>{t.icon}</span>
                      <span style={{ flex: 1, fontSize: 13, color: C.dark }}>{t.label}</span>
                      <span style={{ width: 18, height: 18, borderRadius: 4, background: t.color, display: "inline-block", flexShrink: 0 }} />
                      <button onClick={() => { setEditTrackId(t.id); setEditTrackDraft({ ...t }); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>✏️</button>
                      <button onClick={() => { if (db) { deleteTrack(db, t.id); reloadTracks(); if (activeTrack === t.id) setActiveTrack(tracks[0]?.id ?? ""); } }} style={{ background: "none", border: "none", color: C.bordeaux, cursor: "pointer", fontSize: 13 }}>🗑</button>
                    </>
                  )}
                </div>
              ))}
              {showAddTrack ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <IconPicker value={newTrackDraft.icon} onChange={icon => setNewTrackDraft(d => ({ ...d, icon }))} />
                  <input value={newTrackDraft.label} onChange={e => setNewTrackDraft(d => ({ ...d, label: e.target.value }))} placeholder="Navn" style={{ ...inputStyle, flex: 1 }} />
                  <input type="color" value={newTrackDraft.color} onChange={e => setNewTrackDraft(d => ({ ...d, color: e.target.value }))} style={{ width: 32, height: 28, border: `1px solid ${C.mid}`, borderRadius: 4, padding: 1, cursor: "pointer" }} />
                  <button onClick={() => {
                    if (!newTrackDraft.label.trim() || !db) return;
                    const id = newTrackDraft.label.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
                    insertTrack(db, { ...newTrackDraft, id, sortOrder: tracks.length });
                    reloadTracks();
                    setShowAddTrack(false);
                    setNewTrackDraft({ id: "", label: "", icon: "📋", color: "#007AA1" });
                  }} style={{ ...inputStyle, padding: "4px 10px", background: C.teal, color: "#fff", border: "none", cursor: "pointer" }}>Tilføj</button>
                  <button onClick={() => setShowAddTrack(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>×</button>
                </div>
              ) : (
                <button onClick={() => setShowAddTrack(true)} style={{ marginTop: 6, background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: 13 }}>+ Tilføj spor</button>
              )}
            </div>

            {/* Session log */}
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>Checkout-log</div>
                <button onClick={() => setShowSessionLog(s => !s)} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: 12 }}>
                  {showSessionLog ? "Skjul" : "Vis"}
                </button>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                Logget ind som <strong style={{ color: C.dark }}>{userName || "—"}</strong>
                <button onClick={() => { setNameInput(userName); setShowNamePrompt(true); }} style={{ marginLeft: 8, background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: 11 }}>Skift navn</button>
              </div>
              {showSessionLog && (
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {sessionLog.length === 0 && <p style={{ fontSize: 12, color: C.muted }}>Ingen log endnu.</p>}
                  {sessionLog.map(s => {
                    const outTime = new Date(s.checkedOutAt).toLocaleString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                    const inTime  = s.checkedInAt ? new Date(s.checkedInAt).toLocaleString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
                    const active  = !s.checkedInAt;
                    return (
                      <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderBottom: `1px solid ${C.mid}` }}>
                        <span style={{ fontSize: 11, marginTop: 1 }}>{active ? "🟢" : "⚪"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>{s.userName}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>Ud: {outTime}</div>
                          {inTime && <div style={{ fontSize: 11, color: C.muted }}>Ind: {inTime}</div>}
                          {active && <div style={{ fontSize: 11, color: C.teal, fontWeight: 600 }}>Aktiv session</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Responsible management */}
            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Ansvarlige</div>
              {responsible.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {renameResponsibleId === r.id ? (
                    <>
                      <input value={renameResponsibleVal} onChange={e => setRenameResponsibleVal(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoFocus />
                      <button onClick={() => { renameResponsible(r.id, renameResponsibleVal); setRenameResponsibleId(null); }} style={{ ...inputStyle, padding: "4px 10px", background: C.teal, color: "#fff", border: "none", cursor: "pointer" }}>OK</button>
                      <button onClick={() => setRenameResponsibleId(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>×</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13, color: C.dark }}>👤 {r.name}</span>
                      <button onClick={() => { setRenameResponsibleId(r.id); setRenameResponsibleVal(r.name); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>✏️</button>
                      <button onClick={() => removeResponsible(r.id)} style={{ background: "none", border: "none", color: C.bordeaux, cursor: "pointer", fontSize: 13 }}>🗑</button>
                    </>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input value={newResponsibleVal} onChange={e => setNewResponsibleVal(e.target.value)} placeholder="Nyt navn" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => { if (e.key === "Enter" && newResponsibleVal.trim()) { addResponsible(newResponsibleVal.trim()); setNewResponsibleVal(""); }}} />
                <button onClick={() => { if (newResponsibleVal.trim()) { addResponsible(newResponsibleVal.trim()); setNewResponsibleVal(""); }}} style={{ ...inputStyle, padding: "4px 12px", background: C.teal, color: "#fff", border: "none", cursor: "pointer" }}>+</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View tabs */}
      <div style={{ background: "white", borderBottom: `2px solid ${C.mid}`, display: "flex", flexShrink: 0 }}>
        {([ ["tasks","📋 Opgaver"], ["timeline","📅 Tidslinje"], ["milestones","🏁 Milepæle"], ["owners","👤 Ansvarlige"] ] as [ViewType, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "10px 22px", border: "none", background: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            color: view === v ? C.teal : C.muted,
            borderBottom: view === v ? `3px solid ${C.teal}` : "3px solid transparent",
          }}>{label}</button>
        ))}
      </div>

      {/* ── TASKS toolbar ── */}
      {view === "tasks" && (
        <div style={{ background: "white", borderBottom: `1px solid ${C.mid}`, padding: "8px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", border: `1px solid ${C.mid}`, borderRadius: 7, overflow: "hidden" }}>
            {([[true, "Per spor"], [false, "Alle opgaver"]] as [boolean, string][]).map(([val, label]) => (
              <button key={String(val)} onClick={() => setGroupByTrack(val)} style={{
                padding: "5px 14px", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: 600,
                background: groupByTrack === val ? C.teal : "none",
                color: groupByTrack === val ? "white" : C.muted,
              }}>{label}</button>
            ))}
          </div>
          {!groupByTrack && (
            <select value={selectedOwner} onChange={e => setSelectedOwner(e.target.value)}
              style={{ border: `1px solid ${C.mid}`, borderRadius: 6, padding: "5px 9px", fontSize: 12, color: C.dark, background: "white", cursor: "pointer" }}>
              <option value="">Alle ansvarlige</option>
              {[...new Set(tasks.flatMap(t => t.owners.map(o => o.name)))].sort().map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── TASKS ── */}
      {view === "tasks" && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {groupByTrack && (
            <div style={{ width: 215, background: "white", borderRight: `1px solid ${C.mid}`, overflowY: "auto", flexShrink: 0 }}>
              {tracks.map(t => {
                const tt = tasks.filter(x => x.track === t.id);
                const d  = tt.filter(x => x.done).length;
                const active = t.id === activeTrack;
                return (
                  <button key={t.id} onClick={() => setActiveTrack(t.id)} style={{
                    width: "100%", textAlign: "left", padding: "11px 14px", border: "none",
                    background: active ? `${t.color}12` : "none",
                    borderLeft: `4px solid ${active ? t.color : "transparent"}`,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? t.color : C.dark }}>{t.icon} {t.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, background: C.mid, borderRadius: 999, height: 4 }}>
                        <div style={{ width: `${tt.length ? (d / tt.length) * 100 : 0}%`, background: t.color, height: 4, borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.muted }}>{d}/{tt.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {groupByTrack ? (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {activeTrackMeta && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{activeTrackMeta.icon}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{activeTrackMeta.label}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>({currentTasks.length})</span>
                  </div>
                  <button
                    onClick={() => setEditTask({ id: "__new__", track: activeTrack, text: "", owners: [], deadline: "", done: false })}
                    style={{ padding: "7px 16px", background: activeTrackMeta.color, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >+ Tilføj opgave</button>
                </div>
              )}

              {currentTasks.length === 0 && (
                <div style={{ textAlign: "center", color: C.muted, marginTop: 48, fontSize: 13 }}>Ingen opgaver endnu — tilføj din første!</div>
              )}

              {currentTasks.map(task => (
                <div key={task.id} onClick={() => setEditTask(task)} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px",
                  marginBottom: 7, background: "white", borderRadius: 8,
                  border: `1px solid ${task.done ? (activeTrackMeta?.color ?? C.teal) + "55" : C.mid}`,
                  opacity: task.done ? 0.6 : 1, transition: "opacity 0.2s", cursor: "pointer",
                }}>
                  <button onClick={e => { e.stopPropagation(); toggleTask(task.id); }} style={{
                    width: 20, height: 20, borderRadius: 4, border: `2px solid ${task.done ? (activeTrackMeta?.color ?? C.teal) : "#bbb"}`,
                    background: task.done ? (activeTrackMeta?.color ?? C.teal) : "white", flexShrink: 0, marginTop: 1,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {task.done && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.dark, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.45 }}>{task.text}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {task.owners.map(o => <span key={o.id} style={{ fontSize: 11, color: C.muted, background: C.light, borderRadius: 4, padding: "1px 6px" }}>👤 {o.name}</span>)}
                      {task.deadline && <span style={{ fontSize: 11, color: C.bordeaux, fontWeight: 600 }}>⏰ {new Date(task.deadline).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}</span>}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setEditTask(task); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "2px 5px" }}>✏️</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>
                  Alle opgaver <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>({allTasksSorted.length})</span>
                </span>
                <button
                  onClick={() => setEditTask({ id: "__new__", track: tracks[0]?.id ?? "", text: "", owners: [], deadline: "", done: false })}
                  style={{ padding: "7px 16px", background: C.teal, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >+ Tilføj opgave</button>
              </div>

              {allTasksSorted.length === 0 && (
                <div style={{ textAlign: "center", color: C.muted, marginTop: 48, fontSize: 13 }}>Ingen opgaver fundet.</div>
              )}

              {allTasksSorted.map(task => {
                const tColor = trackColor(task.track);
                const tIcon  = trackIcon(task.track);
                const tLabel = tracks.find(t => t.id === task.track)?.label ?? task.track;
                return (
                  <div key={task.id} onClick={() => setEditTask(task)} style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px",
                    marginBottom: 7, background: "white", borderRadius: 8,
                    border: `1px solid ${task.done ? tColor + "55" : C.mid}`,
                    opacity: task.done ? 0.6 : 1, transition: "opacity 0.2s", cursor: "pointer",
                  }}>
                    <button onClick={e => { e.stopPropagation(); toggleTask(task.id); }} style={{
                      width: 20, height: 20, borderRadius: 4, border: `2px solid ${task.done ? tColor : "#bbb"}`,
                      background: task.done ? tColor : "white", flexShrink: 0, marginTop: 1,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {task.done && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: C.dark, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.45 }}>{task.text}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: tColor, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: C.muted }}>{tIcon} {tLabel}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        {task.owners.map(o => <span key={o.id} style={{ fontSize: 11, color: C.muted, background: C.light, borderRadius: 4, padding: "1px 6px" }}>👤 {o.name}</span>)}
                        {task.deadline && <span style={{ fontSize: 11, color: C.bordeaux, fontWeight: 600 }}>⏰ {new Date(task.deadline).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}</span>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setEditTask(task); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "2px 5px" }}>✏️</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TIMELINE ── */}
      {view === "timeline" && (
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          <div style={{ minWidth: 900 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={showDoneTl} onChange={e => setShowDoneTl(e.target.checked)} style={{ accentColor: C.teal }} />
                Vis færdiggjorte opgaver
              </label>
            </div>
            <div style={{ position: "relative", height: 28, marginLeft: 160, marginBottom: 4 }}>
              {months.map((m, i) => (
                <div key={i} style={{ position: "absolute", left: `${toPct(m.toISOString().slice(0, 10))}%`, transform: "translateX(-50%)", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {m.toLocaleDateString("da-DK", { month: "short", year: "2-digit" })}
                </div>
              ))}
              <div style={{ position: "absolute", left: `${toPct(todayStr)}%`, transform: "translateX(-50%)", bottom: -4, fontSize: 10, fontWeight: 700, color: C.bordeaux, whiteSpace: "nowrap" }}>I dag</div>
            </div>
            {tracks.map(t => {
              const tTasks = tasks.filter(x => x.track === t.id && x.deadline && (showDoneTl || !x.done));
              const tMs    = milestones.filter(m => m.track === t.id && m.date);
              if (!tTasks.length && !tMs.length) return null;
              const laned    = assignLanes(tTasks, task => toPct(task.deadline));
              const numLanes = laned.length ? Math.max(...laned.map(l => l.lane)) + 1 : 1;
              const msZone   = tMs.length ? 26 : 0;
              const rowHeight = msZone + LANE_PAD + numLanes * LANE_H + LANE_PAD;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ width: 160, flexShrink: 0, fontSize: 11, fontWeight: 700, color: t.color, textAlign: "right", paddingRight: 12, lineHeight: 1.3 }}>
                    {t.icon} {t.label}
                  </div>
                  <div style={{ flex: 1, position: "relative", height: rowHeight, background: `${t.color}10`, borderRadius: 8, border: `1px solid ${t.color}25` }}>
                    {months.map((m, i) => <div key={i} style={{ position: "absolute", left: `${toPct(m.toISOString().slice(0, 10))}%`, top: 0, bottom: 0, width: 1, background: `${t.color}20` }} />)}
                    <div style={{ position: "absolute", left: `${toPct(todayStr)}%`, top: 0, bottom: 0, width: 2, background: C.bordeaux, opacity: 0.5, zIndex: 1, borderRadius: 1 }} />
                    {tMs.map(ms => (
                      <div key={ms.id} title={ms.label} onClick={() => setEditMS(ms)} style={{ position: "absolute", left: `${toPct(ms.date)}%`, top: 3, transform: "translateX(-50%)", fontSize: 16, cursor: "pointer", zIndex: 3 }}>🏁</div>
                    ))}
                    {laned.map(({ item: task, lane }) => (
                      <div key={task.id}
                        title={`${task.text}\n${task.owners.map(o => "👤 " + o.name).join(", ")}\n⏰ ${task.deadline}`}
                        onClick={() => setEditTask(task)}
                        style={{ position: "absolute", left: `${toPct(task.deadline)}%`, top: msZone + LANE_PAD + lane * LANE_H + 4, transform: "translateX(-50%)", background: task.done ? t.color : "white", border: `2px solid ${t.color}`, color: task.done ? "white" : t.color, fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px", cursor: "pointer", whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", zIndex: 2 }}>
                        {task.text.slice(0, 24)}{task.text.length > 24 ? "…" : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>💡 Klik på en opgave eller 🏁 for at redigere. Opgaver uden deadline vises ikke.</p>
          </div>
        </div>
      )}

      {/* ── MILESTONES ── */}
      {view === "milestones" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>Nøglemilepæle</span>
            <button onClick={() => setEditMS({ id: "__new__", date: "", label: "", track: tracks[0]?.id ?? "", done: false })} style={{ padding: "7px 16px", background: C.teal, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Tilføj milepæl</button>
          </div>
          {[...milestones].sort((a, b) => a.date > b.date ? 1 : -1).map((m, i, arr) => {
            const color = trackColor(m.track);
            return (
              <div key={m.id} style={{ display: "flex", gap: 14, marginBottom: 6, alignItems: "flex-start" }}>
                <div style={{ minWidth: 76, textAlign: "right", fontSize: 12, fontWeight: 700, color, paddingTop: 8 }}>
                  {m.date ? new Date(m.date).toLocaleDateString("da-DK", { day: "numeric", month: "short" }) : "—"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <button onClick={() => toggleMilestone(m.id)} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${color}`, background: m.done ? color : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {m.done && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </button>
                  {i < arr.length - 1 && <div style={{ width: 2, height: 26, background: C.mid }} />}
                </div>
                <div style={{ flex: 1, background: "white", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: m.done ? C.muted : C.dark, border: `1px solid ${m.done ? color + "50" : C.mid}`, textDecoration: m.done ? "line-through" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{trackIcon(m.track)} {m.label}</span>
                  <button onClick={() => setEditMS(m)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "0 4px", flexShrink: 0 }}>✏️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ANSVARLIGE ── */}
      {view === "owners" && (() => {
        const allOwnerNames = [...new Set(tasks.flatMap(t => t.owners.map(o => o.name)))].sort();
        const filteredTasks = selectedOwner === ""
          ? tasks.filter(t => t.owners.length > 0)
          : tasks.filter(t => t.owners.some(o => o.name === selectedOwner));
        return (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <div style={{ width: 215, background: "white", borderRight: `1px solid ${C.mid}`, overflowY: "auto", flexShrink: 0 }}>
              {(() => {
                const active = selectedOwner === "";
                const total  = tasks.filter(t => t.owners.length > 0).length;
                const done   = tasks.filter(t => t.owners.length > 0 && t.done).length;
                return (
                  <button onClick={() => setSelectedOwner("")} style={{ width: "100%", textAlign: "left", padding: "11px 14px", border: "none", background: active ? `${C.teal}12` : "none", borderLeft: `4px solid ${active ? C.teal : "transparent"}`, cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.teal : C.dark }}>👥 Alle</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, background: C.mid, borderRadius: 999, height: 4 }}>
                        <div style={{ width: `${total ? (done / total) * 100 : 0}%`, background: C.teal, height: 4, borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.muted }}>{done}/{total}</span>
                    </div>
                  </button>
                );
              })()}
              {allOwnerNames.map(name => {
                const ownerTasks = tasks.filter(t => t.owners.some(o => o.name === name));
                const ownerDone  = ownerTasks.filter(t => t.done).length;
                const active     = selectedOwner === name;
                return (
                  <button key={name} onClick={() => setSelectedOwner(name)} style={{ width: "100%", textAlign: "left", padding: "11px 14px", border: "none", background: active ? `${C.teal}12` : "none", borderLeft: `4px solid ${active ? C.teal : "transparent"}`, cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.teal : C.dark }}>👤 {name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, background: C.mid, borderRadius: 999, height: 4 }}>
                        <div style={{ width: `${ownerTasks.length ? (ownerDone / ownerTasks.length) * 100 : 0}%`, background: C.teal, height: 4, borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.muted }}>{ownerDone}/{ownerTasks.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {filteredTasks.length === 0 && <div style={{ textAlign: "center", color: C.muted, marginTop: 48, fontSize: 13 }}>Ingen opgaver fundet.</div>}
              {tracks.map(t => {
                const trackTasks = filteredTasks.filter(task => task.track === t.id).sort((a, b) => {
                  if (a.done !== b.done) return a.done ? 1 : -1;
                  if (!a.deadline && !b.deadline) return 0;
                  if (!a.deadline) return 1; if (!b.deadline) return -1;
                  return a.deadline < b.deadline ? -1 : 1;
                });
                if (!trackTasks.length) return null;
                return (
                  <div key={t.id} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.color, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{t.icon} {t.label}</span>
                      <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>({trackTasks.length})</span>
                    </div>
                    {trackTasks.map(task => (
                      <div key={task.id} onClick={() => setEditTask(task)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", marginBottom: 7, background: "white", borderRadius: 8, border: `1px solid ${task.done ? t.color + "55" : C.mid}`, opacity: task.done ? 0.6 : 1, cursor: "pointer" }}>
                        <button onClick={e => { e.stopPropagation(); toggleTask(task.id); }} style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${task.done ? t.color : "#bbb"}`, background: task.done ? t.color : "white", flexShrink: 0, marginTop: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {task.done && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: C.dark, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.45 }}>{task.text}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                            {task.owners.map(o => (
                              <span key={o.id} style={{ fontSize: 11, background: o.name === selectedOwner ? `${C.teal}18` : C.light, color: o.name === selectedOwner ? C.teal : C.muted, borderRadius: 4, padding: "1px 6px" }}>👤 {o.name}</span>
                            ))}
                            {task.deadline && <span style={{ fontSize: 11, color: C.bordeaux, fontWeight: 600 }}>⏰ {new Date(task.deadline).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}</span>}
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setEditTask(task); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "2px 5px" }}>✏️</button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {editTask && (
        <TaskModal
          task={editTask}
          tracks={tracks}
          responsible={responsible}
          onSave={(t, newOwnerNames) => {
            // Ensure any new names are created in DB first
            const owners = newOwnerNames.map(name => ensureResponsible(name));
            const taskWithOwners = { ...t, owners };
            if (editTask.id === "__new__") addTask(taskWithOwners);
            else updateTask(taskWithOwners as Task);
            setEditTask(null);
          }}
          onDelete={id => { deleteTask(id); setEditTask(null); }}
          onAddNote={(taskId, text) => { addNote(taskId, text); }}
          onRemoveNote={(noteId) => { removeNote(noteId); }}
          onClose={() => setEditTask(null)}
        />
      )}
      {editMS && (
        <MilestoneModal
          ms={editMS}
          tracks={tracks}
          onSave={m => { editMS.id === "__new__" ? addMilestone(m) : updateMilestone(m as Milestone); setEditMS(null); }}
          onDelete={id => { deleteMilestone(id); setEditMS(null); }}
          onClose={() => setEditMS(null)}
        />
      )}
    </div>
  );
}
