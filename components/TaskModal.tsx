"use client";
import { useState } from "react";
import { Task, TaskNote } from "@/lib/types";
import { TRACK_META } from "@/lib/data";
import Modal, { Field, inputCls } from "./Modal";

interface Props {
  task: Partial<Task> & { id: string };
  onSave: (t: Task) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

export default function TaskModal({ task, onSave, onDelete, onClose }: Props) {
  const isNew = task.id === "__new__";
  const [form, setForm] = useState<Task>({
    id: task.id,
    track: task.track ?? "digital",
    text: task.text ?? "",
    owner: task.owner ?? "",
    deadline: task.deadline ?? "",
    done: task.done ?? false,
    notes: task.notes ?? [],
    spId: task.spId,
  });
  const [newNote, setNewNote] = useState("");

  const set = <K extends keyof Task>(k: K, v: Task[K]) => setForm(f => ({ ...f, [k]: v }));

  const addNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    const note: TaskNote = { ts: new Date().toISOString(), text: trimmed };
    setForm(f => ({ ...f, notes: [note, ...(f.notes ?? [])] }));
    setNewNote("");
  };

  return (
    <Modal title={isNew ? "Tilføj opgave" : "Rediger opgave"} onClose={onClose}>
      <Field label="Opgave">
        <textarea
          className={`${inputCls} min-h-[72px] resize-y`}
          value={form.text}
          onChange={e => set("text", e.target.value)}
        />
      </Field>
      <Field label="Spor">
        <select className={inputCls} value={form.track} onChange={e => set("track", e.target.value as Task["track"])}>
          {TRACK_META.map(t => (
            <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
          ))}
        </select>
      </Field>
      <div className="flex gap-3">
        <Field label="Ansvar">
          <input className={inputCls} value={form.owner} onChange={e => set("owner", e.target.value)} placeholder="f.eks. Nicklas" />
        </Field>
        <Field label="Deadline">
          <input type="date" className={inputCls} value={form.deadline} onChange={e => set("deadline", e.target.value)} />
        </Field>
      </div>
      <Field label="Status">
        <label className="flex items-center gap-2 text-sm cursor-pointer text-[#1D3E47]">
          <input type="checkbox" checked={form.done} onChange={e => set("done", e.target.checked)} className="accent-[#006564]" />
          Markér som færdig
        </label>
      </Field>

      <Field label="Statusnoter">
        <div className="flex gap-2 mb-2">
          <textarea
            className={`${inputCls} flex-1 min-h-[56px] resize-y`}
            placeholder="Skriv en statusopdatering..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(); }}
          />
          <button
            onClick={addNote}
            disabled={!newNote.trim()}
            className="px-3 py-2 bg-[#006564] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40 self-start"
          >Tilføj</button>
        </div>
        {(form.notes ?? []).length > 0 && (
          <div className="max-h-[180px] overflow-y-auto flex flex-col gap-1.5">
            {(form.notes ?? []).map((n, i) => (
              <div key={i} className="bg-[#f4f8f9] rounded-lg px-3 py-2 text-sm text-[#1D3E47]">
                <div className="text-[10px] font-bold text-[#6b8b90] mb-0.5">{formatTs(n.ts)}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </Field>

      <div className="flex justify-between mt-2">
        {!isNew
          ? <button onClick={() => { if (confirm("Slet opgaven?")) onDelete(form.id); }} className="px-4 py-2 bg-[#992B30] text-white rounded-lg text-sm font-semibold hover:opacity-90">🗑 Slet</button>
          : <span />}
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-[#e2eaeb] text-[#1D3E47] rounded-lg text-sm font-semibold hover:opacity-90">Annuller</button>
          <button
            onClick={() => form.text.trim() && onSave(form)}
            className="px-4 py-2 bg-[#006564] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
            disabled={!form.text.trim()}
          >Gem</button>
        </div>
      </div>
    </Modal>
  );
}
