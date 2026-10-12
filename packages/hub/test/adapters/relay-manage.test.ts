import { expect, test } from 'vitest';
import { RelayManageAdapter } from '../../src/adapters/RelayManageAdapter';
import { DEVICE_ID, hostIdentity, registration } from '../support/remoteFixture';
import { REGISTERED_AT, remoteHostsFake } from '../support/remoteHostsFake';

const owner = { id: 'google:fixture-one' };
const stranger = { id: 'google:fixture-two' };

function setup() {
	const relay = remoteHostsFake();
	return { relay, adapter: new RelayManageAdapter({ hosts: relay.namespace }) };
}

async function code(work: Promise<unknown>): Promise<string> {
	try {
		await work;
		return 'accepted';
	} catch (error) {
		return (error as { code?: string }).code ?? 'threw';
	}
}

test('each operation is one JSON POST to the object named by the host id', async () => {
	const { relay, adapter } = setup(),
		host = await hostIdentity(),
		{ hostId } = host,
		call = { name: hostId, method: 'POST', contentType: 'application/json' };
	const loose = { ...registration(host), owner: { ...owner, email: 'owner@gmail.com' }, extra: 1 };
	expect(await adapter.register(loose)).toEqual({
		hostId,
		generation: 1,
		registeredAt: REGISTERED_AT
	});
	relay.addDevice(hostId, DEVICE_ID);
	expect(await adapter.summary({ owner, hostId, extra: 1 } as never)).toMatchObject({
		hostId,
		name: 'Studio Mac',
		devices: [{ deviceId: DEVICE_ID, online: true, lastSeenAt: null }]
	});
	expect(await adapter.revokeDevice({ owner, hostId, deviceId: DEVICE_ID })).toEqual({ ok: true });
	expect(await adapter.unregister({ owner, hostId })).toEqual({ ok: true });
	const url = (operation: string) => `https://relay.internal/manage/${operation}`;
	expect(relay.calls).toEqual([
		{ ...call, url: url('register'), body: { owner, ...registration(host) } },
		{ ...call, url: url('summary'), body: { owner, hostId } },
		{ ...call, url: url('revoke-device'), body: { owner, hostId, deviceId: DEVICE_ID } },
		{ ...call, url: url('unregister'), body: { owner, hostId } }
	]);
});

test('the three relay refusals keep their own code', async () => {
	const { relay, adapter } = setup(),
		host = await hostIdentity(),
		{ hostId } = host;
	expect(await code(adapter.summary({ owner, hostId }))).toBe('not-found');
	await adapter.register({ owner, ...registration(host) });
	expect(await code(adapter.summary({ owner: stranger, hostId }))).toBe('forbidden');
	expect(await code(adapter.unregister({ owner: stranger, hostId }))).toBe('forbidden');
	const unknown = { owner, hostId, deviceId: DEVICE_ID };
	expect(await code(adapter.revokeDevice(unknown))).toBe('not-found');
	relay.respond = () => Response.json({ error: 'invalid-input' }, { status: 400 });
	expect(await code(adapter.register({ owner, ...registration(host) }))).toBe('invalid-input');
});

test('every other relay answer or failure is unavailable', async () => {
	const { relay, adapter } = setup(),
		host = await hostIdentity(),
		{ hostId } = host;
	const answers: (() => Response)[] = [
		() => {
			throw new Error('relay-internal-detail');
		},
		() => new Response('relay-internal-detail'),
		() => new Response(null, { status: 204 }),
		() => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }),
		() => Response.json({ error: 'relay-internal-detail' }, { status: 500 }),
		() => Response.json({ error: 'credential-invalid' }, { status: 401 }),
		() => Response.json({ error: 'rate-limited' }, { status: 429 }),
		() => Response.json({ error: 'not-found' }, { status: 403 }),
		() => Response.json({ error: 'forbidden' }, { status: 200 }),
		() => Response.json({ error: ['forbidden'] }, { status: 403 }),
		() => Response.json([{ ok: true }]),
		() => Response.json({ generation: 1 })
	];
	for (const respond of answers) {
		relay.respond = respond;
		const seen = [
			await code(adapter.register({ owner, ...registration(host) })),
			await code(adapter.summary({ owner, hostId })),
			await code(adapter.revokeDevice({ owner, hostId, deviceId: DEVICE_ID })),
			await code(adapter.unregister({ owner, hostId }))
		];
		expect([String(respond), seen]).toEqual([
			String(respond),
			['unavailable', 'unavailable', 'unavailable', 'unavailable']
		]);
	}
	expect(relay.calls).toHaveLength(answers.length * 4);
});
