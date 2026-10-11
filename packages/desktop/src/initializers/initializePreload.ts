import { contextBridge, ipcRenderer } from 'electron';
import { channels, runEventChannel } from '../models/DesktopBridge.types';
import type { DesktopBridge, RunEvent } from '../models/DesktopBridge.types';
const bridge: DesktopBridge = {
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
