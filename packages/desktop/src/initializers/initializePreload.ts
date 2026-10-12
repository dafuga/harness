import type { CacheStatus } from '../models/ProjectContext.types';
import { contextBridge, ipcRenderer } from 'electron';
import { channels, runEventChannel, cacheEventChannel } from '../models/DesktopBridge.types';
import type { DesktopBridge, RunEvent } from '../models/DesktopBridge.types';
const bridge: DesktopBridge = {
	history: (input) => ipcRenderer.invoke(channels.history, input),
	onCacheStatus: (listener) => {
		const handler = (_event: unknown, value: CacheStatus) => listener(value);
		ipcRenderer.on(cacheEventChannel, handler);
		return () => ipcRenderer.removeListener(cacheEventChannel, handler);
	},
	hostedStatus: () => ipcRenderer.invoke(channels.hostedStatus),
	connectHosted: () => ipcRenderer.invoke(channels.connectHosted),
	disconnectHosted: () => ipcRenderer.invoke(channels.disconnectHosted),
	listProjects: () => ipcRenderer.invoke(channels.listProjects),
	selectProject: (input) => ipcRenderer.invoke(channels.selectProject, input),
	capabilities: (input) => ipcRenderer.invoke(channels.capabilities, input),
	addComment: (input) => ipcRenderer.invoke(channels.addComment, input),
	pendingComments: (input) => ipcRenderer.invoke(channels.pendingComments, input),
	openProject: () => ipcRenderer.invoke(channels.openProject),
	snapshot: (input) => ipcRenderer.invoke(channels.snapshot, input),
	entity: (input) => ipcRenderer.invoke(channels.entity, input),
	source: (input) => ipcRenderer.invoke(channels.source, input),
	image: async (input) => new Uint8Array(await ipcRenderer.invoke(channels.image, input)),
	createPlan: (input) => ipcRenderer.invoke(channels.createPlan, input),
	openThread: (input) => ipcRenderer.invoke(channels.openThread, input),
	messages: (input) => ipcRenderer.invoke(channels.messages, input),
	approve: (input) => ipcRenderer.invoke(channels.approve, input),
	providers: () => ipcRenderer.invoke(channels.providers),
	startRun: (input) => ipcRenderer.invoke(channels.startRun, input),
	cancelRun: (input) => ipcRenderer.invoke(channels.cancelRun, input),
	onRunEvent: (listener) => {
		const handler = (_event: unknown, value: RunEvent) => listener(value);
		ipcRenderer.on(runEventChannel, handler);
		return () => ipcRenderer.removeListener(runEventChannel, handler);
	}
};
export function initializePreload(): void {
	contextBridge.exposeInMainWorld('harness', Object.freeze(bridge));
}
initializePreload();
