export interface TrackMeta {
  id: string;
  label: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface Responsible {
  id: string;
  name: string;
}

export interface TaskNote {
  id: number;
  taskId: string;
  ts: string;
  text: string;
}

export interface Task {
  id: string;
  track: string;
  text: string;
  owners: Responsible[];
  deadline: string;
  done: boolean;
  notes?: TaskNote[];
}

export interface Milestone {
  id: string;
  track: string;
  label: string;
  date: string;
  done: boolean;
}

export interface Project {
  name: string;
  createdAt: string;
}

export interface Session {
  id: number;
  userName: string;
  checkedOutAt: string;
  checkedInAt: string | null;
}
