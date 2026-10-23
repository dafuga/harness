import type { MetricHost } from './entityMetricComparison.types';
import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
import type { EntityMeasure } from './entityMeasure';
import type { HarnessRevision } from '../../models/explorer-ui/Harness.types';
import { entityMeasure } from '../../components/explorer-ui/entity-sections/entityMeasure';
import { verdictRecord } from './explorer-verdict/explorerVerdict';
import type { MetricComparison } from './metricChanges';

function observations(revision: HarnessRevision) {
	return (revision.regressions ?? []).flatMap(({ green }) =>
		green &&
		(green.commit === revision.commit ||
			(green.sourceTree &&
				(revision.sourceTree === green.sourceTree ||
					revision.side === `sides/${green.sourceTree}.json`)))
			? (green.measurements ?? [])
			: []
	);
}

/** The first-parent profile appears only for an entity opened through Pages at a commit. */
export function entityMetricComparison(
	host: MetricHost,
	entity: ExplorerEntity,
	measure: EntityMeasure,
	helper?: string
): MetricComparison | null {
	const previous = host.parent;
	if (
		host.route.category !== 'pages' ||
		entity.category !== 'pages' ||
		!previous ||
		helper ||
		entity.lastAt
	)
		return null;
	const present = host.head.registry.units.some(
		(unit) => unit.id === entity.id && unit.status === 'active'
	);
	const unit = previous.registry.units.find(
		(candidate) => candidate.id === entity.id && candidate.status === 'active'
	);
	if (!present || !unit) return null;
	return {
		before: {
			commit: previous.commit,
			measure: entityMeasure(unit, verdictRecord(previous), observations(previous))
		},
		after: { commit: host.head.commit, measure }
	};
}
