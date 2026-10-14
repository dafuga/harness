import { expect } from './verificationExpect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
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
