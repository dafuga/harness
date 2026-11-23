import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { offlineModule } from '../../src/templates/module-system/offlineModule';

test('Defines scoped offline module scaffolding', () => {
	expect(offlineModule.id).toBe('offline');
	expect(offlineModule.setup[0]?.path).toBe('src/services/offline/OfflineSyncService.types.ts');
	recordExampleCases(
		{
			unitId: 'template.module-system-offline-module',
			symbol: 'offlineModule',
			state: 'defines-scoped-offline-module-scaffolding',
			evidence: 'examples-cases',
			file: 'defines-scoped-offline-module-scaffolding.json'
		},
		[
			{
				name: 'offline template includes service types and collection scaffold',
				input: { id: offlineModule.id, version: offlineModule.version },
				output: {
					id: offlineModule.id,
					version: offlineModule.version,
					appOnly: offlineModule.appOnly,
					setup: offlineModule.setup.map(({ path, contents }) => ({
						path,
						lines: contents
							.split('\n')
							.filter((line) =>
								/OfflineSyncConfig|scope: string|OfflineStreamFrame|type: 'start'/.test(line)
							)
					})),
					dependencies: offlineModule.dependencies,
					resources: offlineModule.resources.map(({ id, files }) => ({
						id,
						files: files.map(({ path }) => path)
					}))
				}
			}
		]
	);
});
