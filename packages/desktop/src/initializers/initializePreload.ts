import type { CacheStatus } from '../models/ProjectContext.types';
import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge, RunEvent } from '../models/DesktopBridge.types';
import type {
	LocalBootstrap,
	RemoteBinary,
	RemoteConnectionEvent,
	RemoteDesktopControl,
	RemoteMethod
} from '../../../remote/src/index';
import { LocalTransportClientService } from '../services/LocalTransportClientService';
import type { LocalSocketPort } from '../services/LocalTransportClientService';
import { binaryArtifact } from '../utils/binaryArtifact';
import { bootstrapChannel } from '../utils/desktopIpc';
import { remoteBinary } from '../utils/remoteBinary';
/**
 * The page talks to the main process over a loopback socket. Its one-use ticket is asked for
 * here, over IPC, and stays in this isolated world: the page gets the two objects below only.
 */
const transport = new LocalTransportClientService({
	bootstrap: () => ipcRenderer.invoke(bootstrapChannel) as Promise<LocalBootstrap>,
	open: (url, protocols) => new WebSocket(url, protocols) as unknown as LocalSocketPort
});
type Input = object | undefined;
const call =
	<T>(method: RemoteMethod) =>
	(input?: Input): Promise<T> =>
		transport.request<T>(method, { ...input });
const bridge: DesktopBridge = {
	history: call('history'),
	onCacheStatus: (listener) => transport.on('cache', (value) => listener(value as CacheStatus)),
	hostedStatus: call('hostedStatus'),
	connectHosted: call('connectHosted'),
	disconnectHosted: call('disconnectHosted'),
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
	startRun: call('startRun'),
	cancelRun: call('cancelRun'),
	onRunEvent: (listener) => transport.on('run', (value) => listener(value as RunEvent))
};
/** The control port of remote access: public metadata in, public metadata out. */
const remote: RemoteDesktopControl = {
	status: call('remote.status'),
	enable: call('remote.enable'),
	disable: call('remote.disable'),
	createPairing: call('remote.createPairing'),
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
