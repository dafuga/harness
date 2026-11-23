import { test } from 'vitest';
import type {} from '../../src/app';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('Describes optional hub platform bindings', () => {
	type Platform = App.Platform;
	const platform: Platform = {
		env: {
			HARNESS_GOOGLE_CLIENT_ID: 'example-client',
			HARNESS_SESSION_SECRET: 'example-session-secret',
			HARNESS_COLLABORATION_OWNER: 'example-owner',
			HARNESS_COLLABORATION_REPO: 'example-repo',
			HARNESS_RELAY_ORIGIN: 'https://relay.example.test'
		}
	};
	expect(platform.env.HARNESS_COLLABORATION_OWNER).toBe('example-owner');
	expect(platform.env.HARNESS_COLLABORATION_REPO).toBe('example-repo');
	const cases = [
		{
			name: 'accepts the optional hub bindings',
			input: {
				HARNESS_COLLABORATION_OWNER: 'example-owner',
				HARNESS_COLLABORATION_REPO: 'example-repo',
				HARNESS_RELAY_ORIGIN: 'https://relay.example.test'
			},
			output: {
				configured: [
					'HARNESS_COLLABORATION_OWNER',
					'HARNESS_COLLABORATION_REPO',
					'HARNESS_RELAY_ORIGIN'
				]
			}
		}
	];
	recordExampleCases(
		{
			unitId: 'hub.entry.app-d',
			symbol: 'App.Platform',
			state: 'describes-optional-hub-platform-bindings',
			evidence: 'examples-cases',
			file: 'describes-optional-hub-platform-bindings.json'
		},
		cases
	);
});
