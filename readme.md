# Risk Score (Likelihood x Impact)

This Azure DevOps extension automatically calculates and persists a Risk Score on work items.

Formula:

Risk Score = Likelihood x Impact

The value is written to a custom field so it is stored with the work item and visible when reopened.

## Risk matrix

Likelihood scale:

- 1 = Extremely Unlikely
- 2 = Unlikely
- 3 = Possible
- 4 = Likely
- 5 = Highly Likely

Impact scale:

- 1 = Low
- 2 = Medium
- 3 = High

Examples:

- 1 x 1 = 1
- 5 x 1 = 5
- 3 x 2 = 6
- 4 x 2 = 8
- 3 x 3 = 9
- 5 x 3 = 15

## Required custom fields

Create these Azure DevOps custom fields and add them to the target work item types:

- Custom.RiskLikelihood, Picklist (Integer), allowed values 1 through 5
- Custom.RiskImpact, Picklist (Integer), allowed values 1 through 3
- Custom.RiskScore, Integer, calculated values 1 through 15

## Configuration

The default field references are defined in src/riskScoreConfig.ts:

- Custom.RiskLikelihood
- Custom.RiskImpact
- Custom.RiskScore

You can change mappings from Organization settings > Risk Score hub. The hub stores selected field reference names in extension data.

## Behavior and validation

- Recalculates when Likelihood or Impact changes.
- Calculates only when both inputs are valid integers in range.
- Clears Risk Score when either source input becomes invalid or missing.
- Avoids redundant writes when the calculated value already matches stored Risk Score.
- Uses loop guards to avoid recursive field-change update loops.
- Keeps Risk Score read-only from extension logic where supported.

## Build and packaging workflow

### 1. Local build and test

Compile and test the TypeScript code:

```bash
npm install
npm run build
npm run lint
npm test
```

### 2. Create VSIX package

Package the extension into a VSIX file using tfx:

```bash
npm run package
```

This creates a `.vsix` file that contains the compiled extension.

For environment-specific packages:

```bash
npm run package:dev
npm run package:test
```

### 3. Installation

Install the generated VSIX package into your Azure DevOps organization.

**Web UI Installation** (if available):

Navigate to Organization settings > Extensions > Manage extensions and upload the VSIX file.

**Command-line installation with tfx** (recommended):

To install from the command line without using the web UI:

```bash
npx tfx extension install --vsix <vsix-filename> --service-url https://dev.azure.com/<organization> --token <PAT>
```

Example:

```bash
npx tfx extension install --vsix sbodhankar-devtools.risk-score-extension-1.0.0.vsix --service-url https://dev.azure.com/contososhwetaadmin --token "YOUR_PAT_TOKEN_HERE"
```

**Parameters:**
- `--vsix`: Path to the generated VSIX file (from step 2)
- `--service-url`: Your Azure DevOps organization URL
- `--token`: Personal Access Token with "Extension Management" scope

**Note:** Create a PAT with "Extension Management" scope to allow installation.

## Publishing to Marketplace

After packaging the extension (step 2 above), you can publish to the Azure DevOps Marketplace:

1. Set your publisher ID in `azure-devops-extension.json`

2. Create a Personal Access Token with "Marketplace manage" scope and export it as `AZDO_PAT`

3. Publish using npm:

```bash
npm run publish:dev
npm run publish:test
```

**Note:** This extension has already been manually built and published to the Azure DevOps Marketplace. The above commands are for future updates.

## Add control to a work-item form

1. Open your process customization page.
2. Add the three custom fields to each work item type where scoring is needed.
3. Add the extension contribution to the work-item form:
Contribution type: ms.vss-work-web.work-item-notifications
Contribution ID: risk-score-work-item-form-observer
4. Open a work item and set Likelihood and Impact.
5. Confirm Risk Score is calculated and persisted in Custom.RiskScore.

## Troubleshooting

- Risk Score does not update:
Confirm all three fields exist on the work item type.
Confirm field reference names match configuration.
Verify values are integers and within required ranges.

- Risk Score clears unexpectedly:
One input is missing, non-integer, zero, negative, or out-of-range.

- Extension compiles but does not run:
Confirm riskScore.html and riskScoreSettings.html are listed in azure-devops-extension.json files section.
Confirm scripts were built to dist and packaged as scripts.

## Support

Use your repository issue tracker for bugs, validation gaps, and feature requests.

## Attribution

This project architecture is adapted from the Microsoft AzureDevOps-WSJF-Extension reference implementation.
