import { afterAll, beforeAll, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/harness/media/[file]/+server';
import type { Event } from './reports.endpoint.harness-media-file.test.types';

const unitId = 'reports.endpoint.harness-media-file';
const symbol = 'GET';
const stored = `${'a'.repeat(64)}.png`;
const absent = `${'b'.repeat(64)}.png`;
const owner = '127.0.0.1';
const pixels = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const saved = new Map<string, string | undefined>();
let directory = '';

/** A minimal request event: only the fields the owner guard and the media handler read. */
function eventFor(file: string | undefined, address = owner): Event {
	const url = new URL('http://127.0.0.1/harness/media/fixture');
	const params = file === undefined ? {} : { file };
	return {
		params,
		url,
		request: new Request(url),
		getClientAddress: () => address
	} as unknown as Event;
}

/** Turns a response into plain data, so the recorded output stays readable JSON. */
async function summary(response: Response) {
	const bytes = new Uint8Array(await response.arrayBuffer());
	return {
		status: response.status,
		contentType: response.headers.get('content-type'),
		length: bytes.byteLength,
		body: Buffer.from(bytes).toString('base64')
	};
}

function setEnv(name: string, value: string | undefined) {
	saved.set(name, process.env[name]);
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

beforeAll(() => {
	directory = mkdtempSync(join(tmpdir(), 'reports-media-file-'));
	mkdirSync(join(directory, 'media'));
	writeFileSync(join(directory, 'media', stored), pixels);
	setEnv('HARNESS_CONSOLE_DATA', directory);
	setEnv('HARNESS_OWNER_MODE', 'loopback');
	setEnv('HARNESS_BIND', '127.0.0.1');
	setEnv('ADDRESS_HEADER', undefined);
});

afterAll(() => {
	for (const [name, value] of saved) {
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
	}
	rmSync(directory, { recursive: true, force: true });
});

test('Reads a recorded media file from the local history directory', async () => {
	const response = await GET(eventFor(stored));
	const output = await summary(response);
	expect(output.status).toBe(200);
	expect(output.length).toBe(pixels.byteLength);
	expect(Buffer.from(output.body, 'base64')).toEqual(Buffer.from(pixels));
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'reads-recorded-media-file',
			evidence: 'examples-cases',
			file: 'reads-recorded-media-file.json'
		},
		[{ name: 'stored png is returned in full', input: { file: stored, address: owner }, output }]
	);
});

test('Reports the recorded content type of the media file', async () => {
	const response = await GET(eventFor(stored));
	const output = { contentType: response.headers.get('content-type') };
	expect(output.contentType).toBe('image/png');
	expect(response.headers.get('cache-control')).toContain('private');
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'reports-recorded-content-type',
			evidence: 'examples-cases',
			file: 'reports-recorded-content-type.json'
		},
		[{ name: 'png media reports image/png', input: { file: stored }, output }]
	);
});

test('Refuses an ordinary missing media filename as not found', async () => {
	const absentOutput = await summary(await GET(eventFor(absent)));
	const emptyOutput = await summary(await GET(eventFor(undefined)));
	expect(absentOutput.status).toBe(404);
	expect(emptyOutput.status).toBe(404);
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'refuses-missing-media-filename',
			evidence: 'examples-cases',
			file: 'refuses-missing-media-filename.json'
		},
		[
			{ name: 'absent stored name is not found', input: { file: absent }, output: absentOutput },
			{
				name: 'missing file parameter is not found',
				input: { file: undefined },
				output: emptyOutput
			}
		]
	);
});

test('Refuses a request that does not come from the loopback owner', async () => {
	const response = await GET(eventFor(stored, '203.0.113.7'));
	const output = await summary(response);
	expect(output.status).toBe(403);
	expect(Buffer.from(output.body, 'base64').toString('utf8')).toBe('Forbidden');
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'refuses-non-owner-request',
			evidence: 'examples-cases',
			file: 'refuses-non-owner-request.json'
		},
		[
			{
				name: 'non-loopback peer is forbidden even for a stored file',
				input: { file: stored, address: '203.0.113.7' },
				output
			}
		]
	);
});
