import type { Shown, EntityShown } from '../../../utils/entityShown';
import type { ExplorerEntity } from '../../../models/Explorer.types';
import { entityContract, requiredStates } from './entityContract';
import { entityMeasure } from './entityMeasure';
import { verdictRecord } from '../../../utils/explorer-verdict/explorerVerdict';

/**
 * Describe one entity using the selected revision's contract and recorded observations.
 * Focused figures can come from an identical whole tree without acquiring a full verdict.
 * Removed entities retain the states their parent required.
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
	const observations = (host.head.regressions ?? []).flatMap(({ green }) =>
		green &&
		(green.commit === host.head.commit ||
			(green.sourceTree &&
				(host.head.sourceTree === green.sourceTree ||
					host.head.side === `sides/${green.sourceTree}.json`)))
			? (green.measurements ?? [])
			: []
	);
	return { contract, measure: entityMeasure(entity.unit, record, observations), record };
}
