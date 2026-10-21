import type { Page } from '@playwright/test';
import { alpha, beta, projectFixture } from './ui-project-fixture';
import { pairing, phone, relayOrigin } from './ui-remote-host-fixture';
export * from './ui-project-fixture';
export { pairing, relayOrigin } from './ui-remote-host-fixture';

/**
 * SYNTHETIC ADAPTER FIXTURE. A page that believes it runs in the Capacitor iOS shell: the native
 * bridge and the `HarnessRemote` plugin are imitated in the page, and "the computer" is the
 * fixture bridge of the project tests. No socket, relay, key or credential exists here.
 */
export const hostName = 'Synthetic Mac';
export const deviceName = phone.name;
export const seenAt = '2026-10-12T08:00:00.000Z';

type Operation = (input?: unknown) => Promise<unknown>;
type Callback = (value: unknown) => void;
type Call = { method: string; input: { projectId?: string } };
interface PhoneOptions {
	state: string;
	origin: string;
	host: { id: string; name: string };
	device: { id: string; name: string };
	seenAt: string;
	granted: { id: string; name: string }[];
}
interface PhoneState {
	options: PhoneOptions;
	phone: { state: string; deviceName: string | null };
	/** How the next scans end: a failure code of the plugin each, then success. */
	scans: string[];
	computer: Record<string, Operation>;
	listeners: Map<string, { eventName: string; callback: Callback }>;
	status: () => Record<string, unknown>;
	set: (state: string) => void;
	request: (call: Call) => Promise<unknown>;
}
interface PhoneHost {
	harness?: Record<string, Operation>;
	__calls: Record<string, unknown>[];
	__projects: { selected: string | null };
	__remotePhone: PhoneState;
}

/** SYNTHETIC phone state, in the words of `RemoteMobileStatus`. The fixture bridge leaves the page. */
function installPhoneState(options: PhoneOptions) {
	const host = window as unknown as PhoneHost;
	const computer = host.harness!;
	delete host.harness;
	const named = options.state === 'unpaired' ? null : options.device.name;
	const phone = { state: options.state, deviceName: named };
	const listeners: PhoneState['listeners'] = new Map();
	const paired = () => phone.state === 'online' || phone.state === 'offline';
	const known = () => phone.state !== 'unpaired';
	const status = () => ({
		state: phone.state,
		origin: known() ? options.origin : null,
		host: known() ? options.host : null,
		device: phone.deviceName ? { id: options.device.id, name: phone.deviceName } : null,
		grant: paired() ? { projects: options.granted, agents: true } : null,
		reason: phone.state === 'offline' ? 'The computer is asleep or has no network.' : null,
		lastOnlineAt: paired() ? options.seenAt : null
	});
	/** What the native plugin would announce: approval on the desktop, loss of the host, revocation. */
	const set = (state: string) => {
		phone.state = state;
		listeners.forEach((item) => {
			if (item.eventName === 'status') item.callback(status());
		});
	};
	const request = async () => undefined;
	host.__remotePhone = { options, phone, scans: [], computer, listeners, status, set, request };
}

/** SYNTHETIC host answers: explicit project per request, granted projects only, `RemoteBinary`. */
function installPhoneRequests() {
	const host = window as unknown as PhoneHost;
	const state = host.__remotePhone;
	const local = ['openProject', 'selectProject', 'hostedStatus', 'connectHosted'];
	const fail = (code: string, message: string) => Object.assign(new Error(message), { code });
	const binary = async (bytes: Uint8Array) => {
		const digest = new Uint8Array(
			await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)
		);
		const sha256 = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
		const data = btoa(String.fromCharCode(...bytes));
		return { encoding: 'base64', mediaType: 'image/png', byteLength: bytes.length, sha256, data };
	};
	const granted = (value: unknown) =>
		(value as { id: string }[]).filter((item) =>
			state.options.granted.some((project) => project.id === item.id)
		);
	state.request = async (call: Call) => {
		host.__calls.push({ op: 'native.request', method: call.method });
		if (state.phone.state !== 'online')
			throw fail('offline', 'The computer is offline. Nothing was sent.');
		const operation = local.includes(call.method) ? undefined : state.computer[call.method];
		if (!operation) throw fail('method-denied', `Operation not allowed: ${call.method}`);
		host.__projects.selected = call.input.projectId ?? host.__projects.selected;
		const value = await operation(call.input);
		if (call.method === 'listProjects') return { value: granted(value) };
		return { value: value instanceof Uint8Array ? await binary(value) : value };
	};
}

/** SYNTHETIC native bridge of Capacitor iOS with the one plugin the renderer uses. */
function installPhonePlugin() {
	const host = window as unknown as PhoneHost;
	const { phone, scans, listeners, status, set, request } = host.__remotePhone;
	const methods: Record<string, (input: never) => Promise<unknown>> = {
		status: async () => status(),
		/** SYNTHETIC scanner: no camera and no code; it ends the way the test says, or well. */
		scan: async (input: { deviceName: string }) => {
			const outcome = scans.shift() ?? 'ok';
			host.__calls.push({ op: 'native.scan', ...input, outcome });
			if (outcome !== 'ok')
				throw Object.assign(new Error('SYNTHETIC native words'), { code: outcome });
			phone.deviceName = input.deviceName;
			set('pending-approval');
			return status();
		},
		disconnect: async () => {
			host.__calls.push({ op: 'native.disconnect' });
			phone.deviceName = null;
			set('unpaired');
			return status();
		},
		request: (call: Call) => request(call)
	};
	let serial = 0;
	type Listen = { eventName: string; callbackId?: string };
	const listen = (_plugin: string, method: string, input: Listen, callback: Callback) => {
		if (method === 'removeListener') return void listeners.delete(String(input.callbackId));
		listeners.set(String(++serial), { eventName: input.eventName, callback });
		return String(serial);
	};
	const promised = Object.keys(methods).map((name) => ({ name, rtype: 'promise' }));
	const header = {
		name: 'HarnessRemote',
		methods: [...promised, { name: 'addListener' }, { name: 'removeListener' }]
	};
	Object.assign(host, {
		webkit: { messageHandlers: { bridge: { postMessage: () => {} } } },
		Capacitor: {
			isNativePlatform: () => true,
			getPlatform: () => 'ios',
			PluginHeaders: [header],
			nativePromise: (_plugin: string, method: string, input: never) => methods[method](input),
			nativeCallback: listen
		}
	});
}

/** A phone in the given state; its computer granted it the two local projects, with agents. */
export async function remotePhoneFixture(page: Page, state = 'unpaired') {
	const outbox = await projectFixture(page);
	const options: PhoneOptions = {
		state,
		origin: relayOrigin,
		host: { id: pairing.hostId, name: hostName },
		device: { id: phone.deviceId, name: deviceName },
		seenAt,
		granted: [
			{ id: alpha, name: 'Alpha' },
			{ id: beta, name: 'Beta' }
		]
	};
	await page.addInitScript(installPhoneState, options);
	await page.addInitScript(installPhoneRequests);
	await page.addInitScript(installPhonePlugin);
	return outbox;
}
