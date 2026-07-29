export interface RiskScoreCalculationResult {
  isValid: boolean;
  score: number | null;
  message: string | null;
}

function toIntegerInRange(
  rawValue: any,
  minimum: number,
  maximum: number
): number | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === "string" && rawValue.trim() === "") {
    return null;
  }

  const numberValue = Number(rawValue);
  if (!Number.isFinite(numberValue) || !Number.isInteger(numberValue)) {
    return null;
  }

  if (numberValue < minimum || numberValue > maximum) {
    return null;
  }

  return numberValue;
}

export function calculateRiskScore(
  likelihoodRaw: any,
  impactRaw: any
): RiskScoreCalculationResult {
  const likelihood = toIntegerInRange(likelihoodRaw, 1, 5);
  const impact = toIntegerInRange(impactRaw, 1, 3);

  if (likelihood === null || impact === null) {
    return {
      isValid: false,
      score: null,
      message: "Risk Score requires Likelihood 1-5 and Impact 1-3.",
    };
  }

  const score = likelihood * impact;
  if (score < 1 || score > 15) {
    return {
      isValid: false,
      score: null,
      message: "Calculated Risk Score is outside the valid range 1-15.",
    };
  }

  return {
    isValid: true,
    score,
    message: null,
  };
}

export function parseStoredScore(rawValue: any): number | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === "string" && rawValue.trim() === "") {
    return null;
  }

  const numberValue = Number(rawValue);
  if (!Number.isFinite(numberValue) || !Number.isInteger(numberValue)) {
    return null;
  }

  return numberValue;
}

export function shouldWriteCalculatedScore(
  currentScoreRaw: any,
  calculatedScore: number
): boolean {
  const currentScore = parseStoredScore(currentScoreRaw);
  return currentScore !== calculatedScore;
}

export function shouldClearScore(currentScoreRaw: any): boolean {
  return currentScoreRaw !== null && currentScoreRaw !== undefined && currentScoreRaw !== "";
}

export function shouldRecalculateFromChangedFields(
  changedFields: { [key: string]: any },
  likelihoodField: string,
  impactField: string,
  riskScoreField: string
): boolean {
  const hasChanges = changedFields || {};
  const likelihoodChanged = hasChanges[likelihoodField] !== undefined;
  const impactChanged = hasChanges[impactField] !== undefined;
  const scoreChanged = hasChanges[riskScoreField] !== undefined;

  if (scoreChanged && !likelihoodChanged && !impactChanged) {
    return false;
  }

  return likelihoodChanged || impactChanged;
}
