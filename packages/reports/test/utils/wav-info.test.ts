import { expect, test } from 'vitest';
import { wavInfo } from '../../src/utils/wavInfo';
import { audioFixture } from '../audioFixture';
test('derives duration from actual PCM data and tolerates non-audio chunks', () => {
	const wave = audioFixture(1.25);
	expect(wavInfo(wave).durationSeconds).toBe(1.25);
	const junk = Buffer.alloc(12);
	junk.write('JUNK');
	junk.writeUInt32LE(4, 4);
	const extra = Buffer.concat([wave.subarray(0, 12), junk, wave.subarray(12)]);
	extra.writeUInt32LE(extra.length - 8, 4);
	expect(wavInfo(extra).durationSeconds).toBe(1.25);
});
test('rejects inconsistent sample format and missing data', () => {
	const bad = audioFixture();
	bad.writeUInt32LE(0, 24);
	expect(() => wavInfo(bad)).toThrow(/format/);
	const missing = audioFixture();
	missing.write('JUNK', 36);
	expect(() => wavInfo(missing)).toThrow(/required/);
});
