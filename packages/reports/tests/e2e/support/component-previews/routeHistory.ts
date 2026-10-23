import type {
	HarnessIndex,
	HarnessRecord,
	HarnessRevision
} from '../../../../src/models/Harness.types';
import { index, record, revision } from '../../../../test/entityFixture';
import { commits } from '../../../../test/entityUnits';
import { sealedHistory } from '../../../../../desktop/tests/e2e/ui-evidence-history';
import { routeIds, routeUnits } from './routeUnits';
const added = Object.values(routeIds);
/** The orders history the route previews open on; its first commit also adds the synthetic units. */
export const routeIndex: HarnessIndex = {
	...index,
	revisions: index.revisions.map((item) =>
		item.commit === commits.first && item.changes
			? { ...item, changes: { ...item.changes, added: [...item.changes.added, ...added] } }
			: item
	)
};
// Sealed once, when a route preview first reads a revision; importing this module seals nothing.
let sealed: ReturnType<typeof sealedHistory> | undefined;
/**
 * One recorded revision of that history. The shell is drawn by the orders page scenario, and the
 * function results are those the sealed history keeps for the commit, the same bytes the media
 * route already serves for the desktop previews, so every artifact read matches its stated hash.
 */
export function routeRevision(commit: string): HarnessRevision {
	const shown = revision(commit, [results(commit, record(commit))]);
	const scenarios = shown.registry.scenarios.map((scenario) =>
		scenario.id === 'orders-page'
			? { ...scenario, units: [...scenario.units, routeIds.shell] }
			: scenario
	);
	const units = [...shown.registry.units, ...routeUnits];
	return { ...shown, registry: { ...shown.registry, units, scenarios } };
}
/** A commit the sealed history did not record keeps the results of the orders fixture. */
function results(commit: string, taken: HarnessRecord): HarnessRecord {
	sealed ??= sealedHistory();
	const kept = sealed.revisions[commit]?.records[0]?.scenarios.find(
		(item) => item.id === 'order-filter'
	);
	if (!kept) return taken;
	return {
		...taken,
		scenarios: taken.scenarios.map((item) => (item.id === kept.id ? kept : item))
	};
}
