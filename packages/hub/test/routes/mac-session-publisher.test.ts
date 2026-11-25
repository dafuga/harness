import { expect, test, vi } from 'vitest';
import type { ClientOptions, WebSocket as WebSocketClient } from 'ws';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';
import type { ScopeKeys } from '../../../remote/src/models/networking-security/Sealed.types';
import { commitmentOf } from '../../../remote/test/support/sealedFixture';
import { sealedChain } from '../../../remote/src/utils/networking-security/sealedChain';
import { sealedChainEntry } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../remote/src/utils/networking-security/sealedDevice';
import {
	openSealedGrant,
	sealedGrant
} from '../../../remote/src/utils/networking-security/sealedGrant';
import { storedByObject, storedObjects, storedRows } from '../support/syncCapture';
import { expectNoPlaintext } from '../../../remote/test/support/plaintextCanary';
import {
	newScopeKeys,
	scopeName,
	sealedObjectId
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import {
	fromBase64Url,
	toBase64Url
} from '../../../remote/src/utils/networking-security/remoteBytes';
import { openSealedRecord } from '../../../remote/src/utils/networking-security/sealedRecord';
import {
	openSealedFrame,
	sealedFrameHeader,
	sealedStreamKey
} from '../../../remote/src/utils/networking-security/sealedFrame';
import { sealedUnpadding } from '../../../remote/src/utils/networking-security/sealedPadding';
import { openSessionPublisher } from '../../../desktop/src/services/session-stream/openSessionPublisher';

const bridge = vi.hoisted(() => ({ origin: '' }));
const trusted = 'https://hub.example.test';
const account = 'google:fixture-a';
const bearer = 'session-a';
const encoder = new TextEncoder();
const runId = 'local private run identifier';
const output = 'session output canary';

vi.mock('ws', async (load) => {
	const { WebSocket } = await load<{ WebSocket: typeof WebSocketClient }>();
	return {
		WebSocket: class extends WebSocket {
			constructor(url: URL, options: ClientOptions) {
				expect(url.href).toBe('wss://hub.example.test/api/sync/v1/live');
				expect(options.followRedirects).toBe(false);
				expect(options.headers?.Authorization).toBe(`Bearer ${bearer}`);
				super(bridge.origin.replace('http:', 'ws:') + url.pathname, {
					...options,
					headers: { ...options.headers, 'x-test-session': bearer }
				});
			}
		}
	};
});

function bridgeFetch() {
	const fetchReal = globalThis.fetch;
	return vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
		if (!(url instanceof URL) || url.origin !== trusted) return fetchReal(url, init);
		expect(url.search).toBe('');
		expect(url.pathname).toMatch(/^\/api\/sync\/v1\/objects\//);
		expect(init?.redirect).toBe('error');
		const headers = new Headers(init?.headers);
		expect(headers.get('authorization')).toBe(`Bearer ${bearer}`);
		headers.set('x-test-session', bearer);
		return fetchReal(bridge.origin + url.pathname, { ...init, headers });
	});
}

async function enrollFixture(hub: SyncFixture) {
	const raw = newScopeKeys();
	const mac = await sealedDevice();
	const commitment = await commitmentOf(raw);
	const device = sealedDevicePublic(mac, 'admin', [commitment.scope]);
	const headers = { 'X-Harness-Device': device.deviceId };
	const entry = await sealedChainEntry(mac, {
		seq: 0,
		prev: '',
		at: 1,
		by: device.deviceId,
		body: { type: 'genesis', account, devices: [device], scopes: [commitment] }
	});
	expect((await hub.call(bearer, 'POST', 'chain', { body: entry, headers })).status).toBe(201);
	const grant = await sealedGrant(account, raw, device);
	expect((await hub.call(bearer, 'POST', 'grants', { body: grant, headers })).status).toBe(201);
	const response = await hub.call(bearer, 'GET', `grants?device=${device.deviceId}`, { headers });
	const stored = (await response.json()) as { grants: (typeof grant)[] };
	const keys = await openSealedGrant(
		stored.grants[0],
		mac,
		await sealedChain([entry], { account })
	);
	return { keys, device: device.deviceId };
}

async function assertFrame(keys: ScopeKeys, messages: (string | Uint8Array)[]) {
	const relayed = messages.find((message) => message instanceof Uint8Array);
	if (!relayed) throw new Error('The account object did not relay a binary frame.');
	const frame = relayed.slice(8);
	const { streamId, counter } = sealedFrameHeader(frame);
	const streamKey = await sealedStreamKey(keys, streamId);
	const opened = await openSealedFrame(keys, streamKey, frame);
	expect(counter).toBe(0n);
	expect(sealedUnpadding(opened.data)).toEqual(encoder.encode(output));
	return toBase64Url(streamId);
}

test('the native publisher writes sealed state, binary live output and an R2 transcript through the Hub', async () => {
	const hub = await startSync();
	bridge.origin = hub.origin;
	const fetchSpy = bridgeFetch();
	const { keys, device } = await enrollFixture(hub);
	const scope = scopeName(keys);
	const publisher = openSessionPublisher({ origin: trusted, bearer, device, keys }, runId);
	const watcher = await hub.socket(bearer, device);
	try {
		watcher.send(JSON.stringify({ t: 'subscribe', scopes: [scope] }));
		await watcher.until(1);
		await publisher.publishStatus({ status: 'running' });
		await expect(publisher.publishCapturedOutput(0, encoder.encode(output))).resolves.toBe('live');
		const messages = await watcher.until(4);
		const streamId = await assertFrame(keys, messages);

		const id = toBase64Url(await sealedObjectId(keys, 'session', runId));
		const status = await hub.call(bearer, 'GET', `objects/${scope}/${id}`, {
			headers: { 'X-Harness-Device': device }
		});
		expect(status.headers.get('X-Sealed-Revision')).toBe('1');
		expect(await openSealedRecord(keys, fromBase64Url(await status.text()))).toMatchObject({
			value: { kind: 'session', runId, streamId, status: 'running' }
		});
		const [objectKey, transcript] = await storedObjects(hub);
		expect(objectKey).toEqual(expect.any(String));
		expect(await openSealedRecord(keys, transcript as Uint8Array)).toMatchObject({
			value: {
				kind: 'transcript',
				runId,
				index: 0,
				data: toBase64Url(encoder.encode(output)),
				streamId,
				throughCounter: '0'
			}
		});
		expectNoPlaintext(
			[
				...messages,
				...(await storedRows(hub)),
				...(await storedObjects(hub)),
				...(await storedByObject(hub, account))
			],
			[runId, output]
		);
	} finally {
		await publisher.close();
		watcher.close();
		fetchSpy.mockRestore();
		await hub.stop();
	}
}, 30_000);
