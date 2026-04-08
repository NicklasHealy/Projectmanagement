import * as XLSX from "xlsx";
import { Task, Milestone, TaskNote } from "./types";
import { TRACK_META } from "./data";

function formatNotes(notes: TaskNote[] | undefined): string {
  if (!notes || notes.length === 0) return "";
  return notes.map(n => {
    const d = new Date(n.ts);
    const dato = d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
    const kl = d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
    return `${dato} ${kl}\n${n.text}`;
  }).join("\n\n");
}

function trackLabel(id: string) {
  return TRACK_META.find(t => t.id === id)?.label ?? id;
}
function trackIdFromLabel(label: string) {
  return TRACK_META.find(t => t.label === label)?.id ?? "digital";
}

function buildWorkbook(tasks: Task[], milestones: Milestone[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const taskRows = tasks.map(t => ({
    Spor: trackLabel(t.track),
    Opgave: t.text,
    Ansvar: t.owner,
    Deadline: t.deadline,
    Status: t.done ? "Færdig" : "Ikke påbegyndt",
    Statusnoter: formatNotes(t.notes),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows), "Opgaver");

  const msRows = milestones.map(m => ({
    Dato: m.date,
    Milepæl: m.label,
    Spor: trackLabel(m.track),
    Status: m.done ? "Nået" : "Kommende",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(msRows), "Milepæle");

  return wb;
}

function parseWorkbook(wb: XLSX.WorkBook): { tasks: Task[]; milestones: Milestone[] } {
  const tasks: Task[] = [];
  const milestones: Milestone[] = [];

  const taskSheet = wb.Sheets["Opgaver"];
  if (taskSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(taskSheet);
    rows.forEach((r, i) => {
      tasks.push({
        id: `imp-${i}`,
        track: trackIdFromLabel(r["Spor"] ?? "") as Task["track"],
        text: r["Opgave"] ?? "",
        owner: r["Ansvar"] ?? "",
        deadline: r["Deadline"] ?? "",
        done: r["Status"] === "Færdig",
      });
    });
  }

  const msSheet = wb.Sheets["Milepæle"];
  if (msSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(msSheet);
    rows.forEach((r, i) => {
      milestones.push({
        id: `impm-${i}`,
        track: trackIdFromLabel(r["Spor"] ?? "") as Milestone["track"],
        label: r["Milepæl"] ?? "",
        date: r["Dato"] ?? "",
        done: r["Status"] === "Nået",
      });
    });
  }

  return { tasks, milestones };
}

export function exportToXlsx(tasks: Task[], milestones: Milestone[]): void {
  XLSX.writeFile(buildWorkbook(tasks, milestones), "SammenOmNorddjurs_Budget2027.xlsx");
}

export async function writeToHandle(
  handle: FileSystemFileHandle,
  tasks: Task[],
  milestones: Milestone[],
): Promise<void> {
  const buf      = XLSX.write(buildWorkbook(tasks, milestones), { bookType: "xlsx", type: "array" });
  const writable = await handle.createWritable();
  await writable.write(buf);
  await writable.close();
}

export async function readFromHandle(
  handle: FileSystemFileHandle,
): Promise<{ tasks: Task[]; milestones: Milestone[] }> {
  const file = await handle.getFile();
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array" });
  return parseWorkbook(wb);
}

export function importFromXlsx(file: File): Promise<{ tasks: Task[]; milestones: Milestone[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(parseWorkbook(XLSX.read(e.target?.result, { type: "binary" })));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}
