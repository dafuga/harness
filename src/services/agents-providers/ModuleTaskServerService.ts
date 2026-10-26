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
	private readonly repository: ModuleTaskRepository;
	private readonly openTree: typeof CommitTreeAdapter.open;
	private readonly registry: Pick<UnitRegistryRepository, 'read'>;
	private readonly requireMetadata: typeof requireModuleData;
	private readonly worker: Pick<ModuleTaskWorkerService, 'once'>;
	private readonly grantFiles: typeof taskGrantFiles;
	private readonly validateGrant: typeof validateTaskGrant;
	private readonly plans: Pick<FeaturePlanService, 'approved'>;

	constructor(
		private readonly root: string,
		dependencies: Partial<{
			repository: ModuleTaskRepository;
			openTree: typeof CommitTreeAdapter.open;
			registry: Pick<UnitRegistryRepository, 'read'>;
			requireMetadata: typeof requireModuleData;
			worker: Pick<ModuleTaskWorkerService, 'once'>;
			grantFiles: typeof taskGrantFiles;
			validateGrant: typeof validateTaskGrant;
			plans: Pick<FeaturePlanService, 'approved'>;
		}> = {}
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
		return this.submitPlan(input);
	}

	async submitApproved(input: { feature: string; expectedDigest: string }) {
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
