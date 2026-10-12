import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { channels } from '../models/DesktopBridge.types';
import type { DesktopBridge } from '../models/DesktopBridge.types';
import { NavigationValidator } from '../validators/NavigationValidator';
import { IpcRequestValidator } from '../validators/IpcRequestValidator';
export function trustedSender(
	event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>,
	window: BrowserWindow
): boolean {
	return (
		event.sender === window.webContents &&
		event.senderFrame === window.webContents.mainFrame &&
		new NavigationValidator().validate(event.senderFrame?.url)
	);
}
export function desktopIpc(
	window: BrowserWindow,
	bridge: Omit<DesktopBridge, 'onRunEvent'>
): () => void {
	const validator = new IpcRequestValidator();
	Object.entries(channels).forEach(([name, channel]) => {
		ipcMain.handle(channel, async (event, input: unknown) => {
			if (!trustedSender(event, window)) throw new Error('Untrusted renderer.');
			const value = validator.parse(channel, input);
			const method = bridge[name as keyof typeof bridge] as (value: unknown) => Promise<unknown>;
			if (typeof method !== 'function') throw new Error('Desktop operation unavailable.');
			return method(value);
		});
	});
	return () => Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
}
