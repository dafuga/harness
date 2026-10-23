/** `ipcMain`, or a stand-in. */
export interface DesktopIpcPort {
	handle(channel: string, listener: (event: unknown) => Promise<unknown>): unknown;
	removeHandler(channel: string): unknown;
}
