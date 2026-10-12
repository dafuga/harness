import type { ExplorerEntity } from '../models/Explorer.types';
import type { ExplorerScreenProps } from '../models/ExplorerScreen.types';
import type { HarnessRecord } from '../models/Harness.types';
import { entityContract, requiredStates, type ContractRow } from './entityContract';
import { entityMeasure, type EntityMeasure } from './entityMeasure';
import { entityReasons, type EntityReasons } from './entityReasons';
import { verdictRecord } from './explorerVerdict';

export interface EntityShown {
	contract: ContractRow[];
	measure: EntityMeasure;
	/** The one record that judges the shown revision; its figures and its verdict go together. */
	record: HarnessRecord | null;
}

type Shown = Pick<ExplorerScreenProps, 'head' | 'parent'>;

/**
 * What an overview and a details screen say about one entity: its contract, and its size and
 * performance from the record that judges the shown revision. An entity the shown commit
 * removed has nothing there, so the states of its last contract are those its parent required.
 */
export function entityShown(host: Shown, entity: ExplorerEntity): EntityShown {
	const held = entity.change === 'removed' && host.parent ? host.parent : host.head;
	const record = verdictRecord(host.head);
	const contract = entityContract(entity.unit, {
		category: entity.category,
		appRoute: entity.appRoute,
		states: requiredStates(entity.unit, held.registry.scenarios)
	});
	return { contract, measure: entityMeasure(entity.unit, record), record };
}

/** What the shown commit itself says it changed in one entity, held to the length of a reason. */
export function entityChanged(host: Pick<Shown, 'head'>, unit: string): EntityReasons {
	return entityReasons(host.head.explanations.filter((item) => item.unit === unit));
}
