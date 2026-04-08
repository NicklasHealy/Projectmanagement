// ─── UDFYLD DINE POWER AUTOMATE FLOW-URLS HER ────────────────────────────────
// Kopiér URL'en fra hvert flow i Power Automate:
// Flow → trigger-kort "Når en HTTP-anmodning modtages" → HTTP POST URL
//
// Sæt ENABLE_SHAREPOINT til true når du har udfyldt alle URLs.
// Sæt den til false for at køre lokalt uden SharePoint.

export const ENABLE_SHAREPOINT = false;
export const ENABLE_MILESTONES = false;

export const PA_URLS = {
  tasks: {
    get:    "https://default6a779833039342b59d19351c386335.7b.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/e79831bf52d0457589b7a9285c43b8b5/triggers/manual/paths/invoke?api-version=1", // GET
    post:   "https://default6a779833039342b59d19351c386335.7b.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ff4023ca8c2544a0821521684fc9f933/triggers/manual/paths/invoke?api-version=1", // POST
    patch:  "https://default6a779833039342b59d19351c386335.7b.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/32742de44d144d4daba5781ffea8b8bb/triggers/manual/paths/invoke?api-version=1", // PATCH
    delete: "https://default6a779833039342b59d19351c386335.7b.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/fddaf0abe8b94564a1ad349eb489b7aa/triggers/manual/paths/invoke?api-version=1", // DELETE
  },
  milestones: {
    get:    "YOUR_FLOW_URL_GET_BUDGETMILEPÆLE",
    post:   "YOUR_FLOW_URL_POST_BUDGETMILEPÆLE",
    patch:  "YOUR_FLOW_URL_PATCH_BUDGETMILEPÆLE",
    delete: "YOUR_FLOW_URL_DELETE_BUDGETMILEPÆLE",
  },
};
