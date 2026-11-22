import { createHash } from 'node:crypto';
import { test } from 'vitest';
import {
	artifactBehavior,
	explorerArtifact
} from '../../src/utils/explorer-reading/explorerArtifact';
import { artifactText } from '../../src/utils/explorer-ui/explorerArtifact';
import { commits } from '../entityUnits';
import { capture } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const base = '/harness/media/';
const payload = JSON.stringify({
	scenario: 'Clock reads a value',
	steps: ['Start the service'],
	input: { value: '09:30' },
	output: { value: '09:30' },
	assertions: [{ name: 'The value is returned', passed: true }]
});
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

/** A JSON capture from the scoped fixture commit, stored under the hash it must have. */
const stored = (text: string, sha256 = hash(text)) =>
	capture({
		kind: 'output',
		evidence: 'output',
		sha256,
		media: `media/${sha256}.json`,
		server: { buildId: 'build-1', revision: commits.middle }
	});

/** A fetcher that serves one response and records every address it was asked for. */
function serving(text: string, status = 200) {
	const asked: string[] = [];
	const fetcher = (address: string) => {
		asked.push(address);
		return Promise.resolve(new Response(text, { status }));
	};
	return { asked, fetcher };
}

/** The name of the error a call throws, so a recorded case states what was actually raised. */
function thrownName(run: () => unknown): string {
	try {
		run();
		return 'nothing thrown';
	} catch (error) {
		return error instanceof Error ? error.name : String(error);
	}
}

/** Records one named symbol's cases as a trace of their inputs and results. */
function traceCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
): boolean {
	const meta = { unitId: 'reports.function.explorer-artifact', symbol, state };
	return recordExampleCases({ ...meta, evidence: 'examples-cases', file: `${state}.json` }, cases);
}

test('an artifact is read from its stored media file named by the recorded hash, under the protected base', async () => {
	const item = stored(payload);
	const { asked, fetcher } = serving(payload);
	const artifact = await explorerArtifact(item, base, fetcher);
	expect(asked).toEqual([`${base}${hash(payload)}.json`]);
	expect(artifact).toMatchObject({ verified: true, problem: null, text: payload });
	traceCases('explorerArtifact', 'explorer-artifact-reads-stored-media-by-hash', [
		{
			name: 'stored media is fetched by its hash name',
			input: { media: item.media, sha256: item.sha256, mediaBase: base },
			output: { address: asked[0], artifact }
		}
	]);
});

test('the media base is joined to the file name exactly as given, with no separator inserted', async () => {
	const { asked, fetcher } = serving(payload);
	const artifact = await explorerArtifact(stored(payload), '/harness/media', fetcher);
	expect(asked).toEqual([`/harness/media${hash(payload)}.json`]);
	traceCases('explorerArtifact', 'explorer-artifact-joins-base-without-separator', [
		{
			name: 'base without a trailing slash',
			input: { mediaBase: '/harness/media' },
			output: { address: asked[0], verified: artifact.verified }
		}
	]);
});

test('bytes that do not match the recorded hash stay text, are not parsed and are not trusted', async () => {
	const wrong = 'f'.repeat(64);
	const artifact = await explorerArtifact(stored(payload, wrong), base, serving(payload).fetcher);
	expect(artifact).toMatchObject({ verified: false, document: null, behavior: null });
	expect(artifact.text).toBe(payload);
	expect(artifact.problem).toBe('The bytes that were read do not have the recorded SHA-256.');
	traceCases('explorerArtifact', 'explorer-artifact-hash-mismatch-stays-text', [
		{ name: 'recorded hash differs from the bytes', input: { sha256: wrong }, output: artifact }
	]);
});

test('a response that is not OK resolves unverified with its status and reads no text', async () => {
	const artifact = await explorerArtifact(stored(payload), base, serving('', 404).fetcher);
	expect(artifact).toMatchObject({ verified: false, text: '', document: null, behavior: null });
	expect(artifact.problem).toBe('The artifact could not be read (404).');
	traceCases('explorerArtifact', 'explorer-artifact-http-error-unverified', [
		{ name: 'a 404 response is unverified', input: { status: 404 }, output: artifact }
	]);
});

test('an absent capture says why it is absent and never fetches', async () => {
	const { asked, fetcher } = serving(payload);
	const gapped = capture({ media: null, gap: 'Not stored by this build' });
	const gap = await explorerArtifact(gapped, base, fetcher);
	const bare = await explorerArtifact(capture({ media: null }), base, fetcher);
	expect(asked).toEqual([]);
	expect(gap).toMatchObject({ verified: false, text: '', problem: gapped.gap });
	expect(bare.problem).toBe('The artifact is not stored.');
	traceCases('explorerArtifact', 'explorer-artifact-absent-capture-gap-or-default', [
		{ name: 'gap text is the reason', input: { media: null, gap: gapped.gap }, output: gap },
		{ name: 'no gap gives the default reason', input: { media: null }, output: bare }
	]);
});

test('a rejection from the supplied fetcher reaches the caller unchanged', async () => {
	const failure = new TypeError('connection refused');
	const fetcher = () => Promise.reject(failure);
	await expect(explorerArtifact(stored(payload), base, fetcher)).rejects.toBe(failure);
	traceCases('explorerArtifact', 'explorer-artifact-fetcher-rejection-propagates', [
		{ name: 'fetcher rejection is rethrown', input: 'a fetcher that rejects', error: failure.name }
	]);
});

test('object, array, number and text payloads are read as their own types', async () => {
	const bodies = { object: payload, array: '[1,2]', number: '42', text: 'plain output' };
	const read = (text: string) => explorerArtifact(stored(text), base, serving(text).fetcher);
	const object = await read(bodies.object);
	const list = await read(bodies.array);
	const number = await read(bodies.number);
	const plain = await read(bodies.text);
	expect(object.behavior?.steps).toEqual(['Start the service']);
	expect(list).toMatchObject({ verified: true, document: [1, 2], behavior: null });
	expect(number).toMatchObject({ verified: true, document: 42, behavior: null });
	expect(plain).toMatchObject({ verified: true, text: 'plain output', document: null });
	traceCases('explorerArtifact', 'explorer-artifact-payload-types', [
		{ name: 'object payload gives behavior', input: { body: bodies.object }, output: object },
		{ name: 'array payload gives no behavior', input: { body: bodies.array }, output: list },
		{ name: 'number payload gives no behavior', input: { body: bodies.number }, output: number },
		{ name: 'text payload is kept as text', input: { body: bodies.text }, output: plain }
	]);
});

test('a run takes its request and answer from the first of their names that is present', () => {
	const preferred = artifactBehavior({
		request: { size: 3 },
		inputs: { size: 4 },
		actual: 8,
		response: 7
	});
	const present = artifactBehavior({ input: undefined, request: { size: 3 } });
	expect(preferred).toMatchObject({ input: { size: 4 }, output: 7 });
	expect(present && 'input' in present).toBe(true);
	traceCases('artifactBehavior', 'artifact-behavior-first-request-and-response-name', [
		{
			name: 'inputs wins over request, response over actual',
			input: { request: { size: 3 }, inputs: { size: 4 }, actual: 8, response: 7 },
			output: preferred
		},
		{
			name: 'a present input key wins even when empty',
			input: 'input undefined, request set',
			output: present
		}
	]);
});

test('documents that are null, arrays or primitives give no behavior', () => {
	const documents = [null, [1, 2], 42, 'text'];
	const found = documents.map((document) => artifactBehavior(document));
	expect(found).toEqual([null, null, null, null]);
	traceCases(
		'artifactBehavior',
		'artifact-behavior-non-object-documents-null',
		documents.map((document, index) => ({
			name: `document ${index + 1} gives no behavior`,
			input: document,
			output: found[index]
		}))
	);
});

test('artifact text passes strings through, names missing values, indents structures and throws for cycles and BigInt', () => {
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	const structured = { action: 'search', text: 'SERVICE' };
	const found = {
		text: artifactText('Open the page'),
		missing: artifactText(undefined),
		structured: artifactText(structured),
		cyclic: thrownName(() => artifactText(cyclic)),
		bigint: thrownName(() => artifactText(BigInt(1)))
	};
	expect(found).toEqual({
		text: 'Open the page',
		missing: 'Not recorded',
		structured: '{\n  "action": "search",\n  "text": "SERVICE"\n}',
		cyclic: 'TypeError',
		bigint: 'TypeError'
	});
	traceCases('artifactText', 'artifact-text-display-and-thrown-type-error', [
		{ name: 'a string is unchanged', input: 'Open the page', output: found.text },
		{ name: 'undefined reads as not recorded', input: 'undefined value', output: found.missing },
		{ name: 'a structure is indented JSON', input: structured, output: found.structured },
		{ name: 'a cycle throws a TypeError', input: 'cyclic object', error: found.cyclic },
		{ name: 'a BigInt throws a TypeError', input: 'BigInt value', error: found.bigint }
	]);
});
