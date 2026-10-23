import type { Options } from './wire-framing.test.types';
import { expect, test } from 'vitest';
import { remoteLimits } from '../../src/models/Remote.types';
import type { WirePart } from '../../src/models/RemoteLocal.types';
import { WireFramingService } from '../../src/services/WireFramingService';
import type { WireFramingOptions } from '../../src/services/WireFramingService';
/** A sender whose later steps run only when the test says so. */
function sender(options: Options = {}) {
	const frames: string[] = [],
		steps: (() => void)[] = [];
	const framing = new WireFramingService({
		write: (frame) => frames.push(frame),
		defer: (step) => steps.push(step),
		...options
	});
	const flush = () => {
		while (steps.length) steps.shift()?.();
		return frames;
	};
	return { framing, frames, flush };
}
const receiver = (options: Options = {}) =>
	new WireFramingService({ write: () => undefined, ...options });
const part = (frame: string) => JSON.parse(frame) as WirePart;
const code = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return (error as { code?: string }).code ?? 'threw';
	}
	return 'accepted';
};
const small = { chunkBytes: 4 };

test('a short message is one frame, written at once, and text round-trips exactly', () => {
	for (const text of ['{"type":"response"}', 'héllo ✓ 😀', '']) {
		const { framing, frames } = sender();
		framing.send(text);
		expect(frames).toHaveLength(1);
		expect(part(frames[0])).toMatchObject({ type: 'part', index: 0, last: true });
		expect(receiver().accept(frames[0])).toBe(text);
	}
});
test('a megabyte is split into frames within the bound and reassembled only at its end', () => {
	const text = 'é😀'.repeat(180000),
		{ framing, flush } = sender(),
		incoming = receiver();
	framing.send(text);
	const frames = flush(),
		answers = frames.map((frame) => incoming.accept(frame));
	expect(new TextEncoder().encode(text).length).toBeGreaterThan(1048576);
	expect(frames.length).toBeGreaterThan(8);
	expect(Math.max(...frames.map((frame) => frame.length))).toBeLessThanOrEqual(
		remoteLimits.frameBytes
	);
	expect(frames.map((frame) => part(frame).index)).toEqual(frames.map((_, index) => index));
	expect(answers.slice(0, -1).every((answer) => answer === null)).toBe(true);
	expect(answers.at(-1)).toBe(text);
});
test('frames of concurrent answers take turns, and each message arrives whole', () => {
	const { framing, frames, flush } = sender(small),
		incoming = receiver(small);
	framing.send('aaaaaaaaaaaa');
	framing.send('bbbbbbbbbbbb');
	expect(frames).toHaveLength(2);
	flush();
	expect(frames.map((frame) => part(frame).message)).toEqual([0, 1, 0, 1, 0, 1]);
	const arrived = frames.map((frame) => incoming.accept(frame)).filter((text) => text !== null);
	expect(arrived).toEqual(['aaaaaaaaaaaa', 'bbbbbbbbbbbb']);
});
test('ordered messages keep their order beside a long answer, and ids rise in starting order', () => {
	const { framing, frames, flush } = sender(small),
		incoming = receiver(small);
	framing.send('r'.repeat(40));
	framing.send('first event', true);
	framing.send('second', true);
	framing.send('s'.repeat(8));
	flush();
	const arrived = frames.map((frame) => incoming.accept(frame)).filter((text) => text !== null);
	expect(arrived.indexOf('first event')).toBeLessThan(arrived.indexOf('second'));
	expect(arrived.indexOf('second')).toBeLessThan(arrived.indexOf('r'.repeat(40)));
	expect([...arrived].sort()).toEqual(
		['first event', 'second', 'r'.repeat(40), 's'.repeat(8)].sort()
	);
	const starts = frames.map(part).filter((item) => item.index === 0);
	expect(starts.map((item) => item.message)).toEqual(starts.map((_, index) => index));
});
test('an incomplete message is never delivered, and reset forgets it', () => {
	const { framing, flush } = sender(small),
		incoming = receiver(small);
	framing.send('incomplete!!');
	const frames = flush();
	expect(frames).toHaveLength(3);
	expect([incoming.accept(frames[0]), incoming.accept(frames[1])]).toEqual([null, null]);
	incoming.reset();
	expect(code(() => incoming.accept(frames[2]))).toBe('invalid-message');
});
test('frames out of order, repeated, or of a message that already started are refused', () => {
	const { framing, flush } = sender(small);
	framing.send('abcdefghijkl');
	framing.send('mnop');
	const [a0, b0, a1, a2] = flush();
	expect(code(() => receiver(small).accept(a1))).toBe('invalid-message');
	const skipping = receiver(small);
	skipping.accept(a0);
	expect(code(() => skipping.accept(a2))).toBe('invalid-message');
	const repeating = receiver(small);
	repeating.accept(a0);
	expect(code(() => repeating.accept(a0))).toBe('invalid-message');
	const replaying = receiver(small);
	expect(replaying.accept(b0)).toBe('mnop');
	expect(code(() => replaying.accept(b0))).toBe('invalid-message');
	expect(code(() => replaying.accept(a0))).toBe('invalid-message');
});
test('too many partial messages, an oversize frame and an oversize message are refused', () => {
	const { framing, flush } = sender(small);
	for (const text of ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']) framing.send(text);
	const frames = flush(),
		starts = frames.filter((frame) => part(frame).index === 0),
		bounded = receiver({ ...small, streams: 2 });
	bounded.accept(starts[0]);
	bounded.accept(starts[1]);
	expect(code(() => bounded.accept(starts[2]))).toBe('too-many-requests');
	expect(
		code(() =>
			receiver({ frameBytes: 64 }).accept(JSON.stringify(part(starts[0])) + ' '.repeat(64))
		)
	).toBe('too-large');
	const limited = receiver({ ...small, incomingBytes: 6 });
	limited.accept(frames.filter((frame) => part(frame).message === 0)[0]);
	expect(code(() => limited.accept(frames.filter((frame) => part(frame).message === 0)[1]))).toBe(
		'too-large'
	);
	expect(code(() => sender({ outgoingBytes: 4 }).framing.send('12345'))).toBe('too-large');
});
test('anything that is not exactly a part is refused', () => {
	const good = { type: 'part', message: 0, index: 0, last: true, data: 'YQ==' };
	expect(receiver().accept(JSON.stringify(good))).toBe('a');
	const refused: unknown[] = [
		'not json',
		[good],
		null,
		{ ...good, type: 'request' },
		{ ...good, extra: 1 },
		{ ...good, message: -1 },
		{ ...good, message: 1.5 },
		{ ...good, index: '0' },
		{ ...good, last: 'yes' },
		{ ...good, data: 'a-b_' },
		{ ...good, data: 'YQ' },
		{ ...good, data: '/w==' },
		{ type: 'part', message: 0, index: 0, last: true }
	];
	for (const frame of refused)
		expect(
			code(() => receiver().accept(typeof frame === 'string' ? frame : JSON.stringify(frame)))
		).toBe('invalid-message');
});
