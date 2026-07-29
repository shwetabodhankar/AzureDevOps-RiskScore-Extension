import TFS_Wit_Contracts = require("TFS/WorkItemTracking/Contracts");
import TFS_Wit_Client = require("TFS/WorkItemTracking/RestClient");
import TFS_Wit_Services = require("TFS/WorkItemTracking/Services");

import { StoredFieldReferences } from "./riskScoreModels";
import { DEFAULT_FIELD_REFERENCES, STORAGE_KEYS } from "./riskScoreConfig";
import {
  calculateRiskScore,
  shouldRecalculateFromChangedFields,
  shouldClearScore,
  shouldWriteCalculatedScore,
} from "./riskScoreCalculator";

let isUpdatingRiskScore = false;

function getStoredFields(): IPromise<any> {
  return new Promise<any>((resolve) => {
    VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then(
      (dataService: IExtensionDataService) => {
        dataService
          .getValue<StoredFieldReferences>(STORAGE_KEYS.current)
          .then((storedFields: StoredFieldReferences) => {
            if (storedFields) {
              resolve(storedFields);
              return;
            }

            dataService
              .getValue<StoredFieldReferences>(STORAGE_KEYS.legacy)
              .then((legacyFields: StoredFieldReferences) => {
                resolve(legacyFields || DEFAULT_FIELD_REFERENCES);
              });
          });
      }
    );
  }) as any;
}

function getWorkItemFormService() {
  return TFS_Wit_Services.WorkItemFormService.getService();
}

function setStatusMessage(service: any, message: string | null) {
  if (message) {
    if (typeof service.setError === "function") {
      service.setError(message);
    } else {
      console.log(message);
    }
    return;
  }

  if (typeof service.clearError === "function") {
    service.clearError();
  }
}

function setScoreFieldReadOnly(service: any, storedFields: StoredFieldReferences) {
  if (typeof service.setFieldReadOnly === "function") {
    service.setFieldReadOnly(storedFields.riskScoreField, true);
  }
}

function updateRiskScoreOnForm(storedFields: StoredFieldReferences) {
  if (isUpdatingRiskScore) {
    return;
  }

  getWorkItemFormService().then((service) => {
    setScoreFieldReadOnly(service, storedFields);

    service
      .getFieldValues([
        storedFields.likelihoodField,
        storedFields.impactField,
        storedFields.riskScoreField,
      ])
      .then((values) => {
        const result = calculateRiskScore(
          values[storedFields.likelihoodField],
          values[storedFields.impactField]
        );
        const existingScoreValue = values[storedFields.riskScoreField];

        if (!result.isValid) {
          setStatusMessage(service, result.message);
          if (!shouldClearScore(existingScoreValue)) {
            return;
          }

          isUpdatingRiskScore = true;
          service
            .setFieldValue(storedFields.riskScoreField, null)
            .then(() => {
              isUpdatingRiskScore = false;
            }, (reason) => {
              isUpdatingRiskScore = false;
              console.log(reason);
            });
          return;
        }

        setStatusMessage(service, null);

        if (!shouldWriteCalculatedScore(existingScoreValue, result.score)) {
          return;
        }

        isUpdatingRiskScore = true;
        service
          .setFieldValue(storedFields.riskScoreField, result.score)
          .then(() => {
            isUpdatingRiskScore = false;
          }, (reason) => {
            isUpdatingRiskScore = false;
            console.log(reason);
          });
      });
  });
}

function updateRiskScoreOnGrid(
  workItemId: number,
  storedFields: StoredFieldReferences
): IPromise<any> {
  const riskFields = [
    storedFields.likelihoodField,
    storedFields.impactField,
    storedFields.riskScoreField,
  ];

  return new Promise<any>((resolve, reject) => {
    const client = TFS_Wit_Client.getClient();
    client
      .getWorkItem(workItemId, riskFields)
      .then((workItem: TFS_Wit_Contracts.WorkItem) => {
        const result = calculateRiskScore(
          workItem.fields[storedFields.likelihoodField],
          workItem.fields[storedFields.impactField]
        );
        const existingScoreValue = workItem.fields[storedFields.riskScoreField];

        if (!result.isValid) {
          if (!shouldClearScore(existingScoreValue)) {
            reject("No relevant change to work item");
            return;
          }

          const clearDocument = [
            {
              from: null,
              op: "add",
              path: "/fields/" + storedFields.riskScoreField,
              value: null,
            },
          ];

          client
            .updateWorkItem(clearDocument, workItemId)
            .then((updatedWorkItem: TFS_Wit_Contracts.WorkItem) => {
              resolve(updatedWorkItem);
            });
          return;
        }

        if (!shouldWriteCalculatedScore(existingScoreValue, result.score)) {
          reject("No relevant change to work item");
          return;
        }

        const updateDocument = [
          {
            from: null,
            op: "add",
            path: "/fields/" + storedFields.riskScoreField,
            value: result.score,
          },
        ];

        client
          .updateWorkItem(updateDocument, workItemId)
          .then((updatedWorkItem: TFS_Wit_Contracts.WorkItem) => {
            resolve(updatedWorkItem);
          });
      }, (reason) => {
        reject(reason);
      });
  }) as any;
}

function hasConfiguredFields(storedFields: StoredFieldReferences): boolean {
  return !!(
    storedFields &&
    storedFields.likelihoodField &&
    storedFields.impactField &&
    storedFields.riskScoreField
  );
}

const formObserver = () => {
  return {
    onFieldChanged: function (args) {
      getStoredFields().then((storedFields: StoredFieldReferences) => {
        if (!hasConfiguredFields(storedFields)) {
          console.log(
            "Unable to calculate Risk Score. Configure fields on the collection settings page."
          );
          return;
        }

        const changedFields = args.changedFields || {};
        if (
          shouldRecalculateFromChangedFields(
            changedFields,
            storedFields.likelihoodField,
            storedFields.impactField,
            storedFields.riskScoreField
          )
        ) {
          updateRiskScoreOnForm(storedFields);
        }
      });
    },

    onLoaded: function () {
      getStoredFields().then((storedFields: StoredFieldReferences) => {
        if (!hasConfiguredFields(storedFields)) {
          console.log(
            "Unable to calculate Risk Score. Configure fields on the collection settings page."
          );
          return;
        }

        updateRiskScoreOnForm(storedFields);
      });
    },
  };
};

const contextProvider = () => {
  return {
    execute: function (args) {
      getStoredFields().then((storedFields: StoredFieldReferences) => {
        if (!hasConfiguredFields(storedFields)) {
          console.log(
            "Unable to calculate Risk Score. Configure fields on the collection settings page."
          );
          return;
        }

        const workItemIds = args.workItemIds;
        const promises = [];

        $.each(workItemIds, function (index, workItemId) {
          promises.push(updateRiskScoreOnGrid(workItemId, storedFields));
        });

        Promise.all(
          promises.map((promise) => promise.then(() => null, () => null))
        ).then(() => {
          VSS.getService(VSS.ServiceIds.Navigation).then(
            (navigationService: IHostNavigationService) => {
              navigationService.reload();
            }
          );
        });
      });
    },
  };
};

const extensionContext = VSS.getExtensionContext();
VSS.register(
  `${extensionContext.publisherId}.${extensionContext.extensionId}.risk-score-work-item-form-observer`,
  formObserver
);
VSS.register(
  `${extensionContext.publisherId}.${extensionContext.extensionId}.risk-score-context-menu`,
  contextProvider
);
