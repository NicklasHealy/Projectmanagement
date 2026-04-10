"use client";
import { useState } from "react";
import type { Database } from "sql.js";
import { initSqlJs, openDatabase, createDatabase } from "../lib/sqlite";
import { saveHandle } from "../lib/fileHandle";
import { DEFAULT_TRACKS } from "../lib/data";
import IconPicker from "./IconPicker";

const C = {
  dark: "#1D3E47",
  teal: "#006564",
  yellow: "#EEC32B",
  light: "#f0f4f4",
  mid: "#e2eaeb",
  muted: "#6b8b90",
};

interface TrackDraft { id: string; label: string; icon: string; color: string }

interface Props {
  onProjectReady: (db: Database, fileHandle: FileSystemFileHandle) => void;
}

export default function ProjectSetup({ onProjectReady }: Props) {
  const [mode, setMode] = useState<"welcome" | "create">("welcome");
  const [projectName, setProjectName] = useState("");
  const [tracks, setTracks] = useState<TrackDraft[]>(DEFAULT_TRACKS.map(t => ({ ...t })));
  const [responsible, setResponsible] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setError(null);
    setLoading(true);
    try {
      await initSqlJs();
      const [fileHandle] = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).showOpenFilePicker({
        types: [{ description: "SQLite database", accept: { "application/x-sqlite3": [".db"] } }],
        multiple: false,
      });
      const db = await openDatabase(fileHandle);
      await saveHandle(fileHandle);
      onProjectReady(db, fileHandle);
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "AbortError") {
        setError("Kunne ikke åbne filen: " + (e instanceof Error ? e.message : String(e)));
      }
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!projectName.trim()) { setError("Angiv et projektnavn"); return; }
    const validTracks = tracks.filter(t => t.label.trim());
    if (!validTracks.length) { setError("Tilføj mindst ét spor"); return; }
    setError(null);
    setLoading(true);
    try {
      await initSqlJs();
      const fileHandle = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).showSaveFilePicker({
        suggestedName: `${projectName.trim().replace(/\s+/g, "-").toLowerCase()}.db`,
        types: [{ description: "SQLite database", accept: { "application/x-sqlite3": [".db"] } }],
      });
      const validResponsible = responsible.map(r => r.trim()).filter(Boolean);
      const db = await createDatabase(projectName.trim(), validTracks, validResponsible, fileHandle);
      await saveHandle(fileHandle);
      onProjectReady(db, fileHandle);
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "AbortError") {
        setError("Kunne ikke oprette projektet: " + (e instanceof Error ? e.message : String(e)));
      }
    } finally { setLoading(false); }
  }

  function addTrack() {
    setTracks(prev => [...prev, { id: `spor-${Date.now()}`, label: "", icon: "📋", color: "#007AA1" }]);
  }
  function removeTrack(i: number) { setTracks(prev => prev.filter((_, idx) => idx !== i)); }
  function updateTrack(i: number, field: keyof TrackDraft, value: string) {
    setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }

  function addResponsibleRow() { setResponsible(prev => [...prev, ""]); }
  function removeResponsibleRow(i: number) { setResponsible(prev => prev.filter((_, idx) => idx !== i)); }
  function updateResponsibleRow(i: number, value: string) {
    setResponsible(prev => prev.map((r, idx) => idx === i ? value : r));
  }

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${C.mid}`, borderRadius: 6, padding: "6px 10px",
    fontSize: 14, outline: "none", background: "#fff", color: C.dark,
  };

  if (mode === "welcome") {
    return (
      <div style={{ minHeight: "100vh", background: C.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "48px 40px", maxWidth: 440, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ width: 48, height: 48, background: C.dark, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 24 }}>📋</span>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, color: C.dark }}>Projektmanager</h1>
          <p style={{ margin: "0 0 32px", color: C.muted, fontSize: 15 }}>Norddjurs Kommune — opret eller åbn et projekt</p>

          {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => { setMode("create"); setError(null); }}
              disabled={loading}
              style={{ padding: "12px 20px", background: C.dark, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
            >
              + Opret nyt projekt
            </button>
            <button
              onClick={handleOpen}
              disabled={loading}
              style={{ padding: "12px 20px", background: "#fff", color: C.dark, border: `2px solid ${C.mid}`, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? "Åbner…" : "📂 Åbn eksisterende projekt"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.light, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "40px 36px", maxWidth: 560, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <button
          onClick={() => { setMode("welcome"); setError(null); }}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, marginBottom: 24, padding: 0 }}
        >
          ← Tilbage
        </button>

        <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700, color: C.dark }}>Nyt projekt</h2>

        {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</p>}

        {/* Projektnavn */}
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Projektnavn</span>
          <input
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="f.eks. Budget 2027"
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          />
        </label>

        {/* Tracks */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>Spor</span>
            <button onClick={addTrack} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: 13 }}>+ Tilføj spor</button>
          </div>
          {tracks.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <IconPicker value={t.icon} onChange={icon => updateTrack(i, "icon", icon)} />
              <input
                value={t.label}
                onChange={e => updateTrack(i, "label", e.target.value)}
                placeholder="Sporens navn"
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="color"
                value={t.color}
                onChange={e => updateTrack(i, "color", e.target.value)}
                style={{ width: 36, height: 34, border: `1px solid ${C.mid}`, borderRadius: 6, padding: 2, cursor: "pointer" }}
              />
              {tracks.length > 1 && (
                <button onClick={() => removeTrack(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>×</button>
              )}
            </div>
          ))}
        </div>

        {/* Ansvarlige */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>Ansvarlige (valgfrit)</span>
            <button onClick={addResponsibleRow} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: 13 }}>+ Tilføj</button>
          </div>
          {responsible.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input
                value={r}
                onChange={e => updateResponsibleRow(i, e.target.value)}
                placeholder="Navn"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => removeResponsibleRow(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          style={{ width: "100%", padding: "12px 20px", background: C.dark, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Opretter…" : "Opret projekt"}
        </button>
      </div>
    </div>
  );
}
