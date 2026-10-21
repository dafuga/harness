import type { Shown, EntityShown } from '../../../../utils/explorer-ui/entityShown';
import type { ExplorerEntity } from '../../../../models/explorer-ui/Explorer.types';
import { entityContract, requiredStates } from './entityContract';
import { entityMeasure } from './entityMeasure';
import { verdictRecord } from '../../../../utils/explorer-ui/explorer-verdict/explorerVerdict';

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
		// The registry that holds the entity says what it is made into, so which states apply.
		states: requiredStates(entity.unit, held.registry.scenarios, held.registry.units)
	});
	const observations = (host.head.regressions ?? []).flatMap((proof) =>
		proof.green?.commit === host.head.commit ? (proof.green.measurements ?? []) : []
	);
	return { contract, measure: entityMeasure(entity.unit, record, observations), record };
}
