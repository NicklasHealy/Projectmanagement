import { Configuration, PopupRequest } from "@azure/msal-browser";

// ─── FILL THESE IN ────────────────────────────────────────────────────────────
// 1. Go to portal.azure.com → Azure Active Directory → App registrations → New
// 2. Set redirect URI to http://localhost:3000 (type: SPA)
// 3. Under API permissions add: Sites.ReadWrite.All, User.Read (Microsoft Graph)
// 4. Copy the values below
export const AZURE_CONFIG = {
  clientId: "YOUR_CLIENT_ID",          // Application (client) ID
  tenantId: "YOUR_TENANT_ID",          // Directory (tenant) ID
  siteId:   "YOUR_SHAREPOINT_SITE_ID", // SharePoint site ID (see README)
  listName: "BudgetOpgaver",           // Name of your SharePoint list
  msListName: "BudgetMilepæle",        // Name of your milestones list
};
// ─────────────────────────────────────────────────────────────────────────────

export const msalConfig: Configuration = {
  auth: {
    clientId: AZURE_CONFIG.clientId,
    authority: `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest: PopupRequest = {
  scopes: ["User.Read", "Sites.ReadWrite.All"],
};
