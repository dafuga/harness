import type { ExplorerScreenProps } from "../models/ExplorerScreen.types";
import type { HarnessRecord } from "../models/Harness.types";
import { type ContractRow } from "./entityContract";
import { type EntityMeasure } from "./entityMeasure";
import { entityReasons, type EntityReasons } from "./entityReasons";

export interface EntityShown {
	contract: ContractRow[];
	measure: EntityMeasure;
	/** The one record that judges the shown revision; its figures and its verdict go together. */
	record: HarnessRecord | null;
}

export type Shown = Pick<ExplorerScreenProps, 'head' | 'parent'>;

/** What the shown commit itself says it changed in one entity, held to the length of a reason. */
export function entityChanged(host: Pick<Shown, 'head'>, unit: string): EntityReasons {
	return entityReasons(host.head.explanations.filter((item) => item.unit === unit));
}

export { entityShown } from '../components/harness/entity-sections/entityShown';
