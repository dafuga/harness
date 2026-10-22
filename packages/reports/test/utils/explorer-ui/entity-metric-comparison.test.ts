import { expect, test } from 'vitest';
import { entityShown } from '../../../src/components/explorer-ui/harness/entity-sections/entityShown';
import { entityMetricComparison } from '../../../src/utils/explorer-ui/entityMetricComparison';
import { hostProps } from '../../entityRender';
import { commits, ids } from '../../entityUnits';

test('a Pages commit compares an entity with its first parent', () => {
	const host = hostProps('commit', { category: 'pages', entity: ids.page });
	const page = host.entities.find((entity) => entity.id === ids.page)!;
	const measure = entityShown(host, page).measure;
	const comparison = entityMetricComparison(host, page, measure);

	expect(comparison?.before.commit).toBe(commits.first);
	expect(comparison?.after).toEqual({ commit: commits.middle, measure });
});

test('other routes and branch tips keep a single-revision profile', () => {
	const commit = hostProps('commit', { category: 'components', entity: ids.list });
	const component = commit.entities.find((entity) => entity.id === ids.list)!;
	const componentMeasure = entityShown(commit, component).measure;
	expect(entityMetricComparison(commit, component, componentMeasure)).toBeNull();

	const tip = hostProps('current', { category: 'pages', entity: ids.page });
	const page = tip.entities.find((entity) => entity.id === ids.page)!;
	expect(entityMetricComparison(tip, page, entityShown(tip, page).measure)).toBeNull();
});
