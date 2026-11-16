import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { runApi } from '../../src/workflows/networking-security/runApi';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Lists available API resources', async () => {
	await withTempDir('networking-security-api-resources-', async (directory) => {
		const output = join(directory, 'resources.json');
		const result = await runApi('resources', [], { mode: 'local', output });
		const data = JSON.parse(await readFile(output, 'utf8')) as {
			resources: string[];
			mode: string;
		};

		expect(result).toBeUndefined();
		expect(data.resources).toContain('contracts');
		expect(data.mode).toBe('local');
		recordExampleCases(
			{
				unitId: 'workflow.networking-security-run-api',
				symbol: 'runApi',
				state: 'lists-available-api-resources',
				evidence: 'examples-cases',
				file: 'lists-available-api-resources.json'
			},
			[
				{
					name: 'local resources include contracts and identify local mode',
					input: { operation: 'resources', args: [], options: { mode: 'local' } },
					output: { resources: data.resources, mode: data.mode }
				}
			]
		);
	});
});

test('Rejects an unsupported API operation', async () => {
	let error: unknown;
	try {
		await runApi('unknown', [], { mode: 'local' });
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toContain('Unknown API operation');
	recordExampleCases(
		{
			unitId: 'workflow.networking-security-run-api',
			symbol: 'runApi',
			state: 'rejects-an-unsupported-api-operation',
			evidence: 'examples-cases',
			file: 'rejects-an-unsupported-api-operation.json'
		},
		[
			{
				name: 'unknown command fails before dispatch',
				input: { operation: 'unknown', args: [], options: { mode: 'local' } },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
