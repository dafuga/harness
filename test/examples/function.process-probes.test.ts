import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { processProbes } from '../../src/utils/development-tooling/processProbes';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Runs bounded probes and handles unreadable processes', async () => {
	await withTempDir('process-probes-', async (directory) => {
		const tool = join(directory, 'fake-probe');
		await writeFile(tool, '#!/bin/sh\nprintf "probe output\\n"\n');
		await chmod(tool, 0o755);
		const probes = processProbes({ timeoutMs: 1200 });
		const successful = await probes.ran(tool, []);
		const missingFacts = await probes.facts(2_000_000_000);
		const missingExecutable = await probes.executable(2_000_000_000);

		expect(successful).toEqual({ ok: true, out: 'probe output\n' });
		expect(missingFacts).toBeNull();
		expect(missingExecutable).toBeNull();
		recordExampleCases(
			{
				unitId: 'function.process-probes',
				symbol: 'processProbes',
				state: 'runs-bounded-probes-and-handles-unreadable-processes',
				evidence: 'examples-cases',
				file: 'runs-bounded-probes-and-handles-unreadable-processes.json'
			},
			[
				{
					name: 'fake system tool exits successfully and returns stdout',
					input: { tool: 'temporary fake executable', timeoutMs: 1200 },
					output: successful
				},
				{
					name: 'unreadable process facts are unknown',
					input: { pid: 2_000_000_000, operation: 'facts' },
					output: missingFacts
				},
				{
					name: 'unreadable executable paths are unknown',
					input: { pid: 2_000_000_000, operation: 'executable' },
					output: missingExecutable
				}
			]
		);
	});
});
