import { Client } from "@microsoft/microsoft-graph-client";
import { Task, Milestone, TrackId } from "./types";
import { AZURE_CONFIG } from "./authConfig";

// Build an authenticated Graph client from an MSAL access token
export function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

const SITE = () => `sites/${AZURE_CONFIG.siteId}`;

// ─── TASKS ────────────────────────────────────────────────────────────────────

interface SpTaskFields {
  id: string;
  fields: {
    Title: string;
    Track: string;
    Owner: string;
    Deadline: string;
    Done: boolean;
  };
}

export async function spGetTasks(token: string): Promise<Task[]> {
  const client = getGraphClient(token);
  const res = await client
    .api(`/${SITE()}/lists/${AZURE_CONFIG.listName}/items?expand=fields`)
    .get();
  return (res.value as SpTaskFields[]).map(item => ({
    id: `sp-${item.id}`,
    spId: item.id,
    track: (item.fields.Track as TrackId) ?? "digital",
    text: item.fields.Title ?? "",
    owner: item.fields.Owner ?? "",
    deadline: item.fields.Deadline ? item.fields.Deadline.slice(0, 10) : "",
    done: !!item.fields.Done,
  }));
}

export async function spCreateTask(token: string, task: Task): Promise<string> {
  const client = getGraphClient(token);
  const res = await client
    .api(`/${SITE()}/lists/${AZURE_CONFIG.listName}/items`)
    .post({
      fields: {
        Title: task.text,
        Track: task.track,
        Owner: task.owner,
        Deadline: task.deadline || null,
        Done: task.done,
      },
    });
  return res.id as string;
}

export async function spUpdateTask(token: string, task: Task): Promise<void> {
  if (!task.spId) return;
  const client = getGraphClient(token);
  await client
    .api(`/${SITE()}/lists/${AZURE_CONFIG.listName}/items/${task.spId}/fields`)
    .patch({
      Title: task.text,
      Track: task.track,
      Owner: task.owner,
      Deadline: task.deadline || null,
      Done: task.done,
    });
}

export async function spDeleteTask(token: string, spId: string): Promise<void> {
  const client = getGraphClient(token);
  await client
    .api(`/${SITE()}/lists/${AZURE_CONFIG.listName}/items/${spId}`)
    .delete();
}

// ─── MILESTONES ───────────────────────────────────────────────────────────────

interface SpMsFields {
  id: string;
  fields: {
    Title: string;
    Track: string;
    Date: string;
    Done: boolean;
  };
}

export async function spGetMilestones(token: string): Promise<Milestone[]> {
  const client = getGraphClient(token);
  const res = await client
    .api(`/${SITE()}/lists/${AZURE_CONFIG.msListName}/items?expand=fields`)
    .get();
  return (res.value as SpMsFields[]).map(item => ({
    id: `sp-${item.id}`,
    spId: item.id,
    track: (item.fields.Track as TrackId) ?? "digital",
    label: item.fields.Title ?? "",
    date: item.fields.Date ? item.fields.Date.slice(0, 10) : "",
    done: !!item.fields.Done,
  }));
}

export async function spCreateMilestone(token: string, ms: Milestone): Promise<string> {
  const client = getGraphClient(token);
  const res = await client
    .api(`/${SITE()}/lists/${AZURE_CONFIG.msListName}/items`)
    .post({
      fields: {
        Title: ms.label,
        Track: ms.track,
        Date: ms.date || null,
        Done: ms.done,
      },
    });
  return res.id as string;
}

export async function spUpdateMilestone(token: string, ms: Milestone): Promise<void> {
  if (!ms.spId) return;
  const client = getGraphClient(token);
  await client
    .api(`/${SITE()}/lists/${AZURE_CONFIG.msListName}/items/${ms.spId}/fields`)
    .patch({
      Title: ms.label,
      Track: ms.track,
      Date: ms.date || null,
      Done: ms.done,
    });
}

export async function spDeleteMilestone(token: string, spId: string): Promise<void> {
  const client = getGraphClient(token);
  await client
    .api(`/${SITE()}/lists/${AZURE_CONFIG.msListName}/items/${spId}`)
    .delete();
}
