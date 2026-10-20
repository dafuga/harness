import { DeploymentService } from '../services/DeploymentService';
import { ProjectImageCacheService } from '../services/ProjectImageCacheService';
import { ProjectOperationsService } from '../services/ProjectOperationsService';
import { RecordedEvidenceService } from '../services/RecordedEvidenceService';
import type { DesktopBridge } from '../models/DesktopBridge.types';
import type { ProjectSessionService } from '../services/ProjectSessionService';
import type { ProviderDiscoveryService } from '../services/ProviderDiscoveryService';
import type { DesktopRunService } from '../services/DesktopRunService';
interface BridgeContext {
	session: ProjectSessionService;
	providers: ProviderDiscoveryService;
	runs: DesktopRunService;
	choose: () => Promise<string | null>;
	/** False once the client this bridge serves has ended: nothing more is written for it. */
	alive?: () => boolean;
}
async function writable(context: BridgeContext) {
	const { session } = context;
	if (session.busy || session.arbiter.held(session.root))
		throw new Error('Wait for the current run before changing planning artifacts.');
	const project = await session.mutable();
	if (context.alive && !context.alive()) throw new Error('This session has ended.');
	return project;
}
/** Planning writes of one repository happen one at a time, whichever client asks. */
function exclusive<T>(session: ProjectSessionService, work: () => Promise<T>): Promise<T> {
	return session.arbiter.exclusive(session.requireProject().root, work);
}
async function thread(context: BridgeContext, input: Parameters<DesktopBridge['openThread']>[0]) {
	const p = await writable(context),
		plan = (await p.planning.plans(p.revision.commit)).find((item) => item.id === input.entityId);
	if (!plan) {
		const unit = (await p.source.units(p.revision.commit)).find((u) => u.id === input.entityId);
		if (!unit) throw new Error('Unknown entity.');
		await p.planning.ensurePlan(unit);
	}
	return p.planning.openThread(input);
}
async function source(context: BridgeContext, input: Parameters<DesktopBridge['source']>[0]) {
	const adapter = context.session.requireProject().source,
		unit = (await adapter.units(input.commit)).find((u) => u.id === input.entityId);
	if (!unit) throw new Error('This draft has no registered source.');
	return adapter.source(unit, input.commit, input.path);
}
async function create(context: BridgeContext, input: Parameters<DesktopBridge['createPlan']>[0]) {
	const p = await writable(context),
		plan = await p.planning.createPlan(input),
		revision = await p.source.revision({ branch: p.revision.branch, commit: null });
	return p.catalog.entity(plan.id, revision.commit);
}
function authentication(session: ProjectSessionService) {
	return {
		hostedStatus: () =>
			session.auth?.status() ?? Promise.resolve({ configured: false, state: 'signed-out' }),
		connectHosted: async () => {
			if (!session.auth) throw new Error('Hosted sign-in is not configured.');
			return session.auth.connect();
		},
		disconnectHosted: () =>
			session.auth?.disconnect() ?? Promise.resolve({ configured: false, state: 'signed-out' })
	};
}
export function desktopBridge(context: BridgeContext): Omit<DesktopBridge, 'onRunEvent'> {
	const { session, providers, runs, choose } = context;
	const operations = new ProjectOperationsService(session);
	const deployments = new DeploymentService(session);
	const recorded = new RecordedEvidenceService(session);
	const bridge: Omit<DesktopBridge, 'onRunEvent'> = {
		deploymentStatus: (input) => deployments.status(input),
		deploymentProgress: (input) => deployments.progress(input),
		planDeployment: (input) => deployments.plan(input),
		deploy: (input) => deployments.deploy(input),
		...authentication(session),
		listProjects: () => operations.listProjects(),
		selectProject: (input) => operations.selectProject(input),
		capabilities: (input) => operations.capabilities(input),
		addComment: (input) => operations.addComment(input),
		pendingComments: (input) => operations.pendingComments(input),
		openProject: async () => {
			const root = await choose();
			return root ? session.open(root) : null;
		},
		snapshot: (input) => session.snapshot(input),
		entity: (input) => session.requireProject().catalog.entity(input.entityId, input.commit),
		source: (input) => source(context, input),
		image: (input) => new ProjectImageCacheService(session).read(input),
		evidence: (input) => recorded.evidence(input),
		artifact: (input) => recorded.artifact(input),
		createPlan: (input) => exclusive(session, () => create(context, input)),
		openThread: (input) => exclusive(session, () => thread(context, input)),
		messages: (input) =>
			session.requireProject().planning.messages(input.entityId, input.threadId, input.commit),
		approve: (input) =>
			exclusive(session, async () => (await writable(context)).planning.approve(input)),
		providers: () => providers.list(),
		startRun: (input) => runs.start(input),
		cancelRun: async (input) => runs.cancel(input.runId)
	};
	return new Proxy(bridge, {
		get(target, property: keyof typeof bridge) {
			const operation = target[property];
			if (typeof operation !== 'function') return operation;
			if (['openProject', 'selectProject', 'listProjects'].includes(property)) return operation;
			return async (input?: { projectId?: string }) => {
				session.assertProject(input?.projectId);
				session.pending++;
				try {
					return await (operation as (input: unknown) => Promise<unknown>)(input);
				} finally {
					session.pending--;
				}
			};
		}
	});
}
