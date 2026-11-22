import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ModuleInstallService } from '../../src/services/module-system/ModuleInstallService';

test('Rejects an unknown module ID', async () => {
	await withTempDir('module-install-unknown-', async (directory) => {
		const service = new ModuleInstallService();
		let error: unknown;
		try {
			await service.add(directory, 'made-up-module');
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('Unknown module: made-up-module');
		recordExampleCases(
			{
				unitId: 'service.module-system-module-install',
				symbol: 'ModuleInstallService.add',
				state: 'rejects-an-unknown-module-id',
				evidence: 'examples-cases',
				file: 'rejects-an-unknown-module-id.json'
			},
			[
				{
					name: 'an ID absent from the module catalog rejects with its requested value',
					input: { id: 'made-up-module' },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
