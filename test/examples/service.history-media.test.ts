import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { HistoryMediaService } from '../../src/cli/program/history-index-service/history-media-service/HistoryMediaService';

const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const HELLO_MEDIA = `media/${HELLO_SHA256}.png`;
const GAP = 'capture bytes are unavailable';
const capture = { path: 'captures/Shot.PNG', sha256: HELLO_SHA256 };

test('Writes matching bytes once to a content-addressed path', async () => {
	await withTempDir('history-media-write-', async (directory) => {
		const service = new HistoryMediaService(join(directory, 'out'));
		const bytes = Buffer.from('hello');
		const first = await service.place(bytes, capture, GAP);
		const second = await service.place(bytes, capture, GAP);
		const stored = await readFile(join(directory, 'out', HELLO_MEDIA));

		expect(first.media).toBe(HELLO_MEDIA);
		expect(second.media).toBe(HELLO_MEDIA);
		expect(stored.equals(bytes)).toBe(true);
		expect(service.counts).toEqual({ resolved: 2, missing: 0 });
		recordExampleCases(
			{
				unitId: 'service.history-media',
				symbol: 'HistoryMediaService.place',
				state: 'writes-matching-bytes-once-to-a-content-addressed-path',
				evidence: 'examples-cases',
				file: 'writes-matching-bytes-once-to-a-content-addressed-path.json'
			},
			[
				{
					name: 'matching hello bytes for a PNG capture resolve to a content-addressed media path',
					input: { bytes: 'hello', file: capture, gap: GAP },
					output: { media: first.media, stored: stored.toString('utf8') }
				},
				{
					name: 'the second identical placement reuses the same media path',
					input: { bytes: 'hello', file: capture, gap: GAP },
					output: { media: second.media, counts: service.counts }
				}
			]
		);
	});
});

test('Returns the caller gap for missing or mismatched bytes', async () => {
	await withTempDir('history-media-gap-', async (directory) => {
		const service = new HistoryMediaService(join(directory, 'out'));
		const missing = await service.place(undefined, capture, GAP);
		const mismatched = await service.place(Buffer.from('world'), capture, GAP);

		expect(missing.media).toBeNull();
		expect(missing.gap).toBe(GAP);
		expect(mismatched.media).toBeNull();
		expect(mismatched.gap).toBe(GAP);
		expect(service.counts).toEqual({ resolved: 0, missing: 2 });
		expect(await readdir(directory)).toEqual([]);
		recordExampleCases(
			{
				unitId: 'service.history-media',
				symbol: 'HistoryMediaService.place',
				state: 'returns-the-caller-gap-for-missing-or-mismatched-bytes',
				evidence: 'examples-cases',
				file: 'returns-the-caller-gap-for-missing-or-mismatched-bytes.json'
			},
			[
				{
					name: 'undefined bytes produce media null with the supplied gap',
					input: { bytes: null, file: capture, gap: GAP },
					output: { media: missing.media, gap: missing.gap }
				},
				{
					name: 'bytes whose digest differs from the file digest produce media null with the supplied gap',
					input: { bytes: 'world', file: capture, gap: GAP },
					output: { media: mismatched.media, gap: mismatched.gap }
				}
			]
		);
	});
});
