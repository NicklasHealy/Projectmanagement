# CLAUDE.md — Projectmanagement

@AGENTS.md

## Projektoversigt

Next.js (v16) projektstyringsapp til Norddjurs Kommune. Deployes på Vercel.
Appen skal migreres fra Excel-baseret persistens til **lokal SQLite-database** (`sql.js` / WASM) med File System Access API, så brugeren selv vælger hvor `.db`-filen ligger på disk.

## Tech stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS v4 (via `@tailwindcss/postcss`)
- `sql.js` til SQLite i browseren (WASM, ingen server)
- File System Access API til fil-persistens
- Lucide React for ikoner
- Deploy: Vercel (statisk/SSR — SQLite kører 100% client-side)

## Kerneopgave: Migrér fra Excel til SQLite

### Hvad skal ske

Erstat den nuværende Excel-baserede fil-flow (`xlsx`-pakken, `excel.ts`, import/export) med en SQLite-database der kører i browseren via `sql.js`. Brugeren vælger selv placering af `.db`-filen via File System Access API — præcis som den nuværende `.xlsx`-linking fungerer.

### Hvad skal fjernes

- `lib/excel.ts` — erstattes af `lib/sqlite.ts`
- `xlsx`-pakken fra `package.json`
- Al Excel import/export UI i Dashboard (import-knap, export-knap, `.xlsx`-fil-linking)
- `lib/sharepoint.ts` — fjernes helt
- `lib/powerautomate.ts` — fjernes helt
- `lib/paConfig.ts` — fjernes helt
- `lib/authConfig.ts` — fjernes helt
- `components/AuthProvider.tsx` — fjernes helt
- MSAL-pakker fra `package.json` (`@azure/msal-browser`, `@azure/msal-react`, `@microsoft/microsoft-graph-client`)
- Al SharePoint-sync UI i Dashboard (sync-knap, fejlmeddelelser, SharePoint-status)

### Hvad skal beholdes

- `lib/fileHandle.ts` — beholdes og tilpasses til `.db`-filer i stedet for `.xlsx`
- `lib/types.ts` — opdateres (se nedenfor)
- `lib/useProjectData.ts` — refaktoreres til at bruge sqlite.ts
- `lib/data.ts` — forenkles (ingen hardkodede tracks/tasks/milestones)
- `components/Dashboard.tsx` — opdateres med nyt projekt-flow og dynamiske tracks
- `components/TaskModal.tsx` — beholdes, tilpasses
- `components/MilestoneModal.tsx` — beholdes, tilpasses
- `components/Modal.tsx` — beholdes som den er

### Ny fil: `lib/sqlite.ts`

Installér `sql.js` (`npm install sql.js`). Kopiér WASM-filen til `public/`:

```bash
cp node_modules/sql.js/dist/sql-wasm.wasm public/sql-wasm.wasm
```

`sqlite.ts` skal eksponere en klasse eller modul der:

1. **Initialiserer sql.js** med `locateFile: () => "/sql-wasm.wasm"`
2. **Åbner en eksisterende `.db`** fra en `FileSystemFileHandle` (læs filen → `new SQL.Database(buffer)`)
3. **Opretter en ny `.db`** med alle tabeller (via `showSaveFilePicker`)
4. **Skriver ændringer** tilbage til filen via `FileSystemFileHandle.createWritable()` efter hver mutation (debounced, ligesom den nuværende Excel auto-save)
5. Eksponerer CRUD-funktioner for tasks, milestones, tracks, notes og responsible

### Responsible (ansvarlige)

- `responsible`-tabellen er en liste af personer man kan tildele opgaver til
- Ved projektoprettelse kan brugeren oprette en startliste af ansvarlige (navn)
- Nye ansvarlige kan tilføjes undervejs direkte fra TaskModal (fritekst-felt der enten matcher en eksisterende eller opretter en ny)
- Ved oprettelse/redigering af en opgave vælges ansvarlige fra listen (multi-select) med mulighed for at skrive et nyt navn der automatisk oprettes i `responsible`-tabellen
- `task_responsible` junction-tabellen håndterer mange-til-mange relationen
- Når en task hentes fra DB, JOINes `task_responsible` + `responsible` for at returnere `owners: Responsible[]`
- Når en task gemmes, synkroniseres `task_responsible` (slet eksisterende → indsæt nye)
- "Ansvarlige"-view i Dashboard (den nuværende `owners`-tab) skal gruppere opgaver per `responsible.name` i stedet for at parse semikolon-separerede strenge

### Database-schema

```sql
-- Projektmetadata
CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dynamiske spor/tracks — brugeren definerer selv ved projektoprettelse
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,          -- slug, f.eks. "digital", "kommunikation"
  label TEXT NOT NULL,          -- Visningsnavn, f.eks. "Stemmer fra Norddjurs"
  icon TEXT NOT NULL DEFAULT '📋',
  color TEXT NOT NULL DEFAULT '#007AA1',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Ansvarlige personer (fast liste, kan udvides undervejs)
CREATE TABLE IF NOT EXISTS responsible (
  id TEXT PRIMARY KEY,          -- UUID
  name TEXT NOT NULL             -- Visningsnavn, f.eks. "Nicklas", "Bettina"
);

-- Opgaver
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  text TEXT NOT NULL,
  deadline TEXT,                -- ISO date YYYY-MM-DD eller NULL
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mange-til-mange: opgave ↔ ansvarlig
CREATE TABLE IF NOT EXISTS task_responsible (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  responsible_id TEXT NOT NULL REFERENCES responsible(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, responsible_id)
);

-- Opgavenoter (separat tabel, 1:mange relation til tasks)
CREATE TABLE IF NOT EXISTS task_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  text TEXT NOT NULL
);

-- Milepæle
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  label TEXT NOT NULL,
  date TEXT,                    -- ISO date YYYY-MM-DD eller NULL
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Opdaterede typer i `lib/types.ts`

```typescript
export interface TrackMeta {
  id: string;        // Ikke længere en fast union — dynamisk fra DB
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
  track: string;     // track_id reference
  text: string;
  owners: Responsible[];  // mange-til-mange via task_responsible
  deadline: string;
  done: boolean;
  notes?: TaskNote[];
}

export interface Milestone {
  id: string;
  track: string;     // track_id reference
  label: string;
  date: string;
  done: boolean;
}

export interface Project {
  name: string;
  createdAt: string;
}
```

Fjern `TrackId`-typen (den faste union). Alle steder der bruger `TrackId` skal bruge `string` i stedet.
Fjern `owner: string` fra Task — erstattes af `owners: Responsible[]` array.

### Brugerflow

#### Første gang (intet projekt)

1. Appen viser en **velkomstskærm** (ikke Dashboard) med to valg:
   - "Opret nyt projekt" → brugeren indtaster projektnavn og definerer tracks (navn, ikon, farve per track) → appen opretter `.db`-filen via `showSaveFilePicker` med schema + tracks + projektmetadata → åbner Dashboard
   - "Åbn eksisterende projekt" → `showOpenFilePicker` med filter for `.db`-filer → åbner Dashboard med data fra filen

2. Handle gemmes i IndexedDB (via `fileHandle.ts`) så appen genhenter filen automatisk næste gang.

#### Efterfølgende besøg

1. Appen forsøger at gendanne handle fra IndexedDB
2. Hvis permission er granted → åbn databasen og vis Dashboard
3. Hvis permission mangler → vis "Genaktivér" knap (brugeren skal klikke for at give tilladelse igen)
4. Hvis ingen handle → vis velkomstskærm

#### I Dashboard

- Header viser projektnavnet (fra `project`-tabellen, ikke hardkodet)
- Track-tabs er dynamiske (fra `tracks`-tabellen)
- Brugeren kan tilføje/redigere/slette tracks via en indstillingsmenu
- "Fjern link" lukker databasen og returnerer til velkomstskærmen
- Auto-save (debounced 800ms) skriver hele databasen til filen efter ændringer

### `lib/data.ts` ændringer

Fjern `TRACK_META`, `INITIAL_TASKS`, `INITIAL_MILESTONES`. Filen skal kun indeholde evt. default-tracks der foreslås ved projektoprettelse:

```typescript
export const DEFAULT_TRACKS = [
  { id: "spor-1", label: "Spor 1", icon: "📋", color: "#007AA1" },
  { id: "spor-2", label: "Spor 2", icon: "📌", color: "#006564" },
  { id: "spor-3", label: "Spor 3", icon: "🎯", color: "#992B30" },
];
```

### `lib/useProjectData.ts` ændringer

Hooken skal refaktoreres til at:

1. Tage en `SQL.Database`-instans som input (eller hente den fra en context)
2. Læse tasks, milestones og tracks fra SQLite ved initialisering
3. Kalde sqlite.ts CRUD-funktioner ved mutationer
4. Trigger auto-save (skrive hele db-bufferen til filen) via en eksponeret `flush()`-funktion

Fjern alt SharePoint-relateret kode.

### `lib/fileHandle.ts` ændringer

Minimal ændring — opdatér `FILE_KEY` fra `"xlsx-file"` til `"db-file"`. Funktionerne `saveHandle`, `loadHandle`, `clearHandle` forbliver ens.

### Dashboard ændringer

1. **Fjern** al SharePoint-sync UI (sync-knap, syncError, synced-status)
2. **Fjern** Excel import/export knapper og `<input type="file">`
3. **Erstat** "Link til Excel-fil" med "Åbn projekt (.db)" / "Fjern link"
4. **Tilføj** velkomstskærm-komponent der vises når intet projekt er åbent
5. **Gør tracks dynamiske** — track-tabs og farver kommer fra databasen, ikke `TRACK_META`
6. **Projektnavnet** i headeren læses fra `project`-tabellen
7. **Fjern** hardkodet "Sammen om Norddjurs — Budget 2027" fra headeren
8. **Owners-view** — den eksisterende `owners`-tab (`parseOwners` med semikolon-split) refaktoreres til at gruppere via `task_responsible` JOIN i stedet for string-parsing
9. **Ansvarlige-administration** — tilføj en indstillingsmenu/sektion hvor man kan se, tilføje og omdøbe ansvarlige i projektet

### TaskModal ændringer

- Erstat det nuværende fritekst `owner`-felt med en **multi-select** af ansvarlige fra `responsible`-tabellen
- Tilføj mulighed for at skrive et nyt navn der ikke findes i listen — ved gem oprettes personen automatisk i `responsible`-tabellen og tilknyttes opgaven
- Visning af valgte ansvarlige som tags/chips der kan fjernes individuelt

### Ny komponent: Projektoprettelse

Lav en `components/ProjectSetup.tsx` (eller inline i Dashboard) med:

1. Input-felt til projektnavn
2. En dynamisk liste af tracks med felter for: label, ikon (emoji-picker eller fritekst), farve (color input)
3. Knapper til at tilføje/fjerne tracks
4. En dynamisk liste af ansvarlige (navn-felter) med knapper til at tilføje/fjerne
5. "Opret projekt" knap der kalder `showSaveFilePicker` og opretter databasen med schema, tracks og responsible

### Auto-save flow

```
Bruger ændrer data → useProjectData muterer SQLite → markér dirty
  → debounce 800ms → db.export() → skrive Uint8Array til FileSystemFileHandle
```

Dette erstatter den nuværende `writeToHandle(fileHandle, tasks, milestones)` der skriver en hel Excel-fil.

### WASM-fil i Vercel

Tilføj til `next.config.ts` hvis nødvendigt for at Vercel serverer `.wasm` korrekt:

```typescript
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
};
```

Sørg for at `public/sql-wasm.wasm` inkluderes i deploy. Vercel serverer filer fra `public/` automatisk.

### Vigtige detaljer

- **sql.js er client-only** — al SQLite-kode skal være i `"use client"` komponenter/hooks. Brug dynamisk import (`next/dynamic`) hvis nødvendigt for at undgå SSR-fejl.
- **ID-generering** — brug `crypto.randomUUID()` til nye task/milestone IDs (i stedet for `local-${counter}`).
- **Fejlhåndtering** — vis en toast/besked hvis filen er låst, slettet eller utilgængelig.
- **Ingen polling nødvendig** — i modsætning til Excel-filen (der kunne redigeres eksternt) er `.db`-filen appens ejendom. Fjern den 30-sekunders poll.

## Styling

Behold det eksisterende farveskema:

```typescript
const C = {
  dark: "#1D3E47",
  teal: "#006564",
  yellow: "#EEC32B",
  bordeaux: "#992B30",
  light: "#f0f4f4",
  mid: "#e2eaeb",
  muted: "#6b8b90",
};
```

Inline styles bruges konsekvent i hele appen — følg det mønster, brug ikke Tailwind-klasser i komponenterne (Tailwind bruges kun til globals).

## Kommandoer

```bash
npm install       # Installér afhængigheder
npm run dev       # Start dev server (localhost:3000)
npm run build     # Byg til produktion
npm run lint      # Kør ESLint
```

## Filstruktur efter migration

```
app/
├── layout.tsx              # Root layout (fjern MSAL-provider)
├── page.tsx                # Hovedside
└── globals.css
components/
├── Dashboard.tsx           # Hoved-UI med dynamiske tracks
├── ProjectSetup.tsx        # NY: Velkomst/opret/åbn projekt
├── Modal.tsx               # Genbrugelig modal
├── TaskModal.tsx           # Opret/rediger opgave
└── MilestoneModal.tsx      # Opret/rediger milepæl
lib/
├── sqlite.ts               # NY: sql.js wrapper, CRUD, schema
├── fileHandle.ts           # IndexedDB handle-persistens (tilpasset til .db)
├── types.ts                # TypeScript-typer (opdateret)
├── data.ts                 # Default tracks til nye projekter
└── useProjectData.ts       # State hook (refaktoreret til SQLite)
public/
├── sql-wasm.wasm           # NY: sql.js WASM-binary
└── ...
```

Filer der skal SLETTES:
- `lib/excel.ts`
- `lib/sharepoint.ts`
- `lib/powerautomate.ts`
- `lib/paConfig.ts`
- `lib/authConfig.ts`
- `components/AuthProvider.tsx`