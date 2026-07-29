# Risk Score (Likelihood x Impact)

This extension calculates Risk Score on Azure DevOps work items and writes the result to a custom integer field.

Formula:

Risk Score = Likelihood x Impact

## Scoring model

Likelihood:

- 1 = Extremely Unlikely
- 2 = Unlikely
- 3 = Possible
- 4 = Likely
- 5 = Highly Likely

Impact:

- 1 = Low
- 2 = Medium
- 3 = High

Risk Score range:

- 1 to 15

## Validation behavior

- Calculates only when both inputs are valid integers.
- Likelihood must be 1..5.
- Impact must be 1..3.
- Invalid, missing, empty, decimal, zero, negative, and out-of-range inputs are treated as invalid.
- When inputs are invalid, Risk Score is cleared.

## Required fields

Add these fields to each work item type where Risk Score is needed:

- Custom.RiskLikelihood (Integer)
- Custom.RiskImpact (Integer)
- Custom.RiskScore (Integer)

## Configuration

Use the Risk Score settings hub to map field reference names. Default mappings are:

- Custom.RiskLikelihood
- Custom.RiskImpact
- Custom.RiskScore

## Runtime behavior

- Recalculates on work item load.
- Recalculates whenever Likelihood or Impact changes.
- Avoids redundant writes when the score is unchanged.
- Includes guards to prevent recursive update loops.

## Context menu action

From backlog or query grids, use the context menu action to recalculate Risk Score for selected work items.

## Attribution

Architecture adapted from the Microsoft AzureDevOps-WSJF-Extension reference implementation.
