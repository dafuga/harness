import { expect } from 'vitest';
import { explorerRoute } from '../../../src/utils/explorerRoute';

export function assertApiRoutes(): void {
	const prefix = `/branch/feature%2Forders/commit/${'a'.repeat(40)}`;
	expect(explorerRoute(`${prefix}/apis`)?.category).toBe('apis');
	expect(explorerRoute(`${prefix}/apis/app.endpoint.orders`, '?tab=contract')).toMatchObject({
		category: 'apis',
		entity: 'app.endpoint.orders',
		tab: 'contract'
	});
	expect(explorerRoute(`${prefix}/pages/app.page.orders`, '?tab=apis')).toMatchObject({
		category: 'pages',
		tab: 'apis'
	});
	expect(
		explorerRoute(`${prefix}/components/app.component.orders`, '?tab=apis')?.tab
	).toBeUndefined();
}
