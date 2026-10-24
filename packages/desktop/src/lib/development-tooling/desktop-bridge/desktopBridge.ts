import { GameLevelService } from './GameLevelService';
import type { BridgeContext } from './desktopBridge.types';
import { GameImageService } from './GameImageService';
import { GameProjectService } from './GameProjectService';
import { GameRenderService } from './GameRenderService';
import { DeploymentService } from '../../../services/DeploymentService';
import { repositoryLease } from '../../../utils/development-tooling/repositoryLease';
import { ProjectImageCacheService } from './ProjectImageCacheService';
import { ProjectOperationsService } from './ProjectOperationsService';
import { RecordedEvidenceService } from './RecordedEvidenceService';
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import type { DeploymentBridge } from '../../../models/Deployment.types';
import type { GameDesktopBridge } from '../../../models/game-authoring/GameDesktopBridge.types';
const projectIndependentMethods: Array<keyof DesktopBridge> = [
	'openProject',
	'selectProject',
	'listProjects',
	'deploymentActivities',
	'gameCreate'
];
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
	const root = session.requireProject().root;
	return session.arbiter.exclusive(root, async () => {
		const release = await repositoryLease(root);
		if (!release)
			throw new Error('Wait for the current run or planning write in this or another Harness app.');
		try {
			release.signal.throwIfAborted();
			const value = await work();
			release.signal.throwIfAborted();
			return value;
		} finally {
			await release();
		}
	});
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
	const recorded = new RecordedEvidenceService(session);
	const bridge: Omit<DesktopBridge, 'onRunEvent'> = {
		...deploymentOperations(session),
		...gameOperations(context),
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
			if (projectIndependentMethods.includes(property)) return operation;
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
function deploymentOperations(session: ProjectSessionService): DeploymentBridge {
	const deployments = new DeploymentService(session);
	return {
		deploymentStatus: (input) => deployments.status(input),
		deploymentActivities: async () => deployments.activities(),
		startDeployment: (input) => deployments.start(input),
		deploymentProgress: (input) => deployments.progress(input),
		planDeployment: (input) => deployments.plan(input),
		deploy: (input) => deployments.deploy(input)
	};
}

function gameOperations(context: BridgeContext): Required<GameDesktopBridge> {
	const { session, providers } = context;
	const levels = new GameLevelService(session, providers);
	const images = new GameImageService(session);
	const game = new GameProjectService(session),
		render = new GameRenderService(session);
	return {
		gameCreate: (input) => game.create(input),
		gameLevelGenerate: (input) => levels.generate(input),
		gameImageGenerate: (input) => images.generate(input),
		gameImageRead: (input) => images.read(input),
		gameRead: (input) => game.read(input),
		gameSave: (input) => game.save(input),
		gameRender: (input) => render.start(input)
	};
}
