import { expect, test } from 'vitest';
import { WireFramingService } from '../src/services/WireFramingService';

test('nine multipart responses can finish without exceeding the receive stream bound', () => {
	const steps: (() => void)[] = [];
	const answers: string[] = [];
	const receiver = new WireFramingService({ write: () => undefined, streams: 8 });
	const sender = new WireFramingService({
		chunkBytes: 4,
		streams: 8,
		defer: (step) => steps.push(step),
		write: (frame) => {
			const answer = receiver.accept(frame);
			if (answer !== null) answers.push(answer);
		}
	});
	const messages = Array.from({ length: 9 }, (_, i) => String(i).repeat(40));
	expect(() => {
		messages.forEach((message) => sender.send(message));
		while (steps.length) steps.shift()?.();
	}).not.toThrow();
	expect(answers.sort()).toEqual(messages.sort());
});

test('an empty non-final part is rejected before it can grow a zero-byte assembly', () => {
	const receiver = new WireFramingService({ write: () => undefined, incomingBytes: 8 });
	const frame = JSON.stringify({ type: 'part', message: 0, index: 0, last: false, data: '' });
	expect(() => receiver.accept(frame)).toThrow();
});
