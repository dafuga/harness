import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { FRAME_SECONDS, replayFrames } from '../../src/utils/reports-media/replayFrames';
import type { ReplayFrame } from '../../src/utils/reports-media/replayFrames.types';

type Items = Parameters<typeof replayFrames>[0];
type Item = Items[number];

const UNIT_ID = 'reports.function.replay-frames';

function file(id: string, title: string, fileName: string): Item {
	return { id, title, category: 'Playwright', file: fileName, status: 'passed' };
}

function shot(id: string, title: string, extra: Partial<Item> = {}): Item {
	return {
		...file(id, title, `${id}.png`),
		mediaType: 'image',
		mimeType: 'image/png',
		...extra
	};
}

function summarise(frames: ReplayFrame[]) {
	return frames.map(({ item, scene, index, start, duration }) => ({
		id: item.id,
		scene,
		index,
		start,
		duration
	}));
}

const SIGN_IN = shot('pw-1-0', 'Scene 1 sign in - screenshot', { order: 1, checkId: 'pw-1' });
const CHECKOUT = shot('pw-2-0', 'Scene 2 checkout - screenshot', { order: 2, checkId: 'pw-2' });
const MISSING = shot('pw-3-0', 'Scene 3 receipt - screenshot', { missing: true });

const BEFORE: Item = {
	id: '2f9c8a64-1b7e-4d03-a5c2-9e8f7d6c5b4a-before',
	title: 'Checkout summary before',
	category: 'Uploaded comparison',
	file: '0e5a9d2c7f4b81e3a6d0c9f5b2e8714d3a6c0f9e2b5d8a1c4e7f0b3d6a9c2e85.png',
	status: 'not-proven',
	source: 'Manual upload · Cloudflare R2',
	capturedAt: '2026-11-14T09:41:07.302Z',
	comparison: '2f9c8a64-1b7e-4d03-a5c2-9e8f7d6c5b4a',
	storage: 'r2',
	viewport: '1440px desktop',
	phase: 'before'
};

const AFTER: Item = {
	...BEFORE,
	id: '2f9c8a64-1b7e-4d03-a5c2-9e8f7d6c5b4a-after',
	title: 'Checkout summary after',
	file: '4a7e0c3d9b1f526e8a0d4c7b3e9f1a25c6d8b0e4f2a7c93d1b5e8f0a6c4d2b71.png',
	phase: 'after'
};

test('Orders image frames by their order field', () => {
	const input = [CHECKOUT, SIGN_IN];
	const frames = replayFrames(input);

	expect(summarise(frames)).toEqual([
		{ id: 'pw-1-0', scene: 1, index: 0, start: 0, duration: 3 },
		{ id: 'pw-2-0', scene: 2, index: 1, start: 3, duration: 3 }
	]);
	expect(frames[0].item).toBe(SIGN_IN);
	expect(FRAME_SECONDS).toBe(3);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'replayFrames',
			state: 'orders-image-frames-by-their-order-field',
			evidence: 'examples-cases',
			file: 'orders-image-frames-by-their-order-field.json'
		},
		[
			{
				name: 'two screenshots given in reverse order',
				input,
				output: summarise(frames)
			}
		]
	);
});

test('Drops before-phase and missing evidence from the sequence', () => {
	const input = [BEFORE, AFTER, MISSING];
	const frames = replayFrames(input);

	expect(summarise(frames)).toEqual([
		{ id: AFTER.id, scene: null, index: 0, start: 0, duration: 3 }
	]);
	expect(frames[0].item).toBe(AFTER);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'replayFrames',
			state: 'drops-before-phase-and-missing-evidence-from-the-sequence',
			evidence: 'examples-cases',
			file: 'drops-before-phase-and-missing-evidence-from-the-sequence.json'
		},
		[
			{
				name: 'before-comparison and missing screenshots are removed',
				input,
				output: summarise(frames)
			}
		]
	);
});

test('Keeps input position for unordered and tied items', () => {
	const scene1 = shot('b', 'Scene 1 setup', { order: 1 });
	const scene4 = shot('c', 'scene 4 export', { order: 1 });
	const unordered = shot('a', 'Scenes 5 wrap-up');
	const input = [scene1, scene4, unordered];
	const frames = replayFrames(input);

	expect(summarise(frames)).toEqual([
		{ id: 'b', scene: 1, index: 0, start: 0, duration: 3 },
		{ id: 'c', scene: 4, index: 1, start: 3, duration: 3 },
		{ id: 'a', scene: null, index: 2, start: 6, duration: 3 }
	]);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'replayFrames',
			state: 'keeps-input-position-for-unordered-and-tied-items',
			evidence: 'examples-cases',
			file: 'keeps-input-position-for-unordered-and-tied-items.json'
		},
		[
			{
				name: 'tied order keeps input order and missing order uses input position',
				input,
				output: summarise(frames)
			}
		]
	);
});

test('Keeps pdf files and drops wav audio without a media type', () => {
	const brief = file('brief', 'Brief', 'brief.pdf');
	const voice = file('voice', 'Voice note', 'voice.wav');
	const input = [brief, voice];
	const frames = replayFrames(input);

	expect(summarise(frames)).toEqual([
		{ id: 'brief', scene: null, index: 0, start: 0, duration: 3 }
	]);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'replayFrames',
			state: 'keeps-pdf-files-and-drops-wav-audio-without-a-media-type',
			evidence: 'examples-cases',
			file: 'keeps-pdf-files-and-drops-wav-audio-without-a-media-type.json'
		},
		[
			{
				name: 'pdf without mediaType counts as image, wav is audio',
				input,
				output: summarise(frames)
			}
		]
	);
});
