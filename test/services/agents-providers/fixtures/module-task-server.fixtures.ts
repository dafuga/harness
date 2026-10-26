import { expect, vi } from 'vitest';
import { ModuleTaskServerService } from '../../../../src/services/agents-providers/ModuleTaskServerService';
import { componentManifestSchema } from '../../../../src/core/unitTypes';
export const root = '/disposable/repository';
export const sourceCommit = 'a'.repeat(40);
export const nextCommit = 'b'.repeat(40);
export const feature = { id: 'contract-first-execution', goal: 'Goal', tldr: 'Brief' };
export const contract = {
	responsibility: 'Work',
	inputs: [],
	outputs: [{ name: 'x', type: 'string' }],
	errors: []
};
const manifestContract = { origin: 'declared', inputs: [], outputs: contract.outputs, errors: [] };
export const task = (id: string, module = 'service.alpha', changes = {}) => ({
	id,
	title: id,
	feature: feature.id,
	module,
	verificationFiles: [`test/${id}.test.ts`],
	instructions: id,
	wantedContract: contract,
	model: 'auto',
	...changes
});
export const plan = (tasks: unknown[], f = feature) => ({ feature: f, tasks });
export const manifest = (id: string, changes: Record<string, unknown> = {}) => {
	const source = `src/${id.split('.').at(-1)}`;
	return componentManifestSchema.parse({
		schemaVersion: 1,
		id,
		kind: 'service',
		title: id,
		status: 'active',
		responsibilityOrigin: 'declared',
		responsibility: 'work',
		owns: { source: [`${source}.ts`, `${source}.alternate.ts`], symbols: [] },
		contract: manifestContract,
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: `${source}.ts`,
			targets: [{ kind: 'module', entry: `${source}.ts` }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		...changes
	});
};
const makeService = (d: object) => new (ModuleTaskServerService as any)(root, d) as any;
export const invoke = (
	f: any,
	execution: { worker: string; modules: string[]; once: boolean; signal: AbortSignal }
) => f.service.run(plan([task('task-one')]), execution);
export const makeFixture = (
	options: {
		manifests?: unknown[];
		errors?: string[];
		metadataFailure?: Error;
		approved?: unknown;
		race?: (queue: any) => void;
	} = {}
) => {
	let queue: any = { schemaVersion: 1, features: [], tasks: [] },
		commit: string | undefined;
	if (options.approved) queue.plans = [structuredClone(options.approved)];
	const tree = { revision: sourceCommit };
	const manifests = options.manifests ?? [manifest('service.alpha'), manifest('service.beta')];
	const repository = {
		read: vi.fn(async () => ({ commit, data: structuredClone(queue) })),
		update: vi.fn(async (change: any, _source?: string) => {
			const before = JSON.stringify(queue);
			let draft = structuredClone(queue),
				value = change(draft);
			if (options.race) {
				options.race(queue);
				draft = structuredClone(queue);
				value = change(draft);
			}
			if (JSON.stringify(draft) !== before) ((queue = draft), (commit = nextCommit));
			return { value, commit };
		})
	};
	const collaborators = {
		repository,
		plans: {
			approved: vi.fn(async () => {
				if (!options.approved) throw new Error('No approved plan');
				return structuredClone(options.approved);
			})
		},
		openTree: vi.fn(async () => tree),
		grantFiles: vi.fn(async (input: any, unit: any) => {
			const role = input.role ?? 'implementation';
			const files: string[] =
				input.assignedFiles ??
				(role === 'verification' ? input.verificationFiles : unit.owns.source.slice(0, 1));
			const allowed: string[] =
				role === 'verification' ? (input.verificationFiles ?? []) : unit.owns.source;
			if (!files.length || files.some((file) => !allowed.includes(file)))
				throw new Error('unsafe file grant');
			return [...files];
		}),
		validateGrant: vi.fn(async () => {}),
		registry: {
			read: vi.fn(async () => ({ manifests, errors: options.errors ?? [], unformatted: [] }))
		},
		requireMetadata: vi.fn(async () => {
			if (options.metadataFailure) throw options.metadataFailure;
		}),
		worker: { once: vi.fn(async () => ({ status: 'idle' as const })) }
	};
	return {
		service: makeService(collaborators),
		collaborators: collaborators as any,
		queue: () => structuredClone(queue),
		commit: () => commit,
		tree
	};
};
export const rejectBeforeUpdate = async (
	value: unknown,
	options: Parameters<typeof makeFixture>[0] = {}
) => {
	const f = makeFixture(options);
	await expect(f.service.submit(value)).rejects.toThrow();
	expect(f.collaborators.repository.update).not.toHaveBeenCalled();
};
export const admissionTrace = (f: any) => {
	const { collaborators } = f;
	return {
		grants: collaborators.grantFiles.mock.calls.map(([input, unit, tree]: any[]) => [
			input.id,
			unit.id,
			tree
		]),
		validated: collaborators.validateGrant.mock.calls,
		beforeUpdate:
			Math.max(
				...collaborators.grantFiles.mock.invocationCallOrder,
				...collaborators.validateGrant.mock.invocationCallOrder
			) < collaborators.repository.update.mock.invocationCallOrder[0]
	};
};
export const outcome = (status: 'review' | 'failed' = 'review') => ({
	status,
	task: 'task-one',
	result: Object.freeze({ opaqueWorkerResult: true })
});
export const approvedPlan = () => ({
	feature: feature.id,
	goal: feature.goal,
	tldr: feature.tldr,
	sourceCommit,
	revision: 1,
	pages: [],
	changes: ['service.alpha', 'service.beta'].map((unit) => ({
		unit,
		kind: 'modify',
		wantedContract: contract,
		assignedFiles: [`src/${unit.split('.').at(-1)}.ts`]
	})),
	tasks: [task('task-one'), task('task-two', 'service.beta', { dependsOn: ['task-one'] })],
	digest: 'c'.repeat(64),
	approval: { digest: 'c'.repeat(64), reviewer: 'reviewer', approvedAt: '2026-10-26T12:00:00.000Z' }
});
export const checkApprovedSubmission = async () => {
	const approved = approvedPlan(),
		f = makeFixture({ approved });
	const request = { feature: feature.id, expectedDigest: approved.digest };
	const ids = ['task-one', 'task-two'],
		c = f.collaborators;
	const created = { created: ids, reused: [], commit: nextCommit };
	const reused = { created: [], reused: ids, commit: nextCommit };
	expect(await f.service.submitApproved(request)).toEqual(created);
	expect(f.collaborators.plans.approved).toHaveBeenCalledWith(request);
	expect(c.plans.approved.mock.invocationCallOrder[0]).toBeLessThan(
		c.repository.update.mock.invocationCallOrder[0]
	);
	expect(f.queue().tasks.map((item: any) => item.id)).toEqual(['task-one', 'task-two']);
	expect(f.queue().tasks[1]).toMatchObject({ dependsOn: ['task-one'], wantedContract: contract });
	expect(f.collaborators.worker.once).not.toHaveBeenCalled();
	const before = f.queue();
	expect(await f.service.submitApproved(request)).toEqual(reused);
	expect(f.queue()).toEqual(before);
};
export const checkApprovedRejections = async () => {
	const approved = approvedPlan(),
		request = { feature: feature.id, expectedDigest: approved.digest };
	for (const race of [
		(queue: any) => (queue.plans = []),
		(queue: any) => delete queue.plans[0].approval,
		(queue: any) => (queue.plans[0].digest = 'd'.repeat(64)),
		(queue: any) => (queue.plans[0].tasks[1].instructions = 'Changed'),
		(queue: any) => (queue.plans[0].approval.reviewer = 'Changed')
	]) {
		const f = makeFixture({ approved, race });
		await expect(f.service.submitApproved(request)).rejects.toThrow();
		expect(f.queue().tasks).toEqual([]);
		expect(f.queue().features).toEqual([]);
		expect(f.commit()).toBeUndefined();
	}
	for (const options of [
		{},
		{ approved, metadataFailure: new Error('Missing metadata') },
		{ approved, manifests: [manifest('service.alpha')] }
	]) {
		const f = makeFixture(options),
			before = f.queue();
		await expect(f.service.submitApproved(request)).rejects.toThrow();
		expect(f.queue()).toEqual(before);
		expect(f.collaborators.repository.update).not.toHaveBeenCalled();
	}
	const f = makeFixture({ approved });
	const stale = { ...request, expectedDigest: 'd'.repeat(64) };
	await expect(f.service.submitApproved(stale)).rejects.toThrow();
	expect(f.queue().tasks).toEqual([]);
};
