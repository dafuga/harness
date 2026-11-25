import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { NativeAuthService } from '../../src/lib/development-tooling/desktop-initialization/NativeAuthService';
import type { AuthOptions } from '../../src/lib/development-tooling/desktop-initialization/NativeAuthService.types';

export const directories: string[] = [];

export function tempDirectory() {
	const directory = mkdtempSync(join(tmpdir(), 'native-auth-example-'));
	directories.push(directory);
	return directory;
}

export function options(overrides: Partial<AuthOptions> = {}) {
	const calls: Array<{ path: string; body?: unknown }> = [];
	const credential = { token: 'example-token' };
	let saved: unknown = null;
	let configured = true;
	const base: AuthOptions = {
		origin: 'https://hosted.example.test',
		http: {
			publicJson: async (path, body) => {
				calls.push({ path, body });
				if (path.endsWith('/start'))
					return {
						handoffId: 'handoff-example-1',
						userCode: 'WDJB-MJHT',
						verificationUrl: 'https://hosted.example.test/native/handoff-example-1',
						expiresAt: '2026-11-15T12:10:00.000Z',
						interval: 5
					};
				if (path.endsWith('/poll')) return { status: 'pending' };
				return { status: 'approved' };
			},
			publicStatus: async () => ({ configured }),
			request: async (path, _credential, requestOptions) => {
				calls.push({ path, body: requestOptions?.body });
				return {};
			}
		} as AuthOptions['http'],
		store: {
			available: () => true,
			read: async () => credential,
			save: async (value) => {
				saved = value;
			},
			clear: async () => {
				saved = null;
			}
		} as AuthOptions['store'],
		open: async () => undefined,
		now: () => Date.parse('2026-11-15T12:00:00.000Z')
	};
	return {
		config: { ...base, ...overrides },
		calls,
		credential,
		get saved() {
			return saved;
		},
		set configured(value: boolean) {
			configured = value;
		}
	};
}

test('Starts a native handoff', async () => {
	tempDirectory();
	const fixture = options();
	const opened: string[] = [];
	fixture.config.open = async (url) => {
		opened.push(url);
	};
	const service = new NativeAuthService(fixture.config);
	const result = await service.connect();
	const output = { status: result, opened, request: fixture.calls[0] };
	expect(result).toMatchObject({
		configured: true,
		state: 'pending',
		handoff: { userCode: 'WDJB-MJHT' }
	});
	recordExampleCases(
		{
			unitId: 'desktop.service.native-auth',
			symbol: 'connect',
			state: 'starts-a-native-handoff',
			evidence: 'examples-cases',
			file: 'starts-a-native-handoff.json'
		},
		[
			{
				name: 'Starts a hosted native handoff',
				input: { origin: fixture.config.origin, resource: 'projects' },
				output
			}
		]
	);
});
