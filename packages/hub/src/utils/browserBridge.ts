import { AgentHttpAdapter } from '../../../desktop/src/adapters/AgentHttpAdapter';
import { browserEvidenceReads } from './browserEvidenceReads';
import type { CommittedThread, ProjectSummary } from 'collaboration';
import type { DesktopBridge, SourceFile } from '$desktop/models/DesktopBridge.types';
import type { EntityDetail, ProjectSnapshot } from '$desktop/models/Desktop.types';
import type {
	CacheStatus,
	ProjectCapabilities,
	ProjectContext
} from '$desktop/models/ProjectContext.types';
import { commentEntries } from '$desktop/utils/commentEntries';
import type { BrowserApi } from './browserApi';

type Reads = Pick<
	DesktopBridge,
	'listProjects' | 'selectProject' | 'capabilities' | 'snapshot' | 'entity' | 'source'
> &
	Pick<DesktopBridge, 'image' | 'messages' | 'history' | 'evidence' | 'artifact'>;
type Listener = (event: CacheStatus) => void;
/** Runs a read of one project and, when it is refused, says so before the refusal is thrown. */
type Guard = <T>(context: ProjectContext, read: (base: string) => Promise<T>) => Promise<T>;
type Denied = Pick<
	DesktopBridge,
	'createPlan' | 'openThread' | 'approve' | 'providers' | 'startRun' | 'cancelRun'
>;

const refused = 'The hosted workspace shows projects and comments. It runs no agent.';
const refuse = () => Promise.reject(new Error(refused));

function base(input: ProjectContext): string {
	if (!input.projectId) throw new Error('Name the project this is asked for.');
	return `/api/projects/${encodeURIComponent(input.projectId)}`;
}

/**
 * Whatever a server states, a hosted project has no agent, plan or approval and is not
 * writable. Commenting is allowed only when the server says so.
 */
function hosted(snapshot: ProjectSnapshot): ProjectSnapshot {
	const stated = snapshot.capabilities;
	const capabilities: ProjectCapabilities = {
		comments: stated?.comments === true,
		agents: stated?.agents === true,
		planning: stated?.planning === true,
		approval: stated?.approval === true,
		source: 'github'
	};
	if (stated?.reason) capabilities.reason = stated.reason;
	return { ...snapshot, writable: snapshot.writable && capabilities.agents, capabilities };
}

/**
 * A refused read ends what may be shown: the session for 401, that one project for 403. The
 * page hears it before the read rejects, as it does from the desktop bridge.
 */
function guarded(listeners: Set<Listener>): Guard {
	return async (context, read) => {
		try {
			return await read(base(context));
		} catch (cause) {
			const status = (cause as { status?: number }).status;
			const projectId = status === 401 ? '$projects' : context.projectId;
			if ((status === 401 || status === 403) && projectId)
				for (const tell of listeners) tell({ projectId, status: 'denied' });
			throw cause;
		}
	};
}

function reads(
	api: BrowserApi,
	guard: Guard,
	report: (snapshot: ProjectSnapshot, query: Parameters<DesktopBridge['snapshot']>[0]) => void
): Reads {
	/** The branch last shown per project: the server reads an entity's history along it. */
	const branches = new Map<string, string>();
	const snapshot: DesktopBridge['snapshot'] = async (input) => {
		const { branch, commit } = input;
		const shown = hosted(
			await guard(input, (path) => api.get<ProjectSnapshot>(`${path}/snapshot`, { branch, commit }))
		);
		branches.set(input.projectId!, shown.revision.branch);
		report(shown, input);
		return shown;
	};
	return {
		listProjects: async () =>
			(await api.get<ProjectSummary[]>('/api/projects')).map(({ id, name }) => ({
				id,
				name,
				kind: 'shared'
			})),
		selectProject: (input) => snapshot({ ...input, branch: null, commit: null }),
		capabilities: async (input = {}) =>
			(await snapshot({ ...input, branch: null, commit: null })).capabilities!,
		snapshot,
		...browserEvidenceReads(api, guard),
		entity: async ({ entityId, commit, ...context }) => {
			const branch = branches.get(context.projectId ?? '');
			return guard(context, (path) =>
				api.get<EntityDetail>(`${path}/entity`, { entityId, commit, branch })
			);
		},
		source: async ({ entityId, commit, path: file, ...context }) =>
			guard(context, (path) =>
				api.get<SourceFile>(`${path}/source`, { entityId, commit, path: file })
			),
		image: async ({ entityId, commit, version, sha256, ...context }) =>
			guard(context, (path) => api.bytes(`${path}/image`, { entityId, commit, version, sha256 })),
		messages: (input) => messages(api, guard, input),
		/** Further pages of an entity's history, along the branch and at the commit in view. */
		history: async ({ entityId, commit, page, branch, ...context }) =>
			guard(context, (path) =>
				api.get(`${path}/history`, {
					entityId,
					commit,
					branch,
					page: String(page)
				})
			)
	};
}

/** Refused here, without a request: the hosted app has no executor to ask. */
function denied(): Denied {
	return {
		createPlan: refuse,
		openThread: refuse,
		approve: refuse,
		providers: refuse,
		startRun: refuse,
		cancelRun: refuse
	};
}

/**
 * The desktop bridge over the same-origin API of the hosted app. It reads projects and posts
 * human comments; the server binds each request to the signed-in person.
 */
export function browserBridge(api: BrowserApi): DesktopBridge {
	const listeners = new Set<Listener>();
	let selected = '';
	const agents = new AgentHttpAdapter((projectId, body) =>
		api.send('POST', `${base({ projectId })}/agent`, body)
	);
	const call = (method: string, input: unknown = {}) => agents.call(method, input, selected);
	return {
		...reads(api, guarded(listeners), (snapshot, query) => {
			selected = snapshot.project.id!;
			agents.shown(snapshot, query);
		}),
		onCacheStatus: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		...denied(),
		openProject: async () => null,
		/** A comment the server did not accept is an error. Nothing is kept as a pending draft. */
		pendingComments: async () => [],
		addComment: async (input) => {
			const { projectId, requestId, threadId, anchor, text } = input;
			const body = {
				projectId,
				requestId,
				anchor,
				text,
				...(threadId ? { threadId } : {})
			};
			const thread = await api.send<CommittedThread>('POST', `${base(input)}/comments`, body);
			return { kind: 'shared', projectId: projectId!, thread };
		},
		providers: () => call('providers') as ReturnType<DesktopBridge['providers']>,
		startRun: (input) => call('startRun', input) as ReturnType<DesktopBridge['startRun']>,
		cancelRun: (input) => call('cancelRun', input) as ReturnType<DesktopBridge['cancelRun']>,
		openThread: (input) => call('openThread', input) as ReturnType<DesktopBridge['openThread']>,
		approve: (input) => call('approve', input) as ReturnType<DesktopBridge['approve']>,
		onRunEvent: (listener) => agents.listen(listener)
	};
}

async function messages(
	api: BrowserApi,
	guard: Guard,
	input: Parameters<DesktopBridge['messages']>[0]
) {
	const { entityId, commit, threadId, ...context } = input;
	const threads = await guard(context, (path) =>
		api.get<CommittedThread[]>(`${path}/threads`, { entityId, commit })
	);
	const thread = threads.find((item) => item.id === threadId);
	return thread ? commentEntries(thread) : [];
}
