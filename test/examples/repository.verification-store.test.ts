import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'vitest';
import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';
import { VerificationStoreRepository } from '../../src/repositories/verification-evidence/VerificationStoreRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'repository.verification-store';
const commit = '89abcdef0123456789abcdef0123456789abcdef';
const tree = '0123456789abcdef0123456789abcdef01234567';

function buildRecord(
	id: string,
	startedAt: string,
	status: 'passed' | 'failed' = 'passed',
	sourceCommit = commit
): VerificationRecord {
	return {
		id,
		schemaVersion: 1,
		repository: '/workspace/project',
		source: { commit: sourceCommit, tree, base: null },
		profile: {
			id: 'linux-x64-node22',
			platform: 'linux',
			arch: 'x64',
			cpu: 'AMD EPYC 7B13',
			cores: 4,
			memoryBytes: 8589934592,
			runtime: 'node 22.15.0'
		},
		startedAt,
		finishedAt: '2026-11-16T09:08:12.456Z',
		status,
		components: [],
		measurements: [],
		impact: {
			runtime: 'module',
			expanded: false,
			changed: [],
			units: { direct: [], indirect: [], added: [], removed: [] },
			uncertain: []
		},
		tests: [],
		scenarios: [],
		budgets: { status: 'passed', findings: [] },
		reasons: { status: 'passed', missing: [] },
		failures: []
	};
}

function storedSummary(
	stored: { record: VerificationRecord; directory: string } | undefined,
	root: string
) {
	return stored
		? {
				id: stored.record.id,
				commit: stored.record.source.commit,
				startedAt: stored.record.startedAt,
				status: stored.record.status,
				directory: relative(root, stored.directory)
			}
		: null;
}

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
): void {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

function withStore<T>(
	use: (root: string, repository: VerificationStoreRepository) => Promise<T> | T
): Promise<T> {
	return withTempDir('repository-verification-store-', (root) =>
		use(root, new VerificationStoreRepository(root))
	);
}

test(
	'Builds a sanitized directory for a verification run',
	() =>
		withStore((root, repository) => {
			const startedAt = '2026-11-14T09:08:07.123Z';
			const directory = repository.directoryFor(commit, startedAt);
			expect(directory).toBe(
				join(root, '.cache/harness/verifications', commit, '20261114090807123')
			);
			expect(existsSync(directory)).toBe(false);
			recordCases(
				'VerificationStoreRepository.directoryFor',
				'builds-a-sanitized-directory-for-a-verification-run',
				[
					{
						name: 'full commit and ISO run timestamp',
						input: { root, commit, startedAt },
						output: directory
					}
				]
			);
		}),
	20000
);

test(
	'Saves a record that can be read from disk',
	() =>
		withStore(async (root, repository) => {
			const record = buildRecord(
				'2b6b11bc30c3cd561673f630f74094e70182590b10c12f74838198b70b5d4783',
				'2026-11-14T09:08:07.123Z'
			);
			const directory = repository.directoryFor(record.source.commit, record.startedAt);
			const saved = await repository.save(record, directory);
			const contents = readFileSync(join(directory, 'record.json'), 'utf8');
			expect(saved).toBeUndefined();
			expect(contents).toBe(`${JSON.stringify(record, null, '\t')}\n`);
			recordCases('VerificationStoreRepository.save', 'saves-a-record-that-can-be-read-from-disk', [
				{
					name: 'contract-shaped record saved under its commit and run timestamp',
					input: { record, directory },
					output: null
				}
			]);
		}),
	20000
);

test(
	'Loads a record by ID or file path',
	() =>
		withStore(async (root, repository) => {
			const record = buildRecord(
				'2b6b11bc30c3cd561673f630f74094e70182590b10c12f74838198b70b5d4783',
				'2026-11-14T09:08:07.123Z'
			);
			const directory = repository.directoryFor(record.source.commit, record.startedAt);
			await repository.save(record, directory);
			const pathReference = relative(root, join(directory, 'record.json'));
			const byId = repository.load(record.id);
			const byPath = repository.load(pathReference);
			expect(byId?.record).toEqual(record);
			expect(byPath?.directory).toBe(directory);
			recordCases('VerificationStoreRepository.load', 'loads-a-record-by-id-or-file-path', [
				{
					name: 'record addressed by its ID',
					input: { reference: record.id },
					output: storedSummary(byId, root)
				},
				{
					name: 'record addressed by a root-relative file',
					input: { reference: pathReference },
					output: storedSummary(byPath, root)
				}
			]);
		}),
	20000
);

test(
	'Finds the newest record for an exact commit',
	() =>
		withStore(async (root, repository) => {
			const first = buildRecord(
				'2b6b11bc30c3cd561673f630f74094e70182590b10c12f74838198b70b5d4783',
				'2026-11-14T09:08:07.123Z'
			);
			const newest = buildRecord('3c'.repeat(32), '2026-11-15T09:08:07.123Z', 'failed');
			const unrelated = buildRecord(
				'4d'.repeat(32),
				'2026-11-16T09:08:07.123Z',
				'passed',
				'ab'.repeat(20)
			);
			for (const record of [first, newest, unrelated])
				await repository.save(
					record,
					repository.directoryFor(record.source.commit, record.startedAt)
				);
			const latest = repository.latest(commit);
			const unmatched = repository.latest('cd'.repeat(20));
			expect(latest?.record.id).toBe(newest.id);
			expect(latest?.record.status).toBe('failed');
			expect(unmatched).toBeUndefined();
			recordCases(
				'VerificationStoreRepository.latest',
				'finds-the-newest-record-for-an-exact-commit',
				[
					{
						name: 'newest record wins regardless of outcome',
						input: { commit },
						output: storedSummary(latest, root)
					},
					{
						name: 'commit with no stored records',
						input: { commit: 'cd'.repeat(20) },
						output: null
					}
				]
			);
		}),
	20000
);

test(
	'Lists valid records and streams them in traversal order',
	() =>
		withStore(async (root, repository) => {
			const first = buildRecord(
				'2b6b11bc30c3cd561673f630f74094e70182590b10c12f74838198b70b5d4783',
				'2026-11-14T09:08:07.123Z'
			);
			const second = buildRecord('3c'.repeat(32), '2026-11-15T09:08:07.123Z');
			for (const record of [first, second])
				await repository.save(
					record,
					repository.directoryFor(record.source.commit, record.startedAt)
				);
			const invalidDirectory = repository.directoryFor(commit, '2026-11-16T09:08:07.123Z');
			mkdirSync(invalidDirectory, { recursive: true });
			writeFileSync(join(invalidDirectory, 'record.json'), '{ invalid json');
			const allIds = repository.all().map((stored) => stored.record.id);
			const streamedIds = [...repository.records()].map((stored) => stored.record.id);
			expect([...allIds].sort()).toEqual([first.id, second.id].sort());
			expect(streamedIds).toEqual(allIds);
			recordCases(
				'VerificationStoreRepository.all',
				'lists-valid-records-and-streams-them-in-traversal-order',
				[
					{
						name: 'valid records exclude a malformed run file',
						input: {},
						output: { allIds, streamedIds }
					}
				]
			);
		}),
	20000
);

test(
	'Reads valid record files and skips invalid paths',
	() =>
		withStore(async (root, repository) => {
			const record = buildRecord(
				'2b6b11bc30c3cd561673f630f74094e70182590b10c12f74838198b70b5d4783',
				'2026-11-14T09:08:07.123Z'
			);
			const directory = repository.directoryFor(record.source.commit, record.startedAt);
			await repository.save(record, directory);
			const validPath = join(directory, 'record.json');
			const malformedPath = join(root, 'malformed.json');
			writeFileSync(malformedPath, '{ invalid json');
			const valid = repository.read(validPath);
			const malformed = repository.read(malformedPath);
			const missingPath = join(root, 'missing.json');
			const missing = repository.read(missingPath);
			expect(valid?.record).toEqual(record);
			expect(malformed).toBeUndefined();
			expect(missing).toBeUndefined();
			recordCases(
				'VerificationStoreRepository.read',
				'reads-valid-record-files-and-skips-invalid-paths',
				[
					{
						name: 'well-formed schema-valid record JSON',
						input: { path: validPath },
						output: storedSummary(valid, root)
					},
					{ name: 'malformed record JSON', input: { path: malformedPath }, output: null },
					{ name: 'missing record file', input: { path: missingPath }, output: null }
				]
			);
		}),
	20000
);
