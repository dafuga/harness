import { deflateSync } from 'node:zlib';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubPng } from '../../src/routes/api/[...path]/hub-projection-service/hubPng';

const state = 'valid-png-exposes-dimensions-after-scanline-validation';

function chunk(type: string, data: Uint8Array): Uint8Array {
	const bytes = Buffer.alloc(data.length + 12);
	bytes.writeUInt32BE(data.length, 0);
	bytes.write(type, 4, 'ascii');
	bytes.set(data, 8);
	let crc = 0xffffffff;
	for (const value of bytes.subarray(4, data.length + 8)) {
		crc ^= value;
		for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
	bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
	return bytes;
}

function png(width: number, height: number, scanlines: Uint8Array): Uint8Array {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header.set([8, 6, 0, 0, 0], 8);
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([
		signature,
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(scanlines)),
		chunk('IEND', new Uint8Array())
	]);
}

test('Valid PNG exposes dimensions after scanline validation', async () => {
	const inputBytes = png(1, 1, new Uint8Array([0, 12, 34, 56, 255]));
	const input = Array.from(inputBytes);
	const output = await hubPng(inputBytes);
	expect(output).toEqual({ width: 1, height: 1 });
	recordExampleCases(
		{
			unitId: 'hub.function.hub-png',
			symbol: 'hubPng',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'valid one-pixel RGBA PNG', input, output }]
	);
});
