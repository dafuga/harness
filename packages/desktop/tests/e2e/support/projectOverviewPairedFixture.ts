import type { Page } from '@playwright/test';
import { overviewSnapshot } from './projectOverviewNativeFixture';
import type {
	PairedAccountCall,
	PairedInstall,
	PairedMode,
	PairedPhoneHost,
	PairedPlugin,
	PairedShell
} from './projectOverviewPairedFixture.types';

/**
 * SYNTHETIC ADAPTER FIXTURE. A page that believes it runs in the Capacitor iOS shell, whose paired
 * computer and whose phone account are both imitated here. No socket, token, credential or real
 * person exists: the account is a fixture owner and the overview is the synthetic snapshot.
 *
 * The page runs the helpers below as one init script. Each helper is a top-level function
 * declaration that receives everything it needs as arguments and reads nothing of this module,
 * so the serialized script does not depend on the order in which the helpers are written.
 */

function pairedReply(status: number, body: unknown) {
	return { status, contentType: 'application/json', data: btoa(JSON.stringify(body)) };
}

function pairedRemoteStatus(state: string) {
	const paired = state === 'online';
	const unpaired = state === 'unpaired';
	return {
		state,
		origin: unpaired ? null : 'https://fixture.invalid',
		host: unpaired ? null : { id: 'a1'.repeat(20), name: 'Synthetic Mac' },
		device: unpaired ? null : { id: 'd'.repeat(40), name: 'Synthetic Phone' },
		grant: paired ? { projects: [], agents: false } : null,
		reason: null,
		lastOnlineAt: null
	};
}

function pairedShell(mode: PairedMode): PairedShell {
	const state = mode === 'unpaired' ? 'unpaired' : mode === 'revoked' ? 'revoked' : 'online';
	return { state, reads: 0, serial: 0, listeners: new Map() };
}

/** What the native plugin announces to every `status` listener of the page. */
function pairedEmit(shell: PairedShell) {
	shell.listeners.forEach((item) => {
		if (item.eventName === 'status') item.callback(pairedRemoteStatus(shell.state));
	});
}

/**
 * The overview answer for the Nth read: a non-owner is denied, a denied owner keeps the card for the
 * landing confirmation and the page's own read, and loses it on the third (a focus refresh).
 */
function pairedOverviewReply(mode: PairedMode, snapshot: unknown, read: number) {
	if (mode === 'non-owner') return pairedReply(403, { error: 'permission-denied' });
	if (mode === 'denied' && read > 2) return pairedReply(403, { error: 'permission-denied' });
	if (mode === 'unavailable') return pairedReply(503, { status: 'unavailable' });
	return pairedReply(200, snapshot);
}

/** The `HarnessRemote` double: the computer is only ever asked for its empty project list. */
function pairedRemote(shell: PairedShell) {
	return {
		status: async () => pairedRemoteStatus(shell.state),
		scan: async () => pairedRemoteStatus(shell.state),
		disconnect: async () => {
			shell.state = 'unpaired';
			pairedEmit(shell);
			return pairedRemoteStatus(shell.state);
		},
		/** SYNTHETIC computer: no operation of it is granted here, except the empty project list. */
		request: async (call: { method: string }) => {
			if (call.method === 'listProjects') return { value: [] };
			throw Object.assign(new Error('Operation not allowed.'), { code: 'method-denied' });
		}
	};
}

/** The `HarnessAccount` double: every request is recorded; the overview is its only read. */
function pairedAccount(shell: PairedShell, input: PairedInstall, calls: PairedAccountCall[]) {
	const owner = {
		configured: true,
		state: 'signed-in',
		actor: { id: 'google:fixture-owner', name: 'Fixture Owner', email: 'owner@example.invalid' }
	};
	return {
		status: async () => owner,
		connect: async () => owner,
		disconnect: async () => ({ configured: true, state: 'signed-out' }),
		/** Records each request: the overview is read with one fixed GET and nothing else. */
		request: async (call: { method: string; path: string }) => {
			calls.push({ method: call.method, path: call.path });
			if (call.method !== 'GET') return pairedReply(405, { error: 'method-not-allowed' });
			if (call.path === '/api/tracker-overview')
				return pairedOverviewReply(input.mode, input.snapshot, ++shell.reads);
			return pairedReply(200, []);
		}
	};
}

/** The `addListener` and `removeListener` of the native callback bridge, over the shell's listeners. */
function pairedListen(
	shell: PairedShell,
	method: string,
	value: { eventName?: string; callbackId?: string },
	callback: (v: unknown) => void
) {
	if (method === 'removeListener') return void shell.listeners.delete(String(value.callbackId));
	shell.listeners.set(String(++shell.serial), { eventName: String(value.eventName), callback });
	return String(shell.serial);
}

function pairedMethods(plugin: PairedPlugin) {
	return Object.keys(plugin).map((name) => ({ name, rtype: 'promise' }));
}

function pairedHeaders(plugins: Record<string, PairedPlugin>) {
	return [
		{
			name: 'HarnessRemote',
			methods: [
				...pairedMethods(plugins.HarnessRemote!),
				{ name: 'addListener' },
				{ name: 'removeListener' }
			]
		},
		{ name: 'HarnessAccount', methods: pairedMethods(plugins.HarnessAccount!) }
	];
}

/** Imitates the `HarnessRemote` and `HarnessAccount` plugins in the page; runs before the app. */
function installPairedShell(input: PairedInstall) {
	const host = window as unknown as PairedPhoneHost & Record<string, unknown>;
	const calls: PairedAccountCall[] = [];
	host.__pairedAccountCalls = calls;
	const shell = pairedShell(input.mode);
	const plugins: Record<string, PairedPlugin> = {
		HarnessRemote: pairedRemote(shell) as never,
		HarnessAccount: pairedAccount(shell, input, calls) as never
	};
	Object.assign(host, {
		webkit: { messageHandlers: { bridge: { postMessage: () => {} } } },
		Capacitor: {
			isNativePlatform: () => true,
			getPlatform: () => 'ios',
			PluginHeaders: pairedHeaders(plugins),
			nativePromise: (plugin: string, method: string, value: never) =>
				plugins[plugin]![method]!(value),
			nativeCallback: (
				_plugin: string,
				method: string,
				value: { eventName?: string; callbackId?: string },
				callback: (v: unknown) => void
			) => pairedListen(shell, method, value, callback)
		},
		__pairedPhone: {
			/** What the native plugin announces: revocation, loss of the pairing, or a return. */
			setState: (state: string) => {
				shell.state = state;
				pairedEmit(shell);
			}
		}
	});
}

/** Every helper the init script needs, each a function declaration of this module. */
const pairedHelpers: Array<(...args: never[]) => unknown> = [
	pairedReply,
	pairedRemoteStatus,
	pairedShell,
	pairedEmit,
	pairedOverviewReply,
	pairedRemote,
	pairedAccount,
	pairedListen,
	pairedMethods,
	pairedHeaders
];

/** One trusted script: the helper declarations, then the installer that calls them with the input. */
function pairedScript(input: PairedInstall): string {
	const helpers = pairedHelpers.map((helper) => helper.toString()).join('\n');
	return `${helpers}\n(${installPairedShell.toString()})(${JSON.stringify(input)});`;
}

/** A paired phone of the given mode, its account signed in as the synthetic owner. */
export async function pairedPhoneFixture(page: Page, mode: PairedMode = 'owner') {
	await page.addInitScript({
		content: pairedScript({ mode, snapshot: overviewSnapshot })
	});
}

/** Moves the synthetic computer pairing to `state`, as the native plugin would announce it. */
export async function setPairedState(page: Page, state: string) {
	await page.evaluate(
		(next) => (window as unknown as PairedPhoneHost).__pairedPhone.setState(next),
		state
	);
}

/** Every account request the page made so far, in order. */
export async function pairedAccountCalls(page: Page): Promise<PairedAccountCall[]> {
	return page.evaluate(() => (window as unknown as PairedPhoneHost).__pairedAccountCalls);
}
