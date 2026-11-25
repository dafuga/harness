import { expect, test, vi } from 'vitest';
import {
	newScopeKeys,
	sealedObjectId,
	sealedScopeKeys
} from '../../../../remote/src/utils/networking-security/sealedScopeKeys';
import {
	openSealedRecord,
	sealedRecordHeader
} from '../../../../remote/src/utils/networking-security/sealedRecord';
import {
	openSealedFrame,
	sealedFrameHeader,
	sealedStreamKey
} from '../../../../remote/src/utils/networking-security/sealedFrame';
import { sealedUnpadding } from '../../../../remote/src/utils/networking-security/sealedPadding';
import { toBase64Url } from '../../../../remote/src/utils/networking-security/remoteBytes';
import { SessionStreamPublisherService } from '../../../src/services/session-stream/SessionStreamPublisherService';

function fixture() {
	const records = new Map<string, Uint8Array>();
	const frames: Uint8Array[] = [];
	const transport = {
		readRevision: async (_scope: string, id: string) => {
			const previous = records.get(id);
			return previous ? sealedRecordHeader(previous).revision : 0n;
		},
		putObject: vi.fn(async (_scope: string, id: string, envelope: Uint8Array) => {
			records.set(id, envelope);
		}),
		sendFrame: vi.fn(async (bytes: Uint8Array) => {
			frames.push(bytes);
		}),
		close: vi.fn()
	};
	return { frames, transport };
}

test('seals ordered status revisions and resumes the same opaque object after restart', async () => {
	const keys = await sealedScopeKeys(newScopeKeys());
	const { transport } = fixture();
	const runId = 'local-run-canary';
	const publisher = new SessionStreamPublisherService(keys, runId, transport);
	await Promise.all([
		publisher.publishStatus({ status: 'running' }),
		publisher.publishStatus({ status: 'paused' })
	]);
	const restarted = new SessionStreamPublisherService(keys, runId, transport);
	await restarted.publishStatus({ status: 'finished' });

	const id = toBase64Url(await sealedObjectId(keys, 'session', runId));
	const calls = transport.putObject.mock.calls;
	expect(calls.map(([, address]) => address)).toEqual([id, id, id]);
	expect(calls.map(([, , value]) => sealedRecordHeader(value).revision)).toEqual([1n, 2n, 3n]);
	const values = await Promise.all(calls.map(([, , bytes]) => openSealedRecord(keys, bytes)));
	expect(values.map(({ value }) => value)).toMatchObject([
		{ runId, status: 'running' },
		{ runId, status: 'paused' },
		{ runId, status: 'finished' }
	]);
	expect(values[0].value).toMatchObject({ streamId: expect.any(String) });
	expect(values[2].value).not.toHaveProperty(
		'streamId',
		(values[0].value as { streamId: string }).streamId
	);
	expect(JSON.stringify(calls)).not.toContain(runId);
});

test('orders binary chunks and consumes a counter even if delivery fails', async () => {
	const keys = await sealedScopeKeys(newScopeKeys());
	const { transport, frames } = fixture();
	transport.sendFrame.mockImplementationOnce(async (frame) => {
		frames.push(frame);
		throw new Error('ambiguous delivery');
	});
	const publisher = new SessionStreamPublisherService(keys, 'run', transport);
	const output = Buffer.alloc(128 * 1024 + 1, 231);
	const expected = Uint8Array.from(output);
	await expect(publisher.publishOutput(Uint8Array.of(3))).rejects.toThrow('ambiguous delivery');
	const sending = publisher.publishOutput(output);
	output.fill(0);
	await Promise.all([sending, publisher.publishOutput(Uint8Array.of(7))]);
	const headers = frames.map(sealedFrameHeader);
	const key = await sealedStreamKey(keys, headers[0].streamId);
	expect(headers.map(({ counter }) => counter)).toEqual([0n, 1n, 2n, 3n]);
	expect(
		headers.every(({ streamId }) => toBase64Url(streamId) === toBase64Url(headers[0].streamId))
	).toBe(true);
	expect(frames.every((frame) => frame.length <= 256 * 1024)).toBe(true);
	const plain = await Promise.all(
		frames.map(async (frame) => sealedUnpadding((await openSealedFrame(keys, key, frame)).data))
	);
	expect(plain).toEqual([
		Uint8Array.of(3),
		expected.slice(0, -1),
		Uint8Array.of(231),
		Uint8Array.of(7)
	]);
	await publisher.close();
	expect(transport.close).toHaveBeenCalledOnce();
	await expect(publisher.publishOutput(output)).rejects.toThrow('closed');
});

test('seals even a short transcript above the R2 threshold and uses a stable retry address', async () => {
	const keys = await sealedScopeKeys(newScopeKeys());
	const { transport } = fixture();
	const publisher = new SessionStreamPublisherService(keys, 'run', transport);
	const data = new TextEncoder().encode('private transcript canary');
	await publisher.publishTranscriptSegment(6, data);
	await publisher.publishTranscriptSegment(6, data);
	const [[, firstId, first], [, secondId, second]] = transport.putObject.mock.calls;
	expect(firstId).toBe(secondId);
	expect(first.length).toBeGreaterThan(32 * 1024);
	expect(second.length).toBeLessThan(4 * 1024 * 1024);
	expect(new TextDecoder().decode(first)).not.toContain('private transcript canary');
	expect(await openSealedRecord(keys, second)).toMatchObject({
		header: { revision: 2n },
		value: { kind: 'transcript', runId: 'run', index: 6, data: toBase64Url(data) }
	});
});
