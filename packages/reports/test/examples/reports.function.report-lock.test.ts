import { mkdtempSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportLock } from '../../src/utils/reports-media/reportLock';
import { ReportLockBusyError } from '../../src/utils/reports-media/reportLock.types';

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

test('Throws ReportLockBusyError when all lock attempts are occupied', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'report-lock-busy-'));
	writeFileSync(join(directory, '.lock'), String(process.pid));
	try {
		let error: unknown;
		try {
			await reportLock(directory, async () => 'unreachable');
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(ReportLockBusyError);
		expect((error as Error).message).toBe('Report is busy; retry this update');
		recordExampleCases(
			{
				unitId: 'reports.function.report-lock',
				symbol: 'reportLock',
				state: 'throws-reportlockbusyerror-when-all-lock-attempts-are-occupi',
				evidence: 'examples-cases',
				file: 'throws-reportlockbusyerror-when-all-lock-attempts-are-occupi.json'
			},
			[
				{
					name: 'existing live lock exhausts acquisition attempts',
					input: { directory: 'temporary report directory with a live lock', operation: 'resolve unreachable' },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
