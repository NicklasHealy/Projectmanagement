"use client";
import { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1D3E47]/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-[500px] max-w-[95vw] shadow-2xl overflow-hidden">
        <div className="bg-[#1D3E47] text-white px-5 py-3.5 flex justify-between items-center">
          <span className="font-bold text-sm tracking-wide">{title}</span>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-bold text-[#6b8b90] uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputCls = "w-full px-3 py-2 border border-[#e2eaeb] rounded-lg text-sm text-[#1D3E47] font-[Trebuchet_MS] outline-none focus:border-[#006564] transition-colors";
