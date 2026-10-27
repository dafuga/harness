import { afterEach, expect, test, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FeaturePlanRepository } from '../../../../../src/repositories/agents-providers/FeaturePlanRepository';
import { ModuleTaskRepository } from '../../../../../src/repositories/agents-providers/ModuleTaskRepository';
import { FeaturePlanService } from '../../../../../src/services/agents-providers/FeaturePlanService';
import { ModuleTaskServerService } from '../../../../../src/services/agents-providers/ModuleTaskServerService';
import { FeaturePlanValidator } from '../../../../../src/validators/agents-providers/FeaturePlanValidator';
import type { HostResourcesAdapter } from '../../../../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/HostResourcesAdapter';
import type { FeaturePlan } from '../../../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import type { BridgeContext } from '../../../src/lib/development-tooling/desktop-bridge/desktopBridge.types';
import { featurePlanAction } from '../../../src/utils/development-tooling/featurePlanAction';
import { fixture as gitFixture, git } from '../../run-fixture';

const digest = 'a'.repeat(64),
	source = 'b'.repeat(40);
const plan = {
	feature: 'feature',
	sourceCommit: source,
	revision: 1,
	goal: 'Goal',
	tldr: 'Summary',
	pages: [],
	changes: [],
	tasks: [],
	digest
} satisfies FeaturePlan;
const approved = {
	...plan,
	approval: { digest, reviewer: 'Daniel', approvedAt: '2026-10-27T00:00:00.000Z' }
};
const selection = {
	projectId: 'project-a',
	feature: 'feature',
	page: 'page',
	option: 'o1',
	expectedDigest: digest
};
const approval = {
	projectId: 'project-a',
	feature: 'feature',
	reviewer: 'Daniel',
	expectedDigest: digest
};

type ResourceSnapshot = Awaited<ReturnType<HostResourcesAdapter['sample']>>;

function resourceSample(memoryAvailableBytes: number, memoryPressure = 'normal') {
	const snapshot = {
		status: 'available',
		memoryAvailableBytes,
		memoryTotalBytes: 32 * 1024 ** 3,
		memoryPressure
	} as unknown as ResourceSnapshot;
	return async () => snapshot;
}

function fixture() {
	const assertProject = vi.fn((id: string) => {
		if (id !== 'project-a') throw new Error('Wrong project.');
	});
	const context = { session: { assertProject } } as unknown as BridgeContext;
	const project = { root: '/fixture', revision: { commit: source } } as Awaited<
		ReturnType<BridgeContext['session']['mutable']>
	>;
	const writable = vi.fn(async () => project);
	const read = vi
		.spyOn(FeaturePlanRepository.prototype, 'read')
		.mockResolvedValue({ commit: undefined, plans: [plan] });
	const select = vi.spyOn(FeaturePlanService.prototype, 'select').mockResolvedValue(plan);
	const approve = vi.spyOn(FeaturePlanService.prototype, 'approve').mockResolvedValue(approved);
	const submit = vi
		.spyOn(ModuleTaskServerService.prototype, 'submitApproved')
		.mockResolvedValue({ created: ['feature.task'], reused: [], commit: undefined });
	const runApproved = vi
		.spyOn(ModuleTaskServerService.prototype, 'runApproved')
		.mockResolvedValue({
			submission: { created: ['feature.task'], reused: [], commit: undefined },
			results: []
		});
	const sampleResources = vi.fn(resourceSample(16 * 1024 ** 3));
	return { context, project, writable, read, select, approve, submit, runApproved, sampleResources };
}
afterEach(() => vi.restoreAllMocks());

test('featurePlanAction rejects a foreign project and stale plan before a write', async () => {
	const f = fixture();
	await expect(
		featurePlanAction(
			f.context,
			{ ...selection, projectId: 'other' },
			f.writable,
			f.sampleResources
		)
	).rejects.toThrow('Wrong project');
	await expect(
		featurePlanAction(
			f.context,
			{ ...selection, expectedDigest: 'c'.repeat(64) },
			f.writable,
			f.sampleResources
		)
	).rejects.toThrow('changed');
	f.read.mockResolvedValueOnce({
		commit: undefined,
		plans: [{ ...plan, sourceCommit: 'c'.repeat(40) }]
	});
	await expect(
		featurePlanAction(f.context, selection, f.writable, f.sampleResources)
	).rejects.toThrow('changed');
	expect(f.select).not.toHaveBeenCalled();
	expect(f.approve).not.toHaveBeenCalled();
	expect(f.submit).not.toHaveBeenCalled();
	expect(f.runApproved).not.toHaveBeenCalled();
});

test('featurePlanAction refuses a changed revision before selection or task admission', async () => {
	const f = fixture(),
		changed = { ...f.project, revision: { ...f.project.revision, commit: 'c'.repeat(40) } };
	f.writable.mockResolvedValueOnce(f.project).mockResolvedValueOnce(changed);
	await expect(featurePlanAction(f.context, selection, f.writable, f.sampleResources)).rejects.toThrow(
		'revision has changed'
	);
	expect(f.select).not.toHaveBeenCalled();
	expect(f.runApproved).not.toHaveBeenCalled();
	f.writable
		.mockResolvedValueOnce(f.project)
		.mockResolvedValueOnce(f.project)
		.mockResolvedValueOnce(changed);
	await expect(featurePlanAction(f.context, approval, f.writable, f.sampleResources)).rejects.toThrow(
		'revision has changed'
	);
	expect(f.approve).toHaveBeenCalledOnce();
	expect(f.submit).not.toHaveBeenCalled();
	expect(f.runApproved).not.toHaveBeenCalled();
});

test('featurePlanAction propagates readiness and queue errors and submits only the approved digest', async () => {
	const f = fixture();
	const tasks = Array.from({ length: 4 }, (_, index) => ({ id: `task-${index}` })) as unknown as FeaturePlan['tasks'];
	f.read.mockResolvedValue({ commit: undefined, plans: [{ ...plan, tasks }] });
	f.approve.mockRejectedValueOnce(new Error('Not ready.'));
	await expect(
		featurePlanAction(f.context, approval, f.writable, f.sampleResources)
	).rejects.toThrow('Not ready');
	expect(f.runApproved).not.toHaveBeenCalled();
	f.runApproved
		.mockRejectedValueOnce(new Error('Worker unavailable.'))
		.mockRejectedValueOnce(new Error('Worker unavailable.'));
	f.sampleResources
		.mockImplementationOnce(resourceSample(16 * 1024 ** 3, 'warning'))
		.mockRejectedValueOnce(new Error('Resource probe unavailable.'));
	await expect(featurePlanAction(f.context, approval, f.writable, f.sampleResources)).rejects.toThrow(
		'Worker unavailable'
	);
	await expect(featurePlanAction(f.context, approval, f.writable, f.sampleResources)).rejects.toThrow(
		'Worker unavailable'
	);
	await expect(
		featurePlanAction(f.context, approval, f.writable, f.sampleResources)
	).resolves.toMatchObject({ plan: approved, results: [] });
	expect(f.submit).not.toHaveBeenCalled();
	expect(f.runApproved).toHaveBeenNthCalledWith(
		1,
		{ feature: 'feature', expectedDigest: digest },
		expect.objectContaining({ worker: 'project-agent', parallelism: 1 })
	);
	expect(f.runApproved).toHaveBeenNthCalledWith(
		2,
		{ feature: 'feature', expectedDigest: digest },
		expect.objectContaining({ worker: 'project-agent', parallelism: 1 })
	);
	expect(f.runApproved).toHaveBeenLastCalledWith(
		{ feature: 'feature', expectedDigest: digest },
		expect.objectContaining({ worker: 'project-agent', parallelism: 2 })
	);
});

async function committedFixture() {
	const f = await gitFixture();
	const cli = (...args: string[]) =>
		execFileSync('bun', [resolve(process.cwd(), '../../src/index.ts'), ...args], {
			cwd: f.root,
			encoding: 'utf8'
		});
	const validation = JSON.parse(cli('validate', '--write', '--json')) as { valid: boolean };
	expect(validation.valid).toBe(true);
	const units = JSON.parse(cli('units', 'list', '--json')) as { id: string }[];
	const module = units.find((unit) => unit.id.includes('owned'))?.id;
	if (!module)
		throw new Error(`No owned fixture module: ${units.map((unit) => unit.id).join(', ')}`);
	writeFileSync(
		resolve(f.root, 'src/owned.ts'),
		'export function owned(): string { return "owned"; }\n'
	);
	cli('units', 'index', '--write');
	const contractPath = resolve(f.root, 'fixture-contract.json');
	writeFileSync(
		contractPath,
		JSON.stringify({
			responsibility: 'Return the owned fixture value.',
			contract: {
				inputs: [],
				outputs: [{ name: 'owned', type: 'string', description: 'Returns the owned value.' }],
				errors: []
			}
		})
	);
	cli('units', 'contract', module, '--input', contractPath);
	unlinkSync(contractPath);
	git(f.root, 'add', 'src/owned.ts', 'specification/units');
	git(f.root, 'commit', '-m', 'fixture: declare owned output');
	expect((JSON.parse(cli('validate', '--write', '--json')) as { valid: boolean }).valid).toBe(true);
	const sourceCommit = git(f.root, 'rev-parse', 'HEAD');
	await f.session.snapshot({ branch: null, commit: null });
	return { f, module, sourceCommit };
}

async function draftFixtureTask(root: string, module: string, sourceCommit: string) {
	const wantedContract = {
		responsibility: 'Change the owned fixture.',
		inputs: [],
		outputs: [{ name: 'result', type: 'string' }],
		errors: []
	};
	const task = {
		id: 'real-feature.task',
		title: 'Change fixture',
		feature: 'real-feature',
		module,
		moduleGoal: 'Change the owned fixture.',
		role: 'implementation' as const,
		assignedFiles: ['src/owned.ts'],
		instructions: 'Change only the assigned file.',
		wantedContract,
		model: 'auto'
	};
	const service = new FeaturePlanService({
		repository: new FeaturePlanRepository(root),
		validator: new FeaturePlanValidator()
	});
	const draft = await service.draft({
		feature: 'real-feature',
		sourceCommit,
		goal: 'Change fixture',
		tldr: 'One committed fixture task.',
		pages: [],
		changes: [{ unit: module, kind: 'modify', wantedContract, assignedFiles: ['src/owned.ts'] }],
		tasks: [task]
	});
	return { task, draft };
}

test('featurePlanAction approves and admits a committed fixture task without starting a provider', async () => {
	const { f, module, sourceCommit } = await committedFixture();
	const { task, draft } = await draftFixtureTask(f.root, module, sourceCommit);
	const runApproved = vi.spyOn(ModuleTaskServerService.prototype, 'runApproved').mockImplementation(
		async function (this: ModuleTaskServerService, input, _execution) {
			const submission = await this.submitApproved(input);
			return {
				submission,
				results: [{ status: 'review', task: task.id, result: { text: 'completed' } }]
			};
		}
	);
	const submitApproved = vi.spyOn(ModuleTaskServerService.prototype, 'submitApproved');
	const context = { session: f.session } as unknown as BridgeContext;
	const result = await featurePlanAction(
		context,
		{
			projectId: f.session.projectId!,
			feature: draft.feature,
			expectedDigest: draft.digest,
			reviewer: 'Daniel'
		},
		() => f.session.mutable(),
		resourceSample(16 * 1024 ** 3)
	);
	expect(result).toMatchObject({
		plan: { approval: { digest: draft.digest } },
		submission: { created: [task.id] },
		results: [{ status: 'review', task: task.id }],
		parallelism: 1
	});
	expect(submitApproved).toHaveBeenCalledOnce();
	expect(runApproved).toHaveBeenCalledOnce();
	expect(runApproved).toHaveBeenCalledWith(
		{ feature: draft.feature, expectedDigest: draft.digest },
		expect.objectContaining({ worker: 'project-agent', parallelism: 1 })
	);
	const queue = (await new ModuleTaskRepository(f.root).read()).data;
	expect(queue.tasks.map((item) => item.id)).toEqual([task.id]);
	expect(queue.tasks[0]).toMatchObject({
		status: 'queued',
		sourceCommit,
		assignedFiles: ['src/owned.ts'],
		moduleGoal: 'Return the owned fixture value.',
		module: { id: module, files: ['src/owned.ts'] }
	});
	expect(f.run).not.toHaveBeenCalled();
}, 30000);
