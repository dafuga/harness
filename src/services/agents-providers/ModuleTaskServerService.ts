import {
	mergePlan,
	prepareSubmission
} from '../../helpers/agents-providers/moduleTaskApprovedSubmission';
import { isDeepStrictEqual } from 'node:util';
import { CommitTreeAdapter } from '../../adapters/CommitTreeAdapter';
import { FeaturePlanReadinessAdapter } from '../../adapters/agents-providers/FeaturePlanReadinessAdapter';
import { FeaturePlanRepository } from '../../repositories/agents-providers/FeaturePlanRepository';
import { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { UnitRegistryRepository } from '../../repositories/UnitRegistryRepository';
import { FeaturePlanValidator } from '../../validators/agents-providers/FeaturePlanValidator';
import { requireModuleData } from '../git-source-history/module-data-service/moduleDataAdmission';
import { FeaturePlanService } from './FeaturePlanService';
import { ModuleTaskWorkerService } from './ModuleTaskWorkerService';
import { taskGrantFiles, validateTaskGrant } from './module-task-service/queuedTask';
import type {
	ApprovedTaskScope,
	ApprovedExecution,
	ServerDependencies,
	ServerWorker
} from '../../helpers/agents-providers/moduleTaskApprovedSubmission.types';

const unitId = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const isAbortSignal = (value: unknown): value is AbortSignal =>
	!!value &&
	typeof (value as AbortSignal).aborted === 'boolean' &&
	typeof (value as AbortSignal).addEventListener === 'function' &&
	typeof (value as AbortSignal).removeEventListener === 'function';
const abortError = () =>
	Object.assign(new Error('Module task run aborted'), { name: 'AbortError' });

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
	if (signal.aborted) throw abortError();
};

const waitForPoll = (signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const finish = () => {
			clearTimeout(timer);
			signal.removeEventListener('abort', finish);
			resolve();
		};
		const timer = setTimeout(finish, 50);
		signal.addEventListener('abort', finish, { once: true });
	});

async function approvedBatch(
	worker: ServerWorker,
	scope: ApprovedTaskScope,
	run: ApprovedExecution
) {
	const once = worker.onceApproved?.bind(worker);
	if (!once) throw new Error('Approval-scoped worker is unavailable.');
	const outcomes = await Promise.allSettled(
		Array.from({ length: run.parallelism }, () =>
			Promise.resolve().then(() => once(run.worker, scope, run.signal))
		)
	);
	const failure = outcomes.find(
		(result): result is PromiseRejectedResult => result.status === 'rejected'
	);
	if (failure) throw failure.reason;
	return outcomes.map((result) => (result as PromiseFulfilledResult<unknown>).value);
}

async function watch(
	workerService: ServerWorker,
	execution: { worker: string; modules: string[]; signal: AbortSignal }
): Promise<never> {
	const { worker, modules, signal } = execution;
	const results: unknown[] = [];
	while (!signal.aborted) {
		try {
			const result = await workerService.once(worker, modules, signal);
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

export class ModuleTaskServerService {
	private readonly repository: ModuleTaskRepository;
	private readonly openTree: typeof CommitTreeAdapter.open;
	private readonly registry: Pick<UnitRegistryRepository, 'read'>;
	private readonly requireMetadata: typeof requireModuleData;
	private readonly worker: ServerWorker;
	private readonly grantFiles: typeof taskGrantFiles;
	private readonly validateGrant: typeof validateTaskGrant;
	private readonly plans: Pick<FeaturePlanService, 'approved'>;

	constructor(
		private readonly root: string,
		dependencies: ServerDependencies = {}
	) {
		this.repository = dependencies.repository ?? new ModuleTaskRepository(root);
		this.openTree = dependencies.openTree ?? CommitTreeAdapter.open;
		this.registry = dependencies.registry ?? new UnitRegistryRepository(root);
		this.requireMetadata = dependencies.requireMetadata ?? requireModuleData;
		this.worker = dependencies.worker ?? new ModuleTaskWorkerService(root);
		this.grantFiles = dependencies.grantFiles ?? taskGrantFiles;
		this.validateGrant = dependencies.validateGrant ?? validateTaskGrant;
		this.plans =
			dependencies.plans ??
			new FeaturePlanService({
				repository: new FeaturePlanRepository(root, this.repository),
				validator: new FeaturePlanValidator(),
				verifyReady: (plan) => new FeaturePlanReadinessAdapter(root).verify(plan)
			});
	}

	async submit(
		input: unknown
	): Promise<ReturnType<typeof mergePlan> & { commit: string | undefined }> {
		return (await this.submitPlan(input)).submission;
	}

	async submitApproved(input: { feature: string; expectedDigest: string }) {
		return (await this.admitApproved(input)).submission;
	}

	private async admitApproved(input: { feature: string; expectedDigest: string }) {
		const { feature, expectedDigest } = input;
		const approved = structuredClone(await this.plans.approved({ feature, expectedDigest }));
		if (
			approved.feature !== feature ||
			approved.digest !== expectedDigest ||
			approved.approval?.digest !== expectedDigest
		)
			throw new Error('Approved plan does not match the requested feature and digest.');
		return this.submitPlan(
			{
				feature: { id: approved.feature, goal: approved.goal, tldr: approved.tldr },
				tasks: approved.tasks
			},
			approved
		);
	}

	private async submitPlan(input: unknown, approved?: FeaturePlan) {
		const { feature, records, sourceCommit } = await prepareSubmission(
			input,
			{
				root: this.root,
				repository: this.repository,
				openTree: this.openTree,
				registry: this.registry,
				requireMetadata: this.requireMetadata,
				grantFiles: this.grantFiles,
				validateGrant: this.validateGrant
			},
			approved?.sourceCommit
		);
		const result = await this.repository.update((draft) => {
			const latest = draft.plans?.filter((plan) => plan.feature === feature.id).at(-1);
			if (approved && !isDeepStrictEqual(latest, approved))
				throw new Error('Approved plan changed before task submission.');
			return mergePlan(draft, feature, records);
		}, sourceCommit);
		return {
			submission: { ...result.value, commit: result.commit },
			scope: approved ? { plan: approved, feature, records } : undefined
		};
	}

	async runApproved(
		input: { feature: string; expectedDigest: string },
		execution: ApprovedExecution
	) {
		const request = structuredClone(input);
		const { worker, parallelism, signal } = execution;
		validateRun(worker, [], true, signal);
		if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 8)
			throw new Error('Parallelism must be an integer from 1 to 8.');
		if (!this.worker.onceApproved) throw new Error('Approval-scoped worker is unavailable.');
		const { submission, scope } = await this.admitApproved(request);
		signal.throwIfAborted();
		const current = await this.plans.approved(request);
		if (!isDeepStrictEqual(current, scope!.plan))
			throw new Error('Approved plan changed before dispatch.');
		signal.throwIfAborted();
		return {
			submission,
			results: await approvedBatch(this.worker, scope!, { worker, parallelism, signal })
		};
	}

	async run(
		input: unknown,
		execution: { worker: string; modules: string[]; once: boolean; signal: AbortSignal }
	) {
		const { worker, modules, once, signal } = execution;
		validateRun(worker, modules, once, signal);
		const submission = await this.submit(input);
		if (once) return { submission, results: [await this.worker.once(worker, modules, signal)] };
		return watch(this.worker, { worker, modules, signal });
	}
}
