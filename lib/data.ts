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

export const INITIAL_TASKS: Task[] = [
  { id: "1",  track: "digital",    text: "Spørgeramme finaliseret og godkendt (~50 spørgsmål)", owner: "Nicklas", deadline: "2026-04-30", done: false },
  { id: "2",  track: "digital",    text: "Første spørgeskemaer opsat i SurveyXact", owner: "Tina", deadline: "2026-04-30", done: false },
  { id: "3",  track: "digital",    text: "Intern test af spørgeskema og Facebook-flow", owner: "Nicklas", deadline: "2026-05-10", done: false },
  { id: "4",  track: "digital",    text: "Lancering af første tema (uge 20)", owner: "Nicklas", deadline: "2026-05-15", done: false },
  { id: "5",  track: "digital",    text: "Udarbejd digitale spørgsmål per udvalg", owner: "", deadline: "", done: false },
  { id: "6",  track: "digital",    text: "Analyse af trafik mv. på FB-opslag", owner: "", deadline: "", done: false },
  { id: "7",  track: "bus",        text: "Kontakt til arrangører (Open by Night, Auning, Glesborg)", owner: "Henrik", deadline: "2026-04-30", done: false },
  { id: "8",  track: "bus",        text: "Politikere inviteret og bekræftet til alle 3 stops", owner: "Henrik", deadline: "2026-04-30", done: false },
  { id: "9",  track: "bus",        text: "Materialer klar (spørgsmålsvæg, QR, flyers, roll-up)", owner: "Kim", deadline: "2026-05-15", done: false },
  { id: "10", track: "bus",        text: "Briefing af medarbejdere og politikere", owner: "Henrik", deadline: "2026-05-25", done: false },
  { id: "11", track: "bus",        text: "Drejebog for Det mobile mødested", owner: "", deadline: "", done: false },
  { id: "12", track: "webinar",    text: "Aftale med politikere om deltagelse (inkl. suppleanter)", owner: "Tina", deadline: "", done: false },
  { id: "13", track: "webinar",    text: "Find moderator (Karen Meisner?)", owner: "Nicklas", deadline: "", done: false },
  { id: "14", track: "webinar",    text: "Aftal lokation (Museum Østjylland?)", owner: "", deadline: "", done: false },
  { id: "15", track: "webinar",    text: "Udarbejd drejebog for webinar", owner: "", deadline: "", done: false },
  { id: "16", track: "webinar",    text: "Åbn tilmelding til webinaret", owner: "Tina", deadline: "", done: false },
  { id: "17", track: "borgermøde", text: "Lokation bekræftet – Grenå Gymnasium", owner: "Britt", deadline: "2026-04-10", done: true },
  { id: "18", track: "borgermøde", text: "Catering aftalt (~200 deltagere)", owner: "", deadline: "2026-04-30", done: false },
  { id: "19", track: "borgermøde", text: "Hanne booker politikere og KCL", owner: "Hanne", deadline: "2026-04-30", done: false },
  { id: "20", track: "borgermøde", text: "Tilmeldingsformular opsat i SurveyXact", owner: "Tina", deadline: "", done: false },
  { id: "21", track: "borgermøde", text: "Fastlæg mødeformat og program", owner: "", deadline: "", done: false },
  { id: "22", track: "borgermøde", text: "Udarbejd dilemmaer per fagudvalg (6 udvalg)", owner: "", deadline: "", done: false },
  { id: "23", track: "borgermøde", text: "Drejebog for borgermødet", owner: "", deadline: "", done: false },
  { id: "24", track: "kampagne",   text: "Indkøring af Christine Aakjær de Wolff (starter 15. april)", owner: "Nicklas", deadline: "2026-04-16", done: false },
  { id: "25", track: "kampagne",   text: "Møde med Kim (grafiker) – 2 plakater", owner: "", deadline: "", done: false },
  { id: "26", track: "kampagne",   text: "Borgermødeplakat", owner: "Kim", deadline: "", done: false },
  { id: "27", track: "kampagne",   text: "Busplakat", owner: "Kim", deadline: "", done: false },
  { id: "28", track: "kampagne",   text: "Kampagnetidsplan uge 20–35", owner: "Christine", deadline: "", done: false },
  { id: "29", track: "kampagne",   text: "Koordiner pressemeddelelse(r)", owner: "Christine", deadline: "", done: false },
];

export const INITIAL_MILESTONES: Milestone[] = [
  { id: "m1", track: "borgermøde", date: "2026-04-10", label: "Økonomiudvalget – godkendelse af datoer og politisk deltagelse", done: false },
  { id: "m2", track: "kampagne",   date: "2026-04-15", label: "Christine starter", done: false },
  { id: "m3", track: "digital",    date: "2026-05-15", label: "Lancering Stemmer fra Norddjurs (uge 20)", done: false },
  { id: "m4", track: "bus",        date: "2026-06-04", label: "Det mobile mødested #1 – Open by Night, Grenå", done: false },
  { id: "m5", track: "bus",        date: "2026-06-06", label: "Det mobile mødested #2 – Sommerfest, Auning", done: false },
  { id: "m6", track: "bus",        date: "2026-06-13", label: "Det mobile mødested #3 – Brugsen, Glesborg", done: false },
  { id: "m7", track: "webinar",    date: "2026-08-10", label: "Webinar med politikere (10.–12. august)", done: false },
  { id: "m8", track: "borgermøde", date: "2026-08-19", label: "Borgermødet – Grenå Gymnasium kl. 16:30–20:00", done: false },
];
