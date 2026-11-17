import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { NativeAccountStatusService } from '../../src/lib/development-tooling/desktop-initialization/NativeAccountStatusService';
import type { StatusOptions } from '../../src/lib/development-tooling/desktop-initialization/NativeAccountStatusService.types';

const credential = {
	origin: 'https://hosted.example.com',
	principalId: 'principal_7f3a9c21',
	token: 'example-bearer-token'
};

function serviceFor(result: unknown, events: string[], failure?: Error) {
	const options = {
		http: {
			request: async (path: string, sentCredential: typeof credential) => {
				events.push(`request:${path}:${sentCredential.principalId}`);
				if (failure) throw failure;
				return { json: async () => result };
			}
		},
		store: { clear: async () => { events.push('store.clear'); } },
		onDisconnect: () => { events.push('onDisconnect'); },
		clearCache: async () => { events.push('clearCache'); }
	};
	return new NativeAccountStatusService(options as unknown as StatusOptions);
}

function errorSummary(error: unknown) {
	return error instanceof Error ? { name: error.name, message: error.message } : String(error);
}

test('Rechecks identity and preserves sessions during outages', async () => {
	const valid = {
		actor: { id: credential.principalId, name: 'Ada Lovelace', email: 'ada@example.com', emailVerified: true }
	};
	const signedInEvents: string[] = [];
	const signedIn = await serviceFor(valid, signedInEvents).read(credential);
	expect(signedIn).toEqual({
		configured: true,
		state: 'signed-in',
		actor: { id: credential.principalId, name: 'Ada Lovelace', email: 'ada@example.com' }
	});

	const deniedEvents: string[] = [];
	const signedOut = await serviceFor({ actor: { id: 'another-principal', name: 'Ada', email: 'ada@example.com', emailVerified: true } }, deniedEvents).read(credential);
	expect(signedOut).toEqual({ configured: true, state: 'signed-out' });
	expect(deniedEvents).toEqual(['request:/api/auth/status:principal_7f3a9c21', 'onDisconnect', 'store.clear', 'clearCache']);

	const outage = new Error('Hosted service is offline');
	const outageEvents: string[] = [];
	let observedError: unknown;
	try {
		await serviceFor(null, outageEvents, outage).read(credential);
	} catch (error) {
		observedError = error;
	}
	expect(observedError).toBe(outage);
	expect(outageEvents).toEqual(['request:/api/auth/status:principal_7f3a9c21']);

	recordExampleCases(
		{
			unitId: 'desktop.service.native-account-status',
			symbol: 'read',
			state: 'rechecks-identity-and-preserves-sessions-during-outages',
			evidence: 'examples-cases',
			file: 'rechecks-identity-and-preserves-sessions-during-outages.json'
		},
		[
			{
				name: 'Matching verified actor remains signed in',
				input: { credential, response: valid, request: '/api/auth/status' },
				output: signedIn
			},
			{
				name: 'A different actor revokes the saved session and clears cache',
				input: { credential, response: { actor: { id: 'another-principal', emailVerified: true } } },
				output: { status: signedOut, events: deniedEvents }
			},
			{
				name: 'A temporary request failure propagates without clearing the session',
				input: { credential, requestError: errorSummary(outage) },
				error: errorSummary(observedError)
			}
		]
	);
});
