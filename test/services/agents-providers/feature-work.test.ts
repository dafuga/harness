import { expect, test, vi } from 'vitest';
import { FeatureWorkService } from '../../../src/services/agents-providers/FeatureWorkService';
import type {
	FeaturePlan,
	ModuleTask,
	ModuleTaskInput,
	ModuleTaskQueue,
	TaskFeature
} from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';

const alpha = { id: 'alpha', goal: 'Build alpha', tldr: 'Alpha context' };
const beta = { id: 'beta', goal: 'Build beta', tldr: 'Beta context' };
const legacy = { id: 'legacy', goal: 'Legacy work', tldr: 'No plan yet' };
const commit = 'a'.repeat(40);
const input = (id: string, feature = alpha.id): ModuleTaskInput => ({
	id,
	title: `Task ${id}`,
	feature,
	module: 'service.synthetic',
	instructions: 'PRIVATE_INSTRUCTIONS',
	wantedContract: {
		responsibility: 'Synthetic work',
		inputs: [],
		outputs: [{ name: 'result', type: 'string' }],
		errors: []
	},
	role: 'implementation',
	model: 'auto'
});
const task = (
	id: string,
	status: ModuleTask['status'],
	feature: TaskFeature = alpha,
	dependsOn?: string[]
): ModuleTask => ({
	...input(id, feature.id),
	feature,
	module: { id: 'service.synthetic', goal: 'Synthetic work', files: ['private/source.ts'] },
	status,
	dependsOn,
	sourceCommit: commit,
	contractHash: 'b'.repeat(64),
	createdAt: '2026-10-26T12:00:00.000Z',
	reviews: [],
	claim: {
		worker: 'synthetic-worker',
		token: '11111111-1111-4111-8111-111111111111',
		startedAt: '2026-10-26T12:00:00.000Z',
		owner: { workspace: '22222222-2222-4222-8222-222222222222', pid: 123, startedAt: 'synthetic' }
	},
	claimHistory: [],
	attempts: [],
	result: {
		provider: 'codex',
		model: 'synthetic',
		intelligence: 'max',
		reportedModel: null,
		text: 'PRIVATE_EXECUTION',
		worktree: '/private/worktree',
		changedFiles: [],
		fallback: false,
		finishedAt: '2026-10-26T12:00:00.000Z',
		executions: []
	}
});
const plan = (feature: TaskFeature, revision: number, ids: string[]): FeaturePlan => ({
	feature: feature.id,
	sourceCommit: commit,
	revision,
	goal: feature.goal,
	tldr: feature.tldr,
	pages: [],
	changes: [],
	tasks: ids.map((id) => input(id, feature.id)),
	digest: String(revision).repeat(64)
});
const projected = (
	id: string,
	status: ModuleTask['status'],
	belongsToPlan: boolean,
	...dependencies: [dependsOn?: string[], blockedBy?: string[]]
) => ({
	id,
	title: `Task ${id}`,
	module: 'service.synthetic',
	status,
	dependsOn: dependencies[0] ?? [],
	blockedBy: dependencies[1] ?? [],
	belongsToPlan
});

function snapshotData(latest: FeaturePlan, betaPlan: FeaturePlan): ModuleTaskQueue {
	return {
		schemaVersion: 1,
		features: [alpha, beta, legacy],
		plans: [latest, plan(alpha, 1, ['old']), betaPlan, plan(alpha, 2, ['old'])],
		tasks: [
			task('ready', 'accepted'),
			task('queued', 'queued', alpha, ['ready', 'missing', 'foreign', 'running']),
			task('running', 'running', alpha, ['ready']),
			task('review', 'review'),
			task('failed', 'failed'),
			task('old', 'accepted'),
			task('foreign', 'accepted', beta),
			task('legacy-task', 'queued', legacy)
		]
	};
}

async function verifySnapshots() {
	const latest = plan(alpha, 3, ['ready', 'queued', 'running', 'review', 'failed']);
	const betaPlan = plan(beta, 7, ['foreign']);
	const data = snapshotData(latest, betaPlan);
	const original = structuredClone(data);
	const read = vi
		.fn()
		.mockResolvedValueOnce({ commit, data })
		.mockResolvedValueOnce({
			commit: 'c'.repeat(40),
			data: { schemaVersion: 1, features: [legacy], tasks: [] }
		});
	const service = new FeatureWorkService({ read });
	expect(await service.read()).toEqual({
		queueCommit: commit,
		features: [
			{
				...alpha,
				plan: latest,
				tasks: [
					projected('ready', 'accepted', true),
					projected(
						'queued',
						'queued',
						true,
						['ready', 'missing', 'foreign', 'running'],
						['missing', 'foreign', 'running']
					),
					projected('running', 'running', true, ['ready']),
					projected('review', 'review', true),
					projected('failed', 'failed', true),
					projected('old', 'accepted', false)
				]
			},
			{ ...beta, plan: betaPlan, tasks: [projected('foreign', 'accepted', true)] },
			{ ...legacy, plan: null, tasks: [projected('legacy-task', 'queued', false)] }
		]
	});
	expect(read).toHaveBeenCalledTimes(1);
	expect(data).toEqual(original);
	expect(await service.read()).toEqual({
		queueCommit: 'c'.repeat(40),
		features: [{ ...legacy, plan: null, tasks: [] }]
	});
	expect(read).toHaveBeenCalledTimes(2);
}

// Preserve the registered generated method-state case while exercising the new read contract.
test('FeatureWorkService.run from default initialization returns the file name', async () => {
	expect(new FeatureWorkService().run()).toBe('feature-work');
	const read = vi.fn().mockResolvedValue({
		commit: undefined,
		data: { schemaVersion: 1, features: [], tasks: [] }
	});
	expect(await new FeatureWorkService({ read }).read()).toEqual({
		queueCommit: null,
		features: []
	});
	expect(read).toHaveBeenCalledTimes(1);
	await verifySnapshots();
	const failure = new Error('Queue snapshot unavailable');
	const failedRead = vi.fn().mockRejectedValue(failure);
	await expect(new FeatureWorkService({ read: failedRead }).read()).rejects.toBe(failure);
	expect(failedRead).toHaveBeenCalledTimes(1);
});
