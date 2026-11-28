import { pairedTrackerData } from './projectOverviewPairedTrackerFixture';
import type { Page } from '@playwright/test';
import {
	pairedAccount,
	pairedApproval,
	pairedOverviewReply,
	pairedReply
} from './projectOverviewAccountFixture';
import { overviewSnapshot } from './projectOverviewNativeFixture';
import type {
	PairedAccountCall,
	PairedInstall,
	PairedMode,
	PairedPhoneHost,
	PairedPlugin,
	PairedShell
} from './projectOverviewPairedFixture.types';

/** Synthetic Capacitor plugins for an iOS renderer with a test account and computer. */
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
	const state =
		mode === 'unpaired' || mode === 'sign-in'
			? 'unpaired'
			: mode === 'revoked'
				? 'revoked'
				: 'online';
	return {
		state,
		account: mode === 'sign-in' ? 'signed-out' : 'signed-in',
		reads: 0,
		serial: 0,
		listeners: new Map()
	};
}

/** What the native plugin announces to every `status` listener of the page. */
function pairedEmit(shell: PairedShell) {
	shell.listeners.forEach((item) => {
		if (item.eventName === 'status') item.callback(pairedRemoteStatus(shell.state));
	});
}

/** The `HarnessRemote` double: the computer is only ever asked for its empty project list. */
function pairedRemote(shell: PairedShell) {
	return {
		status: async () => pairedRemoteStatus(shell.state),
		refreshTracker: async () => ({}),
		trackerTool: async ({ name }: { name: string }) => ({
			source: 'local_tracker',
			freshness: shell.state === 'online' ? 'current' : 'stale',
			lastSyncedAt: null,
			partial: false,
			data: pairedTrackerData(name)
		}),
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
	shell.state = sessionStorage.getItem('harness-fixture-pairing') ?? shell.state;
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
			setAccount: (state: string) => {
				shell.account = state;
			},
			/** What the native plugin announces: revocation, loss of the pairing, or a return. */
			setState: (state: string) => {
				shell.state = state;
				sessionStorage.setItem('harness-fixture-pairing', state);
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
	pairedTrackerData,
	pairedRemote,
	pairedAccount,
	pairedApproval,
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

export async function setLoginStage(
	page: Page,
	state: 'waiting-for-approval' | 'approval-denied' | 'approval-expired' | 'signed-in'
) {
	await page.evaluate((next) => {
		(window as unknown as PairedPhoneHost).__pairedPhone.setAccount(next);
	}, state);
}
