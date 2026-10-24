import { expect } from 'vitest';
import { explorerEntities } from '../src/utils/explorerEntities';
import { explorerRelations } from '../src/utils/explorerRelations';
import { revision } from './entityFixture';
import { commits, ids } from './entityUnits';
import { withApis, apiIds } from './entityApiFixtures';

export function assertApiCatalog(): void {
	const detail = withApis(revision(commits.tip, []));
	const related = explorerRelations(detail, ids.page);
	expect(related).toMatchObject({ apis: [{ id: apiIds.orders }, { id: apiIds.refunds }] });
	const apis = explorerEntities(detail).filter(
		(entity) => entity.category === ('apis' as typeof entity.category)
	);
	expect(apis.map((entity) => entity.name)).toEqual(['/api/orders', '/api/status', '/api/refunds']);
	const old = withApis(revision(commits.first, []));
	expect(explorerRelations(old, ids.page)).toMatchObject({ apis: [] });
	expect(explorerRelations(detail, apiIds.orders).pages.map((entity) => entity.id)).toEqual([
		ids.page
	]);
}
