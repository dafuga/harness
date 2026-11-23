import type {
	Case,
	Summary
} from './entry.program-history-prune-scan-verification-cache.test.types';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { scanVerificationCache } from '../../src/cli/program/history-prune/scanVerificationCache';

const STORE = '.cache/harness/verification';
const EMPTY_COMMIT = 'c'.repeat(40);

function storeOf(root: string): string {
	return join(root, ...STORE.split('/'));
}

function record(state: string, cases: Case[]): void {
	recordExampleCases(
		{
			unitId: 'entry.program-history-prune-scan-verification-cache',
			symbol: 'scanVerificationCache',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

async function scanStore(root: string): Promise<Summary> {
	const context = await scanVerificationCache(root, storeOf(root));
	return {
		entries: context.entries.map(({ path, protectionReasons }) => ({ path, protectionReasons })),
		valid: context.valid,
		problems: context.problems
	};
}

async function populateProtectedStore(root: string): Promise<void> {
	const store = storeOf(root);
	await mkdir(join(store, EMPTY_COMMIT), { recursive: true });
	await writeFile(join(store, 'notes.txt'), 'not a commit');
	await symlink(join(root, 'elsewhere'), join(store, 'link'));
}

test('Returns an empty context for a missing store', async () => {
	await withTempDir('verification-cache-missing-', async (root) => {
		const output = await scanStore(root);
		expect(output).toEqual({ entries: [], valid: [], problems: [] });
		record('returns-an-empty-context-for-a-missing-store', [
			{ name: 'store folder does not exist', input: { store: STORE }, output }
		]);
	});
});

test('Protects an empty, symlink and file commit entry', async () => {
	await withTempDir('verification-cache-entries-', async (root) => {
		await populateProtectedStore(root);
		const output = await scanStore(root);
		expect(output.entries).toEqual([
			{
				path: `${STORE}/${EMPTY_COMMIT}`,
				protectionReasons: ['unregistered empty commit directory']
			},
			{ path: `${STORE}/link`, protectionReasons: ['symlink is not traversed'] },
			{
				path: `${STORE}/notes.txt`,
				protectionReasons: ['unregistered cache entry; expected a commit directory']
			}
		]);
		expect(output.valid).toEqual([]);
		expect(output.problems).toEqual([]);
		record('protects-an-empty-symlink-and-file-commit-entry', [
			{ name: 'empty dir, symlink and file under store', input: { store: STORE }, output }
		]);
	});
});

test('Stops with a protected row when the store is a file', async () => {
	await withTempDir('verification-cache-file-', async (root) => {
		await mkdir(join(root, '.cache', 'harness'), { recursive: true });
		await writeFile(storeOf(root), 'not a directory');
		const output = await scanStore(root);
		expect(output).toEqual({
			entries: [{ path: STORE, protectionReasons: ['expected a directory'] }],
			valid: [],
			problems: []
		});
		record('stops-with-a-protected-row-when-the-store-is-a-file', [
			{ name: 'store path is a regular file', input: { store: STORE }, output }
		]);
	});
});
