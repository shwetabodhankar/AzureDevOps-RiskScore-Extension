import { StoredFieldReferences } from "./riskScoreModels";

export const STORAGE_KEYS = {
  current: "riskScoreStoredFields",
  legacy: "storedFields",
};

export const DEFAULT_FIELD_REFERENCES: StoredFieldReferences = {
  likelihoodField: "Custom.RiskLikelihood",
  impactField: "Custom.RiskImpact",
  riskScoreField: "Custom.RiskScore",
};
