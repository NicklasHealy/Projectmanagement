import { Task, Milestone, TrackId } from "./types";
import { PA_URLS } from "./paConfig";

// ─── Helper ───────────────────────────────────────────────────────────────────
async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Flow svarede ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ─── SharePoint field shapes ──────────────────────────────────────────────────
interface SpItem {
  ID?: number;       // classic SP list item ID
  id?: number;
  Title?: string;
  Track?: string;
  Owner?: string;
  Deadline?: string;
  Date?: string;
  Done?: boolean;
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
export async function paGetTasks(): Promise<Task[]> {
  const data = await call<SpItem[] | { value: SpItem[] }>(PA_URLS.tasks.get, "GET");
  const items: SpItem[] = Array.isArray(data) ? data : (data as { value: SpItem[] }).value ?? [];
  return items.map(item => ({
    id: `sp-${item.ID ?? item.id}`,
    spId: String(item.ID ?? item.id ?? ""),
    track: (item.Track as TrackId) ?? "digital",
    text: item.Title ?? "",
    owner: item.Owner ?? "",
    deadline: item.Deadline ? item.Deadline.slice(0, 10) : "",
    done: !!item.Done,
  }));
}

export async function paCreateTask(task: Task): Promise<string> {
  const res = await call<{ ID?: number; id?: number } | number>(PA_URLS.tasks.post, "POST", {
    Title: task.text,
    Track: task.track,
    Owner: task.owner,
    Deadline: task.deadline || null,
    Done: task.done,
  });
  const id = typeof res === "number" ? res : (res as { ID?: number; id?: number }).ID ?? (res as { ID?: number; id?: number }).id;
  return String(id ?? "");
}

export async function paUpdateTask(task: Task): Promise<void> {
  if (!task.spId) return;
  await call(PA_URLS.tasks.patch, "POST", {
    spId: task.spId,
    Title: task.text,
    Track: task.track,
    Owner: task.owner,
    Deadline: task.deadline || null,
    Done: task.done,
  });
}

export async function paDeleteTask(spId: string): Promise<void> {
  await call(PA_URLS.tasks.delete, "POST", { spId });
}

// ─── MILESTONES ───────────────────────────────────────────────────────────────
export async function paGetMilestones(): Promise<Milestone[]> {
  const data = await call<SpItem[] | { value: SpItem[] }>(PA_URLS.milestones.get, "GET");
  const items: SpItem[] = Array.isArray(data) ? data : (data as { value: SpItem[] }).value ?? [];
  return items.map(item => ({
    id: `sp-${item.ID ?? item.id}`,
    spId: String(item.ID ?? item.id ?? ""),
    track: (item.Track as TrackId) ?? "digital",
    label: item.Title ?? "",
    date: item.Date ? item.Date.slice(0, 10) : "",
    done: !!item.Done,
  }));
}

export async function paCreateMilestone(ms: Milestone): Promise<string> {
  const res = await call<{ ID?: number; id?: number } | number>(PA_URLS.milestones.post, "POST", {
    Title: ms.label,
    Track: ms.track,
    Date: ms.date || null,
    Done: ms.done,
  });
  const id = typeof res === "number" ? res : (res as { ID?: number; id?: number }).ID ?? (res as { ID?: number; id?: number }).id;
  return String(id ?? "");
}

export async function paUpdateMilestone(ms: Milestone): Promise<void> {
  if (!ms.spId) return;
  await call(PA_URLS.milestones.patch, "POST", {
    spId: ms.spId,
    Title: ms.label,
    Track: ms.track,
    Date: ms.date || null,
    Done: ms.done,
  });
}

export async function paDeleteMilestone(spId: string): Promise<void> {
  await call(PA_URLS.milestones.delete, "POST", { spId });
}
