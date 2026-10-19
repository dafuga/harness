/**
 * The one channel the main process answers over IPC: the bootstrap of the caller's own loopback
 * socket. Every project operation and the control port travel over that socket.
 */
export const bootstrapChannel = 'transport:bootstrap';

/** `ipcMain`, or a stand-in. */
export interface DesktopIpcPort {
	handle(channel: string, listener: (event: unknown) => Promise<unknown>): unknown;
	removeHandler(channel: string): unknown;
}

export { desktopIpc } from '../initializers/initialize-desktop/desktopIpc';
