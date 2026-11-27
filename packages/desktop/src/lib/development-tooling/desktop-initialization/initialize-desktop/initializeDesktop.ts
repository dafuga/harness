// @harness-uid u_3en7p2purk
import type { Backend } from './initializeDesktop.types';
import { NativeConnectionService } from '../NativeConnectionService';
import { ProjectRegistryService } from '../../../../services/projects-sessions/ProjectRegistryService';
import { CommentOutboxService } from '../../../../services/projects-sessions/CommentOutboxService';
import { ProjectionCacheService } from '../projection-cache-service/ProjectionCacheService';
import { startTrackerRealtime } from '../tracker-realtime/startTrackerRealtime';
import { createTrackerOverviewPublisher } from '../tracker-overview-publisher/createTrackerOverviewPublisher';
import { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { resolve } from 'node:path';
import type { LocalBootstrap } from '../../../../../../remote/src/index';
import { LocalClientService } from '../LocalClientService';
import { LocalTransportService } from '../../../../services/LocalTransportService';
import { ProviderDiscoveryService } from '../../../../services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import { RepositoryArbiterService } from '../../../../services/projects-sessions/RepositoryArbiterService';
import { CodexAppServerAdapter } from '../../../../adapters/agents-providers/codex-app-server-adapter/CodexAppServerAdapter';
import { ClaudeCliAdapter } from '../../../../adapters/agents-providers/claude-cli-adapter/ClaudeCliAdapter';
import { desktopRemote } from './desktopRemote';
import { chooseProject } from './chooseProject';
import { confirmUnload } from './confirmUnload';
import { desktopIpc } from './desktopIpc';
import { remoteControl } from './remoteControl';
import { rendererAssets } from './rendererAssets';
import { trustedSender } from './trustedSender';
import { prepareDesktopStorage, preserveMacProfile } from './macSafeStorage';
import { guardDesktopNavigation } from './guardDesktopNavigation';

protocol.registerSchemesAsPrivileged([
	{ scheme: 'harness', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

/** The window, while there is one, and the client the main process keeps for it. */
const windows: { current: { window: BrowserWindow; client: LocalClientService } | null } = {
	current: null
};

export async function initializeDesktop(): Promise<BrowserWindow | null> {
	preserveMacProfile(app);
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
	if (!(await prepareDesktopStorage(app))) return null;
	const backend = desktopBackend(),
		port = await backend.transport.listen(),
		assets = resolve(app.getAppPath(), 'build');
	await protocol.handle('harness', (request) =>
		rendererAssets(assets, request.url, `ws://127.0.0.1:${port}`)
	);
	desktopIpc(ipcMain, (event) => bootstrap(backend, event));
	appLifecycle(backend);

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
	const codex = new CodexAppServerAdapter(),
		providers = new ProviderDiscoveryService({ codex, claude: new ClaudeCliAdapter() }),
		stores = { registry, outbox, arbiter, providers, cache };
	const { remote, lifecycle, home, homeChat } = desktopRemote({
		directory,
		origin,
		sessionFile,
		stores,
		onStatus: (status) =>
			windows.current?.client.emit('connection', { kind: 'remote-status', status }),
		cancelLocal: () => windows.current?.client.cancel()
	});
	const { authority, ...connection } = new NativeConnectionService().create(
		{
			origin,
			onSignIn: (ownerId) => remote.linkAccount(ownerId),
			onDisconnect: () => remote.account.end(),
			onCacheStatus: (status) => windows.current?.client.emit('cache', status),
			file: sessionFile,
			cache,
			open: (url) => shell.openExternal(url)
		},
		safeStorage
	);
	const transport = new LocalTransportService();
	const publisher = createTrackerOverviewPublisher({ authority, env: process.env });
	publisher?.start();
	const stopRealtime = startTrackerRealtime({
		publisher,
		authority,
		env: process.env,
		emit: (event) => windows.current?.client.emit('tracker', event)
	});
	const refreshAccount = () => void connection.auth?.status().catch(() => undefined);
	refreshAccount();
	const accountTimer = connection.auth ? setInterval(refreshAccount, 60_000).unref() : undefined;
	return {
		shared: { ...stores, ...connection, home, homeChat },
		remote,
		lifecycle,
		transport,
		publisher,
		stopRealtime,
		accountTimer
	};
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
		backend.publisher?.stop();
		backend.stopRealtime();
		clearInterval(backend.accountTimer);
		void backend.lifecycle
			.quit()
			.then(() => backend.transport.close())
			.finally(() => app.quit());
	});
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
	guardDesktopNavigation(window.webContents);
	confirmUnload(window, dialog);
	const choose = () => chooseProject(window, dialog);
	/* The window's own client: its session and runs, served over the loopback socket. */
	const control = remoteControl(backend.remote),
		client = new LocalClientService({
			shared: backend.shared,
			choose,
			control,
			accountRequired: app.isPackaged || Boolean(backend.shared.auth)
		});
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

export type { desktopBackend };
