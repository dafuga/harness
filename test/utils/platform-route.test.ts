import { expect, test } from 'vitest';
import { measureWorkload } from '../support/measureWorkload';
import { explorerRoute, explorerRoutePath } from '../../src/utils/explorerRoute';
import * as consoleEntry from '../../src/lib/console';

const commit = 'a'.repeat(40);
test('platform list and detail URLs preserve their branch and selected revision', () =>
	measureWorkload('module.console', 'public-platform-route-roundtrips', () =>
		measureWorkload('function.explorer-route', 'platform-route-roundtrips', () => {
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
				expect(consoleEntry.explorerRoutePath(location)).toBe(path);
				expect(consoleEntry.explorerRoute(path)).toEqual(location);
			}
			expect(consoleEntry.explorerCategories).toContain('platforms');
			expect(consoleEntry.explorerEntityCategories).not.toContain('platforms');
		})
	));

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
