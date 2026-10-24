import { compositionRows } from './nativeAtomProps';
import { platformFixture } from '../../../../test/platformFixture';
import { index, record, revision } from '../../../../test/entityFixture';
import { place, scope, lens, nav } from '../../../../test/entityPlaces';
import { commits, ids } from '../../../../test/entityUnits';
import { explorerEntities } from '../../../../src/utils/explorerEntities';
import { entityContract } from '../../../../src/utils/entityContract';
import { desktopData } from './sealedData';
import { entityBehavior } from '../../../../src/utils/entityBehavior';
import { entityMeasure } from '../../../../src/utils/entityMeasure';
import { entityReasons } from '../../../../src/utils/entityReasons';
import { entityCatalog } from '../../../../src/utils/entityCatalog';
import { screenOptions } from '../../../../src/utils/entityScreens';
import { historyDetail } from '../../../../src/utils/explorerHistory';
import type { ExplorerScreenProps } from '../../../../src/models/ExplorerScreen.types';
import type { HarnessExplanation } from '../../../../src/models/Harness.types';
export { index, commits, ids };
const head = revision(commits.middle, [record(commits.middle)]);
const parent = revision(commits.first, [record(commits.first)]);
export const shown = { head, parent, scope: scope('commit') };
export const entities = explorerEntities(head);
export const entity = entities.find((e) => e.id === ids.list)!;
export const navigation = nav(place({ category: 'components', entity: ids.list }));
export const reading = lens(shown, index);
export const evidence = reading.evidence(entity.unit);
export const behavior = desktopData.results[`${ids.filter}|commit|${commits.middle}`].behavior;
export const run = entityBehavior(behavior);
export const cell = run.groups[0].lines[0].after;
export const audioEvidence = desktopData.results[`${ids.search}|current|${commits.tip}`].evidence;
export const contract = entityContract(entity.unit, { category: entity.category });
export const measure = entityMeasure(entity.unit, head.records[0]);
export const reasons = entityReasons(head.explanations);
export const rows = compositionRows(entityCatalog(entities, 'components', reading.relations));
export const helperRows = entityCatalog(entities, 'functions', reading.relations);
export const configRows = entityCatalog(entities, 'configs', reading.relations);
export const options = screenOptions(evidence.scenarios);
export const changeDetail = historyDetail(head, ids.list);
/** Synthetic reasons of two functions of one commit: their summary says less than they do. */
const said = (symbol: string, behavior: string): HarnessExplanation => ({
	unit: ids.list,
	symbol,
	change: 'modified',
	behavior,
	simplification: { attempt: 'Kept one list renderer for every row.', outcome: 'improved' },
	performance: { attempt: 'Measured rendering of the visible rows.', outcome: 'not-applicable' }
});
export const longReasons = entityReasons([
	said('orderList', 'The list now supports keyboard navigation.'),
	said('orderRow', 'A row names its order and its status.')
]);
export const client = {
	revision: async (commit: string) => revision(commit, [record(commit)]),
	index: async () => index,
	activity: async () => ({})
};
export function host(
	category: ExplorerScreenProps['route']['category'] = 'components',
	tab?: ExplorerScreenProps['route']['tab']
): ExplorerScreenProps {
	let selected: string = ids.list;
	if (category === 'configs') selected = ids.settings;
	if (category === 'functions') selected = ids.filter;
	const route = place({
		category,
		entity: selected,
		tab
	});
	return {
		index,
		head,
		parent,
		scope: { ...shown.scope, location: route },
		route,
		entities,
		lens: reading,
		client,
		mediaBase: '/media/',
		onroute: () => {},
		exportHref: ''
	};
}

/** Existing synthetic Orders deployment declarations, shown by the actual platform components. */
export function platformHost(entity?: string): ExplorerScreenProps {
	const shown = host('platforms');
	const route = { ...shown.route, entity };
	return {
		...shown,
		route,
		scope: { ...shown.scope, location: route },
		head: { ...shown.head, platforms: platformFixture }
	};
}
