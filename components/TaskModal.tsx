"use client";
import { useState } from "react";
import { Task, TrackMeta, Responsible } from "@/lib/types";
import Modal, { Field, inputCls } from "./Modal";

interface Props {
  task: Partial<Task> & { id: string };
  tracks: TrackMeta[];
  responsible: Responsible[];
  onSave: (t: Omit<Task, "owners" | "notes">, ownerNames: string[]) => void;
  onDelete: (id: string) => void;
  onAddNote: (taskId: string, text: string) => void;
  onRemoveNote: (noteId: number) => void;
  onClose: () => void;
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

export default function TaskModal({ task, tracks, responsible, onSave, onDelete, onAddNote, onRemoveNote, onClose }: Props) {
  const isNew = task.id === "__new__";

  const [text, setText]         = useState(task.text ?? "");
  const [trackId, setTrackId]   = useState(task.track ?? tracks[0]?.id ?? "");
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [done, setDone]         = useState(task.done ?? false);

  // Owner names (may include names not yet in DB)
  const [selectedOwners, setSelectedOwners] = useState<string[]>(
    (task.owners ?? []).map(o => o.name)
  );
  const [ownerInput, setOwnerInput] = useState("");
  const [newNote, setNewNote]       = useState("");

  const notes = task.notes ?? [];

  const addOwner = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selectedOwners.includes(trimmed)) return;
    setSelectedOwners(prev => [...prev, trimmed]);
    setOwnerInput("");
  };

  const removeOwner = (name: string) => setSelectedOwners(prev => prev.filter(n => n !== name));

  const handleAddNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed || isNew) return;
    onAddNote(task.id, trimmed);
    setNewNote("");
  };

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({ id: task.id, track: trackId, text: text.trim(), deadline, done }, selectedOwners);
  };

  // Suggestions: responsible names not yet selected, filtered by input
  const suggestions = responsible
    .map(r => r.name)
    .filter(name => !selectedOwners.includes(name) && name.toLowerCase().includes(ownerInput.toLowerCase()));

  return (
    <Modal title={isNew ? "Tilføj opgave" : "Rediger opgave"} onClose={onClose}>
      <Field label="Opgave">
        <textarea
          className={`${inputCls} min-h-[72px] resize-y`}
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </Field>

      <Field label="Spor">
        <select className={inputCls} value={trackId} onChange={e => setTrackId(e.target.value)}>
          {tracks.map(t => (
            <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Ansvarlige">
        {/* Selected chips */}
        {selectedOwners.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {selectedOwners.map(name => (
              <span key={name} style={{ display: "flex", alignItems: "center", gap: 4, background: "#e2f0f0", color: "#006564", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600 }}>
                👤 {name}
                <button onClick={() => removeOwner(name)} style={{ background: "none", border: "none", cursor: "pointer", color: "#006564", fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
              </span>
            ))}
          </div>
        )}
        {/* Input + suggestions */}
        <div style={{ position: "relative" }}>
          <input
            className={inputCls}
            value={ownerInput}
            onChange={e => setOwnerInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); addOwner(ownerInput); }
            }}
            placeholder="Søg eller skriv nyt navn, Enter for at tilføje"
          />
          {ownerInput && (suggestions.length > 0 || (ownerInput.trim() && !selectedOwners.includes(ownerInput.trim()))) && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2eaeb", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 10 }}>
              {suggestions.map(name => (
                <button key={name} onClick={() => addOwner(name)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#1D3E47" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0f4f4")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  👤 {name}
                </button>
              ))}
              {!suggestions.find(s => s.toLowerCase() === ownerInput.trim().toLowerCase()) && ownerInput.trim() && !selectedOwners.includes(ownerInput.trim()) && (
                <button onClick={() => addOwner(ownerInput)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#006564", fontStyle: "italic" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0f4f4")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  + Opret &quot;{ownerInput.trim()}&quot;
                </button>
              )}
            </div>
          )}
        </div>
      </Field>

      <Field label="Deadline">
        <input type="date" className={inputCls} value={deadline} onChange={e => setDeadline(e.target.value)} />
      </Field>

      <Field label="Status">
        <label className="flex items-center gap-2 text-sm cursor-pointer text-[#1D3E47]">
          <input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)} className="accent-[#006564]" />
          Markér som færdig
        </label>
      </Field>

      <Field label="Statusnoter">
        {!isNew && (
          <div className="flex gap-2 mb-2">
            <textarea
              className={`${inputCls} flex-1 min-h-[56px] resize-y`}
              placeholder="Skriv en statusopdatering..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="px-3 py-2 bg-[#006564] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40 self-start"
            >Tilføj</button>
          </div>
        )}
        {isNew && <p className="text-xs text-[#6b8b90] mb-2">Gem opgaven først, derefter kan du tilføje noter.</p>}
        {notes.length > 0 && (
          <div className="max-h-[180px] overflow-y-auto flex flex-col gap-1.5">
            {notes.map(n => (
              <div key={n.id} className="bg-[#f4f8f9] rounded-lg px-3 py-2 text-sm text-[#1D3E47] flex justify-between items-start gap-2">
                <div>
                  <div className="text-[10px] font-bold text-[#6b8b90] mb-0.5">{formatTs(n.ts)}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
                </div>
                <button onClick={() => onRemoveNote(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b8b90", fontSize: 14, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </Field>

      <div className="flex justify-between mt-2">
        {!isNew
          ? <button onClick={() => { if (confirm("Slet opgaven?")) onDelete(task.id); }} className="px-4 py-2 bg-[#992B30] text-white rounded-lg text-sm font-semibold hover:opacity-90">🗑 Slet</button>
          : <span />}
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-[#e2eaeb] text-[#1D3E47] rounded-lg text-sm font-semibold hover:opacity-90">Annuller</button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="px-4 py-2 bg-[#006564] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >Gem</button>
        </div>
      </div>
    </Modal>
  );
}
