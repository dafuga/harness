import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, vi } from 'vitest';
import { recordExampleCases } from '../../../test/support/recordExampleCases';
import { expect } from '../../../test/verificationExpect';

const unitId = 'reports.script.seed-harness-console';
const sentinel = 'sentinel: the import must leave this file as it is';
const sentinelPath = join('console', 'sentinel.txt');

/** Every entry below a directory, sorted, relative to it. */
async function listTree(dir: string): Promise<string[]> {
	return (await readdir(dir, { recursive: true })).sort();
}

/** Restores HARNESS_E2E_ROOT as the test found it, so no other test sees the temporary root. */
function restoreRunRoot(previous: string | undefined): void {
	if (previous === undefined) delete process.env.HARNESS_E2E_ROOT;
	else process.env.HARNESS_E2E_ROOT = previous;
}

test('Importing the console seeder writes and deletes nothing under its fixture root', async () => {
	const runRoot = await mkdtemp(join(tmpdir(), 'harness-console-import-'));
	const previous = process.env.HARNESS_E2E_ROOT;
	try {
		await mkdir(dirname(join(runRoot, sentinelPath)), { recursive: true });
		await writeFile(join(runRoot, sentinelPath), sentinel);
		const before = await listTree(runRoot);
		process.env.HARNESS_E2E_ROOT = runRoot;

		vi.resetModules();
		const seeder = await import('../scripts/seed-harness-console');
		const after = await listTree(runRoot);
		const kept = await readFile(join(runRoot, sentinelPath), 'utf8');

		expect(Object.keys(seeder)).toEqual(['seedHarnessConsole']);
		expect(typeof seeder.seedHarnessConsole).toBe('function');
		expect(after).toEqual(before);
		expect(kept).toBe(sentinel);
		recordExampleCases(
			{
				unitId,
				symbol: 'seedHarnessConsole',
				state: 'importing-the-console-seeder-writes-and-deletes-nothing',
				evidence: 'examples-cases',
				file: 'importing-the-console-seeder-writes-and-deletes-nothing.json'
			},
			[
				{
					name: 'import the seeder under a run root that holds a sentinel',
					input: { module: 'packages/reports/scripts/seed-harness-console.ts' },
					output: { exports: Object.keys(seeder) }
				},
				{
					name: 'list the run root before and after the import',
					input: { root: 'temporary run root' },
					output: { entries: before, unchanged: JSON.stringify(after) === JSON.stringify(before) }
				},
				{
					name: 'read the sentinel after the import',
					input: { path: sentinelPath },
					output: { text: kept }
				}
			]
		);
	} finally {
		restoreRunRoot(previous);
		await rm(runRoot, { recursive: true, force: true });
	}
});

test('Importing the console seeder without a run root does not throw', async () => {
	const previous = process.env.HARNESS_E2E_ROOT;
	delete process.env.HARNESS_E2E_ROOT;
	try {
		vi.resetModules();
		const seeder = await import('../scripts/seed-harness-console');

		expect(Object.keys(seeder)).toEqual(['seedHarnessConsole']);
		const seeding = seeder.seedHarnessConsole();
		await expect(seeding).rejects.toMatchObject({ name: 'E2eRootNotSetError' });
		const failure = await seeding.catch((error: Error) => ({
			name: error.name,
			message: error.message
		}));
		recordExampleCases(
			{
				unitId,
				symbol: 'seedHarnessConsole',
				state: 'importing-the-console-seeder-without-a-run-root-does-not-throw',
				evidence: 'examples-cases',
				file: 'importing-the-console-seeder-without-a-run-root-does-not-throw.json'
			},
			[
				{
					name: 'import the seeder with no run root in the environment',
					input: { module: 'packages/reports/scripts/seed-harness-console.ts' },
					output: { exports: Object.keys(seeder) }
				},
				{
					name: 'explicitly run the seeder with no run root',
					input: { HARNESS_E2E_ROOT: null },
					error: failure
				}
			]
		);
	} finally {
		restoreRunRoot(previous);
	}
});
