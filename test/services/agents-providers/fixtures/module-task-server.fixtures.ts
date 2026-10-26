import { expect, vi } from 'vitest';
import { ModuleTaskServerService } from '../../../../src/services/agents-providers/ModuleTaskServerService';

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

export const task = (
	id: string,
	module = 'service.alpha',
	changes: Record<string, unknown> = {}
) => ({
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
export const manifest = (id: string, changes: Record<string, unknown> = {}) => ({
	id,
	status: 'active',
	responsibilityOrigin: 'declared',
	responsibility: 'work',
	owns: { source: [`src/${id.split('.').at(-1)}.ts`] },
	contract: { origin: 'declared', ...contract },
	...changes
});

const makeService = (d: object) => new (ModuleTaskServerService as any)(root, d) as any;
export const invoke = (
	f: any,
	execution: { worker: string; modules: string[]; once: boolean; signal: AbortSignal }
) => f.service.run(plan([task('task-one')]), execution);

export const makeFixture = (
	options: { manifests?: unknown[]; errors?: string[]; metadataFailure?: Error } = {}
) => {
	let queue: any = { schemaVersion: 1, features: [], tasks: [] },
		commit: string | undefined;
	const tree = { revision: sourceCommit };
	const manifests = options.manifests ?? [manifest('service.alpha'), manifest('service.beta')];
	const repository = {
		read: vi.fn(async () => ({ commit, data: structuredClone(queue) })),
		update: vi.fn(async (change: any, _source?: string) => {
			const before = JSON.stringify(queue),
				draft = structuredClone(queue),
				value = change(draft);
			if (JSON.stringify(draft) !== before) ((queue = draft), (commit = nextCommit));
			return { value, commit };
		})
	};
	const collaborators = {
		repository,
		openTree: vi.fn(async () => tree),
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

export const outcome = (status: 'review' | 'failed' = 'review') => ({
	status,
	task: 'task-one',
	result: Object.freeze({ opaqueWorkerResult: true })
});
