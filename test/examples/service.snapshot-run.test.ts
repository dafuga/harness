import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { SnapshotRunService } from '../../src/workflows/verification-evidence/run-verify/verification-service/SnapshotRunService';
import type { SnapshotRun } from '../../src/workflows/verification-evidence/run-verify/verification-service/SnapshotRunService.types';
import { snapshotCaptureContext } from '../../src/workflows/verification-evidence/run-verify/verification-service/snapshotCaptureContext';
import { snapshotVideoFlags } from '../../src/workflows/verification-evidence/run-verify/verification-service/snapshotVideoFlags';

type Scenarios = Parameters<typeof snapshotVideoFlags>[1];
type Repository = { git: (...args: string[]) => string };

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const TREE = '89abcdef0123456789abcdef0123456789abcdef';

const config: SnapshotRun['config'] = {
	schemaVersion: 1,
	setup: [],
	link: [],
	outputs: ['dist/'],
	builds: [],
	tools: [],
	runners: { vitest: 'bun x vitest run {target}' },
	checks: [],
	timeouts: { test: 600000 }
};

function exampleRun(root: string, directory: string, commit: string, tree: string): SnapshotRun {
	return {
		root,
		config,
		context: { directory, commit, tree, profile: 'ci', env: { PATH: '/usr/bin:/bin' } }
	};
}

function commitEmptyRepo(repository: Repository) {
	repository.git(
		'-c',
		'user.name=Example',
		'-c',
		'user.email=example@example.invalid',
		'commit',
		'--allow-empty',
		'-m',
		'init'
	);
	return {
		commit: repository.git('rev-parse', 'HEAD').trim(),
		tree: repository.git('rev-parse', 'HEAD^{tree}').trim()
	};
}

test('Skips the capture context when no video slots exist', async () => {
	await withTempDir('snapshot-run-no-slots-', async (directory) => {
		const run = exampleRun(directory, directory, COMMIT, TREE);
		const slots = { checkout: [] };
		const context = await snapshotCaptureContext(run, slots);
		expect(context).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'service.snapshot-run',
				symbol: 'snapshotCaptureContext',
				state: 'skips-the-capture-context-when-no-video-slots-exist',
				evidence: 'examples-cases',
				file: 'skips-the-capture-context-when-no-video-slots-exist.json'
			},
			[
				{
					name: 'empty slot lists return no capture context',
					input: { slots },
					output: context ?? null
				}
			]
		);
	});
});

test('Returns no pending video flags for unenrolled scenarios', async () => {
	await withTempDir('snapshot-run-unenrolled-', async (directory) => {
		const scenarios = [{ id: 'checkout' }] as unknown as Scenarios;
		const flags = await snapshotVideoFlags(directory, scenarios);
		expect(flags).toEqual({});
		recordExampleCases(
			{
				unitId: 'service.snapshot-run',
				symbol: 'snapshotVideoFlags',
				state: 'returns-no-pending-video-flags-for-unenrolled-scenarios',
				evidence: 'examples-cases',
				file: 'returns-no-pending-video-flags-for-unenrolled-scenarios.json'
			},
			[
				{
					name: 'scenario without video needs no reviewer flags',
					input: { scenarios: [{ id: 'checkout' }] },
					output: flags
				}
			]
		);
	});
});

test('Exports the commit and runs an empty check plan', async () => {
	await withTempRepo(async (repository) => {
		const { commit, tree } = commitEmptyRepo(repository);
		await withTempDir('snapshot-run-execute-', async (directory) => {
			const run = exampleRun(repository.root, `${directory}/run`, commit, tree);
			const result = await new SnapshotRunService(run).execute([], ['dist/server.js']);
			expect(result.outcomes).toEqual([]);
			expect(result.mutated).toEqual([]);
			expect(result.artifacts).toEqual({});
			recordExampleCases(
				{
					unitId: 'service.snapshot-run',
					symbol: 'SnapshotRunService.execute',
					state: 'exports-the-commit-and-runs-an-empty-check-plan',
					evidence: 'examples-cases',
					file: 'exports-the-commit-and-runs-an-empty-check-plan.json'
				},
				[
					{
						name: 'empty plan with a missing artifact path reports no outcomes or artifacts',
						input: { plan: [], artifactPaths: ['dist/server.js'] },
						output: {
							outcomes: result.outcomes,
							mutated: result.mutated,
							added: result.added,
							artifacts: result.artifacts
						}
					}
				]
			);
		});
	});
});
