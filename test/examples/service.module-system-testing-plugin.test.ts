import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { TestingPluginService } from '../../src/commands/module-system/module-command/TestingPluginService';
import { TestingPluginServiceError } from '../../src/commands/module-system/module-command/TestingPluginService.types';

const STATE = 'rejects-a-testing-plugin-id-that-is-not-installed';
const IDS = ['example.testing-plugin', 'example.lint-plugin'];
const NOT_INSTALLED = 'Install a testing plugin before running it.';

async function captureRunError(root: string, id: string): Promise<unknown> {
	try {
		await new TestingPluginService().run(root, id);
	} catch (caught) {
		return caught;
	}
	return undefined;
}

test('Rejects a testing plugin id that is not installed', async () => {
	await withTempDir('testing-plugin-not-installed-', async (directory) => {
		const cases: Array<
			{ name: string; input: unknown } & ({ output: unknown } | { error: unknown })
		> = [];
		for (const id of IDS) {
			const error = await captureRunError(directory, id);
			expect(error).toBeInstanceOf(TestingPluginServiceError);
			expect((error as Error).message).toBe(NOT_INSTALLED);
			cases.push({
				name: `run with uninstalled id ${id} is rejected`,
				input: { root: 'empty temporary project directory', id },
				error: { name: (error as Error).name, message: (error as Error).message }
			});
		}

		recordExampleCases(
			{
				unitId: 'service.module-system-testing-plugin',
				symbol: 'run',
				state: STATE,
				evidence: 'examples-cases',
				file: `${STATE}.json`
			},
			cases
		);
	});
});
