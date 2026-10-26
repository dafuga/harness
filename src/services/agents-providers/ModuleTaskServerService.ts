import { CommitTreeAdapter } from '../../adapters/CommitTreeAdapter';
import {
	featureSchema,
	taskInputSchema,
	ModuleTaskRepository
} from '../../repositories/agents-providers/ModuleTaskRepository';
import type {
	ModuleTask,
	ModuleTaskInput,
	ModuleTaskQueue,
	TaskFeature
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { UnitRegistryRepository } from '../../repositories/UnitRegistryRepository';
import { requireModuleData } from '../git-source-history/module-data-service/moduleDataAdmission';
import { ModuleTaskService } from './ModuleTaskService';
import { ModuleTaskWorkerService } from './ModuleTaskWorkerService';
import { queuedTask, taskGrantFiles, validateTaskGrant } from './module-task-service/queuedTask';

const isRecord = (value: unknown): value is Record<string, any> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);
const unitId = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const safePath = (value: unknown): value is string =>
	typeof value === 'string' &&
	value.length > 0 &&
	!value.startsWith('/') &&
	!value.includes('\\') &&
	!value.split('/').includes('..');
const isAbortSignal = (value: unknown): value is AbortSignal =>
	!!value &&
	typeof (value as AbortSignal).aborted === 'boolean' &&
	typeof (value as AbortSignal).addEventListener === 'function' &&
	typeof (value as AbortSignal).removeEventListener === 'function';
const abortError = () =>
	Object.assign(new Error('Module task run aborted'), { name: 'AbortError' });

const parsePlan = (value: unknown): { feature: TaskFeature; tasks: ModuleTaskInput[] } => {
	if (!isRecord(value) || !Array.isArray(value.tasks)) throw new Error('Invalid module task plan');
	const feature = featureSchema.parse(value.feature);
	const tasks = value.tasks.map((item) => taskInputSchema.parse(item));
	const ids = new Set<string>();
	for (const task of tasks) {
		if (ids.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
		if (task.feature !== feature.id) throw new Error(`Task ${task.id} names another feature`);
		ids.add(task.id);
	}
	return { feature, tasks };
};

const validateModule = (manifest: any, task: ModuleTaskInput): string[] => {
	if (manifest.status !== 'active') throw new Error(`Module ${task.module} is not active`);
	const sources = manifest.owns?.source;
	if (!Array.isArray(sources) || !sources.length || !sources.every(safePath))
		throw new Error(`Module ${task.module} has no safe owned source scope`);
	if (manifest.responsibilityOrigin === 'derived' && !task.moduleGoal)
		throw new Error(`Task ${task.id} requires a module goal`);
	const moduleContract = { ...manifest.contract };
	delete moduleContract.origin;
	taskInputSchema.parse({ ...task, wantedContract: moduleContract });
	return sources;
};

const sameFeature = (left: TaskFeature, right: TaskFeature) =>
	JSON.stringify(left) === JSON.stringify(right);
const taskDefinitionKeys = (
	'id title feature module moduleGoal verificationFiles assignedFiles role instructions ' +
	'wantedContract model provider intelligence assignee sourceCommit contractHash'
).split(' ') as Array<keyof ModuleTask>;
const sameTask = (left: ModuleTask, right: ModuleTask) =>
	taskDefinitionKeys.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));

const mergePlan = (
	queue: ModuleTaskQueue,
	feature: TaskFeature,
	tasks: ModuleTask[]
): { created: string[]; reused: string[] } => {
	const features = queue.features.filter((item) => item.id === feature.id);
	if (features.length > 1 || (features[0] && !sameFeature(features[0], feature)))
		throw new Error(`Conflicting feature: ${feature.id}`);
	const created: string[] = [],
		reused: string[] = [],
		additions: ModuleTask[] = [];
	for (const task of tasks) {
		const matches = queue.tasks.filter((item) => item.id === task.id);
		if (matches.length > 1 || (matches[0] && !sameTask(matches[0], task)))
			throw new Error(`Conflicting task: ${task.id}`);
		(matches.length ? reused : created).push(task.id);
		if (!matches.length) additions.push(task);
	}
	if (!features.length) queue.features.push(feature);
	queue.tasks.push(...additions);
	return { created, reused };
};

const validateRun = (worker: unknown, modules: unknown, once: unknown, signal: unknown) => {
	if (typeof worker !== 'string' || !unitId.test(worker)) throw new Error('Invalid worker id');
	if (
		!Array.isArray(modules) ||
		modules.some((module) => typeof module !== 'string' || !unitId.test(module))
	)
		throw new Error('Invalid module filter');
	if (new Set(modules).size !== modules.length) throw new Error('Duplicate module filter');
	if (typeof once !== 'boolean') throw new Error('Invalid worker run mode');
	if (!isAbortSignal(signal)) throw new Error('Invalid abort signal');
	if ((signal as AbortSignal).aborted) throw abortError();
};

const waitForPoll = (signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		if (signal.aborted) return resolve();
		const finish = () => {
			clearTimeout(timer);
			signal.removeEventListener('abort', finish);
			resolve();
		};
		const timer = setTimeout(finish, 50);
		signal.addEventListener('abort', finish, { once: true });
	});

export class ModuleTaskServerService {
	private readonly root: string;
	private readonly repository: ModuleTaskRepository;
	private readonly openTree: typeof CommitTreeAdapter.open;
	private readonly registry: Pick<UnitRegistryRepository, 'read'>;
	private readonly requireMetadata: typeof requireModuleData;
	private readonly worker: Pick<ModuleTaskWorkerService, 'once'>;
	private readonly grantFiles: typeof taskGrantFiles;
	private readonly validateGrant: typeof validateTaskGrant;

	constructor(
		root: string,
		dependencies: Partial<{
			repository: ModuleTaskRepository;
			openTree: typeof CommitTreeAdapter.open;
			registry: Pick<UnitRegistryRepository, 'read'>;
			requireMetadata: typeof requireModuleData;
			worker: Pick<ModuleTaskWorkerService, 'once'>;
			grantFiles: typeof taskGrantFiles;
			validateGrant: typeof validateTaskGrant;
		}> = {}
	) {
		this.root = root;
		this.repository = dependencies.repository ?? new ModuleTaskRepository(root);
		this.openTree = dependencies.openTree ?? CommitTreeAdapter.open;
		this.registry = dependencies.registry ?? new UnitRegistryRepository(root);
		this.requireMetadata = dependencies.requireMetadata ?? requireModuleData;
		this.worker = dependencies.worker ?? new ModuleTaskWorkerService(root);
		this.grantFiles = dependencies.grantFiles ?? taskGrantFiles;
		this.validateGrant = dependencies.validateGrant ?? validateTaskGrant;
	}

	async submit(
		input: unknown
	): Promise<ReturnType<typeof mergePlan> & { commit: string | undefined }> {
		const { feature, tasks } = parsePlan(input);
		const tree = await this.openTree(this.root, 'HEAD');
		const registry = await this.registry.read(tree);
		if (registry.errors.length)
			throw new Error('Selected unit registry contains invalid manifests');
		const units = new Map<string, any>();
		const admissions: Array<{ task: ModuleTaskInput; unit: any; files: string[] }> = [];
		for (const task of tasks) {
			const manifest = registry.manifests.find((item: any) => item.id === task.module);
			if (!manifest) throw new Error(`Module ${task.module} is not registered`);
			validateModule(manifest, task);
			units.set(task.module, manifest);
			const files = await this.grantFiles(task, manifest, tree);
			await this.validateGrant(this.root, files);
			admissions.push({ task, unit: manifest, files });
		}
		for (const module of units.keys()) await this.requireMetadata(this.root, tree.revision, module);
		const queue = await this.repository.read();
		const service = new ModuleTaskService(this.root);
		const records = admissions.map(({ task, unit, files }) =>
			queuedTask(task, feature, unit, tree.revision, files)
		);
		for (const record of records) service.prepare(record, queue.commit ?? tree.revision);
		const result = await this.repository.update(
			(draft) => mergePlan(draft, feature, records),
			tree.revision
		);
		return { ...result.value, commit: result.commit };
	}

	async run(
		input: unknown,
		execution: { worker: string; modules: string[]; once: boolean; signal: AbortSignal }
	) {
		const { worker, modules, once, signal } = execution;
		validateRun(worker, modules, once, signal);
		const submission = await this.submit(input);
		if (once) return { submission, results: [await this.worker.once(worker, modules, signal)] };
		return this.watch(submission, worker, modules, signal);
	}

	private async watch(
		submission: Awaited<ReturnType<ModuleTaskServerService['submit']>>,
		worker: string,
		modules: string[],
		signal: AbortSignal
	): Promise<never> {
		const results: unknown[] = [];
		while (!signal.aborted) {
			try {
				const result = await this.worker.once(worker, modules, signal);
				results.push(result);
				if (results.length > 100) results.shift();
				if (signal.aborted) throw abortError();
				if (result.status === 'idle') await waitForPoll(signal);
			} catch (error) {
				if (signal.aborted) throw abortError();
				throw error;
			}
		}
		throw abortError();
	}
}
