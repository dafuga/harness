import { test } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { TrustedBaseService } from '../../src/workflows/verification-evidence/run-verify/TrustedBaseService';

test('Returns null when no verification record exists', async () => {
	await withTempRepo(async ({ root, git }) => {
		git('commit', '--allow-empty', '-m', 'fixture');
		const from = git('rev-parse', 'HEAD');
		const service = new TrustedBaseService(root);
		const result = await service.nearestRecord(from);
		expect(result).toBeNull();
		recordExampleCases(
			{
				unitId: 'service.trusted-base',
				symbol: 'nearestRecord',
				state: 'returns-null-when-no-verification-record-exists',
				evidence: 'examples-cases',
				file: 'returns-null-when-no-verification-record-exists.json'
			},
			[
				{
					name: 'a committed revision without verification evidence has no trusted base',
					input: { from },
					output: result
				}
			]
		);
	});
});

test('Throws Error when the starting revision is invalid', async () => {
	await withTempRepo(async ({ root, git }) => {
		git('commit', '--allow-empty', '-m', 'fixture');
		const commit = git('rev-parse', 'HEAD');
		const directory = join(root, '.cache/harness/verifications', commit, '20261117000000000');
		await mkdir(directory, { recursive: true });
		await writeFile(
			join(directory, 'record.json'),
			JSON.stringify({
				schemaVersion: 1,
				id: 'fixture-record',
				repository: 'fixture',
				source: { commit, tree: git('rev-parse', 'HEAD^{tree}'), base: null },
				profile: {
					id: 'fixture',
					platform: 'linux',
					arch: 'x64',
					cpu: 'fixture',
					cores: 1,
					memoryBytes: 1024,
					runtime: 'bun'
				},
				startedAt: '2026-11-17T00:00:00.000Z',
				finishedAt: '2026-11-17T00:00:01.000Z',
				status: 'passed',
				components: [],
				measurements: [],
				impact: {
					runtime: 'fixture',
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
			})
		);
		const service = new TrustedBaseService(root);
		const from = 'not-a-real-revision';
		let failure: unknown;
		try {
			await service.nearestRecord(from);
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'service.trusted-base',
				symbol: 'nearestRecord',
				state: 'throws-error-when-the-starting-revision-is-invalid',
				evidence: 'examples-cases',
				file: 'throws-error-when-the-starting-revision-is-invalid.json'
			},
			[
				{
					name: 'an invalid starting revision rejects the lookup',
					input: { from },
					error: failure instanceof Error ? failure.message : String(failure)
				}
			]
		);
	});
});
