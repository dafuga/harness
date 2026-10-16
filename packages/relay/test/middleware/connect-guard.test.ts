import { afterAll, beforeAll, expect, test } from 'vitest';
import { ConnectGuardMiddleware } from '../../src/middleware/ConnectGuardMiddleware';
import { connectUrl, hostHeaders, registerHost, type TestHost } from '../support/relayActors';
import { allowedOrigin, startRelay, type RelayFixture } from '../support/relayFixture';
import { RelaySocket } from '../support/relaySocket';

const credential = 'Ab0_-'.repeat(8) + 'xyz';
const path = `/v1/hosts/${'a1'.repeat(20)}/connect`;
const upgrade = {
	Upgrade: 'websocket',
	Authorization: `Bearer ${credential}`,
	'X-Harness-Role': 'host'
};
let relay: RelayFixture;
let host: TestHost;

function request(headers: Record<string, string>, origin = 'https://relay.test'): Request {
	return new Request(origin + path, { headers });
}

async function refusal(response: Response | undefined): Promise<[number, unknown]> {
	return [response?.status ?? 0, response ? await response.json() : null];
}

beforeAll(async () => {
	relay = await startRelay();
	host = await registerHost(relay);
}, 60_000);
afterAll(() => relay.stop());

test('ConnectGuardMiddleware lets a native client through', () => {
	expect(new ConnectGuardMiddleware({}).handle(request(upgrade))).toBeUndefined();
	expect(
		new ConnectGuardMiddleware({}).handle(request({ ...upgrade, Upgrade: 'WebSocket' }))
	).toBeUndefined();
});

test('ConnectGuardMiddleware answers 426 to a request that is not an upgrade', async () => {
	const plain = { Authorization: upgrade.Authorization, 'X-Harness-Role': 'host' };
	const response = new ConnectGuardMiddleware({}).handle(request(plain));
	expect(await refusal(response)).toEqual([426, { error: 'upgrade-required' }]);
	expect(response?.headers.get('Upgrade')).toBe('websocket');
	const other = new ConnectGuardMiddleware({}).handle(request({ ...upgrade, Upgrade: 'h2c' }));
	expect(other?.status).toBe(426);
});

test('ConnectGuardMiddleware refuses an origin that is not allow-listed', async () => {
	const guard = new ConnectGuardMiddleware({
		HARNESS_RELAY_ALLOWED_ORIGINS: 'https://one.example, https://two.example'
	});
	const denied = { error: 'origin-denied' };
	expect(
		await refusal(guard.handle(request({ ...upgrade, Origin: 'https://evil.example' })))
	).toEqual([403, denied]);
	expect((await refusal(guard.handle(request({ ...upgrade, Origin: 'null' }))))[0]).toBe(403);
	expect(
		(
			await refusal(
				guard.handle(request({ ...upgrade, Origin: 'https://one.example.evil.example' }))
			)
		)[0]
	).toBe(403);
	expect(guard.handle(request({ ...upgrade, Origin: 'https://two.example' }))).toBeUndefined();
	const closed = new ConnectGuardMiddleware({});
	expect(
		(await refusal(closed.handle(request({ ...upgrade, Origin: 'https://one.example' }))))[0]
	).toBe(403);
});

test('ConnectGuardMiddleware refuses claims it cannot read, before any host is asked', async () => {
	const guard = new ConnectGuardMiddleware({});
	const invalid = [401, { error: 'credential-invalid' }];
	const anonymous = { Upgrade: 'websocket', 'X-Harness-Role': 'host' };
	expect(await refusal(guard.handle(request(anonymous)))).toEqual(invalid);
	expect(
		await refusal(guard.handle(request({ ...upgrade, Authorization: 'Bearer short' })))
	).toEqual(invalid);
	expect(await refusal(guard.handle(request({ ...upgrade, 'X-Harness-Role': 'device' })))).toEqual(
		invalid
	);
});

test('ConnectGuardMiddleware requires TLS in production and staging only', async () => {
	for (const environment of ['production', 'staging']) {
		const guard = new ConnectGuardMiddleware({ HARNESS_ENVIRONMENT: environment });
		const plain = guard.transport(request(upgrade, 'http://relay.test'));
		expect(await refusal(plain)).toEqual([400, { error: 'tls-required' }]);
		expect(guard.transport(request(upgrade, 'https://relay.test'))).toBeUndefined();
	}
	const local = new ConnectGuardMiddleware({ HARNESS_ENVIRONMENT: 'local' });
	expect(local.transport(request(upgrade, 'http://127.0.0.1:8787'))).toBeUndefined();
	expect(
		new ConnectGuardMiddleware({}).transport(request(upgrade, 'http://127.0.0.1'))
	).toBeUndefined();
});

test('the Worker answers 426 to a connect request that is not an upgrade', async () => {
	const response = await relay.fetch(`/v1/hosts/${host.hostId}/connect`, {
		headers: hostHeaders(host)
	});
	expect(response.status).toBe(426);
	expect(await response.json()).toEqual({ error: 'upgrade-required' });
});

test('the Worker refuses a browser origin and opens for the allow-listed one', async () => {
	const url = connectUrl(relay, host.hostId);
	const denied = await RelaySocket.refusal(url, {
		...hostHeaders(host),
		Origin: 'https://evil.example'
	});
	expect(denied).toMatchObject({ status: 403, error: 'origin-denied' });
	const allowed = await RelaySocket.open(url, { ...hostHeaders(host), Origin: allowedOrigin });
	expect((await allowed.next()).type).toBe('ready');
	allowed.close();
});

test('a production relay serves nothing over plain HTTP', async () => {
	const plain = await relay.strict('http://relay.example/v1/health');
	expect([plain.status, await plain.json()]).toEqual([400, { error: 'tls-required' }]);
	const connect = await relay.strict(`http://relay.example/v1/hosts/${host.hostId}/connect`, {
		headers: { ...hostHeaders(host), Upgrade: 'websocket' }
	});
	expect([connect.status, await connect.json()]).toEqual([400, { error: 'tls-required' }]);
	const secure = await relay.strict('https://relay.example/v1/health');
	expect([secure.status, await secure.json()]).toEqual([200, { ok: true, protocol: 1 }]);
	const unknown = await relay.strict('http://relay.example/manage/register', { method: 'POST' });
	expect(unknown.status).toBe(404);
});
