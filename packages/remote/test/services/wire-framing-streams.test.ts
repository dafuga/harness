import { expect, test } from 'vitest';
import type { WirePart } from '../../src/models/RemoteLocal.types';
import { WireFramingService } from '../../src/services/WireFramingService';
import type { WireFramingOptions } from '../../src/services/WireFramingService';

const part = (frame: string) => JSON.parse(frame) as WirePart;
const code = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return (error as { code?: string }).code ?? 'threw';
	}
	return 'accepted';
};
/** A sender whose frames go straight into a receiver, with later steps run on demand. */
function joined(options: Partial<WireFramingOptions>) {
	const steps: (() => void)[] = [],
		frames: WirePart[] = [],
		arrived: string[] = [],
		receiver = new WireFramingService({ write: () => undefined, ...options });
	const sender = new WireFramingService({
		...options,
		defer: (step) => steps.push(step),
		write: (frame) => {
			frames.push(part(frame));
			const text = receiver.accept(frame);
			if (text !== null) arrived.push(text);
		}
	});
	const flush = () => {
		while (steps.length) steps.shift()?.();
	};
	return { sender, frames, arrived, flush };
}
/** The most multipart messages that were in flight at one time. */
function widest(frames: WirePart[]): number {
	const flowing = new Set<number>();
	let most = 0;
	for (const frame of frames) {
		if (frame.index === 0 && frame.last) continue;
		if (frame.last) flowing.delete(frame.message);
		else flowing.add(frame.message);
		most = Math.max(most, flowing.size);
	}
	return most;
}

test('a sender never has more multipart messages in flight than the bound, ordered ones included', () => {
	const f = joined({ chunkBytes: 4, streams: 3 }),
		long = (letter: string) => letter.repeat(20),
		texts = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(long);
	texts.slice(0, 4).forEach((text) => f.sender.send(text));
	f.sender.send(long('x'), true);
	f.sender.send(long('y'), true);
	texts.slice(4).forEach((text) => f.sender.send(text));
	f.flush();
	expect([...f.arrived].sort()).toEqual([...texts, long('x'), long('y')].sort());
	expect(f.arrived.indexOf(long('x'))).toBeLessThan(f.arrived.indexOf(long('y')));
	expect(widest(f.frames)).toBe(3);
});
test('a message of one part passes while every stream is taken', () => {
	const f = joined({ chunkBytes: 4, streams: 2 });
	f.sender.send('aaaaaaaaaaaa');
	f.sender.send('bbbbbbbbbbbb');
	f.sender.send('cccccccccccc');
	f.sender.send('tiny');
	f.sender.send('note', true);
	expect(f.arrived).toEqual(['tiny', 'note']);
	f.flush();
	expect(f.arrived).toHaveLength(5);
	expect(widest(f.frames)).toBe(2);
});
test('a part larger than a chunk, and more parts than a message may have, are refused', () => {
	const big = { type: 'part', message: 0, index: 0, last: true, data: 'YWJjZGU=' },
		receiver = () => new WireFramingService({ write: () => undefined, chunkBytes: 4, parts: 3 });
	expect(code(() => receiver().accept(JSON.stringify(big)))).toBe('too-large');
	const many = receiver(),
		piece = (index: number, last = false) =>
			JSON.stringify({ type: 'part', message: 0, index, last, data: 'YQ==' });
	for (const index of [0, 1, 2]) expect(many.accept(piece(index))).toBeNull();
	expect(code(() => many.accept(piece(3, true)))).toBe('too-large');
	const exact = receiver();
	for (const index of [0, 1]) exact.accept(piece(index));
	expect(exact.accept(piece(2, true))).toBe('aaa');
});
