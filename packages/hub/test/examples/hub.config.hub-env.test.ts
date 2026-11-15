import { test } from 'vitest';
import { hubEnvConfig } from '../../src/configs/development-tooling/hubEnvConfig';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('hubEnvConfig resolves supported Hub settings and excludes unrelated host variables.', () => {
	const cases: Array<{
		name: string;
		input: Record<string, unknown>;
		expected: Record<string, unknown>;
	}> = [
		{
			name: 'local Hub server settings',
			input: {
				HARNESS_GOOGLE_CLIENT_ID: 'hub-local.apps.exampleusercontent.com',
				HARNESS_SESSION_SECRET: 'hub-local-session-secret-example',
				HARNESS_PUBLIC_ORIGIN: 'http://127.0.0.1:5173',
				HARNESS_ENVIRONMENT: 'local',
				PORT: '8787'
			},
			expected: {
				HARNESS_GOOGLE_CLIENT_ID: 'hub-local.apps.exampleusercontent.com',
				HARNESS_SESSION_SECRET: 'hub-local-session-secret-example',
				HARNESS_PUBLIC_ORIGIN: 'http://127.0.0.1:5173',
				HARNESS_ENVIRONMENT: 'local'
			}
		},
		{
			name: 'Hub GitHub integration settings',
			input: {
				HARNESS_GITHUB_APP_ID: '123456',
				HARNESS_GITHUB_PRIVATE_KEY:
					'-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----',
				HARNESS_GITHUB_CLIENT_ID: 'Iv1.example',
				HARNESS_GITHUB_CLIENT_SECRET: 'example-client-secret',
				HARNESS_COLLABORATION_OWNER: 'acme',
				HARNESS_COLLABORATION_REPO: 'hub',
				HARNESS_COLLABORATION_REPOSITORY_ID: '987654321',
				HARNESS_COLLABORATION_INSTALLATION_ID: '12345678',
				GITHUB_TOKEN: 'unrelated-host-token'
			},
			expected: {
				HARNESS_GITHUB_APP_ID: '123456',
				HARNESS_GITHUB_PRIVATE_KEY:
					'-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----',
				HARNESS_GITHUB_CLIENT_ID: 'Iv1.example',
				HARNESS_GITHUB_CLIENT_SECRET: 'example-client-secret',
				HARNESS_COLLABORATION_OWNER: 'acme',
				HARNESS_COLLABORATION_REPO: 'hub',
				HARNESS_COLLABORATION_REPOSITORY_ID: '987654321',
				HARNESS_COLLABORATION_INSTALLATION_ID: '12345678'
			}
		}
	];

	const observed = cases.map(({ name, input, expected }) => {
		const output = hubEnvConfig(input);
		expect(output).toEqual(expected);
		return { name, input, output };
	});

	recordExampleCases(
		{
			unitId: 'hub.config.hub-env',
			symbol: 'hubEnvConfig',
			state: 'resolves-runtime-settings',
			evidence: 'examples-cases',
			file: 'resolves-runtime-settings.json'
		},
		observed
	);
});
