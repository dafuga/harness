import type { Page } from '@playwright/test';
import type { ScopeKeys } from '../../../remote/src/models/networking-security/Sealed.types';
import {
	sealedFrame,
	sealedStreamKey
} from '../../../remote/src/utils/networking-security/sealedFrame';
import { sealedPadding } from '../../../remote/src/utils/networking-security/sealedPadding';
import { sealedRecord } from '../../../remote/src/utils/networking-security/sealedRecord';
import { sealedObjectId } from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import type { seedSealedHome } from './sealed-home-fixture';

export async function sealedHomeDelta(
	page: Page,
	fixture: Awaited<ReturnType<typeof seedSealedHome>>
) {
	const { scope, keys, streamId, device } = fixture;
	const objectId = await sealedObjectId(keys, 'transcript', JSON.stringify(['fixture-run', 1]));
	const id = toBase64Url(objectId);
	const data = toBase64Url(new TextEncoder().encode(' · Durable delta canary'));
	const envelope = toBase64Url(
		await sealedRecord(
			keys,
			{ objectId, revision: 1n },
			{
				kind: 'transcript',
				runId: 'fixture-run',
				index: 1,
				data
			}
		)
	);
	const cursors: number[] = [];
	let ready = false;
	await page.route('**/api/sync/v1/**', async (route) => {
		const url = new URL(route.request().url());
		if (route.request().headers()['x-harness-device'] !== device.deviceId)
			throw new Error('Wrong sealed device id');
		if (url.pathname.endsWith('/chain'))
			return route.fulfill({ json: { entries: [], more: false } });
		if (url.pathname.endsWith('/' + id))
			return route.fulfill({ body: ready ? envelope : corruptEnvelope(envelope) });
		const after = Number(url.searchParams.get('after'));
		cursors.push(after);
		return route.fulfill({
			json: {
				objects: after < 3 ? [{ id, revision: 1, change: 3 }] : [],
				next: Math.max(after, 3),
				more: false
			}
		});
	});
	const rejected = await wireFrame(keys, streamId, 1, 'Rejected frame canary');
	rejected[rejected.length - 1] ^= 1;
	const frame = await wireFrame(keys, streamId, 2, 'Live frame canary');
	const poke = await routeWire(page, scope, [rejected, frame]);
	return {
		cursors,
		id,
		envelope,
		release: () => {
			ready = true;
			poke();
		}
	};
}

async function routeWire(page: Page, scope: string, [rejected, frame]: Uint8Array[]) {
	let poke: (() => void) | undefined;
	await page.routeWebSocket('**/api/sync/v1/live?*', (socket) => {
		socket.onMessage((message) => {
			const subscribe = JSON.parse(String(message));
			if (subscribe.t !== 'subscribe' || subscribe.scopes.join() !== scope)
				throw new Error('Wrong sealed subscription');
			socket.send(JSON.stringify({ t: 'subscribed', ring: 2 }));
			socket.send(Buffer.from(rejected));
			socket.send(Buffer.from(frame));
			socket.send(Buffer.from(frame));
			poke = () => socket.send(JSON.stringify({ t: 'poke', scope, kind: 'objects', seq: 3 }));
		});
	});
	return () => poke?.();
}

function corruptEnvelope(envelope: string): string {
	const index = envelope.length - 8;
	return (
		envelope.slice(0, index) + (envelope[index] === 'A' ? 'B' : 'A') + envelope.slice(index + 1)
	);
}

async function wireFrame(keys: ScopeKeys, streamId: Uint8Array, ring: number, text: string) {
	const key = await sealedStreamKey(keys, streamId);
	const frame = await sealedFrame(keys, key, {
		streamId,
		counter: BigInt(ring - 1),
		data: sealedPadding(new TextEncoder().encode(text))
	});
	const wire = new Uint8Array(frame.length + 8);
	new DataView(wire.buffer).setBigUint64(0, BigInt(ring));
	wire.set(frame, 8);
	return wire;
}
