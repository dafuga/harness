import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { sealRecord } from '../../src/utils/verification-evidence/sealRecord';
import { VerificationStoreRepository } from '../../src/repositories/verification-evidence/VerificationStoreRepository';
import {
	historyAttach,
	historyStatus,
	renderStatus,
	sourceCommit
} from '../../src/workflows/git-source-history/runHistory';
import { verificationSample } from '../support/verificationSample';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';

test('Resolves a revision to a full commit', async () => {
	await withTempRepo(async (repo) => {
		const first = commitSourceFile(repo, 'First source revision.\n');
		const head = commitSourceFile(repo, 'Current source revision.\n');
		const resolvedHead = await sourceCommit(repo.root);
		const resolvedParent = await sourceCommit(repo.root, 'main~1');

		expect([resolvedHead, resolvedParent]).toEqual([head, first]);
		recordExampleCases(
			{
				unitId: 'workflow.run-history',
				symbol: 'sourceCommit',
				state: 'resolves-a-revision-to-a-full-commit',
				evidence: 'examples-cases',
				file: 'resolves-a-revision-to-a-full-commit.json'
			},
			[
				{
					name: 'Resolves the default HEAD revision',
					input: { root: '<temporary Git repository>' },
					output: resolvedHead
				},
				{
					name: 'Resolves an ancestor expression',
					input: { root: '<temporary Git repository>', reference: 'main~1' },
					output: resolvedParent
				}
			]
		);
	});
});

test('Attaches a stored record to Git history', async () => {
	await withTempRepo(async (repo) => {
		const record = await storePassedRecord(repo);
		const attached = await historyAttach({
			root: repo.root,
			commit: record.source.commit,
			record: record.id
		});

		expect(attached).toMatchObject({
			record: record.id,
			status: 'passed',
			source: record.source.commit,
			note: 'refs/notes/harness',
			archive: `refs/harness/source/${record.source.commit}`,
			created: true
		});
		recordExampleCases(
			{
				unitId: 'workflow.run-history',
				symbol: 'historyAttach',
				state: 'attaches-a-stored-record-to-git-history',
				evidence: 'examples-cases',
				file: 'attaches-a-stored-record-to-git-history.json'
			},
			[
				{
					name: 'Attaches the selected passing record to its source commit',
					input: {
						options: {
							root: '<temporary Git repository>',
							commit: record.source.commit,
							record: record.id
						}
					},
					output: attached
				}
			]
		);
	});
}, 20_000);

test('Reports a valid verification record from Git history', async () => {
	await withTempRepo(async (repo) => {
		const record = await storePassedRecord(repo);
		await historyAttach({ root: repo.root, commit: record.source.commit, record: record.id });
		const status = await historyStatus({ root: repo.root, commit: record.source.commit });

		expect(status).toMatchObject({
			commit: record.source.commit,
			verified: true,
			records: [{ record: record.id, status: 'passed', valid: true, problems: [] }],
			problems: []
		});
		recordExampleCases(
			{
				unitId: 'workflow.run-history',
				symbol: 'historyStatus',
				state: 'reports-a-valid-verification-record-from-git-history',
				evidence: 'examples-cases',
				file: 'reports-a-valid-verification-record-from-git-history.json'
			},
			[
				{
					name: 'Reports the intact passing record attached to the selected commit',
					input: {
						options: {
							root: '<temporary Git repository>',
							commit: record.source.commit
						}
					},
					output: status
				}
			]
		);
	});
}, 20_000);

test('Renders validity and problems for attached records', () => {
	const commit = '0123456789abcdef0123456789abcdef01234567';
	const status = {
		commit,
		verified: false,
		records: [
			{
				record: 'verify-20261115T120000Z',
				status: 'passed',
				valid: false,
				problems: ['manifest does not match the hash in the note'],
				evidence: {
					commit: '89abcdef89abcdef89abcdef89abcdef89abcdef',
					path: `records/${commit}/verify-20261115T120000Z`,
					manifest: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
				}
			}
		],
		problems: ['verification note has an invalid line']
	} satisfies Parameters<typeof renderStatus>[0];
	const summary = renderStatus(status);
	const expected = [
		`Commit ${commit} is not verified by Git history: 1 attached record.`,
		'  verify-20261 passed (not usable)',
		'    manifest does not match the hash in the note',
		'  verification note has an invalid line'
	].join('\n');

	expect(summary).toBe(expected);
	recordExampleCases(
		{
			unitId: 'workflow.run-history',
			symbol: 'renderStatus',
			state: 'renders-validity-and-problems-for-attached-records',
			evidence: 'examples-cases',
			file: 'renders-validity-and-problems-for-attached-records.json'
		},
		[
			{
				name: 'Shows an unusable record and its integrity problems',
				input: { status },
				output: summary
			}
		]
	);
});

function commitSourceFile(repo: TemporaryRepo, contents: string): string {
	writeFileSync(join(repo.root, 'README.md'), contents);
	repo.git('add', 'README.md');
	repo.git('commit', '-m', 'feat: update source fixture');
	return repo.git('rev-parse', 'HEAD');
}

async function storePassedRecord(repo: TemporaryRepo) {
	const commit = commitSourceFile(repo, 'Source for a passing verification record.\n');
	const tree = repo.git('rev-parse', `${commit}^{tree}`);
	const { id: sampleId, ...sample } = verificationSample();
	void sampleId;
	const record = sealRecord({
		...sample,
		repository: repo.root,
		source: { commit, tree, base: null },
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
		failures: []
	});
	const store = new VerificationStoreRepository(repo.root);
	await store.save(record, store.directoryFor(commit, record.startedAt));
	return record;
}
