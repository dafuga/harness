import { test } from 'vitest';
import { ModuleScaffoldService } from '../../src/services/module-system/ModuleScaffoldService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Rejects a resource without a scaffold generator', async () => {
	await withTempDir('module-scaffold-missing-generator-', async (root) => {
		let error: unknown;
		try {
			await new ModuleScaffoldService().generate(
				root,
				{ id: 'invoice-test' } as never,
				{ name: 'Invoice' }
			);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('A scaffold generator is required.');
		recordExampleCases(
			{
				unitId: 'service.module-system-module-scaffold',
				symbol: 'generate',
				state: 'rejects-a-resource-without-a-scaffold-generator',
				evidence: 'examples-cases',
				file: 'rejects-a-resource-without-a-scaffold-generator.json'
			},
			[
				{
					name: 'missing generator rejects before invoking a scaffold workflow',
					input: { root: '<temporary directory>', resource: { id: 'invoice-test' }, request: { name: 'Invoice' } },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
