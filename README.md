# Sammen om Norddjurs — Budget 2027
## Projektoverblik & opgavestyring

En Next.js-applikation til intern projektstyring af borgerinddragelsesinitiativet *Sammen om Norddjurs – Budget 2027*. Appen kan køre lokalt og synkronisere data direkte med SharePoint-lister via Microsoft Graph API.

---

## Funktioner

- 📋 **Opgaveliste** — opgaver fordelt på 5 projektspor med filtrering, afkrydsning og redigering
- 📅 **Tidslinje** — visuel Gantt-lignende tidslinje med opgaver og milepæle per spor
- 🏁 **Milepæle** — kronologisk overblik over nøglemilepæle med afkrydsning
- 🔗 **SharePoint-sync** — log ind med Microsoft-konto og synkroniser live med SharePoint-lister
- ⬇⬆ **Excel import/export** — eksporter til .xlsx og importer igen

---

## Kom i gang

### 1. Installér afhængigheder

```bash
npm install
```

### 2. Konfigurér Azure App Registration

1. Gå til portal.azure.com → App registrations → New registration
2. Navn: NorddjursBudget2027
3. Supported account types: Accounts in this organizational directory only
4. Redirect URI: Single-page application (SPA) → http://localhost:3000
5. Klik Register

Kopiér til lib/authConfig.ts:
- Application (client) ID → clientId
- Directory (tenant) ID → tenantId

Tilføj API-tilladelser:
- Microsoft Graph → Delegated → User.Read og Sites.ReadWrite.All
- Grant admin consent

### 3. Find dit SharePoint Site ID

Åbn i browser (tilpas URL til jeres site):
https://graph.microsoft.com/v1.0/sites/norddjurs.sharepoint.com:/sites/budget2027

Kopiér id-feltet → indsæt som siteId i lib/authConfig.ts

### 4. Opret SharePoint-lister

Liste 1 — BudgetOpgaver:
  Title (tekst), Track (tekst), Owner (tekst), Deadline (dato), Done (ja/nej)

Liste 2 — BudgetMilepæle:
  Title (tekst), Track (tekst), Date (dato), Done (ja/nej)

### 5. Udfyld lib/authConfig.ts

```typescript
export const AZURE_CONFIG = {
  clientId:  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  tenantId:  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  siteId:    "norddjurs.sharepoint.com,xxxxxxxx-...",
  listName:  "BudgetOpgaver",
  msListName: "BudgetMilepæle",
};
```

### 6. Start appen

```bash
npm run dev
```

Åbn http://localhost:3000

---

## Brug uden SharePoint

Appen virker fuldt ud uden SharePoint-login. Data lever i hukommelsen under sessionen.
Brug Eksporter .xlsx til at gemme og Importer .xlsx til at indlæse næste gang.

---

## Genbrug til næste projekt

1. lib/data.ts — opdatér TRACK_META, INITIAL_TASKS og INITIAL_MILESTONES
2. lib/authConfig.ts — opdatér siteId og listenavne
3. components/Dashboard.tsx — skift projektnavn i header
4. SharePoint-koden i lib/sharepoint.ts er generisk og kræver ingen ændringer

---

## Projektstruktur

```
norddjurs-budget/
├── app/
│   ├── layout.tsx           # Root layout med MSAL-provider
│   └── page.tsx             # Hovedside
├── components/
│   ├── AuthProvider.tsx     # MSAL-initialisering
│   ├── Dashboard.tsx        # Hoved-UI
│   ├── Modal.tsx            # Genbrugelig modal
│   ├── TaskModal.tsx        # Opret/rediger opgave
│   └── MilestoneModal.tsx   # Opret/rediger milepæl
├── lib/
│   ├── authConfig.ts        # ← UDFYLD DINE AZURE-VÆRDIER HER
│   ├── types.ts             # TypeScript-typer
│   ├── data.ts              # Spormetadata og startdata
│   ├── sharepoint.ts        # Microsoft Graph API-kald
│   ├── excel.ts             # Import/eksport til .xlsx
│   └── useProjectData.ts    # State + SharePoint-sync hook
└── README.md
```

---

## Fejlfinding

"Popup blocked" → Tillad popups for localhost i browseren

"AADSTS50011: Reply URL mismatch" → Tjek Redirect URI i Azure matcher http://localhost:3000 præcist

"Insufficient privileges" → Sørg for admin consent på API-tilladelserne i Azure

SharePoint-fejl ved sync → Bekræft listenavne i authConfig.ts matcher præcist (store/små bogstaver)
