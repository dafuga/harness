import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { selectEnvironment } from '../../src/lib/verification-evidence/select-environment/selectEnvironment';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type {
	EnvironmentHost,
	RemoteDesktopControl
} from '../../src/models/development-tooling/Environment.types';

const names = [
	'status',
	'enable',
	'disable',
	'createPairing',
	'closePairing',
	'approvePairing',
	'denyPairing',
	'revokeDevice',
	'onStatus'
] as const;

function control(): RemoteDesktopControl {
	return Object.fromEntries(
		names.map((name) => [name, vi.fn()])
	) as unknown as RemoteDesktopControl;
}

/** Names the selected environment's fields without serializing live bridge objects. */
function summarize(environment: ReturnType<typeof selectEnvironment>, host: EnvironmentHost) {
	const bridge =
		environment.bridge === undefined
			? null
			: environment.bridge === host.harness
				? 'preload-bridge'
				: 'adapter-bridge';
	return {
		kind: environment.kind,
		bridge,
		local: environment.local,
		host: environment.host === undefined ? null : 'desktop-control',
		phone: environment.phone === undefined ? null : 'phone-control',
		account: environment.account ?? null
	};
}

function recordCases(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'desktop.function.select-environment',
			symbol: 'selectEnvironment',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Native Capacitor shell takes precedence over a preload bridge', () => {
	const harness = { snapshot: vi.fn() } as unknown as DesktopBridge;
	const host: EnvironmentHost = {
		Capacitor: { isNativePlatform: () => true },
		harness,
		harnessRemote: control()
	};
	const environment = selectEnvironment(host);
	expect(environment).toMatchObject({ kind: 'capacitor', local: false });
	expect(environment.bridge).not.toBe(harness);
	expect(environment.host).toBeUndefined();
	expect(environment.phone).toBeDefined();

	const withoutNative = selectEnvironment({ Capacitor: {}, harness });
	expect(withoutNative).toMatchObject({ kind: 'electron', bridge: harness, local: true });

	recordCases('native-shell-takes-precedence', [
		{
			name: 'native shell with preload bridge present',
			input: { Capacitor: 'native', harness: 'present', harnessRemote: 'whole' },
			output: summarize(environment, host)
		},
		{
			name: 'Capacitor without isNativePlatform, harness set',
			input: { Capacitor: 'no check', harness: 'present' },
			output: summarize(withoutNative, { Capacitor: {}, harness })
		}
	]);
});

test('A truthy preload bridge selects Electron; phone access needs a whole control port', () => {
	const harness = { snapshot: vi.fn() } as unknown as DesktopBridge;
	const plain = selectEnvironment({ harness });
	expect(plain).toMatchObject({ kind: 'electron', bridge: harness, local: true });
	expect(plain.host).toBeUndefined();
	expect(plain.phone).toBeUndefined();

	const harnessRemote = control();
	const whole = selectEnvironment({ harness, harnessRemote });
	expect(whole.host).toBe(harnessRemote);

	const partial = { ...control(), denyPairing: undefined };
	const partialHost = selectEnvironment({ harness, harnessRemote: partial });
	expect(partialHost.host).toBeUndefined();

	recordCases('preload-bridge-selects-electron', [
		{
			name: 'bridge with no desktop control port',
			input: { harness: 'present' },
			output: summarize(plain, { harness })
		},
		{
			name: 'bridge with a whole control port',
			input: { harness: 'present', harnessRemote: 'all nine functions' },
			output: summarize(whole, { harness, harnessRemote })
		},
		{
			name: 'bridge with denyPairing missing',
			input: { harness: 'present', harnessRemote: 'eight functions' },
			output: summarize(partialHost, { harness, harnessRemote: partial })
		}
	]);
});

test('An ordinary page is web with no bridge; harnessRemote alone does not select Electron', () => {
	const empty: EnvironmentHost = {};
	const web = selectEnvironment(empty);
	expect(web).toEqual({ kind: 'web', bridge: undefined, local: false });

	const notNative = selectEnvironment({ Capacitor: { isNativePlatform: () => false } });
	expect(notNative).toEqual({ kind: 'web', bridge: undefined, local: false });

	const remoteOnly: EnvironmentHost = { harnessRemote: control() };
	const remote = selectEnvironment(remoteOnly);
	expect(remote).toEqual({ kind: 'web', bridge: undefined, local: false });

	const falsy = { harness: null } as unknown as EnvironmentHost;
	expect(selectEnvironment(falsy)).toEqual({ kind: 'web', bridge: undefined, local: false });

	recordCases('web-without-bridge', [
		{ name: 'empty host', input: {}, output: summarize(web, empty) },
		{
			name: 'native check returns false',
			input: { Capacitor: 'isNativePlatform false' },
			output: summarize(notNative, { Capacitor: { isNativePlatform: () => false } })
		},
		{
			name: 'harnessRemote without harness',
			input: { harnessRemote: 'whole' },
			output: summarize(remote, remoteOnly)
		},
		{
			name: 'harness is null',
			input: { harness: null },
			output: summarize(selectEnvironment(falsy), falsy)
		}
	]);
});
