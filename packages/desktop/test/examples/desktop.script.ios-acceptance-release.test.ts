import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { releaseRefusal } from '../../scripts/ios-acceptance-release';

function failedRun(failure: Error, output: string) {
	return {
		record: { begin: () => undefined, check: () => undefined },
		page: { reset: async () => { throw failure; } },
		udid: 'example-simulator',
		controlOrigin: 'http://127.0.0.1:43121',
		project: { id: 'example-project', name: 'Example project' },
		output
	} as unknown as Parameters<typeof releaseRefusal>[0];
}

test('propagates restart failure before panel inspection', async () => {
	const output = mkdtempSync(join(tmpdir(), 'ios-release-'));
	const failure = new Error('simulator reset failed');
	try {
		let thrown: unknown;
		try {
			await releaseRefusal(failedRun(failure, output));
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBe(failure);
		recordExampleCases(
			{
				unitId: 'desktop.script.ios-acceptance-release',
				symbol: 'releaseRefusal',
				state: 'propagates-restart-failure-before-panel-inspection',
				evidence: 'examples-cases',
				file: 'propagates-restart-failure-before-panel-inspection.json'
			},
			[
				{
					name: 'propagate the simulator reset failure',
					input: { udid: 'example-simulator', project: 'Example project' },
					error: { name: failure.name, message: failure.message }
				}
			]
		);
	} finally {
		rmSync(output, { recursive: true, force: true });
	}
});
