import { expect } from 'vitest';
import { explorerRoute, explorerRoutePath } from '../../../src/utils/explorerRoute';

/** Canonical plugin URLs preserve old module links without stealing category-like identities. */
export function assertPluginRoutes() {
	const sha = 'a'.repeat(40);
	for (const scope of [`/branch/feature%2Fplugins/commit/${sha}`, `/commit/${sha}`]) {
		for (const entity of ['', '/email', '/components', '/apis']) {
			const canonical = `${scope}/plugins${entity}`;
			const expected = explorerRoute(canonical)!;
			expect(expected.screen).toBe('modules');
			expect(explorerRoute(`${scope}/modules${entity}`)).toEqual(expected);
			expect(explorerRoute(`${canonical}/`)).toEqual(expected);
			expect(explorerRoutePath(explorerRoute(`${scope}/modules${entity}`)!)).toBe(canonical);
		}
		for (const unsupported of ['plugin', 'Plugins', 'MODULES'])
			expect(explorerRoute(`${scope}/${unsupported}`)).toBeUndefined();
	}
}
