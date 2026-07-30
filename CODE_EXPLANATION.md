# Code Explanation - Azure DevOps Risk Score Extension

## Overview

This extension integrates with Azure DevOps work item forms to automatically calculate and persist a **Risk Score** using the formula:

```
Risk Score = Likelihood × Impact
```

---

## HTML Entry Point Files

Azure DevOps extensions cannot load TypeScript or JavaScript directly — they require HTML pages as **entry points**. The extension manifest (`azure-devops-extension.json`) registers these HTML files as contributions, and Azure DevOps loads them inside iframes when needed.

### `riskScore.html`

This is the **invisible background listener** page. It has no visible UI — its sole purpose is to load the VSS (Visual Studio Services) SDK and bootstrap `riskScore.tsx` (compiled to `scripts/riskScore`).

```
Azure DevOps loads riskScore.html in a hidden iframe
    → VSS.init() initializes the SDK
    → VSS.require() loads scripts/riskScore
    → riskScore.tsx registers as a work item form observer
    → It now listens for field changes on every open work item
```

### `riskScoreSettings.html`

This is the **admin settings page** shown in the Organization Settings hub. It has a visible UI (title bar + content area) and loads `riskScoreSettings.tsx` (compiled to `scripts/riskScoreSettings`). It also loads the settings CSS for styling.

```
Admin opens Organization Settings > Risk Score
    → Azure DevOps loads riskScoreSettings.html in a hub iframe
    → VSS.init() initializes the SDK
    → settings.initialize() renders dropdown fields for remapping
    → Admin can change which fields Likelihood / Impact / Risk Score map to
```

---

## Source Files

### `riskScoreConfig.ts` — Configuration

Holds the **default field reference names** used when the admin has not configured custom mappings. Also defines storage keys used to read/write settings from extension data storage.

```typescript
DEFAULT_FIELD_REFERENCES = {
  likelihoodField: "Custom.RiskLikelihood",
  impactField:     "Custom.RiskImpact",
  riskScoreField:  "Custom.RiskScore"
}
```

> If an admin remaps the fields via the Settings hub, those values override these defaults at runtime.

---

### `riskScoreModels.tsx` — Shared Types

Defines the `StoredFieldReferences` interface used across all source files. This ensures consistent typing when passing field reference names between functions.

```typescript
interface StoredFieldReferences {
  likelihoodField: string;
  impactField:     string;
  riskScoreField:  string;
}
```

---

### `riskScoreCalculator.ts` — Business Logic

This is the **pure calculation engine** with no Azure DevOps SDK dependencies, making it fully unit-testable.

**Key responsibilities:**
- Validates that Likelihood is an integer between 1–5
- Validates that Impact is an integer between 1–3
- Returns `Likelihood × Impact` if both inputs are valid
- Returns `isValid: false` with a message if either input is invalid

**Returns a `RiskScoreCalculationResult`:**

```typescript
{
  isValid: boolean;       // true if calculation succeeded
  score: number | null;   // the calculated score, or null
  message: string | null; // validation error message, or null
}
```

**Helper functions also exported:**
- `shouldRecalculateFromChangedFields()` — checks if a changed field is relevant
- `shouldClearScore()` — checks if the score field needs to be cleared
- `shouldWriteCalculatedScore()` — avoids redundant writes if score hasn't changed

---

### `riskScore.tsx` — Work Item Form Observer

This is the **core runtime file** that hooks into the Azure DevOps work item form lifecycle.

**Key behaviours:**

| Event | Action |
|-------|--------|
| Work item opened | Loads stored field config, marks Risk Score as read-only, runs initial calculation |
| Likelihood or Impact changed | Calls `calculateRiskScore()`, writes result back to Risk Score field |
| Invalid input detected | Clears Risk Score field, shows validation message |
| Score unchanged | Skips the write to avoid unnecessary saves |

**Loop guard:**

```typescript
let isUpdatingRiskScore = false;
```

When the extension writes the calculated score back to the form, it triggers another `onFieldChanged` event. The `isUpdatingRiskScore` flag prevents this from causing an infinite loop.

**Two calculation modes:**
- **Form mode** — uses `WorkItemFormService` to read/write fields on the currently open work item
- **Grid mode** — uses the REST API client to update work items from a backlog grid view

**Field config loading:**

On startup, the extension reads stored field mappings from extension data storage (set via the Settings hub). If none are found, it falls back to the defaults in `riskScoreConfig.ts`.

---

### `riskScoreSettings.tsx` — Admin Settings UI

Renders the settings page where an org admin can remap which Azure DevOps fields are used for Likelihood, Impact, and Risk Score.

**Key behaviours:**
- Fetches all Integer-type fields from the organization using the Work Item Tracking REST API
- Renders three dropdown lists — one for each field mapping
- Saves the selected field reference names to extension data storage when the admin clicks Save
- Supports both current and legacy storage key formats for backward compatibility

---

## End-to-End Flow

```
User opens a work item
        │
        ▼
riskScore.html loads in hidden iframe
        │
        ▼
riskScore.tsx registers as work item observer
        │
        ▼
User sets Likelihood = 4, Impact = 2
        │
        ▼
onFieldChanged fires
        │
        ▼
riskScoreCalculator.ts validates inputs
        │
        ├─ Invalid → clear Risk Score field, show message
        │
        └─ Valid → write Risk Score = 4 × 2 = 8 to Custom.RiskScore
```

---

## Testing

The calculator logic is tested independently in `tests/riskScoreCalculator.test.js` using the compiled output from `dist-tests/`. Run with:

```bash
npm test
```

---

## Frequently Asked Questions

### Technical / Architecture

**Q: Why are there HTML files if this is TypeScript?**
Azure DevOps extensions need HTML entry points loaded in iframes — the HTML bootstraps the SDK and loads the compiled JS.

**Q: Where does the compiled JavaScript go?**
TypeScript compiles to a `scripts/` folder, then gets packaged into the VSIX file.

**Q: What is the VSS SDK?**
Visual Studio Services SDK — Microsoft's library for Azure DevOps extensions to communicate with the host platform.

**Q: Why does `riskScore.html` have no visible UI?**
It's an invisible background observer — it just hooks into work item form events.

---

### Fields & Configuration

**Q: Do we have to use `Custom.RiskLikelihood` exactly?**
No — admins can remap field names from the Settings hub without touching code.

**Q: Why is Risk Score read-only on the form?**
To prevent manual overrides — the extension controls the value based on Likelihood × Impact.

**Q: What happens if a field doesn't exist on the work item type?**
The calculation won't run — the fields must be added to each work item type first.

**Q: Can we add more Likelihood or Impact values beyond 1–5 and 1–3?**
Not without a code change in `riskScoreCalculator.ts` to update the validation ranges.

---

### Installation & Deployment

**Q: Do we need to publish to the public Marketplace or can it be private?**
It can be published as a **private** extension visible only to your Azure DevOps organization.

**Q: What PAT scopes are needed to install?**
- **Extension Management** scope for installation via tfx
- **Marketplace Manage** scope for publishing to the Marketplace

**Q: Can this be installed on Azure DevOps Server (on-premises)?**
It uses cloud-specific APIs — on-premises support would need testing and may require adjustments.

**Q: What if the UI install fails?**
Use the tfx command-line install as documented in the README:
```bash
npx tfx extension install --vsix <vsix-filename> --service-url https://dev.azure.com/<organization> --token <PAT>
```

---

### Runtime Behaviour

**Q: Does it recalculate when you reopen a saved work item?**
Yes — it runs on load and recalculates based on the stored field values.

**Q: What prevents an infinite loop when writing the score back?**
The `isUpdatingRiskScore` flag guards against recursive field-change events triggered by the extension's own writes.

**Q: What if someone manually types in the Risk Score field?**
The extension marks it read-only on the form, so direct edits are blocked.

**Q: Does it work from the backlog/board grid view or only inside the work item form?**
Both — there is a grid mode that uses the REST API for updates from the backlog view.

---

### Testing & Extensibility

**Q: How is it tested?**
The calculator logic has unit tests in `tests/riskScoreCalculator.test.js` run with `npm test`. The pure calculator has no SDK dependencies making it easy to test in isolation.

**Q: Can we add more fields (e.g., a Severity field)?**
Yes, but it would require code changes to `riskScoreCalculator.ts`, `riskScoreConfig.ts`, `riskScoreModels.tsx`, and `riskScore.tsx`.

**Q: Can we change the formula from multiplication to something else?**
Yes — only `riskScoreCalculator.ts` needs to be modified since all calculation logic is isolated there.
