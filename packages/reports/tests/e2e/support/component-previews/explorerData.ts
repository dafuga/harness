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
import type { ExplorerScreenProps } from '../../../../src/models/ExplorerScreen.types';
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
export const contract = entityContract(entity.unit, {
	category: entity.category,
	states: ['default', 'empty']
});
export const measure = entityMeasure(entity.unit, head.records[0]);
export const reasons = entityReasons(head.explanations);
export const rows = entityCatalog(entities, 'components', reading.relations);
export const helperRows = entityCatalog(entities, 'functions', reading.relations);
export const options = screenOptions(evidence.scenarios);
export const client = {
	revision: async (commit: string) => revision(commit, [record(commit)]),
	index: async () => index,
	activity: async () => ({})
};
export function host(
	category: ExplorerScreenProps['route']['category'] = 'components',
	tab?: ExplorerScreenProps['route']['tab']
): ExplorerScreenProps {
	const route = place({
		category,
		entity:
			category === 'configs' ? ids.settings : category === 'functions' ? ids.filter : ids.list,
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
