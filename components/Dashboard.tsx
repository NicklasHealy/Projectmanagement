"use client";
import { useState, useRef, useEffect } from "react";
import { useProjectData } from "@/lib/useProjectData";
import { exportToXlsx, importFromXlsx, readFromHandle, writeToHandle } from "@/lib/excel";
import { saveHandle, loadHandle, clearHandle } from "@/lib/fileHandle";
import { TRACK_META, trackMeta } from "@/lib/data";
import { Task, Milestone } from "@/lib/types";
import TaskModal from "@/components/TaskModal";
import MilestoneModal from "@/components/MilestoneModal";


const C = {
  dark: "#1D3E47", teal: "#006564", yellow: "#EEC32B",
  bordeaux: "#992B30", light: "#f0f4f4", mid: "#e2eaeb", muted: "#6b8b90",
};

const MS_PER_DAY = 86400000;
function toMs(s: string) { return s ? new Date(s).getTime() : null; }
function parseOwners(owner: string): string[] {
  return owner.split(";").map(s => s.trim()).filter(Boolean);
}
type ViewType = "tasks" | "timeline" | "milestones" | "owners";

const LANE_H = 28;
const LANE_PAD = 8;

function assignLanes<T>(
  items: T[],
  getPct: (t: T) => number,
  thresholdPct = 13,
): { item: T; lane: number }[] {
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
  const {
    tasks, milestones, setTasks, setMilestones,
    addTask, updateTask, deleteTask, toggleTask,
    addMilestone, updateMilestone, deleteMilestone, toggleMilestone,
    syncFromSharePoint, syncing, syncError, synced, sharepointEnabled,
  } = useProjectData();

  const [activeTrack, setActiveTrack] = useState("digital");
  const [view, setView]               = useState<ViewType>("tasks");
  const [editTask, setEditTask]       = useState<(Partial<Task> & { id: string }) | null>(null);
  const [editMS, setEditMS]           = useState<(Partial<Milestone> & { id: string }) | null>(null);
  const [showDoneTl, setShowDoneTl]       = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [fileHandle, setFileHandle]   = useState<FileSystemFileHandle | null>(null);
  const [autoSaving, setAutoSaving]   = useState(false);
  const [fsaSupported, setFsaSupported] = useState(false);
  const fileRef  = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gendan handle fra IndexedDB ved opstart
  useEffect(() => {
    setFsaSupported("showOpenFilePicker" in window);
    loadHandle().then(async handle => {
      if (!handle) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perm = await (handle as any).queryPermission({ mode: "readwrite" });
        if (perm === "granted") {
          const data = await readFromHandle(handle);
          setTasks(data.tasks); setMilestones(data.milestones);
        }
      } catch { /* fil kan være slettet/flyttet */ }
      setFileHandle(handle);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll Excel-filen hvert 30. sekund for eksterne ændringer
  useEffect(() => {
    if (!fileHandle) return;                          // Ingen fil linket → stop

    const interval = setInterval(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perm = await (fileHandle as any).queryPermission({ mode: "readwrite" });
        if (perm !== "granted") return;               // Tilladelse trukket tilbage → skip

        const data = await readFromHandle(fileHandle);
        setTasks(data.tasks);
        setMilestones(data.milestones);
      } catch { /* fil kan være slettet/låst */ }
    }, 30_000);                                       // 30.000 ms = 30 sekunder

    return () => clearInterval(interval);             // Cleanup når fileHandle ændres
  }, [fileHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-gem ved ændringer (debounce 800ms)
  useEffect(() => {
    if (!fileHandle) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      try { await writeToHandle(fileHandle, tasks, milestones); }
      catch { /* fil kan være låst */ }
      finally { setAutoSaving(false); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [tasks, milestones, fileHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  


  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { tasks: t, milestones: m } = await importFromXlsx(file);
    setTasks(t); setMilestones(m);
    e.target.value = "";
  };

  const linkFile = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [handle]: FileSystemFileHandle[] = await (window as any).showOpenFilePicker({
        types: [{ description: "Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (handle as any).requestPermission({ mode: "readwrite" });
      await saveHandle(handle);
      const data = await readFromHandle(handle);
      setTasks(data.tasks); setMilestones(data.milestones);
      setFileHandle(handle);
    } catch { /* bruger annullerede */ }
  };

  const unlinkFile = async () => {
    await clearHandle();
    setFileHandle(null);
    window.location.reload();
  };

  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;
  const currentTasks = tasks
    .filter(t => t.track === activeTrack)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline < b.deadline ? -1 : 1;
    });
  const tm = trackMeta(activeTrack);

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

  return (
    <div style={{ fontFamily: "'Trebuchet MS', sans-serif", background: C.light, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: C.dark, color: "white", padding: "16px 24px 12px", flexShrink: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", opacity: 0.5, marginBottom: 2 }}>Norddjurs Kommune</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Sammen om Norddjurs — Budget 2027</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 1 }}>
              {new Date().toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={syncFromSharePoint}
              disabled={syncing}
              style={{
                padding: "7px 14px", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer",
                background: synced ? "#2d7a2d" : sharepointEnabled ? "#0078d4" : "rgba(255,255,255,0.15)",
                color: "white", opacity: syncing ? 0.7 : 1,
              }}
              title={sharepointEnabled ? "Hent data fra SharePoint" : "Konfigurér lib/paConfig.ts for at aktivere SharePoint-sync"}
            >
              {syncing ? "⏳ Synkroniserer…" : synced ? "✅ SharePoint synket" : sharepointEnabled ? "🔄 Synkronisér med SharePoint" : "☁ SharePoint (ikke konfigureret)"}
            </button>
            {fsaSupported ? (
              fileHandle ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {autoSaving
                    ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>💾 Gemmer…</span>
                    : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>📄 {fileHandle.name}</span>
                  }
                  <button onClick={unlinkFile} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Fjern link
                  </button>
                </div>
              ) : (
                <button onClick={linkFile} style={{ padding: "7px 14px", background: C.yellow, color: C.dark, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  📂 Link til Excel-fil
                </button>
              )
            ) : (
              <>
                <input type="file" accept=".xlsx" ref={fileRef} onChange={handleImport} style={{ display: "none" }} />
                <button onClick={() => fileRef.current?.click()} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ⬆ Importer .xlsx
                </button>
                <button onClick={() => exportToXlsx(tasks, milestones)} style={{ padding: "7px 14px", background: C.yellow, color: C.dark, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ⬇ Eksporter .xlsx
                </button>
              </>
            )}
          </div>
        </div>

        {syncError && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#ffaaaa", background: "rgba(255,0,0,0.1)", borderRadius: 5, padding: "5px 12px" }}>
            ⚠ {syncError}
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 999, height: 7 }}>
            <div style={{ width: `${pct}%`, background: C.yellow, height: 7, borderRadius: 999, transition: "width 0.5s" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.yellow, minWidth: 110 }}>{done}/{total} opgaver · {pct}%</span>
        </div>
      </div>

      {/* Tabs */}
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

      {/* ── TASKS ── */}
      {view === "tasks" && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div style={{ width: 215, background: "white", borderRight: `1px solid ${C.mid}`, overflowY: "auto", flexShrink: 0 }}>
            {TRACK_META.map(t => {
              const tt = tasks.filter(x => x.track === t.id);
              const d = tt.filter(x => x.done).length;
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

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{tm.icon}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{tm.label}</span>
                <span style={{ fontSize: 12, color: C.muted }}>({currentTasks.length})</span>
              </div>
              <button
                onClick={() => setEditTask({ id: "__new__", track: activeTrack as Task["track"], text: "", owner: "", deadline: "", done: false })}
                style={{ padding: "7px 16px", background: tm.color, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >+ Tilføj opgave</button>
            </div>

            {currentTasks.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, marginTop: 48, fontSize: 13 }}>Ingen opgaver endnu — tilføj din første!</div>
            )}

            {currentTasks.map(task => (
              <div key={task.id} onClick={() => setEditTask(task)} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px",
                marginBottom: 7, background: "white", borderRadius: 8,
                border: `1px solid ${task.done ? tm.color + "55" : C.mid}`,
                opacity: task.done ? 0.6 : 1, transition: "opacity 0.2s",
                cursor: "pointer",
              }}>
                <button onClick={e => { e.stopPropagation(); toggleTask(task.id); }} style={{
                  width: 20, height: 20, borderRadius: 4, border: `2px solid ${task.done ? tm.color : "#bbb"}`,
                  background: task.done ? tm.color : "white", flexShrink: 0, marginTop: 1,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {task.done && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.dark, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.45 }}>{task.text}</div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                    {task.owner && <span style={{ fontSize: 11, color: C.muted }}>👤 {task.owner}</span>}
                    {task.deadline && <span style={{ fontSize: 11, color: C.bordeaux, fontWeight: 600 }}>⏰ {new Date(task.deadline).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}</span>}
                    {task.spId && <span style={{ fontSize: 10, color: "#0078d4" }}>☁ SP</span>}
                  </div>
                </div>
                <button onClick={() => setEditTask(task)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "2px 5px" }}>✏️</button>
              </div>
            ))}
          </div>
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
              {/* Dags dato-label i header */}
              <div style={{ position: "absolute", left: `${toPct(todayStr)}%`, transform: "translateX(-50%)", bottom: -4, fontSize: 10, fontWeight: 700, color: C.bordeaux, whiteSpace: "nowrap" }}>
                I dag
              </div>
            </div>
            {TRACK_META.map(t => {
              const tTasks  = tasks.filter(x => x.track === t.id && x.deadline && (showDoneTl || !x.done));
              const tMs     = milestones.filter(m => m.track === t.id && m.date);
              if (!tTasks.length && !tMs.length) return null;
              const laned    = assignLanes(tTasks, task => toPct(task.deadline));
              const numLanes = laned.length ? Math.max(...laned.map(l => l.lane)) + 1 : 1;
              const msZone   = tMs.length ? 26 : 0;  // plads øverst til milepæle
              const rowHeight = msZone + LANE_PAD + numLanes * LANE_H + LANE_PAD;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ width: 160, flexShrink: 0, fontSize: 11, fontWeight: 700, color: t.color, textAlign: "right", paddingRight: 12, lineHeight: 1.3 }}>
                    {t.icon} {t.label}
                  </div>
                  <div style={{ flex: 1, position: "relative", height: rowHeight, background: `${t.color}10`, borderRadius: 8, border: `1px solid ${t.color}25` }}>
                    {months.map((m, i) => <div key={i} style={{ position: "absolute", left: `${toPct(m.toISOString().slice(0, 10))}%`, top: 0, bottom: 0, width: 1, background: `${t.color}20` }} />)}
                    {/* Dags dato-linje */}
                    <div style={{ position: "absolute", left: `${toPct(todayStr)}%`, top: 0, bottom: 0, width: 2, background: C.bordeaux, opacity: 0.5, zIndex: 1, borderRadius: 1 }} />
                    {/* Milepæle øverst */}
                    {tMs.map(ms => (
                      <div key={ms.id} title={ms.label} onClick={() => setEditMS(ms)}
                        style={{ position: "absolute", left: `${toPct(ms.date)}%`, top: 3, transform: "translateX(-50%)", fontSize: 16, cursor: "pointer", zIndex: 3, filter: ms.done ? "none" : "grayscale(0.3) opacity(0.8)" }}>🏁</div>
                    ))}
                    {/* Opgave-pills nedenunder milepæle-zonen */}
                    {laned.map(({ item: task, lane }) => (
                      <div key={task.id} title={`${task.text}\n${task.owner ? "👤 " + task.owner : ""}\n⏰ ${task.deadline}`} onClick={() => setEditTask(task)}
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
            <button onClick={() => setEditMS({ id: "__new__", date: "", label: "", track: "digital", done: false })} style={{ padding: "7px 16px", background: C.teal, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Tilføj milepæl</button>
          </div>
          {[...milestones].sort((a, b) => a.date > b.date ? 1 : -1).map((m, i, arr) => {
            const color = trackMeta(m.track).color;
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
                  <span>{trackMeta(m.track).icon} {m.label}{m.spId && <span style={{ fontSize: 10, color: "#0078d4", marginLeft: 8 }}>☁ SP</span>}</span>
                  <button onClick={() => setEditMS(m)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "0 4px", flexShrink: 0 }}>✏️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ANSVARLIGE ── */}
      {view === "owners" && (() => {
        // Udled unikke ejere på tværs af alle opgaver
        const allOwners = [...new Set(tasks.flatMap(t => parseOwners(t.owner)))].sort();
        // Filtrer opgaver baseret på valgt ejer
        const filteredTasks = selectedOwner === ""
          ? tasks.filter(t => parseOwners(t.owner).length > 0)
          : tasks.filter(t => parseOwners(t.owner).includes(selectedOwner));
        return (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Sidebar med ejere */}
            <div style={{ width: 215, background: "white", borderRight: `1px solid ${C.mid}`, overflowY: "auto", flexShrink: 0 }}>
              {/* "Alle"-knap */}
              {(() => {
                const active = selectedOwner === "";
                const total  = tasks.filter(t => parseOwners(t.owner).length > 0).length;
                const done   = tasks.filter(t => parseOwners(t.owner).length > 0 && t.done).length;
                return (
                  <button onClick={() => setSelectedOwner("")} style={{
                    width: "100%", textAlign: "left", padding: "11px 14px", border: "none",
                    background: active ? `${C.teal}12` : "none",
                    borderLeft: `4px solid ${active ? C.teal : "transparent"}`,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
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
              {/* En knap per ejer */}
              {allOwners.map(owner => {
                const ownerTasks = tasks.filter(t => parseOwners(t.owner).includes(owner));
                const ownerDone  = ownerTasks.filter(t => t.done).length;
                const active     = selectedOwner === owner;
                return (
                  <button key={owner} onClick={() => setSelectedOwner(owner)} style={{
                    width: "100%", textAlign: "left", padding: "11px 14px", border: "none",
                    background: active ? `${C.teal}12` : "none",
                    borderLeft: `4px solid ${active ? C.teal : "transparent"}`,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.teal : C.dark }}>👤 {owner}</div>
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

            {/* Opgaver grupperet per track */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {filteredTasks.length === 0 && (
                <div style={{ textAlign: "center", color: C.muted, marginTop: 48, fontSize: 13 }}>Ingen opgaver fundet.</div>
              )}
              {TRACK_META.map(t => {
                const trackTasks = filteredTasks
                  .filter(task => task.track === t.id)
                  .sort((a, b) => {
                    if (a.done !== b.done) return a.done ? 1 : -1;
                    if (!a.deadline && !b.deadline) return 0;
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return a.deadline < b.deadline ? -1 : 1;
                  });
                if (!trackTasks.length) return null;
                return (
                  <div key={t.id} style={{ marginBottom: 20 }}>
                    {/* Track-header */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.color, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{t.icon} {t.label}</span>
                      <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>({trackTasks.length})</span>
                    </div>
                    {trackTasks.map(task => (
                      <div key={task.id} onClick={() => setEditTask(task)} style={{
                        display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px",
                        marginBottom: 7, background: "white", borderRadius: 8,
                        border: `1px solid ${task.done ? t.color + "55" : C.mid}`,
                        opacity: task.done ? 0.6 : 1, transition: "opacity 0.2s",
                        cursor: "pointer",
                      }}>
                        <button onClick={e => { e.stopPropagation(); toggleTask(task.id); }} style={{
                          width: 20, height: 20, borderRadius: 4, border: `2px solid ${task.done ? t.color : "#bbb"}`,
                          background: task.done ? t.color : "white", flexShrink: 0, marginTop: 1,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {task.done && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: C.dark, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.45 }}>{task.text}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                            {/* Ejere som individuelle pills */}
                            {parseOwners(task.owner).map(o => (
                              <span key={o} style={{ fontSize: 11, background: o === selectedOwner ? `${C.teal}18` : C.light, color: o === selectedOwner ? C.teal : C.muted, borderRadius: 4, padding: "1px 6px" }}>👤 {o}</span>
                            ))}
                            {task.deadline && <span style={{ fontSize: 11, color: C.bordeaux, fontWeight: 600 }}>⏰ {new Date(task.deadline).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}</span>}
                          </div>
                        </div>
                        <button onClick={() => setEditTask(task)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "2px 5px" }}>✏️</button>
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
        <TaskModal task={editTask}
          onSave={t => { editTask.id === "__new__" ? addTask(t) : updateTask(t); setEditTask(null); }}
          onDelete={id => { deleteTask(id); setEditTask(null); }}
          onClose={() => setEditTask(null)} />
      )}
      {editMS && (
        <MilestoneModal ms={editMS}
          onSave={m => { editMS.id === "__new__" ? addMilestone(m) : updateMilestone(m); setEditMS(null); }}
          onDelete={id => { deleteMilestone(id); setEditMS(null); }}
          onClose={() => setEditMS(null)} />
      )}
    </div>
  );
}
