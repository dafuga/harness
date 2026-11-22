import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { InstallationTokenService } from '../../src/lib/verification-evidence/server/auth/installation-token-service/InstallationTokenService';
import type { CachedInstallationToken, InstallationTokenOptions } from '../../src/lib/verification-evidence/server/auth/installation-token-service/InstallationTokenService.types';

const state = 'denies-a-token-request-without-a-valid-repository-scope';

function options(): InstallationTokenOptions {
	const cache = new Map<string, CachedInstallationToken>();
	return {
		app: {
			appId: '12345',
			privateKey: 'unused because the request is denied before minting',
			clientId: 'example-client',
			clientSecret: 'example-secret',
			collaboration: null
		},
		api: { installationToken: async () => { throw new Error('unexpected token mint'); } } as unknown as InstallationTokenOptions['api'],
		cache,
		now: () => 1_800_000_000_000
	};
}

test('Denies a token request without a valid repository scope', async () => {
	const service = new InstallationTokenService(options());
	const input = {
		installationId: 12345678,
		repositoryIds: [987654321, 987654321],
		permissions: { contents: 'read' as const }
	};
	let error: unknown;
	try {
		await service.token(input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: 'hub.service.installation-token',
			symbol: 'InstallationTokenService.token',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'duplicate repository IDs are denied', input, error: { name: (error as Error).name, message: (error as Error).message } }]
	);
});
