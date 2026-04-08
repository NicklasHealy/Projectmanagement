"use client";
import { useState } from "react";
import { Milestone } from "@/lib/types";
import { TRACK_META } from "@/lib/data";
import Modal, { Field, inputCls } from "./Modal";

interface Props {
  ms: Partial<Milestone> & { id: string };
  onSave: (m: Milestone) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function MilestoneModal({ ms, onSave, onDelete, onClose }: Props) {
  const isNew = ms.id === "__new__";
  const [form, setForm] = useState<Milestone>({
    id: ms.id,
    track: ms.track ?? "digital",
    label: ms.label ?? "",
    date: ms.date ?? "",
    done: ms.done ?? false,
    spId: ms.spId,
  });
  const set = <K extends keyof Milestone>(k: K, v: Milestone[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title={isNew ? "Tilføj milepæl" : "Rediger milepæl"} onClose={onClose}>
      <Field label="Beskrivelse">
        <input className={inputCls} value={form.label} onChange={e => set("label", e.target.value)} placeholder="f.eks. Kampagne lanceres" />
      </Field>
      <div className="flex gap-3">
        <Field label="Dato">
          <input type="date" className={inputCls} value={form.date} onChange={e => set("date", e.target.value)} />
        </Field>
        <Field label="Spor">
          <select className={inputCls} value={form.track} onChange={e => set("track", e.target.value as Milestone["track"])}>
            {TRACK_META.map(t => (
              <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Status">
        <label className="flex items-center gap-2 text-sm cursor-pointer text-[#1D3E47]">
          <input type="checkbox" checked={form.done} onChange={e => set("done", e.target.checked)} className="accent-[#006564]" />
          Markér som nået
        </label>
      </Field>
      <div className="flex justify-between mt-2">
        {!isNew
          ? <button onClick={() => { if (confirm("Slet milepæl?")) onDelete(form.id); }} className="px-4 py-2 bg-[#992B30] text-white rounded-lg text-sm font-semibold hover:opacity-90">🗑 Slet</button>
          : <span />}
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-[#e2eaeb] text-[#1D3E47] rounded-lg text-sm font-semibold hover:opacity-90">Annuller</button>
          <button
            onClick={() => form.label.trim() && onSave(form)}
            className="px-4 py-2 bg-[#006564] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
            disabled={!form.label.trim()}
          >Gem</button>
        </div>
      </div>
    </Modal>
  );
}
