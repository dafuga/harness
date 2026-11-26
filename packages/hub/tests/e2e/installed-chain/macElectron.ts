/**
 * TEST ONLY. Stands in for Electron while the installed app's real main process runs under Node:
 * no window, and a profile in a temporary folder. "Encryption" here is only a plain copy.
 */
const profile = process.argv[3];
const ignore = () => undefined;

export const app = {
	isPackaged: false,
	commandLine: { hasSwitch: () => false },
	requestSingleInstanceLock: () => true,
	whenReady: () => Promise.resolve(),
	getPath: () => profile,
	getAppPath: () => profile,
	getName: () => 'Harness chain fixture',
	setName: ignore,
	setPath: ignore,
	on: ignore,
	quit: () => process.exit(0),
	exit: (code = 0) => process.exit(code)
};
export const safeStorage = {
	isEncryptionAvailable: () => true,
	getSelectedStorageBackend: () => 'gnome_libsecret',
	encryptString: (text: string) => Buffer.from(text),
	decryptString: (bytes: Buffer) => bytes.toString()
};
export class BrowserWindow {
	webContents = { on: ignore, send: ignore, setWindowOpenHandler: ignore };
	on = ignore;
	show = ignore;
	focus = ignore;
	isMinimized = () => false;
	loadURL = () => Promise.resolve();
}
export const protocol = { registerSchemesAsPrivileged: ignore, handle: () => Promise.resolve() };
export const ipcMain = { handle: ignore, on: ignore };
export const powerMonitor = { on: ignore };
export const shell = { openExternal: () => Promise.resolve() };
export const dialog = {
	showErrorBox: ignore,
	showMessageBox: () => Promise.resolve({ response: 0 }),
	showMessageBoxSync: () => 0,
	showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] })
};
