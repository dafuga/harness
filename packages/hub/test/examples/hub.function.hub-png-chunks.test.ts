import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubPngChunks } from '../../src/routes/api/[...path]/hub-projection-service/hubPngChunks';
import type { Header, State } from '../../src/utils/networking-security/hubPngChunks';

const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
	return value >>> 0;
});

function checksum(bytes: number[]): number {
	let value = 0xffffffff;
	for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
	return (value ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: number[]): number[] {
	const typeBytes = [...type].map((character) => character.charCodeAt(0));
	const content = [...typeBytes, ...data];
	const length = data.length;
	return [
		(length >>> 24) & 255,
		(length >>> 16) & 255,
		(length >>> 8) & 255,
		length & 255,
		...content,
		(checksum(content) >>> 24) & 255,
		(checksum(content) >>> 16) & 255,
		(checksum(content) >>> 8) & 255,
		checksum(content) & 255
	];
}

function pngBytes(): Uint8Array {
	const ihdr = [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0];
	return Uint8Array.from([
		...signature,
		...chunk('IHDR', ihdr),
		...chunk('IDAT', [53, 175, 6, 30]),
		...chunk('IEND', [])
	]);
}

function summarize(state: State): { header: Header; dataLengths: number[]; palette: number; transparency: boolean; started: boolean; closed: boolean; end: boolean } {
	return {
		header: state.header,
		dataLengths: state.data.map((part) => part.length),
		palette: state.palette,
		transparency: state.transparency,
		started: state.started,
		closed: state.closed,
		end: state.end
	};
}

test('Parses PNG chunks and collects image data', () => {
	const bytes = pngBytes();
	const valid = summarize(hubPngChunks(bytes));
	const invalidBytes = bytes.slice();
	invalidBytes[invalidBytes.length - 5] ^= 1;
	let invalid: { name: string; code: string; message: string } | undefined;
	try {
		hubPngChunks(invalidBytes);
	} catch (error) {
		const caught = error as Error & { code: string };
		invalid = { name: caught.name, code: caught.code, message: caught.message };
	}
	expect(valid).toEqual({
		header: { width: 1, height: 1, depth: 8, color: 6, interlace: 0 },
		dataLengths: [4],
		palette: 0,
		transparency: false,
		started: true,
		closed: true,
		end: true
	});
	expect(invalid).toEqual({ name: 'HarnessArtifactUnavailableError', code: 'artifact-corrupt', message: 'Harness artifact unavailable' });
	recordExampleCases(
		{
			unitId: 'hub.function.hub-png-chunks',
			symbol: 'hubPngChunks',
			state: 'parses-png-chunks-and-collects-image-data',
			evidence: 'examples-cases',
			file: 'parses-png-chunks-and-collects-image-data.json'
		},
		[
			{ name: 'valid one-pixel RGBA image with one IDAT chunk', input: Array.from(bytes), output: valid },
			{ name: 'IEND CRC mismatch is rejected', input: Array.from(invalidBytes), error: invalid }
		]
	);
});
