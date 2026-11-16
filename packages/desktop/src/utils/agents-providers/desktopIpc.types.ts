// @harness-uid u_dzcerery3f
import type { IpcMainInvokeEvent } from 'electron';

/** `ipcMain`, or a stand-in. */
export interface DesktopIpcPort {
	handle(channel: string, listener: (event: IpcMainInvokeEvent) => Promise<unknown>): unknown;
	removeHandler(channel: string): unknown;
}
