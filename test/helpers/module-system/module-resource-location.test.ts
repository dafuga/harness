import { expect, test } from 'vitest';
import { moduleResourceLocation } from '../../../src/helpers/module-system/moduleResourceLocation';
import { measureWorkload } from '../../support/measureWorkload';
import type { ModuleResource } from '../../../src/services/module-system/moduleDefinition.types';
test('module destinations preserve revision scope and clear entity context', async () => {
	const resource: ModuleResource = {
		id: 'service',
		title: 'Services',
		singular: 'Service',
		kind: 'service',
		instructions: ['Generate'],
		files: [],
		catalog: 'services'
	};
	const scope = { branch: 'feature/modules', commit: 'a'.repeat(40), entity: 'unrelated' };
	await measureWorkload(
		'helper.module-system-module-resource-location',
		'resolve-module-destinations',
		async () => {
			expect(moduleResourceLocation(scope, 'services', resource)).toEqual({
				branch: scope.branch,
				commit: scope.commit,
				category: 'services'
			});
			expect(
				moduleResourceLocation(scope, 'rust-wasm', {
					...resource,
					id: 'kernel',
					catalog: undefined
				})
			).toEqual({
				branch: scope.branch,
				commit: scope.commit,
				category: 'pages',
				screen: 'module-resources',
				entity: 'rust-wasm.kernel'
			});
		}
	);
});
