import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { RemoteHostSwitchService } from '../../src/services/networking-security/remote-host-service/remote-host-switch-service/RemoteHostSwitchService';
import type { RemoteHostSwitchOptions } from '../../src/services/networking-security/remote-host-service/remote-host-switch-service/RemoteHostSwitchService.types';

function serviceFor(
	record: Partial<RemoteHostSwitchOptions['record']>,
	events: string[]
): RemoteHostSwitchService {
	const options: RemoteHostSwitchOptions = {
		record: record as RemoteHostSwitchOptions['record'],
		register: async () => { throw new Error('Example registration unavailable'); },
		name: () => 'Example workstation',
		run: () => { events.push('run'); },
		close: () => { events.push('close'); },
		changed: () => { events.push('changed'); }
	};
	return new RemoteHostSwitchService(options);
}

test('Skips launch when the record is unavailable', async () => {
	const events: string[] = [];
	const service = serviceFor({ available: () => false }, events);
	await service.start();
	const output = { phase: service.phase, reason: service.reason, events };
	expect(output).toEqual({ phase: 'idle', reason: null, events: [] });
	recordExampleCases(
		{ unitId: 'desktop.service.remote-host-switch', symbol: 'start', state: 'skips-launch-when-the-record-is-unavailable', evidence: 'examples-cases', file: 'skips-launch-when-the-record-is-unavailable.json' },
		[{ name: 'Unavailable stored record leaves launch idle', input: { available: false }, output }]
	);
});

test('Leaves status unchanged when enabling is unavailable', async () => {
	const events: string[] = [];
	const service = serviceFor({ available: () => false }, events);
	await service.enable();
	const output = { phase: service.phase, reason: service.reason, events };
	expect(output).toEqual({ phase: 'idle', reason: null, events: [] });
	recordExampleCases(
		{ unitId: 'desktop.service.remote-host-switch', symbol: 'enable', state: 'leaves-status-unchanged-when-enabling-is-unavailable', evidence: 'examples-cases', file: 'leaves-status-unchanged-when-enabling-is-unavailable.json' },
		[{ name: 'Unavailable record does not begin registration', input: { available: false }, output }]
	);
});

test('Turns remote access off and closes the running host', async () => {
	const events: string[] = [];
	const service = serviceFor({ off: async () => { events.push('off'); } }, events);
	service.phase = 'signed-out';
	service.reason = 'signed-out';
	await service.disable();
	const output = { phase: service.phase, reason: service.reason, events };
	expect(output).toEqual({ phase: 'idle', reason: null, events: ['close', 'off'] });
	recordExampleCases(
		{ unitId: 'desktop.service.remote-host-switch', symbol: 'disable', state: 'turns-remote-access-off-and-closes-the-running-host', evidence: 'examples-cases', file: 'turns-remote-access-off-and-closes-the-running-host.json' },
		[{ name: 'Disable closes then persists the off state', input: { phase: 'signed-out' }, output }]
	);
});

test('Waits for pending record writes when stopping', async () => {
	const events: string[] = [];
	const service = serviceFor({ settled: async () => { events.push('settled'); } }, events);
	service.phase = 'registering';
	service.reason = 'pending';
	await service.stop();
	const output = { phase: service.phase, reason: service.reason, events };
	expect(output).toEqual({ phase: 'idle', reason: 'pending', events: ['close', 'settled'] });
	recordExampleCases(
		{ unitId: 'desktop.service.remote-host-switch', symbol: 'stop', state: 'waits-for-pending-record-writes-when-stopping', evidence: 'examples-cases', file: 'waits-for-pending-record-writes-when-stopping.json' },
		[{ name: 'Stop waits without turning off the toggle', input: { phase: 'registering' }, output }]
	);
});
