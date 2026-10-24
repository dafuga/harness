import { withApis } from '../../../../test/entityApiFixtures';
import { dependencyData } from './dependencies';
import { translationData } from './translations';
import { platformFixture } from '../../../../test/platformFixture';
import { createHash } from 'node:crypto';
import type {
	HarnessIndex,
	HarnessRecord,
	HarnessRevision
} from '../../../../src/models/Harness.types';
import { index, record, revision, tested } from '../../../../test/entityFixture';
import { commits, ids, scenarios } from '../../../../test/entityUnits';
import { sealedHistory } from '../../../../../desktop/tests/e2e/ui-evidence-history';
import { routeIds, routeUnits } from './routeUnits';
import { layoutImage } from './shared';
const added = Object.values(routeIds);
const layoutScenario = {
	...scenarios[0],
	id: 'orders-layout',
	title: 'Synthetic layout with its child-content slot',
	units: [routeIds.shell],
	states: [{ id: 'default', coverage: 'required' as const }]
};
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
 * One recorded revision of that history. The layout has its own synthetic input; the
 * function results are those the sealed history keeps for the commit, the same bytes the media
 * route already serves for the desktop previews, so every artifact read matches its stated hash.
 */
export function routeRevision(commit: string): HarnessRevision {
	const shown = withApis(revision(commit, [layoutRecord(commit, results(commit, record(commit)))]));
	const units = shown.registry.units.map((unit) =>
		unit.id === ids.page
			? { ...unit, dependencies: [...unit.dependencies, { unit: routeIds.shell, via: 'import' }] }
			: unit
	);
	return {
		...shown,
		platforms: platformFixture,
		translations: translationData,
		projectDependencies: dependencyData,
		registry: {
			...shown.registry,
			units: [...units, ...routeUnits],
			scenarios: [...shown.registry.scenarios, layoutScenario]
		}
	};
}
/** A labelled fixture image of the layout, never a page's screenshot attributed to it. */
function layoutRecord(commit: string, taken: HarnessRecord): HarnessRecord {
	const scenario = tested(commit, layoutScenario.id, [
		{
			id: 'default',
			captures: layoutScenario.viewports.map(({ id }) => ({
				kind: 'screenshot',
				state: 'default',
				viewport: id,
				media: 'media/synthetic-layout-input.svg'
			}))
		}
	]);
	for (const state of scenario.states)
		for (const capture of state.captures) {
			capture.sha256 = createHash('sha256').update(layoutImage).digest('hex');
			capture.mediaType = 'image/svg+xml';
		}
	return { ...taken, scenarios: [...taken.scenarios, scenario] };
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
