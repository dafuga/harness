import { existsSync, mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportLocalCleanup } from '../../src/services/reports-media/report-command-service/report-retention-service/reportLocalCleanup';

const oldTime = new Date('2020-01-01T00:00:00.000Z');
const cutoff = oldTime.getTime() + 1000;

function writeOld(path: string) {
	writeFileSync(path, 'fixture');
	utimesSync(path, oldTime, oldTime);
}

test('Removes old files and preserves reserved and known runs', async () => {
	const root = mkdtempSync(join(tmpdir(), 'report-cleanup-'));
	try {
		mkdirSync(join(root, 'runs'));
		mkdirSync(join(root, 'runs', 'known'));
		mkdirSync(join(root, 'runs', 'orphan'));
		writeOld(join(root, 'stale.txt'));
		writeOld(join(root, 'runs', 'known', 'keep.txt'));
		writeOld(join(root, 'runs', 'orphan', 'remove.txt'));
		writeOld(join(root, 'retention-history.jsonl'));
		writeOld(join(root, '.hidden'));
		const knownRuns = new Set(['known']);
		const removed = await reportLocalCleanup(root, cutoff, false, knownRuns);
		const output = {
			removed,
			staleExists: existsSync(join(root, 'stale.txt')),
			knownExists: existsSync(join(root, 'runs', 'known', 'keep.txt')),
			reservedExists: existsSync(join(root, 'retention-history.jsonl')),
			hiddenExists: existsSync(join(root, '.hidden'))
		};

		expect(output).toEqual({
			removed: 2,
			staleExists: false,
			knownExists: true,
			reservedExists: true,
			hiddenExists: true
		});
		recordExampleCases(
			{
				unitId: 'reports.function.report-local-cleanup',
				symbol: 'reportLocalCleanup',
				state: 'removes-old-files-and-preserves-reserved-and-known-runs',
				evidence: 'examples-cases',
				file: 'removes-old-files-and-preserves-reserved-and-known-runs.json'
			},
			[
				{
					name: 'old root and orphan files are removed while reserved, hidden and known data stays',
					input: { cutoff, dryRun: false, knownRuns: ['known'], entries: ['stale.txt', 'runs/orphan/remove.txt'] },
					output
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
