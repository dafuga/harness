import { NativeConnectionService } from '../../services/NativeConnectionService';
import { ProjectRegistryService } from '../../services/ProjectRegistryService';
import { CommentOutboxService } from '../../services/CommentOutboxService';
import { ProjectionCacheService } from '../../services/projection-cache-service/ProjectionCacheService';
import {
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	powerMonitor,
	protocol,
	safeStorage,
	shell
} from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { resolve } from 'node:path';
import type { LocalBootstrap } from '../../../../remote/src/index';
import { LocalClientService } from '../../services/LocalClientService';
import type { LocalControl } from '../../services/LocalOperationsService';
import { LocalTransportService } from '../../services/LocalTransportService';
import { ProviderDiscoveryService } from '../../services/provider-discovery-service/ProviderDiscoveryService';
import { RemoteHostService } from '../../services/remote-host-service/RemoteHostService';
import { RemoteLifecycleService } from '../../services/RemoteLifecycleService';
import { RepositoryArbiterService } from '../../services/RepositoryArbiterService';
import { CodexAppServerAdapter } from '../../adapters/codex-app-server-adapter/CodexAppServerAdapter';
import { ClaudeCliAdapter } from '../../adapters/claude-cli-adapter/ClaudeCliAdapter';
import { NativeSessionAdapter } from '../../adapters/NativeSessionAdapter';
import { RelaySocketAdapter } from '../../adapters/RelaySocketAdapter';
import { RemoteHostStoreAdapter } from '../../adapters/RemoteHostStoreAdapter';
import { RemoteRegistrationAdapter } from '../../adapters/RemoteRegistrationAdapter';
import { confirmUnload } from './confirmUnload';
import { desktopIpc } from './desktopIpc';
import { rendererAssets } from './rendererAssets';
import { trustedSender } from './trustedSender';
import { NavigationValidator } from '../../validators/NavigationValidator';

protocol.registerSchemesAsPrivileged([
	{ scheme: 'harness', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

type Backend = ReturnType<typeof desktopBackend>;

/** The window, while there is one, and the client the main process keeps for it. */
const windows: { current: { window: BrowserWindow; client: LocalClientService } | null } = {
	current: null
};

export async function initializeDesktop(): Promise<BrowserWindow | null> {
	if (!app.requestSingleInstanceLock()) {
		app.quit();
		return null;
	}
	app.on('second-instance', () => {
		const window = windows.current?.window;
		if (window?.isMinimized()) window.restore();
		window?.show();
		window?.focus();
	});
	await app.whenReady();
	const backend = desktopBackend(),
		port = await backend.transport.listen(),
		assets = resolve(app.getAppPath(), 'build');
	await protocol.handle('harness', (request) =>
		rendererAssets(assets, request.url, `ws://127.0.0.1:${port}`)
	);
	desktopIpc(ipcMain, (event) => bootstrap(backend, event));
	appLifecycle(backend);
	await backend.remote.start();
	return openWindow(backend);
}

/** A ticket for the loopback socket: for the trusted top frame of the open window, nobody else. */
function bootstrap(backend: Backend, event: unknown): LocalBootstrap | null {
	const open = windows.current,
		trusted = open !== null && trustedSender(event as IpcMainInvokeEvent, open.window);
	return open && trusted ? backend.transport.bootstrap(open.client) : null;
}

/**
 * Everything that outlives a window: the loopback transport, remote access with the sessions of
 * approved phones, and what every client shares: registry, outbox, cache and repository locks.
 */
function desktopBackend() {
	const directory = app.getPath('userData'),
		origin = process.env.HARNESS_HUB_ORIGIN,
		sessionFile = resolve(directory, 'session.enc');
	const cache = new ProjectionCacheService(resolve(directory, 'cache/projections')),
		registry = new ProjectRegistryService(resolve(directory, 'projects.json')),
		outbox = new CommentOutboxService(resolve(directory, 'outbox/comments.json')),
		arbiter = new RepositoryArbiterService();
	const connection = new NativeConnectionService().create(
		{
			origin,
			onCacheStatus: (status) => windows.current?.client.emit('cache', status),
			file: sessionFile,
			cache,
			open: (url) => shell.openExternal(url)
		},
		safeStorage
	);
	const codex = new CodexAppServerAdapter(),
		providers = new ProviderDiscoveryService({ codex, claude: new ClaudeCliAdapter() }),
		stores = { registry, outbox, arbiter, providers, generator: codex, cache };
	const hosted = new NativeSessionAdapter(sessionFile, safeStorage),
		registration = new RemoteRegistrationAdapter({ origin, credentials: () => hosted.read() }),
		sockets = new RelaySocketAdapter(),
		screen: { locked?: boolean } = {};
	const remote = new RemoteHostService({
		store: new RemoteHostStoreAdapter({
			file: resolve(directory, 'remote.enc'),
			encryption: safeStorage
		}),
		register: (input) => registration.register(input),
		open: (url, headers) => sockets.open(url, headers),
		shared: stores,
		locked: () => screen.locked
	});
	remote.onStatus((status) =>
		windows.current?.client.emit('connection', { kind: 'remote-status', status })
	);
	const lifecycle = new RemoteLifecycleService({
		power: { on: (event, listener) => powerMonitor.on(event as 'suspend', listener) },
		host: remote,
		cancelLocal: () => windows.current?.client.cancel(),
		screen: (locked) => {
			screen.locked = locked;
			remote.screen(locked);
		}
	});
	lifecycle.start();
	const transport = new LocalTransportService();
	return { shared: { ...stores, ...connection }, remote, lifecycle, transport };
}

/**
 * Closing the window keeps an enabled remote backend alive. Quit ends it and every run, but only
 * once every window agreed to close: one that keeps unsaved work cancels the quit, backend intact.
 */
function appLifecycle(backend: Backend): void {
	let quitting = false;
	app.on('window-all-closed', () => {
		if (backend.lifecycle.windowsClosed() === 'quit') app.quit();
	});
	app.on('activate', () => {
		if (!windows.current && !quitting) void openWindow(backend);
	});
	app.on('will-quit', (event) => {
		if (quitting) return;
		quitting = true;
		event.preventDefault();
		void backend.lifecycle
			.quit()
			.then(() => backend.transport.close())
			.finally(() => app.quit());
	});
}

function remoteControl(remote: RemoteHostService): LocalControl {
	const { devices } = remote;
	return {
		status: () => remote.status(),
		enable: () => remote.enable(),
		disable: () => remote.disable(),
		createPairing: () => devices.createPairing(),
		closePairing: () => devices.closePairing(),
		approvePairing: (input) => devices.approvePairing(input),
		denyPairing: (input) => devices.denyPairing(input),
		revokeDevice: (input) => devices.revokeDevice(input)
	};
}

async function openWindow(backend: Backend): Promise<BrowserWindow> {
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
	confirmUnload(window, dialog);
	const gate = new NavigationValidator();
	window.webContents.on('will-navigate', (event, url) => {
		if (!gate.validate(url)) event.preventDefault();
	});
	window.webContents.on('will-attach-webview', (event) => event.preventDefault());
	const choose = async () => {
		const result = await dialog.showOpenDialog(window, {
			title: 'Open a Harness project',
			properties: ['openDirectory']
		});
		return result.canceled ? null : (result.filePaths[0] ?? null);
	};
	/* The window's own client: its session and runs, served over the loopback socket. */
	const control = remoteControl(backend.remote),
		client = new LocalClientService({ shared: backend.shared, choose, control });
	windows.current = { window, client };
	window.on('closed', () => {
		client.end();
		backend.transport.forget(client);
		if (windows.current?.window === window) windows.current = null;
	});
	await window.loadURL('harness://app/');
	return window;
}

void initializeDesktop().catch((error: unknown) => {
	console.error(error);
	app.exit(1);
});
