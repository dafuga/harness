import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';
import type { Shown, EntityShown } from '../../../utils/explorer-ui/entityShown';
import type { ExplorerEntity } from '../../../models/explorer-ui/Explorer.types';
import { entityContract } from './entityContract';
import { entityMeasure } from './entityMeasure';
import { verdictRecord } from '../../../utils/explorer-ui/explorer-verdict/explorerVerdict';

/**
 * Describe one entity using the selected revision's contract and recorded observations.
 * Focused figures can come from an identical whole tree without acquiring a full verdict.
 */
export function entityShown(host: Shown, entity: ExplorerEntity): EntityShown {
	const record = verdictRecord(host.head);
	const contract = entityContract(entity.unit, {
		category: entity.category,
		appRoute: entity.appRoute
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

/** Project the selected declaration's source tables and unresolved gaps for its owner's Table pane. */
export function modelTableView(unit: HarnessUnit) {
	const all = unit.modelDefinitions ?? [];
	const named = all.filter((item) => item.name === unit.title);
	const definitions = named.length > 0 ? named : all;
	return {
		tables: definitions.flatMap(({ name, source, table }) =>
			table ? [{ name, source, table }] : []
		),
		gaps: definitions.flatMap(({ name, tableGap }) => (tableGap ? [{ name, gap: tableGap }] : []))
	};
}
