import { expect, vi } from 'vitest';
import { ModuleTaskServerService } from '../../../../src/services/agents-providers/ModuleTaskServerService';
import { componentManifestSchema } from '../../../../src/core/unitTypes';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import type {
	ModuleTaskInput,
	ModuleTaskQueue,
	FeaturePlan
} from '../../../../src/repositories/agents-providers/ModuleTaskRepository.types';
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
const makeService = (d: object) => new ModuleTaskServerService(root, d);
export const invoke = (
	f: ReturnType<typeof makeFixture>,
	execution: { worker: string; modules: string[]; once: boolean; signal: AbortSignal }
) => f.service.run(plan([task('task-one')]), execution);
function makeQueueStore(options: {
	manifests?: unknown[];
	errors?: string[];
	metadataFailure?: Error;
	approved?: unknown;
	race?: (queue: ModuleTaskQueue) => void;
}) {
	let queue: ModuleTaskQueue = { schemaVersion: 1, features: [], tasks: [] },
		commit: string | undefined;
	if (options.approved) queue.plans = [structuredClone(options.approved) as FeaturePlan];
	const repository = {
		read: vi.fn(async () => ({ commit, data: structuredClone(queue) })),
		update: vi.fn(async (change: (draft: ModuleTaskQueue) => unknown, _source?: string) => {
			const before = JSON.stringify(queue);
			let draft = structuredClone(queue),
				value = change(draft);
			if (options.race) {
				options.race(queue);
				draft = structuredClone(queue);
				value = change(draft);
			}
			if (JSON.stringify(draft) !== before) {
				queue = draft;
				commit = nextCommit;
			}
			return { value, commit };
		})
	};
	return { repository, queue: () => structuredClone(queue), commit: () => commit };
}
export const makeFixture = (options: Parameters<typeof makeQueueStore>[0] = {}) => {
	const store = makeQueueStore(options),
		{ repository } = store;
	const tree = { revision: sourceCommit };
	const manifests = options.manifests ?? [manifest('service.alpha'), manifest('service.beta')];
	const worker: {
		once: ReturnType<typeof vi.fn>;
		onceApproved?: (...args: unknown[]) => Promise<unknown>;
	} = {
		once: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ status: 'idle' as const }))
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
		grantFiles: vi.fn(async (input: ModuleTaskInput, unit: ComponentManifest, _tree: unknown) => {
			const role = input.role ?? 'implementation';
			const files: string[] =
				input.assignedFiles ??
				(role === 'verification' ? input.verificationFiles! : unit.owns.source.slice(0, 1));
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
		worker
	};
	return {
		service: makeService(collaborators),
		collaborators,
		queue: store.queue,
		commit: store.commit,
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
export const admissionTrace = (f: ReturnType<typeof makeFixture>) => {
	const { collaborators } = f;
	return {
		grants: collaborators.grantFiles.mock.calls.map(([input, unit, tree]) => [
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
export async function assertWatchCancellation() {
	const f = makeFixture();
	let finish!: (value: unknown) => void;
	const active = new Promise<unknown>((resolve) => (finish = resolve));
	f.collaborators.worker.once.mockResolvedValueOnce({ status: 'idle' }).mockReturnValueOnce(active);
	const controller = new AbortController(),
		pending = invoke(f, {
			worker: 'worker-one',
			modules: [],
			once: false,
			signal: controller.signal
		});
	let settled = false;
	void pending.then(
		() => (settled = true),
		() => (settled = true)
	);
	await vi.waitFor(() => expect(f.collaborators.worker.once).toHaveBeenCalledTimes(2));
	controller.abort();
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(settled).toBe(false);
	finish({ status: 'idle' });
	await expect(pending).rejects.toHaveProperty('name', 'AbortError');
	expect(f.collaborators.worker.once).toHaveBeenCalledTimes(2);
}
