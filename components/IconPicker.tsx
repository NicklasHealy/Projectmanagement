"use client";
import { useState, useRef, useEffect } from "react";

const ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: "Opgaver & planlægning",
    icons: ["📋", "📌", "🎯", "📊", "📈", "📉", "🗂", "📁", "📝", "✅", "🗓", "📅"],
  },
  {
    label: "Kommunikation & medier",
    icons: ["📣", "📢", "💬", "🗣", "📰", "🖥", "📱", "💻", "📺", "🎙", "🎤", "📡"],
  },
  {
    label: "Møder & events",
    icons: ["🏛", "👥", "🤝", "🎪", "🏟", "🎭", "🎉", "🏆", "🎗", "🌐"],
  },
  {
    label: "Transport & bevægelse",
    icons: ["🚌", "🚗", "🚶", "🚲", "🏃", "🚀", "🛣", "🗺", "📍"],
  },
  {
    label: "Økonomi & ressourcer",
    icons: ["💰", "💳", "🏦", "💹", "🏗", "🔑", "🛠", "⚙", "🔧"],
  },
  {
    label: "Natur & samfund",
    icons: ["🌱", "🌍", "🏙", "🌟", "⭐", "🌈", "🌻", "🤲", "🏘"],
  },
];

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

const C = {
  dark: "#1D3E47", teal: "#006564", mid: "#e2eaeb", muted: "#6b8b90", light: "#f0f4f4",
};

export default function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (icon: string) => {
    onChange(icon);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Vælg ikon"
        style={{
          width: 46, height: 34, border: `1px solid ${open ? C.teal : C.mid}`,
          borderRadius: 6, background: "#fff", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          outline: open ? `2px solid ${C.teal}40` : "none",
        }}
      >
        {value || "📋"}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
          background: "#fff", border: `1px solid ${C.mid}`, borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", padding: 12, width: 284,
        }}>
          {ICON_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {group.icons.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => select(icon)}
                    title={icon}
                    style={{
                      width: 34, height: 34, border: value === icon ? `2px solid ${C.teal}` : "2px solid transparent",
                      borderRadius: 6, background: value === icon ? `${C.teal}12` : "none",
                      fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (value !== icon) (e.currentTarget as HTMLButtonElement).style.background = C.light; }}
                    onMouseLeave={e => { if (value !== icon) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Custom input */}
          <div style={{ borderTop: `1px solid ${C.mid}`, marginTop: 4, paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>
              Eget ikon
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && customInput.trim()) { select(customInput.trim()); setCustomInput(""); } }}
                placeholder="Indsæt emoji…"
                maxLength={4}
                style={{ flex: 1, border: `1px solid ${C.mid}`, borderRadius: 6, padding: "5px 8px", fontSize: 14, outline: "none", color: C.dark }}
              />
              <button
                type="button"
                onClick={() => { if (customInput.trim()) { select(customInput.trim()); setCustomInput(""); } }}
                style={{ padding: "5px 10px", background: C.teal, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              >
                Brug
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              Find flere emojis på <strong>emojipedia.org</strong> eller åbn OS-tastaturet:
              <br />
              <span style={{ fontFamily: "monospace", background: C.light, borderRadius: 3, padding: "1px 4px" }}>Win + .</span> på Windows &nbsp;·&nbsp;
              <span style={{ fontFamily: "monospace", background: C.light, borderRadius: 3, padding: "1px 4px" }}>⌃⌘Space</span> på Mac
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
