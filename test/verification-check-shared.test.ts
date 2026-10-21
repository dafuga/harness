import { expect } from './verificationExpect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { SourceIndexService } from '../src/services/source-index-service/SourceIndexService';
import { sealRecord } from '../src/utils/sealRecord';
import { taskProfile } from './support/taskProfiles';
import { VerificationStoreRepository } from '../src/repositories/VerificationStoreRepository';
import { VerificationCheckService } from '../src/services/VerificationCheckService';
import { baselineRepo, type VerifyRepo } from './support/verifyRepo';

/**
 * One checker may check the records of several commits: it answers each exactly as a checker made
 * for that record alone does, for commits whose source differs and for a record it must refuse.
 */
const repos: VerifyRepo[] = [];
afterEach(async () => Promise.all(repos.splice(0).map((repo) => repo.dispose())));

test('a checker shared by the records of a chain answers as a fresh checker for each', async () => {
	const repo = await baselineRepo();
	repos.push(repo);
	const records = [await repo.verify()];
	for (const [from, to] of [
		['toLowerCase', 'toUpperCase'],
		['toUpperCase', 'toLowerCase']
	]) {
		await repo.change('src/utils/slugify.ts', (source) => source.replace(from, to));
		records.push(await repo.verify());
	}
	const changed = records[1];
	await writeFile(join(changed.directory, changed.record.tests[0].log.path), 'changed log');
	const store = new VerificationStoreRepository(repo.root);
	const answers = async (checker: () => VerificationCheckService) => {
		const found: string[][] = [];
		for (const { record } of records)
			found.push(await checker().integrity(record.source.commit, store.load(record.id)!));
		return found;
	};
	const shared = new VerificationCheckService(repo.root);
	const once = await answers(() => shared);
	expect(once).toEqual(await answers(() => new VerificationCheckService(repo.root)));
	expect(once.map((problems) => problems.length > 0)).toEqual([false, true, false]);
}, 120_000);

/** A newer scanner derives a broader return type from the same committed method. */
function changedInterpretation() {
	const indexer = new SourceIndexService();
	const index = indexer.index.bind(indexer);
	vi.spyOn(indexer, 'index').mockImplementation(async (tree, config) => {
		const result = await index(tree, config);
		const path = 'src/services/TitleService.ts';
		const file = result.files.get(path)!;
		result.files.set(path, {
			...file,
			exports: file.exports.map((symbol) =>
				symbol.kind === 'method' ? { ...symbol, output: 'unknown' } : symbol
			)
		});
		return result;
	});
	return indexer;
}

test('derived contract interpretation does not invalidate exact committed historical metadata', async () => {
	const repo = await baselineRepo();
	repos.push(repo);
	const stored = await repo.verify();
	const checker = new VerificationCheckService(repo.root, changedInterpretation());
	const operation = () => checker.integrity(stored.record.source.commit, stored);
	expect(await operation()).toEqual([]);
	await taskProfile(
		'service.verification-check',
		'historical-derived-contract-integrity',
		operation
	);
}, 120_000);

test('historical contract compatibility never accepts altered recorded version fields', async () => {
	const repo = await baselineRepo();
	repos.push(repo);
	const stored = await repo.verify();
	const checker = new VerificationCheckService(repo.root, changedInterpretation());
	const draft: Omit<typeof stored.record, 'id'> & { id?: string } = { ...stored.record };
	delete draft.id;
	for (const field of ['source', 'manifest', 'contract', 'runtime'] as const) {
		const record = sealRecord({
			...draft,
			components: draft.components.map((component) =>
				component.unit === 'service.title' ? { ...component, [field]: '0'.repeat(64) } : component
			)
		});
		expect(await checker.integrity(record.source.commit, { ...stored, record })).toContain(
			'component service.title does not match the source at this commit'
		);
	}
}, 120_000);
