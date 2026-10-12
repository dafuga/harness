import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { artifactBehavior, artifactText, explorerArtifact } from '../../src/utils/explorerArtifact';
import { capture } from '../explorerFixture';

const body = JSON.stringify({
	scenario: 'Clock reads a value',
	environment: 'node (headless)',
	fixture: 'Synthetic clock values',
	steps: ['Start the service', 'Ask for 09:30'],
	input: { value: '09:30' },
	output: { value: '09:30' },
	assertions: [
		{ name: 'The value is returned', passed: true },
		{ title: 'Nothing else is written', status: 'failed' },
		'A plain statement'
	],
	trace: [{ at: 1, call: 'clock' }],
	runner: 'fixture'
});
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const recorded = (text: string, sha256 = hash(text)) =>
	capture({
		kind: 'output',
		evidence: 'output',
		sha256,
		mediaType: 'application/json',
		media: `media/${sha256}.json`
	});
const serving =
	(text: string, status = 200) =>
	() =>
		Promise.resolve(new Response(text, { status }));

test('an artifact is read from the media path and checked against its recorded hash', async () => {
	const asked: string[] = [];
	const fetcher = (address: string) => {
		asked.push(address);
		return serving(body)();
	};
	const read = await explorerArtifact(recorded(body), '/harness/media/', fetcher);
	expect(asked).toEqual([`/harness/media/${hash(body)}.json`]);
	expect(read).toMatchObject({ verified: true, problem: null, text: body });
	expect(read.behavior?.steps).toEqual(['Start the service', 'Ask for 09:30']);
});

test('bytes that do not have the recorded hash are shown as unverified, not trusted', async () => {
	const read = await explorerArtifact(recorded(body, 'f'.repeat(64)), '/m/', serving(body));
	expect(read).toMatchObject({ verified: false, behavior: null });
	expect(read.problem).toBe('The bytes that were read do not have the recorded SHA-256.');
});

test('an artifact that is not stored or cannot be read says so', async () => {
	const gone = await explorerArtifact(
		capture({ media: null, gap: 'not stored' }),
		'/m/',
		serving(body)
	);
	expect(gone).toMatchObject({ verified: false, text: '', problem: 'not stored' });
	const refused = await explorerArtifact(recorded(body), '/m/', serving('', 403));
	expect(refused).toMatchObject({
		verified: false,
		problem: 'The artifact could not be read (403).'
	});
});

test('text that is not JSON is kept as text and states no behaviour', async () => {
	const read = await explorerArtifact(recorded('plain output'), '/m/', serving('plain output'));
	expect(read).toMatchObject({
		verified: true,
		text: 'plain output',
		document: null,
		behavior: null
	});
});

test('what a run states is read from its own fields, and nothing is filled in', () => {
	expect(artifactBehavior(JSON.parse(body))).toEqual({
		scenario: 'Clock reads a value',
		environment: 'node (headless)',
		fixture: 'Synthetic clock values',
		steps: ['Start the service', 'Ask for 09:30'],
		input: { value: '09:30' },
		output: { value: '09:30' },
		assertions: [
			{ name: 'The value is returned', passed: true },
			{ name: 'Nothing else is written', passed: false },
			{ name: 'A plain statement', passed: null }
		],
		trace: [{ at: 1, call: 'clock' }],
		other: { runner: 'fixture' }
	});
	const bare = artifactBehavior({
		contract: 'impact-kernel/1',
		vectors: 39,
		request: { size: 3 },
		response: 7
	});
	expect(bare).toEqual({
		scenario: null,
		environment: null,
		fixture: null,
		steps: [],
		input: { size: 3 },
		output: 7,
		assertions: [],
		trace: [],
		other: { contract: 'impact-kernel/1', vectors: 39 }
	});
	expect('input' in (artifactBehavior({ vectors: 1 }) ?? {})).toBe(false);
	expect(artifactBehavior([1, 2])).toBeNull();
	expect(artifactBehavior('text')).toBeNull();
});

test('a structured step, request or assertion is kept as it was recorded, never flattened to text', () => {
	const run = artifactBehavior({
		steps: ['Open the page', { action: 'search', text: 'SERVICE' }],
		request: { method: 'GET', path: '/titles' },
		response: { status: 200, body: ['a'] },
		assertions: [{ name: 'Status is 200', passed: true, expected: 200, actual: 200 }]
	});
	expect(run?.steps).toEqual(['Open the page', { action: 'search', text: 'SERVICE' }]);
	expect(run?.input).toEqual({ method: 'GET', path: '/titles' });
	expect(run?.assertions).toEqual([
		{ name: 'Status is 200', passed: true, detail: { expected: 200, actual: 200 } }
	]);
	expect(artifactText('Open the page')).toBe('Open the page');
	expect(artifactText({ action: 'search', text: 'SERVICE' })).toBe(
		'{\n  "action": "search",\n  "text": "SERVICE"\n}'
	);
	expect(artifactText(run?.steps[1])).not.toContain('[object Object]');
	expect(artifactText(undefined)).toBe('Not recorded');
});
