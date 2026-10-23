import { expect, test } from 'vitest';
import { hubEnvConfig } from '../../src/configs/hubEnvConfig';
import { remoteHostsFake } from '../support/remoteHostsFake';

test('the relay origin and the host binding enter configuration and nothing near them does', () => {
	const binding = remoteHostsFake().namespace;
	const env = hubEnvConfig({
		HARNESS_RELAY_ORIGIN: 'https://relay.example',
		REMOTE_HOSTS: binding,
		RELAY_ORIGIN: 'borrowed',
		HARNESS_RELAY_SECRET: 'borrowed',
		REMOTE_HOSTS_TOKEN: 'borrowed',
		CLOUDFLARE_API_TOKEN: 'borrowed',
		RELAY: binding
	});
	expect(env).toEqual({ HARNESS_RELAY_ORIGIN: 'https://relay.example', REMOTE_HOSTS: binding });
	expect(env.REMOTE_HOSTS).toBe(binding);
	expect(hubEnvConfig({ HARNESS_RELAY_ORIGIN: 7, REMOTE_HOSTS: undefined })).toEqual({});
});
