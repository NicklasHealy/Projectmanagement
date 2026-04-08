export type TrackId = "digital" | "bus" | "webinar" | "borgermøde" | "kampagne";

export interface TaskNote {
  ts: string;   // ISO datetime string
  text: string;
}

export interface Task {
  id: string;
  track: TrackId;
  text: string;
  owner: string;
  deadline: string;   // ISO date string YYYY-MM-DD or ""
  done: boolean;
  notes?: TaskNote[];
  spId?: string;      // SharePoint list item ID (when synced)
}

export interface Milestone {
  id: string;
  track: TrackId;
  label: string;
  date: string;       // ISO date string YYYY-MM-DD or ""
  done: boolean;
  spId?: string;
}

export interface TrackMeta {
  id: TrackId;
  label: string;
  icon: string;
  color: string;
}
