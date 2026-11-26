import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ElectronEnvironmentAdapter } from '../../src/lib/verification-evidence/select-environment/ElectronEnvironmentAdapter';
import type { DesktopBridge } from '../../src/models/development-tooling/DesktopBridge.types';
import type {
	Environment,
	EnvironmentHost,
	RemoteDesktopControl
} from '../../src/models/development-tooling/Environment.types';

const CONTROL = [
	'status',
	'enable',
	'disable',
	'approvePairing',
	'denyPairing',
	'revokeDevice',
	'onStatus'
] as const;

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'desktop.adapter.electron-environment',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

/** A bridge fixture: a plain object, so its label survives the JSON trace. */
function fixtureBridge(): DesktopBridge {
	return { label: 'fixture-bridge' } as unknown as DesktopBridge;
}

/** All seven remote-control members as functions, except `broken`, which is not a function. */
function remoteControl(broken?: string): Partial<RemoteDesktopControl> {
	const members = CONTROL.map((name) => [name, name === broken ? 'not-a-function' : () => {}]);
	return Object.fromEntries(members) as unknown as Partial<RemoteDesktopControl>;
}

/** The connect result as JSON: the bridge's label, and the sorted names of the host members. */
function summary(environment: Environment) {
	return {
		kind: environment.kind,
		local: environment.local,
		bridge: environment.bridge ?? null,
		host: environment.host ? Object.keys(environment.host).sort() : null
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

test('Connects local Electron with the bridge and whole remote control', () => {
	const harness = fixtureBridge();
	const harnessRemote = remoteControl();
	const environment = new ElectronEnvironmentAdapter({
		host: { harness, harnessRemote }
	}).connect();
	expect(environment).toEqual({
		kind: 'electron',
		bridge: harness,
		local: true,
		host: harnessRemote
	});
	expect(environment.bridge).toBe(harness);
	expect(environment.host).toBe(harnessRemote);
	recordCases('connect', 'connects-local-electron-with-bridge-and-remote-control', [
		{
			name: 'connect with a bridge and all seven remote-control members',
			input: { harness: 'fixture-bridge', harnessRemote: 'seven functions' },
			output: summary(environment)
		}
	]);
});

test('Leaves host undefined when a remote-control member is missing', () => {
	const harness = fixtureBridge();
	const cases: Parameters<typeof recordCases>[2] = [];
	for (const name of CONTROL) {
		const environment = new ElectronEnvironmentAdapter({
			host: { harness, harnessRemote: remoteControl(name) }
		}).connect();
		expect(environment.host).toBeUndefined();
		expect(environment.bridge).toBe(harness);
		cases.push({
			name: `connect with ${name} not a function`,
			input: { missing: name },
			output: summary(environment)
		});
	}
	const withoutRemote = new ElectronEnvironmentAdapter({ host: { harness } }).connect();
	expect(withoutRemote.host).toBeUndefined();
	cases.push({
		name: 'connect with no harnessRemote at all',
		input: { harnessRemote: 'absent' },
		output: summary(withoutRemote)
	});
	recordCases('connect', 'leaves-host-undefined-when-a-remote-control-member-is-missing', cases);
});

test('Omits an absent bridge or host without failing', () => {
	const bare = new ElectronEnvironmentAdapter({ host: {} as EnvironmentHost }).connect();
	const harnessRemote = remoteControl();
	const remoteOnly = new ElectronEnvironmentAdapter({ host: { harnessRemote } }).connect();
	expect(bare).toEqual({ kind: 'electron', bridge: undefined, local: true, host: undefined });
	expect(remoteOnly.bridge).toBeUndefined();
	expect(remoteOnly.host).toBe(harnessRemote);
	recordCases('connect', 'omits-absent-bridge-and-host-without-failing', [
		{ name: 'connect with an empty host', input: { harness: 'absent' }, output: summary(bare) },
		{
			name: 'connect with remote control but no bridge',
			input: { harness: 'absent', harnessRemote: 'seven functions' },
			output: summary(remoteOnly)
		}
	]);
});

test('Reads the retained host again on each connect', () => {
	const host: EnvironmentHost = {
		harness: fixtureBridge(),
		harnessRemote: remoteControl('status')
	};
	const adapter = new ElectronEnvironmentAdapter({ host });
	const first = adapter.connect();
	const whole = remoteControl();
	host.harnessRemote = whole;
	const second = adapter.connect();
	expect(first.host).toBeUndefined();
	expect(second.host).toBe(whole);
	recordCases('connect', 'reads-the-retained-host-on-each-connect', [
		{
			name: 'first connect while status is broken',
			input: { harnessRemote: 'status not a function' },
			output: summary(first)
		},
		{
			name: 'second connect after the host is made whole',
			input: { harnessRemote: 'seven functions' },
			output: summary(second)
		}
	]);
});
