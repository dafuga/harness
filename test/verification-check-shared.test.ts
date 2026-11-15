import { expect } from './verificationExpect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { VerificationStoreRepository } from '../src/repositories/verification-evidence/VerificationStoreRepository';
import { VerificationCheckService } from '../src/services/verification-evidence/VerificationCheckService';
import { sealRecord } from '../src/utils/sealRecord';
import { verificationSample } from './support/verificationSample';
import legacy from './fixtures/verification-v1.json';
import type { StoredRecord } from '../src/repositories/verification-evidence/VerificationStoreRepository';
import type { VerificationRecord } from '../src/core/verificationTypes';
import { CommitTreeAdapter } from '../src/adapters/git-source-history/CommitTreeAdapter';
import { SourceIndexService } from '../src/services/development-tooling/source-index-service/SourceIndexService';
import { componentVersion } from '../src/utils/componentVersion';
import { loadSide } from '../src/workflows/loadRevisions';
import { VerificationRecordValidator } from '../src/validators/verification-evidence/VerificationRecordValidator';
import { observedTaskOperation } from './support/taskProfiles';
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
	await rejectsTampering(shared, records[0]);
	const historical = await historicalRecord(repo);
	const checked = await observedTaskOperation(
		'service.verification-check',
		'legacy-record-integrity',
		() => shared.check(historical.record.source.commit, historical)
	);
	expect(checked).toMatchObject({
		status: 'passed',
		problems: []
	});
	await rejectsTampering(shared, historical);
	await versionedRecord(repo, shared, historical);
}, 120_000);

/** Original component, manifest and source bytes from budget record 7b510360a453. */
async function historicalRecord(repo: VerifyRepo): Promise<StoredRecord> {
	await repo.write(legacy.manifest.owns.source[0], legacy.source);
	await repo.write(
		`specification/units/${legacy.manifest.id}.json`,
		JSON.stringify(legacy.manifest)
	);
	const commit = await repo.commit('chore: preserve legacy contract fixture');
	const { id, ...sample } = verificationSample();
	const stored = {
		directory: repo.root,
		record: sealRecord({
			...sample,
			source: { commit, tree: await repo.git(['rev-parse', 'HEAD^{tree}']), base: null },
			components: [legacy.component as VerificationRecord['components'][number]],
			measurements: []
		})
	};
	expect(stored.record.id).not.toBe(id);
	return stored;
}

/** A new seal must not turn a forged component hash into source proof. */
async function rejectsTampering(checker: VerificationCheckService, stored: StoredRecord) {
	const unsealed = { ...stored.record, finishedAt: 'changed after sealing' };
	expect(
		await checker.integrity(unsealed.source.commit, { ...stored, record: unsealed })
	).toContain('record content does not match its id');
	for (const key of ['manifest', 'source', 'contract', 'runtime'] as const) {
		const { id, ...draft } = stored.record;
		const record = sealRecord({
			...draft,
			components: draft.components.map((component) => ({ ...component, [key]: '0'.repeat(64) }))
		});
		expect(record.id).not.toBe(id);
		expect(await checker.integrity(record.source.commit, { ...stored, record })).toEqual(
			record.components
				.filter((component) => component.change !== 'removed')
				.map((component) => `component ${component.unit} does not match the source at this commit`)
		);
	}
}

/** A current record of an old commit explicitly hashes the newly derived source contract. */
async function versionedRecord(
	repo: VerifyRepo,
	checker: VerificationCheckService,
	old: StoredRecord
) {
	const { id, ...draft } = old.record;
	const current = Object.assign({}, draft, { componentSchemaVersion: 2 as const });
	const wrong = sealRecord(current);
	expect(wrong.id).not.toBe(id);
	expect(await checker.integrity(wrong.source.commit, { ...old, record: wrong })).toEqual([
		`component ${legacy.component.unit} does not match the source at this commit`
	]);
	const side = await loadSide(
		repo.root,
		await CommitTreeAdapter.open(repo.root, current.source.commit),
		new SourceIndexService()
	);
	const manifest = side.manifests.find((unit) => unit.id === legacy.component.unit)!;
	const record = sealRecord({
		...current,
		components: [{ ...old.record.components[0], ...componentVersion(manifest, side.index.files) }]
	});
	const validated = await observedTaskOperation(
		'function.verification-types',
		'current-record-schema',
		() => new VerificationRecordValidator().validate(record)
	);
	expect(validated.errors).toEqual([]);
	expect(await checker.check(record.source.commit, { ...old, record })).toMatchObject({
		status: 'passed',
		problems: []
	});
	await rejectsTampering(checker, { ...old, record });
	expect(
		new VerificationRecordValidator().validate({ ...record, componentSchemaVersion: 3 }).value
	).toBeUndefined();
}
