import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import manifest from '../../../../test/fixtures/contract-migration/relay-read-json-body-examples.json' with {
	type: 'json'
};
import { readJsonBody } from '../../src/utils/readJsonBody';

const limit = 16 * 1024;

function post(body: BodyInit, type: string | null = 'application/json'): Request {
	const headers: Record<string, string> = type === null ? {} : { 'Content-Type': type };
	return new Request('https://relay.test/body', { method: 'POST', headers, body });
}

/** A JSON object of exactly `bytes` bytes. */
function sized(bytes: number): string {
	return JSON.stringify({ sealed: 'A'.repeat(bytes - '{"sealed":""}'.length) });
}

/** Rebuild JSON-authored request and byte markers into the original runtime inputs. */
function requestFromFixture(input: {
	body?: string;
	bytes?: number[];
	contentType?: string | null;
}): Request {
	const body = input.bytes ? new Uint8Array(input.bytes) : input.body;
	if (body !== undefined)
		return input.contentType === undefined ? post(body) : post(body, input.contentType);
	const headers =
		input.contentType === null ? {} : { 'Content-Type': input.contentType ?? 'application/json' };
	return new Request('https://relay.test/body', { method: 'POST', headers });
}

async function readRequestFixture(input: {
	body?: string;
	bytes?: number[];
	contentType?: string | null;
	typed?: boolean;
}) {
	const request = requestFromFixture(input);
	return input.typed === undefined
		? readJsonBody(request)
		: readJsonBody(request, input.typed);
}

async function readJsonObject(input: { body?: string; charsetBody?: string; charsetType?: string }) {
	const result = await readRequestFixture(input);
	expect(result).toEqual({ verifier: 'abc', n: 1 });
	const charsetResult = await readJsonBody(
		post(input.charsetBody ?? '{}', input.charsetType ?? 'application/json; charset=utf-8')
	);
	expect(charsetResult).toEqual({});
	return result;
}

async function readUnsupportedContentTypes(input: {
	body?: string;
	types?: Array<string | null>;
}) {
	// Keep every original public rejection and add the missing-header boundary to this matrix.
	const body = input.body ?? '{"a":1}';
	const types = input.types ?? [];
	const first = await readJsonBody(post(body, types[0] ?? null));
	expect(first).toBeUndefined();
	for (const type of types.slice(1))
		expect(await readJsonBody(post(body, type))).toBeUndefined();
	return first;
}

async function readInternalJson(input: { body?: string; contentType?: string | null; typed?: boolean }) {
	const result = await readRequestFixture(input);
	expect(result).toEqual({ a: 1 });
	return result;
}

async function readNonObjects(input: { bodies?: string[] }) {
	// The authored list retains every scalar, array, empty and malformed body from the original test.
	const bodies = input.bodies ?? [];
	const first = await readJsonBody(post(bodies[0] ?? ''));
	expect(first).toBeUndefined();
	for (const body of bodies.slice(1))
		expect(await readJsonBody(post(body)), body).toBeUndefined();
	return first;
}

async function readInvalidBytes(input: { bytes?: number[] }) {
	const result = await readRequestFixture(input);
	expect(result).toBeUndefined();
	return result;
}

async function readAtLimit(input: { limit?: number }) {
	const bytes = input.limit ?? limit;
	const body = sized(bytes);
	expect(body.length).toBe(bytes);
	const result = await readJsonBody(post(body));
	expect(result).toBeDefined();
	return result !== undefined;
}

async function readOverLimit(input: { limit?: number }) {
	const result = await readJsonBody(post(sized((input.limit ?? limit) + 1)));
	expect(result).toBeUndefined();
	return result;
}

async function readMissingBody(input: { contentType?: string | null }) {
	const result = await readRequestFixture(input);
	expect(result).toBeUndefined();
	return result;
}

function neverEndingRequest(chunkBytes: number) {
	let sent = 0;
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			sent += chunkBytes;
			controller.enqueue(new Uint8Array(chunkBytes).fill(0x20));
		}
	});
	const request = new Request('https://relay.test/body', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: stream,
		duplex: 'half'
	} as RequestInit);
	return { request, sent: () => sent };
}

async function readUnendingStream(input: { chunkBytes?: number }) {
	// Preserve the original workload: 1 KiB chunks continue until the bounded reader cancels.
	const { request, sent } = neverEndingRequest(input.chunkBytes ?? 1024);
	const result = await readJsonBody(request);
	expect(result).toBeUndefined();
	expect(sent()).toBeLessThanOrEqual(4 * limit);
	return result;
}

async function invokeReadJsonBody(...input: never[]) {
	const [fixture] = input as unknown as [{
		fixture: string;
		body?: string;
		bytes?: number[];
		contentType?: string | null;
		typed?: boolean;
		charsetBody?: string;
		charsetType?: string;
		types?: Array<string | null>;
		bodies?: string[];
		limit?: number;
		chunkBytes?: number;
	}];
	if (fixture.fixture === 'json-object') return readJsonObject(fixture);
	if (fixture.fixture === 'unsupported-content-types') return readUnsupportedContentTypes(fixture);
	if (fixture.fixture === 'internal-json') return readInternalJson(fixture);
	if (fixture.fixture === 'non-object-json') return readNonObjects(fixture);
	if (fixture.fixture === 'invalid-utf8') return readInvalidBytes(fixture);
	if (fixture.fixture === 'exact-limit') return readAtLimit(fixture);
	if (fixture.fixture === 'over-limit') return readOverLimit(fixture);
	if (fixture.fixture === 'missing-body') return readMissingBody(fixture);
	if (fixture.fixture === 'never-ending-stream') return readUnendingStream(fixture);
	throw new Error(`Unknown readJsonBody fixture: ${fixture.fixture}`);
}

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	readJsonBody: invokeReadJsonBody
});
