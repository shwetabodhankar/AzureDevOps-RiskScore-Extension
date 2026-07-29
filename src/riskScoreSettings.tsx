import Controls = require("VSS/Controls");
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import Menus = require("VSS/Controls/Menus");
import WIT_Client = require("TFS/WorkItemTracking/RestClient");
import Contracts = require("TFS/WorkItemTracking/Contracts");

import { StoredFieldReferences } from "./riskScoreModels";
import { DEFAULT_FIELD_REFERENCES, STORAGE_KEYS } from "./riskScoreConfig";

export class Settings {
  private _changeMade = false;
  private _selectedFields: StoredFieldReferences;
  private _fields: Contracts.WorkItemField[];
  private _menuBar = null;

  private getSortedFieldsList(): IPromise<any> {
    return new Promise<any>((resolve) => {
      const client = WIT_Client.getClient();
      client.getFields().then((fields: Contracts.WorkItemField[]) => {
        this._fields = fields.filter(
          (field) => field.type === Contracts.FieldType.Integer
        );

        const sortedFields = this._fields
          .map((field) => field.name)
          .sort((field1, field2) => {
            if (field1 > field2) {
              return 1;
            }

            if (field1 < field2) {
              return -1;
            }

            return 0;
          });

        resolve(sortedFields);
      });
    }) as any;
  }

  private getFieldReferenceName(fieldName: string): string {
    const matchingFields = this._fields.filter((field) => field.name === fieldName);
    return matchingFields.length > 0 ? matchingFields[0].referenceName : null;
  }

  private getFieldName(fieldReferenceName: string): string {
    const matchingFields = this._fields.filter(
      (field) => field.referenceName === fieldReferenceName
    );
    return matchingFields.length > 0 ? matchingFields[0].name : null;
  }

  private getComboOptions(
    id: string,
    fieldsList: string[],
    initialField: string
  ): IComboOptions {
    const that = this;
    return {
      id,
      mode: "drop",
      source: fieldsList,
      enabled: true,
      value: that.getFieldName(initialField),
      change: function () {
        that._changeMade = true;
        const fieldName = this.getText();
        const fieldReferenceName =
          this.getSelectedIndex() < 0 ? null : that.getFieldReferenceName(fieldName);

        switch (this._id) {
          case "likelihood":
            that._selectedFields.likelihoodField = fieldReferenceName;
            break;
          case "impact":
            that._selectedFields.impactField = fieldReferenceName;
            break;
          case "riskScore":
            that._selectedFields.riskScoreField = fieldReferenceName;
            break;
        }

        that.updateSaveButton();
      },
    };
  }

  public initialize() {
    const hubContent = $(".hub-content");
    const processHubUri = VSS.getWebContext().collection.uri + "_admin/_process";

    $("<div />")
      .addClass("description-text bowtie")
      .text("Configure the field reference names used to calculate Risk Score.")
      .appendTo(hubContent);

    $("<div />")
      .addClass("description-text bowtie")
      .html(
        "Required integer fields: Likelihood (1-5), Impact (1-3), Risk Score (1-15). Add fields in the <a target='_blank' href='" +
          processHubUri +
          "'>process hub</a>."
      )
      .appendTo(hubContent);

    const container = $("<div />")
      .addClass("risk-score-settings-container")
      .appendTo(hubContent);

    const menuBarOptions = {
      items: [{ id: "save", icon: "icon-save", title: "Save selected fields" }],
      executeAction: (args) => {
        const command = args.get_commandName();
        if (command === "save") {
          this.save();
        }
      },
    };

    this._menuBar = Controls.create<Menus.MenuBar, any>(
      Menus.MenuBar,
      container,
      menuBarOptions
    );

    const likelihoodContainer = $("<div />")
      .addClass("settings-control")
      .appendTo(container);
    $("<label />").text("Likelihood Field").appendTo(likelihoodContainer);

    const impactContainer = $("<div />")
      .addClass("settings-control")
      .appendTo(container);
    $("<label />").text("Impact Field").appendTo(impactContainer);

    const riskScoreContainer = $("<div />")
      .addClass("settings-control")
      .appendTo(container);
    $("<label />").text("Risk Score Field").appendTo(riskScoreContainer);

    VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then(
      (dataService: IExtensionDataService) => {
        dataService
          .getValue<StoredFieldReferences>(STORAGE_KEYS.current)
          .then((storedFields: StoredFieldReferences) => {
            if (storedFields) {
              this._selectedFields = storedFields;
              return;
            }

            return dataService
              .getValue<StoredFieldReferences>(STORAGE_KEYS.legacy)
              .then((legacyFields: StoredFieldReferences) => {
                this._selectedFields = legacyFields
                  ? legacyFields
                  : { ...DEFAULT_FIELD_REFERENCES };
              });
          })
          .then(() => {
            this.getSortedFieldsList().then((fieldList: string[]) => {
              Controls.create(
                Combo,
                likelihoodContainer,
                this.getComboOptions(
                  "likelihood",
                  fieldList,
                  this._selectedFields.likelihoodField
                )
              );

              Controls.create(
                Combo,
                impactContainer,
                this.getComboOptions(
                  "impact",
                  fieldList,
                  this._selectedFields.impactField
                )
              );

              Controls.create(
                Combo,
                riskScoreContainer,
                this.getComboOptions(
                  "riskScore",
                  fieldList,
                  this._selectedFields.riskScoreField
                )
              );

              this.updateSaveButton();
              VSS.notifyLoadSucceeded();
            });
          });
      }
    );
  }

  private save() {
    VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then(
      (dataService: IExtensionDataService) => {
        dataService
          .setValue<StoredFieldReferences>(
            STORAGE_KEYS.current,
            this._selectedFields
          )
          .then(() => {
            this._changeMade = false;
            this.updateSaveButton();
          });
      }
    );
  }

  private updateSaveButton() {
    const canSave =
      this._selectedFields &&
      this._selectedFields.likelihoodField &&
      this._selectedFields.impactField &&
      this._selectedFields.riskScoreField &&
      this._changeMade;

    const buttonState = canSave
      ? Menus.MenuItemState.None
      : Menus.MenuItemState.Disabled;

    this._menuBar.updateCommandStates([{ id: "save", disabled: buttonState }]);
  }
}
