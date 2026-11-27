import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { remoteControl } from '../../src/lib/development-tooling/desktop-initialization/initialize-desktop/remoteControl';

const unitId =
	'desktop.module.development-tooling-desktop-initialization-initialize-desktop-remote-control';
const state = 'forwards-remote-host-and-device-controls';

function createFixture() {
	const calls: Array<{ method: string; input?: unknown }> = [];
	const status = { enabled: true, phase: 'online' };
	const devices = {
		approvePairing: (input: unknown) => (
			calls.push({ method: 'approvePairing', input }),
			'approved'
		),
		denyPairing: (input: unknown) => (calls.push({ method: 'denyPairing', input }), 'denied'),
		revokeDevice: (input: unknown) => (calls.push({ method: 'revokeDevice', input }), 'revoked')
	};
	const remote = {
		devices,
		status: () => (calls.push({ method: 'status' }), status),
		enable: () => (calls.push({ method: 'enable' }), 'enabled'),
		disable: () => (calls.push({ method: 'disable' }), 'disabled')
	};
	return { calls, status, control: remoteControl(remote as never) };
}

function callControls(
	control: ReturnType<typeof remoteControl>,
	inputs: {
		approval: { pairingId: string; deviceId: string; projectIds: string[]; agents: boolean };
		pairing: { pairingId: string };
		device: { deviceId: string };
	}
) {
	return {
		status: control.status(),
		enable: control.enable(),
		disable: control.disable(),
		approvePairing: control.approvePairing(inputs.approval),
		denyPairing: control.denyPairing(inputs.pairing),
		revokeDevice: control.revokeDevice(inputs.device)
	};
}

test('Forwards remote host and device controls', () => {
	const { calls, status, control } = createFixture();
	const approval = {
		pairingId: 'pair-42',
		deviceId: 'phone-7',
		projectIds: ['project-3'],
		agents: true
	};
	const pairing = { pairingId: 'pair-42' };
	const device = { deviceId: 'phone-7' };
	const output = { ...callControls(control, { approval, pairing, device }), calls };
	expect(output).toEqual({
		status,
		enable: 'enabled',
		disable: 'disabled',
		approvePairing: 'approved',
		denyPairing: 'denied',
		revokeDevice: 'revoked',
		calls: [
			{ method: 'status' },
			{ method: 'enable' },
			{ method: 'disable' },
			{ method: 'approvePairing', input: approval },
			{ method: 'denyPairing', input: pairing },
			{ method: 'revokeDevice', input: device }
		]
	});
	recordExampleCases(
		{ unitId, symbol: 'remoteControl', state, evidence: 'examples-cases', file: `${state}.json` },
		[
			{
				name: 'Host and device callbacks delegate inputs and return values unchanged',
				input: { approval, pairing, device },
				output
			}
		]
	);
});
