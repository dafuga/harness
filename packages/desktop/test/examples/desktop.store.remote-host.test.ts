import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createRemoteHostStore } from '../../src/lib/stores/networking-security/remoteHost.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte.types';
import type {
	RemoteDesktopControl,
	RemoteHostStatus
} from '../../../remote/src/models/networking-security/RemoteControl.types';

// prettier-ignore
const base: RemoteHostStatus = { supported: true, enabled: false, state: 'disabled', reason: null, host: null, origin: null, pairing: null, requests: [], devices: [], projects: [] };
// prettier-ignore
const online: RemoteHostStatus = { ...base, enabled: true, state: 'online', host: { id: 'host-1', name: 'Desk' } };
// prettier-ignore
const approval = { pairingId: 'pairing-1', deviceId: 'device-1', projectIds: ['project-1'], agents: false };
// prettier-ignore
const methods = ['status', 'enable', 'disable', 'createPairing', 'closePairing', 'approvePairing', 'denyPairing', 'revokeDevice'];

/** Writes this state's trace: its case is named after the state, and its file after the state. */
function record(state: string, symbol: string, output: unknown) {
	recordExampleCases(
		{
			unitId: 'desktop.store.remote-host',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: state, input: null, output }]
	);
}

/** A port that records each call, answers with one status and can announce a status. */
function fakePort(answer: RemoteHostStatus, failing = '') {
	const calls: string[] = [];
	let announce: ((status: RemoteHostStatus) => void) | undefined;
	let released = 0;
	const call = (method: string) => async () => {
		calls.push(method);
		if (method === failing) throw 'offline';
		return answer;
	};
	const port = {
		...Object.fromEntries(methods.map((method) => [method, call(method)])),
		onStatus(listener: (status: RemoteHostStatus) => void) {
			calls.push('onStatus');
			announce = listener;
			return () => {
				released++;
				announce = undefined;
			};
		}
	};
	return {
		port: port as unknown as RemoteDesktopControl,
		calls,
		announce: (status: RemoteHostStatus) => announce?.(status),
		released: () => released
	};
}

const workspaceWith = (host: unknown) => ({ remote: { host } }) as unknown as Workspace;

test('Without a control port start returns unsubscribed and every action resolves false', async () => {
	const store = createRemoteHostStore(workspaceWith(undefined));
	const started = await store.start();
	const results = [
		await store.enable(),
		await store.disable(),
		await store.createPairing(),
		await store.closePairing(),
		await store.approve(approval),
		await store.deny('pairing-1'),
		await store.revoke('device-1')
	];

	expect(started).toBeUndefined();
	expect(results).toEqual([false, false, false, false, false, false, false]);
	expect(store.status).toBeNull();
	expect(store.busy).toBe(false);
	record('absent-port-resolves-every-action-false', 'createRemoteHostStore', {
		started: null,
		results
	});
});

test('A port set on the workspace after creation is read on the next access, and a falsy port is absent', async () => {
	const fake = fakePort(online);
	const workspace = { remote: { host: undefined as RemoteDesktopControl | null | undefined } };
	const store = createRemoteHostStore(workspace as unknown as Workspace);
	const beforePort = await store.enable();
	workspace.remote.host = fake.port;
	const afterPort = await store.enable();
	workspace.remote.host = null;
	const afterFalsy = await store.disable();

	expect(beforePort).toBe(false);
	expect(afterPort).toBe(true);
	expect(afterFalsy).toBe(false);
	expect(fake.calls).toEqual(['enable']);
	record('reads-the-port-on-every-access', 'enable', {
		beforePort,
		afterPort,
		afterFalsy,
		calls: fake.calls
	});
});

test('start asks once, subscribes once and accepts announced statuses', async () => {
	const first = { ...base, reason: 'starting' };
	const fake = fakePort(first);
	const store = createRemoteHostStore(workspaceWith(fake.port));
	await store.start();
	await store.start();
	const asked = store.status;
	fake.announce(online);

	expect(asked).toEqual(first);
	expect(store.status).toEqual(online);
	expect(fake.calls).toEqual(['onStatus', 'status']);
	record('start-subscribes-once-and-accepts-announcements', 'start', {
		asked,
		announced: store.status,
		calls: fake.calls
	});
});

test('Each action forwards its input and accepts the status it answers with', async () => {
	const fake = fakePort(online);
	const store = createRemoteHostStore(workspaceWith(fake.port));
	const results = [
		await store.enable(),
		await store.createPairing(),
		await store.approve(approval),
		await store.deny('pairing-1'),
		await store.revoke('device-1'),
		await store.closePairing(),
		await store.disable()
	];

	expect(results).toEqual([true, true, true, true, true, true, true]);
	expect(store.status).toEqual(online);
	expect(fake.calls).toEqual([
		'enable',
		'createPairing',
		'status',
		'approvePairing',
		'denyPairing',
		'revokeDevice',
		'closePairing',
		'disable'
	]);
	record('actions-accept-the-answered-status', 'enable', {
		results,
		status: store.status,
		calls: fake.calls
	});
});

/** Enable is pending while disable is asked: the second call is refused and never reaches the port. */
async function overlappingCall() {
	let enableCalls = 0;
	let disableCalls = 0;
	let release: (status: RemoteHostStatus) => void = () => undefined;
	const pending = new Promise<RemoteHostStatus>((resolve) => (release = resolve));
	const port = {
		enable: () => (enableCalls++, pending),
		disable: () => (disableCalls++, pending)
	} as unknown as RemoteDesktopControl;
	const store = createRemoteHostStore(workspaceWith(port));
	const inFlight = store.enable();
	const refused = await store.disable();
	const busyWhileWaiting = store.busy;
	release(online);
	const accepted = await inFlight;
	return { refused, busyWhileWaiting, accepted, enableCalls, disableCalls, busyAfter: store.busy };
}

test('A rejected action keeps its error text, and an action while busy is refused without calling the port', async () => {
	const store = createRemoteHostStore(workspaceWith(fakePort(base, 'enable').port));
	const failed = await store.enable();
	const errorAfterFailure = store.error;
	const cleared = await store.disable();
	const overlap = await overlappingCall();

	expect(failed).toBe(false);
	expect(errorAfterFailure).toBe('offline');
	expect(cleared).toBe(true);
	expect(store.error).toBe('');
	expect(overlap.refused).toBe(false);
	expect(overlap.busyWhileWaiting).toBe(true);
	expect(overlap.accepted).toBe(true);
	expect(overlap.enableCalls).toBe(1);
	expect(overlap.disableCalls).toBe(0);
	expect(overlap.busyAfter).toBe(false);
	record('failures-keep-the-error-and-block-overlap', 'enable', {
		failed,
		errorAfterFailure,
		cleared,
		errorAfterClear: store.error,
		...overlap
	});
});

test('dispose detaches the listener and an answer that arrives afterwards is not accepted', async () => {
	const fake = fakePort(base);
	let answer: (status: RemoteHostStatus) => void = () => undefined;
	const slowStatus = new Promise<RemoteHostStatus>((resolve) => (answer = resolve));
	const port = { ...fake.port, status: () => slowStatus } as unknown as RemoteDesktopControl;
	const store = createRemoteHostStore(workspaceWith(port));
	const started = store.start();
	store.dispose();
	answer(online);
	await started;
	fake.announce(online);

	expect(store.status).toBeNull();
	expect(fake.released()).toBe(1);
	expect(store.busy).toBe(false);
	record('dispose-detaches-and-drops-a-late-answer', 'dispose', {
		status: store.status,
		released: fake.released(),
		busy: store.busy,
		error: store.error
	});
});
