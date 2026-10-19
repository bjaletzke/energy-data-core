/** Supported document families. Scheduling and hosted-service policy are excluded. */
export type ItemId = "load" | "generation" | "reservoirs";

export interface Item {
  id: ItemId;
  article: string;
  name: string;
  documentType: string;
  processType: string;
  unit: "MW" | "MWh";
}

/** Source schema metadata, not a grant of rights to upstream data. */
export const ITEMS: Readonly<Record<ItemId, Item>> = {
  load: { id: "load", article: "6.1.A", name: "Actual total load", documentType: "A65", processType: "A16", unit: "MW" },
  generation: { id: "generation", article: "16.1.B", name: "Actual generation per production type", documentType: "A75", processType: "A16", unit: "MW" },
  reservoirs: { id: "reservoirs", article: "16.1.D", name: "Water reservoir and hydro storage levels", documentType: "A72", processType: "A16", unit: "MWh" },
};
export const ITEM_IDS: readonly ItemId[] = ["load", "generation", "reservoirs"];
