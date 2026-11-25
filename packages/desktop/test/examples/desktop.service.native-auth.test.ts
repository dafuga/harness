import { rmSync } from 'node:fs';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { NativeAuthService } from '../../src/lib/development-tooling/desktop-initialization/NativeAuthService';
import { NativeSignInError } from '../../src/lib/development-tooling/desktop-initialization/NativeAuthService.types';
import { directories, tempDirectory, options } from './desktop.service.native-auth.cases';

afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

test('Reads signed-out status', async () => {
	tempDirectory();
	const fixture = options();
	fixture.config.store.read = async () => null;
	fixture.configured = false;
	const service = new NativeAuthService(fixture.config);
	const result = await service.status();
	expect(result).toEqual({ configured: false, state: 'signed-out' });
	recordExampleCases(
		{
			unitId: 'desktop.service.native-auth',
			symbol: 'status',
			state: 'reads-signed-out-status',
			evidence: 'examples-cases',
			file: 'reads-signed-out-status.json'
		},
		[
			{
				name: 'Uses public status for an empty session store',
				input: { storedCredential: null, publicStatus: { configured: false } },
				output: result
			}
		]
	);
});

test('Disconnects and clears the native session', async () => {
	tempDirectory();
	const fixture = options();
	const events: string[] = [];
	fixture.config.onDisconnect = () => {
		events.push('disconnect');
	};
	fixture.config.clearCache = async () => {
		events.push('cache-cleared');
	};
	const service = new NativeAuthService(fixture.config);
	const result = await service.disconnect();
	const output = { status: result, events, requests: fixture.calls };
	expect(result).toEqual({ configured: true, state: 'signed-out' });
	expect(events).toEqual(['disconnect', 'cache-cleared']);
	recordExampleCases(
		{
			unitId: 'desktop.service.native-auth',
			symbol: 'disconnect',
			state: 'disconnects-and-clears-the-native-session',
			evidence: 'examples-cases',
			file: 'disconnects-and-clears-the-native-session.json'
		},
		[
			{
				name: 'Posts logout and clears local session state',
				input: { credentialStored: true },
				output
			}
		]
	);
});

test('Throws NativeSignInError when OS encryption is unavailable', async () => {
	tempDirectory();
	const fixture = options();
	fixture.config.store.available = () => false;
	const service = new NativeAuthService(fixture.config);
	const error = await service.connect().catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(NativeSignInError);
	expect((error as Error).message).toBe('OS encryption is required for hosted sessions.');
	recordExampleCases(
		{
			unitId: 'desktop.service.native-auth',
			symbol: 'connect',
			state: 'throws-nativesigninerror-when-os-encryption-is-unavailable',
			evidence: 'examples-cases',
			file: 'throws-nativesigninerror-when-os-encryption-is-unavailable.json'
		},
		[
			{
				name: 'Rejects when the session store cannot encrypt credentials',
				input: { storeAvailable: false },
				error: {
					name: 'NativeSignInError',
					message: 'OS encryption is required for hosted sessions.'
				}
			}
		]
	);
});

test('Throws NativeSignInError when a native handoff is refused', async () => {
	tempDirectory();
	const fixture = options();
	let now = Date.parse('2026-11-15T12:00:00.000Z');
	fixture.config.now = () => now;
	const service = new NativeAuthService(fixture.config);
	await service.connect();
	now += 5000;
	fixture.config.http.publicJson = async () => ({ status: 'refused' });
	const error = await service.status().catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(NativeSignInError);
	expect((error as Error).message).toBe('Native handoff expired or was refused.');
	recordExampleCases(
		{
			unitId: 'desktop.service.native-auth',
			symbol: 'status',
			state: 'throws-nativesigninerror-when-a-native-handoff-is-refused',
			evidence: 'examples-cases',
			file: 'throws-nativesigninerror-when-a-native-handoff-is-refused.json'
		},
		[
			{
				name: 'Rejects when polling reports a refused handoff',
				input: { pollStatus: 'refused' },
				error: { name: 'NativeSignInError', message: 'Native handoff expired or was refused.' }
			}
		]
	);
});
