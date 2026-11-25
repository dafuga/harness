import { expect, test } from 'vitest';
import { SealedError } from '../../../src/models/networking-security/SealedError';
import { remoteBytes, toHex } from '../../../src/utils/networking-security/remoteBytes';
import {
	openSealedFrame,
	sealedFrame,
	sealedFrameHeader,
	sealedStreamKey
} from '../../../src/utils/networking-security/sealedFrame';
import {
	newScopeKeys,
	sealedScopeKeys
} from '../../../src/utils/networking-security/sealedScopeKeys';

async function stream() {
	const keys = await sealedScopeKeys(newScopeKeys());
	const streamId = crypto.getRandomValues(new Uint8Array(16));
	return { keys, streamId, key: await sealedStreamKey(keys, streamId) };
}

test('frames round-trip in order and expose only stream id and counter', async () => {
	const { keys, streamId, key } = await stream();
	const frames = await Promise.all(
		['$ bun test', 'ok 12 passed'].map((text, index) =>
			sealedFrame(keys, key, { streamId, counter: BigInt(index), data: remoteBytes(text) })
		)
	);
	expect(sealedFrameHeader(frames[1]!).counter).toBe(1n);
	expect(toHex(sealedFrameHeader(frames[0]!).streamId)).toBe(toHex(streamId));
	const opened = await openSealedFrame(keys, key, frames[1]!);
	expect(new TextDecoder().decode(opened.data)).toBe('ok 12 passed');
});

test('a changed byte, a moved counter or another stream key fails', async () => {
	const { keys, streamId, key } = await stream();
	const frame = await sealedFrame(keys, key, {
		streamId,
		counter: 5n,
		data: remoteBytes('output')
	});
	for (const position of [0, 1, 20, 21, 44, 45, frame.length - 1]) {
		const changed = frame.slice();
		changed[position]! ^= 0x80;
		await expect(openSealedFrame(keys, key, changed), `byte ${position}`).rejects.toThrow(
			SealedError
		);
	}
	const other = await sealedStreamKey(keys, crypto.getRandomValues(new Uint8Array(16)));
	await expect(openSealedFrame(keys, other, frame)).rejects.toThrow(SealedError);
	await expect(sealedStreamKey(keys, new Uint8Array(15))).rejects.toThrow(SealedError);
});
