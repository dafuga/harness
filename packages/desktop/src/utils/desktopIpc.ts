import type { LocalBootstrap } from '../../../remote/src/index';

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

/** `bootstrap` answers for the trusted top frame of a window and returns null for anyone else. */
export function desktopIpc(
	port: DesktopIpcPort,
	bootstrap: (event: unknown) => LocalBootstrap | null
): () => void {
	port.handle(bootstrapChannel, async (event) => {
		const answer = bootstrap(event);
		if (!answer) throw new Error('Untrusted renderer.');
		return answer;
	});
	return () => port.removeHandler(bootstrapChannel);
}
