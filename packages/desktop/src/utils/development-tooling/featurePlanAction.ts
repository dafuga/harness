import { FeaturePlanService } from '../../../../../src/services/agents-providers/FeaturePlanService';
import { ModuleTaskServerService } from '../../../../../src/services/agents-providers/ModuleTaskServerService';
import { FeaturePlanRepository } from '../../../../../src/repositories/agents-providers/FeaturePlanRepository';
import { FeaturePlanReadinessAdapter } from '../../../../../src/adapters/agents-providers/FeaturePlanReadinessAdapter';
import { FeaturePlanValidator } from '../../../../../src/validators/agents-providers/FeaturePlanValidator';
import type { BridgeContext } from '../../lib/development-tooling/desktop-bridge/desktopBridge.types';
import type {
	FeaturePlanSelection,
	FeaturePlanApproval
} from '../../models/development-tooling/DesktopBridge.types';

/** The caller holds the repository lease; every action binds to its selected project and plan. */
export async function featurePlanAction(
	context: BridgeContext,
	input: FeaturePlanSelection | FeaturePlanApproval,
	writable: BridgeContext['session']['mutable']
) {
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
	await new ModuleTaskServerService(project.root).submitApproved({
		feature: input.feature,
		expectedDigest: input.expectedDigest
	});
	return plan;
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
