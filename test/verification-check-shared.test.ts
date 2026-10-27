import { expect } from './verificationExpect';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, test } from 'vitest';
import {
	VerificationStoreRepository,
	type StoredRecord
} from '../src/repositories/VerificationStoreRepository';
import { VerificationCheckService } from '../src/services/VerificationCheckService';
import { SourceIndexService } from '../src/services/development-tooling/source-index-service/SourceIndexService';
import { budgetSources, prepareBudgetFixture } from './support/budgetFixture';
import { baselineRepo, type VerifyRepo } from './support/verifyRepo';
import { measureWorkload } from './support/measureWorkload';
import type { ComponentManifest } from '../src/core/unitTypes';
import manifest from '../specification/units/service.verification-check.json' with { type: 'json' };

let repo: VerifyRepo;
let records: StoredRecord[];
beforeAll(async () => {
	repo = await baselineRepo(undefined, {
		sources: budgetSources,
		omitScenarios: true,
		prepare: prepareBudgetFixture
	});
	const outcomes = [await repo.verify()];
	for (const [from, to] of [
		['titleCost = 10;', 'titleCost = 10 '],
		['titleCost = 10 ', 'titleCost = 10;']
	]) {
		await repo.change('src/services/TitleService.ts', (source) => source.replace(from, to));
		outcomes.push(await repo.verify());
	}
	for (const outcome of outcomes) {
		if (outcome.exitCode !== 0)
			throw new Error(`Fixture verification failed: ${outcome.record.failures.join('; ')}`);
	}
	const changed = outcomes[1];
	await writeFile(join(changed.directory, changed.record.tests[0].log.path), 'changed log');
	const store = new VerificationStoreRepository(repo.root);
	records = outcomes.map(({ record }) => {
		const stored = store.load(record.id);
		if (!stored) throw new Error(`Fixture record ${record.id} was not stored`);
		return stored;
	});
}, 180_000);
afterAll(async () => repo?.dispose());

async function integrity(checker: VerificationCheckService) {
	const found: string[][] = [];
	for (const stored of records)
		found.push(await checker.integrity(stored.record.source.commit, stored));
	return found;
}
async function reports(checker: VerificationCheckService) {
	const found = [];
	for (const stored of records)
		found.push(await checker.check(stored.record.source.commit, stored));
	return found;
}
function fresh() {
	return new VerificationCheckService(repo.root);
}
function injected() {
	return new VerificationCheckService(repo.root, new SourceIndexService());
}
function expected(id: string): unknown {
	const item = (manifest as ComponentManifest).testing?.cases.find((entry) => entry.id === id);
	if (item?.expected?.kind !== 'value') throw new Error(`Missing expected value for ${id}`);
	return item.expected.value;
}
function assertLineage(results: Awaited<ReturnType<typeof reports>>) {
	const log = records[1].record.tests[0].log.path;
	const mismatch = `evidence ${log} does not match its recorded hash`;
	expect(results[1].problems).toContain(mismatch);
	expect(results[2].problems).toContainEqual(expect.stringContaining(mismatch));
}
async function assertInvalidRoot(method: 'integrity' | 'check'): Promise<void> {
	const item = (manifest as ComponentManifest).testing?.cases.find(
		(entry) => entry.id === `${method}.invalid-root`
	);
	const expected = item?.expected?.kind === 'error' ? item.expected.value : undefined;
	if (
		!expected ||
		typeof expected !== 'object' ||
		Array.isArray(expected) ||
		typeof expected.message !== 'string'
	)
		throw new Error(`Missing expected error for ${method}`);
	const root = await mkdtemp(join(tmpdir(), 'harness-check-invalid-root-'));
	try {
		const checker = new VerificationCheckService(root);
		await expect(checker[method](records[0].record.source.commit, records[0])).rejects.toThrow(
			expected.message
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}
function wrongCommit() {
	const wrong = '0'.repeat(40);
	return `record is for commit ${records[0].record.source.commit}, not ${wrong}`;
}

test('VerificationCheckService.integrity from default initialization', async () => {
	const checker = fresh();
	expect((await integrity(checker)).map((problems) => problems.length > 0)).toEqual(
		expected('integrity.default')
	);
	expect(await checker.integrity('0'.repeat(40), records[0])).toEqual([wrongCommit()]);
});

test('a checker shared by the records of a chain answers as a fresh checker for each', async () => {
	await measureWorkload('service.verification-check', 'integrity.injected', async () => {
		const shared = await integrity(injected());
		const separate = [];
		for (const stored of records)
			separate.push(await fresh().integrity(stored.record.source.commit, stored));
		expect(shared).toEqual(separate);
		expect(shared.map((problems) => problems.length > 0)).toEqual(
			expected('integrity.indexer-parity')
		);
		expect(await injected().integrity('0'.repeat(40), records[0])).toEqual([wrongCommit()]);
	});
});

test('VerificationCheckService.check from default initialization', async () => {
	const checker = fresh();
	const result = await reports(checker);
	expect(result.map((report) => report.status)).toEqual(expected('check.default'));
	assertLineage(result);
	const wrong = await checker.check('0'.repeat(40), records[0]);
	expect(wrong.status).toBe('failed');
	expect(wrong.problems).toEqual([wrongCommit()]);
});

test('VerificationCheckService.check with an injected indexer', async () => {
	const shared = await reports(injected());
	const separate = [];
	for (const stored of records)
		separate.push(await fresh().check(stored.record.source.commit, stored));
	expect(shared).toEqual(separate);
	expect(shared.map((report) => report.status)).toEqual(expected('check.indexer-parity'));
	assertLineage(shared);
	const wrong = await injected().check('0'.repeat(40), records[0]);
	expect(wrong.status).toBe('failed');
	expect(wrong.problems).toEqual([wrongCommit()]);
});

test('VerificationCheckService.integrity rejects a non-repository root', async () => {
	await assertInvalidRoot('integrity');
});

test('VerificationCheckService.check rejects a non-repository root', async () => {
	await assertInvalidRoot('check');
});
