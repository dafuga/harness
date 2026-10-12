import { NativeConnectionService } from '../services/NativeConnectionService';
import { ProjectRegistryService } from '../services/ProjectRegistryService';
import { CommentOutboxService } from '../services/CommentOutboxService';
import { ProjectionCacheService } from '../services/ProjectionCacheService';
import { app, BrowserWindow, dialog, protocol, safeStorage, shell } from 'electron';
import { resolve } from 'node:path';
import { DesktopBridgeService } from '../services/DesktopBridgeService';
import { DesktopRunService } from '../services/DesktopRunService';
import { ProjectSessionService } from '../services/ProjectSessionService';
import { ProviderDiscoveryService } from '../services/ProviderDiscoveryService';
import { CodexAppServerAdapter } from '../adapters/CodexAppServerAdapter';
import { ClaudeCliAdapter } from '../adapters/ClaudeCliAdapter';
import { desktopIpc } from '../utils/desktopIpc';
import { rendererAssets } from '../utils/rendererAssets';
import { runEventChannel, cacheEventChannel } from '../models/DesktopBridge.types';
import { NavigationValidator } from '../validators/NavigationValidator';
protocol.registerSchemesAsPrivileged([
	{ scheme: 'harness', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
export async function initializeDesktop(): Promise<BrowserWindow> {
	await app.whenReady();
	await protocol.handle('harness', (request) =>
		rendererAssets(resolve(app.getAppPath(), 'build'), request.url)
	);
	const window = new BrowserWindow({
		title: 'Harness',
		width: 1500,
		height: 980,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: '#0c1923',
		webPreferences: {
			preload: resolve(app.getAppPath(), 'dist/preload.cjs'),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false
		}
	});
	window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
	const gate = new NavigationValidator();
	window.webContents.on('will-navigate', (event, url) => {
		if (!gate.validate(url)) event.preventDefault();
	});
	window.webContents.on('will-attach-webview', (event) => event.preventDefault());
	const session = projectSession(window),
		codex = new CodexAppServerAdapter(),
		providers = new ProviderDiscoveryService({ codex, claude: new ClaudeCliAdapter() });
	const runs = new DesktopRunService(session, providers, codex, (event) => {
		if (!window.isDestroyed()) window.webContents.send(runEventChannel, event);
	});
	const choose = async () => {
		const result = await dialog.showOpenDialog(window, {
			title: 'Open a Harness project',
			properties: ['openDirectory']
		});
		return result.canceled ? null : (result.filePaths[0] ?? null);
	};
	const release = desktopIpc(
		window,
		new DesktopBridgeService(session, providers, runs, choose).bridge()
	);
	window.on('closed', () => {
		runs.cancelActive();
		release();
	});
	await window.loadURL('harness://app/');
	return window;
}
function projectSession(window: BrowserWindow) {
	const directory = app.getPath('userData');
	const cache = new ProjectionCacheService(resolve(directory, 'cache/projections'));
	const connection = new NativeConnectionService().create(
		{
			origin: process.env.HARNESS_HUB_ORIGIN,
			onCacheStatus: (status) => {
				if (!window.isDestroyed()) window.webContents.send(cacheEventChannel, status);
			},
			file: resolve(directory, 'session.enc'),
			cache,
			open: (url) => shell.openExternal(url)
		},
		safeStorage
	);
	return new ProjectSessionService({
		registry: new ProjectRegistryService(resolve(directory, 'projects.json')),
		outbox: new CommentOutboxService(resolve(directory, 'outbox/comments.json')),
		cache,
		...connection
	});
}
void initializeDesktop().catch((error: unknown) => {
	console.error(error);
	app.exit(1);
});
app.on('window-all-closed', () => app.quit());
