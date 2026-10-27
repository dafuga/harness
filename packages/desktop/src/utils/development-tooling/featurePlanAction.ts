import { FeaturePlanService } from '../../../../../src/services/agents-providers/FeaturePlanService';
import { ModuleTaskServerService } from '../../../../../src/services/agents-providers/ModuleTaskServerService';
import { HostResourcesAdapter } from '../../../../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/HostResourcesAdapter';
import { FeaturePlanRepository } from '../../../../../src/repositories/agents-providers/FeaturePlanRepository';
import { FeaturePlanReadinessAdapter } from '../../../../../src/adapters/agents-providers/FeaturePlanReadinessAdapter';
import { FeaturePlanValidator } from '../../../../../src/validators/agents-providers/FeaturePlanValidator';
import type { BridgeContext } from '../../lib/development-tooling/desktop-bridge/desktopBridge.types';
import type {
	FeaturePlanSelection,
	FeaturePlanApproval,
	FeaturePlanExecutionResult
} from '../../models/development-tooling/DesktopBridge.types';

/** The caller holds the repository lease; every action binds to its selected project and plan. */
export function featurePlanAction(
	context: BridgeContext,
	input: FeaturePlanSelection,
	writable: BridgeContext['session']['mutable'],
	sampleResources?: () => ReturnType<HostResourcesAdapter['sample']>
): Promise<Awaited<ReturnType<FeaturePlanService['select']>>>;
export function featurePlanAction(
	context: BridgeContext,
	input: FeaturePlanApproval,
	writable: BridgeContext['session']['mutable'],
	sampleResources?: () => ReturnType<HostResourcesAdapter['sample']>
): Promise<FeaturePlanExecutionResult>;
export async function featurePlanAction(
	context: BridgeContext,
	input: FeaturePlanSelection | FeaturePlanApproval,
	writable: BridgeContext['session']['mutable'],
	sampleResources: () => ReturnType<HostResourcesAdapter['sample']> = () =>
		new HostResourcesAdapter().sample()
): Promise<FeaturePlanExecutionResult | Awaited<ReturnType<FeaturePlanService['select']>>> {
	if (!input.projectId) throw new Error('A selected project ID is required.');
	context.session.assertProject(input.projectId);
	const project = await writable(),
		repository = new FeaturePlanRepository(project.root);
	const latest = (await repository.read(input.feature)).plans.at(-1);
	if (
		!latest ||
		latest.digest !== input.expectedDigest ||
		latest.sourceCommit !== project.revision.commit
	)
		throw new Error('The feature plan or source revision has changed.');
	await checkProject(context, input.projectId, project, writable);
	const readiness = new FeaturePlanReadinessAdapter(project.root);
	const plans = new FeaturePlanService({
		repository,
		validator: new FeaturePlanValidator(),
		verifyReady: (plan) => readiness.verify(plan)
	});
	if ('page' in input)
		return plans.select({
			feature: input.feature,
			page: input.page,
			option: input.option,
			expectedDigest: input.expectedDigest
		});
	const plan = await plans.approve({
		feature: input.feature,
		reviewer: input.reviewer,
		expectedDigest: input.expectedDigest
	});
	await checkProject(context, input.projectId, project, writable);
	const snapshot = await sampleResources().catch(() => undefined);
	await checkProject(context, input.projectId, project, writable);
	const parallelism = resolveParallelism(snapshot, latest.tasks.length);
	const execution = await new ModuleTaskServerService(project.root).runApproved(
		{ feature: input.feature, expectedDigest: input.expectedDigest },
		{ worker: 'project-agent', parallelism, signal: new AbortController().signal }
	);
	return {
		plan,
		submission: {
			created: execution.submission.created,
			reused: execution.submission.reused,
			commit: execution.submission.commit ?? null
		},
		results: execution.results,
		parallelism
	};
}

function resolveParallelism(
	snapshot: Awaited<ReturnType<HostResourcesAdapter['sample']>> | undefined,
	taskCount: number
): number {
	if (
		taskCount <= 1 ||
		!snapshot ||
		snapshot.status !== 'available' ||
		snapshot.memoryPressure !== 'normal'
	)
		return 1;
	const available = snapshot.memoryAvailableBytes,
		total = snapshot.memoryTotalBytes;
	if (!Number.isFinite(available) || !Number.isFinite(total) || available <= 0 || total <= 0)
		return 1;
	const gib = 1024 ** 3,
		protectedMemory = Math.max(2 * gib, total * 0.2),
		workers = Math.floor((available - protectedMemory) / (4 * gib));
	return Math.max(1, Math.min(8, taskCount, workers));
}

async function checkProject(
	context: BridgeContext,
	id: string,
	project: Awaited<ReturnType<BridgeContext['session']['mutable']>>,
	writable: BridgeContext['session']['mutable']
) {
	const current = await writable();
	context.session.assertProject(id);
	if (current.root !== project.root || current.revision.commit !== project.revision.commit)
		throw new Error('The selected project or revision has changed.');
}
