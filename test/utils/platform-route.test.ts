import { expect, test } from 'vitest';
import { measureWorkload } from '../support/measureWorkload';
import { explorerRoute, explorerRoutePath } from '../../src/utils/explorerRoute';

const commit = 'a'.repeat(40);
test('platform list and detail URLs preserve their branch and selected revision', async () => {
	await measureWorkload('function.explorer-route', 'platform-route-roundtrips', () => {
		for (const entity of [undefined, 'ios', 'android', 'web', 'desktop']) {
			const location = {
				branch: 'feature/platforms',
				commit,
				category: 'platforms' as const,
				...(entity ? { entity } : {})
			};
			const path = `/branch/feature%2Fplatforms/commit/${commit}/platforms${entity ? '/' + entity : ''}`;
			expect(explorerRoutePath(location)).toBe(path);
			expect(explorerRoute(path)).toEqual(location);
		}
	});
});

test('platform pages have configuration details rather than helper or source-entity tabs', () => {
	expect(explorerRoute('/branch/main/platforms/web/history')).toBeUndefined();
	expect(explorerRoute('/branch/main/platforms/web/details')).toBeUndefined();
	expect(explorerRoute('/branch/main/platforms/web', '?tab=source&helper=web')).toEqual({
		branch: 'main',
		commit: null,
		category: 'platforms',
		entity: 'web'
	});
});
