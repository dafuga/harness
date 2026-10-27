import type { Listener } from './desktop-startup.test.types';
import { beforeEach, expect, test, vi } from 'vitest';
import { tmpdir } from 'node:os';
/** Electron as the main process sees it: app events, one window, its page and native dialogs. */
const state = vi.hoisted(() => {
	const listeners = () => {
		const map = new Map<string, Listener>();
		return { map, on: (event: string, listener: Listener) => void map.set(event, listener) };
	};
	const app = listeners(),
		windows: { contents: ReturnType<typeof listeners>; own: ReturnType<typeof listeners> }[] = [];
	return {
		app,
		windows,
		listeners,
		lock: vi.fn(() => true),
		quit: vi.fn(),
		on: vi.fn(app.on),
		ready: vi.fn(() => new Promise<void>(() => undefined)),
		choose: vi.fn(() => 0),
		host: { enabled: vi.fn(() => false), stop: vi.fn(async () => undefined) },
		transport: { close: vi.fn(async () => undefined) },
		expose: vi.fn((_name: string, _value: unknown) => undefined),
		request: vi.fn(async (_method: string, _input: unknown) => ({
			queueCommit: null,
			features: []
		}))
	};
});
/** A window as `new BrowserWindow()` makes it: its own events and those of its page. */
function browserWindow() {
	const window = { contents: state.listeners(), own: state.listeners() };
	state.windows.push(window);
	return {
		webContents: { on: window.contents.on, setWindowOpenHandler: vi.fn() },
		on: window.own.on,
		loadURL: vi.fn(async () => undefined)
	};
}
vi.mock('electron', () => ({
	app: {
		requestSingleInstanceLock: state.lock,
		quit: state.quit,
		on: state.on,
		whenReady: state.ready,
		getPath: () => tmpdir(),
		getAppPath: () => tmpdir()
	},
	BrowserWindow: browserWindow,
	contextBridge: { exposeInMainWorld: state.expose },
	dialog: { showMessageBoxSync: state.choose, showOpenDialog: vi.fn() },
	ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
	ipcRenderer: { invoke: vi.fn() },
	powerMonitor: { on: vi.fn() },
	protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
	safeStorage: { isEncryptionAvailable: () => false },
	shell: { openExternal: vi.fn() }
}));
vi.mock('../src/services/networking-security/remote-host-service/RemoteHostService', () => ({
	RemoteHostService: function RemoteHostService() {
		return {
			devices: {},
			enabled: state.host.enabled,
			stop: state.host.stop,
			start: vi.fn(async () => undefined),
			onStatus: vi.fn(),
			suspend: vi.fn(),
			resume: vi.fn(),
			screen: vi.fn()
		};
	}
}));
vi.mock('../src/services/LocalTransportService', () => ({
	LocalTransportService: function LocalTransportService() {
		return {
			listen: vi.fn(async () => 4321),
			close: state.transport.close,
			bootstrap: vi.fn(),
			forget: vi.fn()
		};
	}
}));
vi.mock(
	'../src/lib/development-tooling/preload-initialization/LocalTransportClientService',
	() => ({
		LocalTransportClientService: function LocalTransportClientService() {
			return { request: state.request, on: vi.fn() };
		}
	})
);
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	state.app.map.clear();
	state.windows.length = 0;
	state.lock.mockReturnValue(true);
	state.ready.mockImplementation(() => new Promise<void>(() => undefined));
});
/** The app once its window is open, as a person meets it. */
async function started() {
	state.ready.mockImplementation(async () => undefined);
	await import('../src/initializers/initializeDesktop');
	await vi.waitFor(() => expect(state.windows).toHaveLength(1));
	return state.windows[0];
}
const event = () => ({ preventDefault: vi.fn() });
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

test('preload exposes the selected project Work reader over the local transport', async () => {
	await import('../src/lib/development-tooling/preload-initialization/initializePreload');
	const bridge = state.expose.mock.calls.find(([name]) => name === 'harness')?.[1] as {
		projectWork?: (input: { projectId: string }) => Promise<unknown>;
		prepareFeaturePlan?: (input: object) => Promise<unknown>;
		selectFeaturePlan?: (input: object) => Promise<unknown>;
		approveFeaturePlan?: (input: object) => Promise<unknown>;
	};
	expect(bridge.projectWork).toBeTypeOf('function');
	await expect(bridge.projectWork!({ projectId: 'project-a' })).resolves.toEqual({
		queueCommit: null,
		features: []
	});
	expect(state.request).toHaveBeenCalledWith('projectWork', { projectId: 'project-a' });
	const preparation = {
		projectId: 'project-a',
		sourceCommit: 'a'.repeat(40),
		originalRequest: 'Improve the page.',
		proposal: {
			feature: 'feature',
			sourceCommit: 'a'.repeat(40),
			goal: 'Improve the page.',
			tldr: 'Design then build.',
			changes: [],
			tasks: []
		},
		pageDesigns: []
	};
	expect(bridge.prepareFeaturePlan).toBeTypeOf('function');
	await bridge.prepareFeaturePlan!(preparation);
	expect(state.request).toHaveBeenCalledWith('prepareFeaturePlan', preparation);
	const selection = {
		projectId: 'project-a',
		feature: 'feature',
		page: 'page',
		option: 'o1',
		expectedDigest: 'a'.repeat(64)
	};
	const approval = {
		projectId: 'project-a',
		feature: 'feature',
		reviewer: 'Daniel',
		expectedDigest: 'b'.repeat(64)
	};
	expect(bridge.selectFeaturePlan).toBeTypeOf('function');
	expect(bridge.approveFeaturePlan).toBeTypeOf('function');
	await bridge.selectFeaturePlan!(selection);
	await bridge.approveFeaturePlan!(approval);
	expect(state.request).toHaveBeenCalledWith('selectFeaturePlan', selection);
	expect(state.request).toHaveBeenCalledWith('approveFeaturePlan', approval);
});

test('only the first app instance reaches readiness and backend startup', async () => {
	await import('../src/initializers/initializeDesktop');
	expect(state.lock).toHaveBeenCalledOnce();
	expect(state.ready).toHaveBeenCalledOnce();
	expect(state.lock.mock.invocationCallOrder[0]).toBeLessThan(
		state.ready.mock.invocationCallOrder[0]
	);
	expect(state.on.mock.calls.map(([event]) => event)).toContain('second-instance');
});

test('a second app instance quits before readiness or any backend can start', async () => {
	state.lock.mockReturnValue(false);
	await import('../src/initializers/initializeDesktop');
	expect(state.quit).toHaveBeenCalledOnce();
	expect(state.ready).not.toHaveBeenCalled();
});

test('a page that refuses to unload asks natively: Stay keeps it, Discard lets it go', async () => {
	const window = await started(),
		refused = window.contents.map.get('will-prevent-unload');
	expect(refused, 'unsaved work must reach a native Stay or Discard choice').toBeTypeOf('function');
	const stay = event();
	state.choose.mockReturnValueOnce(0);
	refused!(stay);
	expect(stay.preventDefault).not.toHaveBeenCalled();
	const discard = event();
	state.choose.mockReturnValueOnce(1);
	refused!(discard);
	expect(discard.preventDefault).toHaveBeenCalledOnce();
	const [, options] = state.choose.mock.calls[0] as unknown as [unknown, { buttons: string[] }];
	expect(options.buttons).toEqual(['Stay', 'Discard']);
});

test('quit ends the backend only after every window agreed to close', async () => {
	await started();
	const asked = event();
	state.app.map.get('before-quit')?.(asked);
	await settled();
	expect(asked.preventDefault).not.toHaveBeenCalled();
	expect(state.host.stop).not.toHaveBeenCalled();
	expect(state.transport.close).not.toHaveBeenCalled();
	const closing = event();
	state.app.map.get('will-quit')?.(closing);
	expect(closing.preventDefault).toHaveBeenCalledOnce();
	await vi.waitFor(() => expect(state.quit).toHaveBeenCalledOnce());
	expect(state.host.stop).toHaveBeenCalledOnce();
	expect(state.transport.close).toHaveBeenCalledOnce();
	const last = event();
	state.app.map.get('will-quit')?.(last);
	expect(last.preventDefault).not.toHaveBeenCalled();
	expect(state.host.stop).toHaveBeenCalledOnce();
});

test('closing the last window quits only when no phone depends on the computer', async () => {
	await started();
	state.host.enabled.mockReturnValueOnce(true);
	state.app.map.get('window-all-closed')?.();
	expect(state.quit).not.toHaveBeenCalled();
	state.app.map.get('window-all-closed')?.();
	expect(state.quit).toHaveBeenCalledOnce();
	expect(state.transport.close).not.toHaveBeenCalled();
});
