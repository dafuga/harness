import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { LfsAdapter } from '../../src/adapters/git-source-history/LfsAdapter';

function record(state: string, symbol: string, input: unknown, error: unknown): void {
	recordExampleCases(
		{ unitId: 'adapter.lfs', symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: 'operation rejects with the observed error', input, error: String(error) }]
	);
}

test('throws-gitadapter-run-error-when-the-repository-root-is-miss', async () => {
	await withTempDir('lfs-missing-root-', async (directory) => {
		const root = join(directory, 'missing');
		let caught: unknown;
		try {
			await new LfsAdapter(root).path('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeDefined();
		record('throws-gitadapter-run-error-when-the-repository-root-is-miss', 'LfsAdapter.path', { root }, caught);
	});
});

test('throws-gitadapter-exec-error-when-fetch-uses-a-missing-repos', async () => {
	await withTempDir('lfs-missing-repo-', async (directory) => {
		const root = join(directory, 'missing');
		let caught: unknown;
		try {
			await new LfsAdapter(root).fetch('origin', 'main');
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeDefined();
		record('throws-gitadapter-exec-error-when-fetch-uses-a-missing-repos', 'LfsAdapter.fetch', { remote: 'origin', ref: 'main' }, caught);
	});
});

test('store-rethrows-rename-error-when-the-object-path-is-a-direct', async () => {
	await withTempRepo(async ({ root }) => {
		const bytes = Buffer.from('hello');
		const oid = createHash('sha256').update(bytes).digest('hex');
		const target = join(root, '.git', 'lfs', 'objects', oid.slice(0, 2), oid.slice(2, 4), oid);
		await mkdir(target, { recursive: true });
		let caught: unknown;
		try {
			await new LfsAdapter(root).store(bytes);
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeDefined();
		record('store-rethrows-rename-error-when-the-object-path-is-a-direct', 'LfsAdapter.store', { text: 'hello', oid }, caught);
	});
});
