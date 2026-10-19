import { expect, test } from 'vitest';
import { HubApiController } from '../../src/controllers/hub-api-controller/HubApiController';
import { hubHttpFailure } from '../../src/controllers/hub-api-controller/hubHttp';
import { hubRuntime } from '../../src/routes/api/[...path]/-server/hubRuntime';
import { hostIdentity, outcome, registration, remoteRequest } from '../support/remoteFixture';
import { remoteHostsFake } from '../support/remoteHostsFake';

const HARNESS_RELAY_ORIGIN = 'https://relay.example';

test('the runtime has a remote part only when the origin and the binding are both set', () => {
	const REMOTE_HOSTS = remoteHostsFake().namespace;
	expect(hubRuntime({}).remote).toBeNull();
	expect(hubRuntime({ HARNESS_RELAY_ORIGIN }).remote).toBeNull();
	expect(hubRuntime({ REMOTE_HOSTS }).remote).toBeNull();
	expect(hubRuntime({ HARNESS_RELAY_ORIGIN, REMOTE_HOSTS }).remote?.origin).toBe(
		HARNESS_RELAY_ORIGIN
	);
});

test('a hub without configured sign-in registers no host for anybody', async () => {
	const relay = remoteHostsFake(),
		runtime = hubRuntime({ HARNESS_RELAY_ORIGIN, REMOTE_HOSTS: relay.namespace });
	expect(runtime.remote?.origin).toBe(HARNESS_RELAY_ORIGIN);
	const request = remoteRequest('POST', '/hosts', registration(await hostIdentity()));
	const reply = await new HubApiController(runtime).handle(request);
	expect(await outcome(reply)).toBe('401 session-required');
	expect(relay.calls).toEqual([]);
});

test('remote-disabled is a public 503', async () => {
	const reply = hubHttpFailure({ code: 'remote-disabled' });
	expect([reply.status, await reply.json()]).toEqual([503, { error: 'remote-disabled' }]);
});
