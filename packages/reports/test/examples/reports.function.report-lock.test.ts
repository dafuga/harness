import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportLock } from '../../src/utils/reports-media/reportLock';

test('Returns operation result and releases lock', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'report-lock-'));
	try {
		const value = await reportLock(directory, async () => 'updated');
		const lockRemoved = !existsSync(join(directory, '.lock'));
		expect({ value, lockRemoved }).toEqual({ value: 'updated', lockRemoved: true });
		recordExampleCases(
			{
				unitId: 'reports.function.report-lock',
				symbol: 'reportLock',
				state: 'returns-operation-result-and-releases-lock',
				evidence: 'examples-cases',
				file: 'returns-operation-result-and-releases-lock.json'
			},
			[
				{
					name: 'operation resolves after exclusive lock acquisition',
					input: { directory: 'temporary report directory', operation: 'resolve updated' },
					output: { value, lockRemoved }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
