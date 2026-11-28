// @harness-uid u_u5ye4kbgg5
import type {
	InboxReply,
	InboxWriteReceipt,
	TrackerInboxSource
} from '../../../models/development-tooling/TrackerInbox.types';
import type { Input } from './initializePreload.types';
import type { CacheStatus } from '../../../models/projects-sessions/ProjectContext.types';
import { contextBridge, ipcRenderer } from 'electron';
import type {
	DesktopBridge,
	RunEvent
} from '../../../models/development-tooling/DesktopBridge.types';
import type {
	LocalBootstrap,
	RemoteBinary,
	RemoteConnectionEvent,
	RemoteDesktopControl,
	RemoteMethod
} from '../../../../../remote/src/index';
import { watchLocalTracker } from './watchLocalTracker';
import { LocalTransportClientService } from './LocalTransportClientService';
import type { LocalSocketPort } from './LocalTransportClientService';
import { binaryArtifact } from '../../../utils/reports-media/binaryArtifact';
import { bootstrapChannel } from '../../../utils/agents-providers/desktopIpc';
import { remoteBinary } from '../../../utils/networking-security/remoteBinary';
/**
 * The page talks to the main process over a loopback socket. Its one-use ticket is asked for
 * here, over IPC, and stays in this isolated world: the page gets the two objects below only.
 */
const transport = new LocalTransportClientService({
	bootstrap: () => ipcRenderer.invoke(bootstrapChannel) as Promise<LocalBootstrap>,
	open: (url, protocols) => new WebSocket(url, protocols) as unknown as LocalSocketPort
});
const call =
	<T>(method: RemoteMethod) =>
	(input?: Input): Promise<T> =>
		transport.request<T>(method, { ...input });
const unavailable: InboxReply<never> = {
	code: 'unavailable',
	freshness: 'unavailable',
	lastSyncedAt: null,
	partial: true
};
const inboxRead = <T>(input: Input): Promise<InboxReply<T>> =>
	call<InboxReply<T>>('trackerInboxRead')(input).catch(() => unavailable);
const trackerInbox: TrackerInboxSource = {
	overview: () => inboxRead({ operation: 'overview' }),
	search: (query) => inboxRead({ operation: 'search', query }),
	detail: (id) => inboxRead({ operation: 'detail', id }),
	write: (write) =>
		call<InboxReply<InboxWriteReceipt>>('trackerInboxWrite')(write).catch(() => unavailable),
	writes: async () => ({
		freshness: 'current',
		lastSyncedAt: null,
		partial: false,
		value: []
	}),
	discard: async () => unavailable,
	watch: (listener) => watchLocalTracker(transport, inboxRead, listener)
};
const bridge: DesktopBridge = {
	gameCreate: call('gameCreate'),
	gameImageGenerate: call('gameImageGenerate'),
	gameLevelGenerate: call('gameLevelGenerate'),
	gameImageRead: call('gameImageRead'),
	gameRead: call('gameRead'),
	gameSave: call('gameSave'),
	gameRender: call('gameRender'),
	deploymentStatus: call('deploymentStatus'),
	deploymentActivities: call('deploymentActivities'),
	startDeployment: call('startDeployment'),
	deploymentProgress: call('deploymentProgress'),
	planDeployment: call('planDeployment'),
	deploy: call('deploy'),
	history: call('history'),
	onCacheStatus: (listener) => transport.on('cache', (value) => listener(value as CacheStatus)),
	hostedStatus: call('hostedStatus'),
	connectHosted: call('connectHosted'),
	disconnectHosted: call('disconnectHosted'),
	projectOverview: call('projectOverview'),
	homeSnapshot: call('homeSnapshot'),
	homeChat: call('homeChat'),
	homeOutgoing: { read: call('outgoingDrafts'), write: call('outgoingDrafts') },
	trackerInbox,
	listProjects: call('listProjects'),
	selectProject: call('selectProject'),
	capabilities: call('capabilities'),
	addComment: call('addComment'),
	pendingComments: call('pendingComments'),
	openProject: call('openProject'),
	snapshot: call('snapshot'),
	entity: call('entity'),
	source: call('source'),
	image: async (input) => remoteBinary(await call<RemoteBinary>('image')(input)),
	evidence: call('evidence'),
	artifact: async (input) => binaryArtifact(await call<RemoteBinary>('artifact')(input)),
	createPlan: call('createPlan'),
	openThread: call('openThread'),
	messages: call('messages'),
	approve: call('approve'),
	providers: call('providers'),
	agentActivity: call('agentActivity'),
	designCanvases: call('designCanvases'),
	startRun: call('startRun'),
	cancelRun: call('cancelRun'),
	onRunEvent: (listener) => transport.on('run', (value) => listener(value as RunEvent))
};
/** The control port of remote access: public metadata in, public metadata out. */
const remote: RemoteDesktopControl = {
	status: call('remote.status'),
	enable: call('remote.enable'),
	disable: call('remote.disable'),
	approvePairing: call('remote.approvePairing'),
	denyPairing: call('remote.denyPairing'),
	revokeDevice: call('remote.revokeDevice'),
	onStatus: (listener) =>
		transport.on('connection', (value) => {
			const event = value as RemoteConnectionEvent;
			if (event.kind === 'remote-status') listener(event.status);
		})
};
export function initializePreload(): void {
	contextBridge.exposeInMainWorld('harness', Object.freeze(bridge));
	contextBridge.exposeInMainWorld('harnessRemote', Object.freeze(remote));
}
initializePreload();
