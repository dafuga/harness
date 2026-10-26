import { expect } from 'vitest';
import {
	explorerRoute,
	explorerRoutePath,
	type ExplorerLocation
} from '../../../src/utils/explorerRoute';
import { tabOf as declaredTabOf } from '../../../src/utils/development-tooling/explorer-route/explorerTabs';
import { tabOf as forwardedTabOf } from '../../../src/utils/explorer-route/explorerTabs';

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

export function assertPermissionRoutes(): void {
	const prefix = `/branch/feature%2Forders/commit/${'a'.repeat(40)}`;
	const place = explorerRoute(`${prefix}/apis/app.endpoint.orders`, '?tab=permissions');
	expect(place).toMatchObject({
		category: 'apis',
		entity: 'app.endpoint.orders',
		tab: 'permissions'
	});
	for (const category of ['pages', 'models', 'services', 'components'])
		expect(explorerRoute(`${prefix}/${category}/example`, '?tab=permissions')?.tab).toBeUndefined();
	expect(explorerRoute(`${prefix}/permissions/member`)).toMatchObject({
		category: 'pages',
		screen: 'permissions',
		entity: 'member',
		branch: 'feature/orders',
		commit: 'a'.repeat(40)
	});
}

/** Public tab lookup accepts category accessors without adding eager reads. */
export function assertPermissionGetterAdmission(): void {
	const profile = `/branch/main/commit/${'a'.repeat(40)}/permissions/member`;
	expect(explorerRoutePath(explorerRoute(profile)!)).toBe(profile);
	for (const select of [declaredTabOf, forwardedTabOf]) {
		for (const [category, query, bound, expected] of [
			['components', 'source', 4, 'source'],
			['components', 'tests', 4, 'states'],
			['components', 'permissions', 2, undefined],
			['apis', 'permissions', 5, 'permissions']
		] as const) {
			let reads = 0;
			const location: ExplorerLocation = {
				branch: 'main',
				commit: null,
				entity: 'example',
				get category() {
					if (++reads > bound)
						throw new Error('Tab selection reads category beyond its admitted bound');
					return category;
				}
			};
			expect(select(location, `?tab=${query}`)).toBe(expected);
		}
	}
}
