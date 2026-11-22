import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportLocalCleanup } from '../../src/services/reports-media/report-command-service/report-retention-service/reportLocalCleanup';
import { InvalidReportCleanupRootError } from '../../src/services/reports-media/report-command-service/report-retention-service/reportLocalCleanup.types';

const oldTime = new Date('2020-01-01T00:00:00.000Z');
const cutoff = oldTime.getTime() + 1000;

function writeOld(path: string) {
	writeFileSync(path, 'fixture');
	utimesSync(path, oldTime, oldTime);
}

function recordError(state: string, input: unknown) {
	recordExampleCases(
		{ unitId: 'reports.function.report-local-cleanup', symbol: 'reportLocalCleanup', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: state, input, error: { name: 'InvalidReportCleanupRootError', message: 'Invalid report cleanup root' } }]
	);
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
		expect(output).toEqual({ removed: 2, staleExists: false, knownExists: true, reservedExists: true, hiddenExists: true });
		recordExampleCases(
			{ unitId: 'reports.function.report-local-cleanup', symbol: 'reportLocalCleanup', state: 'removes-old-files-and-preserves-reserved-and-known-runs', evidence: 'examples-cases', file: 'removes-old-files-and-preserves-reserved-and-known-runs.json' },
			[{ name: 'old root and orphan files are removed while reserved, hidden and known data stays', input: { cutoff, dryRun: false, knownRuns: ['known'], entries: ['stale.txt', 'runs/orphan/remove.txt'] }, output }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws InvalidReportCleanupRootError when cutoff is not finite', async () => {
	const root = mkdtempSync(join(tmpdir(), 'report-cleanup-cutoff-'));
	try {
		await expect(reportLocalCleanup(root, Number.NaN)).rejects.toBeInstanceOf(InvalidReportCleanupRootError);
		recordError('throws-invalidreportcleanuprooterror-when-cutoff-is-not-fini', { root: '<temporary-root>', cutoff: 'NaN' });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws InvalidReportCleanupRootError when root is a symlink', async () => {
	const parent = mkdtempSync(join(tmpdir(), 'report-cleanup-root-'));
	try {
		const target = join(parent, 'target');
		const root = join(parent, 'root-link');
		mkdirSync(target);
		symlinkSync(target, root);
		await expect(reportLocalCleanup(root, cutoff)).rejects.toBeInstanceOf(InvalidReportCleanupRootError);
		recordError('throws-invalidreportcleanuprooterror-when-root-is-a-symlink', { root: 'root-link', cutoff });
	} finally {
		rmSync(parent, { recursive: true, force: true });
	}
});

test('Throws InvalidReportCleanupRootError when runs directory is a symlink', async () => {
	const root = mkdtempSync(join(tmpdir(), 'report-cleanup-runs-'));
	try {
		const target = join(root, 'target');
		mkdirSync(target);
		symlinkSync(target, join(root, 'runs'));
		await expect(reportLocalCleanup(root, cutoff)).rejects.toBeInstanceOf(InvalidReportCleanupRootError);
		recordError('throws-invalidreportcleanuprooterror-when-runs-directory-is', { root: '<temporary-root>', cutoff, runs: 'symlink' });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
