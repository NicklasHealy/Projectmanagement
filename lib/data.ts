import { TrackMeta, Task, Milestone } from "./types";

export const TRACK_META: TrackMeta[] = [
  { id: "digital",    label: "Stemmer fra Norddjurs",    icon: "📱", color: "#007AA1" },
  { id: "bus",        label: "Det mobile mødested",      icon: "🚌", color: "#006564" },
  { id: "webinar",    label: "Webinar med politikere",   icon: "🎥", color: "#992B30" },
  { id: "borgermøde", label: "Borgermødet 19. august",   icon: "🏛️", color: "#b08000" },
  { id: "kampagne",   label: "Kampagne & kommunikation", icon: "📣", color: "#3d6b75" },
];

export function trackMeta(id: string): TrackMeta {
  return TRACK_META.find(t => t.id === id) ?? TRACK_META[0];
}

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_MILESTONES: Milestone[] = [];
