import { expect, test, vi } from 'vitest';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { RemoteDesktopControl } from '../../src/models/Environment.types';
import { selectEnvironment } from '../../src/utils/selectEnvironment';

const harness = { snapshot: vi.fn() } as unknown as DesktopBridge;
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
];
const control = () =>
	Object.fromEntries(names.map((name) => [name, vi.fn()])) as unknown as RemoteDesktopControl;

test('an ordinary page is the web environment: no bridge, no folder, no control port', () => {
	expect(selectEnvironment({})).toEqual({ kind: 'web', bridge: undefined, local: false });
	const web = selectEnvironment({ Capacitor: { isNativePlatform: () => false } });
	expect(web.kind).toBe('web');
});

test('the preload bridge selects Electron, with phone access only when its port is whole', () => {
	const plain = selectEnvironment({ harness });
	expect(plain).toMatchObject({ kind: 'electron', bridge: harness, local: true });
	expect(plain.host).toBeUndefined();
	expect(plain.phone).toBeUndefined();
	const harnessRemote = control();
	expect(selectEnvironment({ harness, harnessRemote }).host).toBe(harnessRemote);
	for (const name of names) {
		const lacking = { ...control(), [name]: undefined };
		expect([name, selectEnvironment({ harness, harnessRemote: lacking }).host]).toEqual([
			name,
			undefined
		]);
	}
	const partial = { ...control(), denyPairing: undefined };
	expect(selectEnvironment({ harness, harnessRemote: partial }).host).toBeUndefined();
});

test('the native shell selects Capacitor first and never hands out the desktop surface', () => {
	const native = { isNativePlatform: () => true };
	const phone = selectEnvironment({ Capacitor: native, harness, harnessRemote: control() });
	expect(phone).toMatchObject({ kind: 'capacitor', local: false });
	expect(phone.bridge).not.toBe(harness);
	expect(phone.host).toBeUndefined();
	expect(phone.phone).toBeDefined();
	const bridge = phone.bridge as unknown as Record<string, unknown>;
	for (const name of ['hostedStatus', 'connectHosted', 'disconnectHosted'])
		expect(bridge[name]).toBeUndefined();
});
