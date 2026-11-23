import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { remoteHostStatus } from '../../src/services/networking-security/remote-host-service/remoteHostStatus';
import type { RemoteHostStatusInput } from '../../src/utils/networking-security/remoteHostStatus';

const baseInput = (
	phase: RemoteHostStatusInput['phase'],
	reason: string | null
): RemoteHostStatusInput => ({
	supported: true,
	state: null,
	runtime: null,
	phase,
	reason,
	name: 'Office Mac',
	projects: [{ id: 'local-project-42', name: 'orders-app' }]
});

test('reports idle, signed-out and registration status with public', () => {
	const idleInput = baseInput('idle', null),
		signedOutInput = baseInput('signed-out', null),
		registrationInput = baseInput('idle', 'Remote access could not be registered. Try again.'),
		idle = remoteHostStatus(idleInput),
		signedOut = remoteHostStatus(signedOutInput),
		registration = remoteHostStatus(registrationInput),
		summary = (status: ReturnType<typeof remoteHostStatus>) => ({
			supported: status.supported,
			enabled: status.enabled,
			state: status.state,
			reason: status.reason,
			host: status.host,
			origin: status.origin,
			pairing: status.pairing,
			requests: status.requests,
			devices: status.devices,
			projects: status.projects
		});

	expect(idle).toMatchObject({
		state: 'disabled',
		enabled: false,
		projects: [{ id: 'local-project-42', name: 'orders-app' }]
	});
	expect(signedOut).toMatchObject({
		state: 'signed-out',
		reason: 'Connect to Harness Hub on this computer first.'
	});
	expect(registration).toMatchObject({
		state: 'disabled',
		reason: 'Remote access could not be registered. Try again.'
	});

	recordExampleCases(
		{
			unitId: 'desktop.function.remote-host-status',
			symbol: 'remoteHostStatus',
			state: 'reports-idle-signed-out-and-registration-status-with-public',
			evidence: 'examples-cases',
			file: 'reports-idle-signed-out-and-registration-status-with-public.json'
		},
		[
			{ name: 'idle with no persisted host', input: idleInput, output: summary(idle) },
			{ name: 'waiting for Hub sign-in', input: signedOutInput, output: summary(signedOut) },
			{
				name: 'registration supplied a display reason',
				input: registrationInput,
				output: summary(registration)
			}
		]
	);
});
