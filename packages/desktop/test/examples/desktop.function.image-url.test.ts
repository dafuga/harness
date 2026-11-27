import { afterEach, beforeEach, test, vi, type Mock } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { imageUrl } from '../../src/utils/reports-media/imageUrl';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte';
import type { Applied } from './desktop.function.image-url.test.types';

const request = { entityId: 'design-image-42', version: 'v3', sha256: 'ba7816bf'.padEnd(64, '0') };
const commit = 'a'.repeat(40);
const context = { projectId: 'project-7' };
const PNG_BYTES = new Uint8Array([137, 80, 78, 71]);

/** Lets the bridge promise and Svelte tick settle; expectations stay outside retry loops. */
const settle = () => new Promise((done) => setTimeout(done, 5));

function workspaceOf(image: (input: object) => Promise<Uint8Array>): Workspace {
	return {
		bridge: { image },
		snapshot: { revision: { commit } },
		context
	} as unknown as Workspace;
}

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'desktop.function.image-url',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

let createObjectURL: Mock;
let revokeObjectURL: Mock;

beforeEach(() => {
	createObjectURL = vi.fn((_blob: Blob) => 'blob:example-1');
	revokeObjectURL = vi.fn((_url: string) => {});
	vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);
});

afterEach(() => {
	vi.restoreAllMocks();
});

test('Reads the shown image into a PNG object URL and revokes it after release', async () => {
	const image = vi.fn(async (_input: object) => PNG_BYTES);
	const seen: Applied[] = [];
	const release = imageUrl(workspaceOf(image), request, (url, error) => seen.push([url, error]));
	const initial = seen[0];
	await settle();
	expect(seen).toHaveLength(2);
	expect(image).toHaveBeenCalledWith({ ...request, commit, ...context });
	const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
	expect(blob.type).toBe('image/png');
	expect(blob.size).toBe(PNG_BYTES.length);
	release();
	await settle();
	expect(revokeObjectURL).toHaveBeenCalledWith('blob:example-1');
	recordCases('imageUrl', 'reads-shown-image-to-png-url', [
		{ name: 'initial callback before read', input: { request }, output: initial },
		{
			name: 'bridge image request with commit and context',
			input: { request, commit, context },
			output: image.mock.calls[0]?.[0]
		},
		{
			name: 'PNG object URL after read',
			input: { byteLength: PNG_BYTES.length, type: blob.type },
			output: seen[1]
		},
		{
			name: 'revoked after release',
			input: { release: true },
			output: revokeObjectURL.mock.calls[0]?.[0]
		}
	]);
});

test('Passes request fields to the bridge without validating them', async () => {
	const image = vi.fn(async (_input: object) => PNG_BYTES);
	const odd = { entityId: '', version: 'not-a-version', sha256: 'XYZ' };
	imageUrl(workspaceOf(image), odd, () => {});
	expect(image).toHaveBeenCalledWith({ ...odd, commit, ...context });
	recordCases('imageUrl', 'passes-request-fields-unvalidated', [
		{
			name: 'unvalidated request fields reach the bridge',
			input: odd,
			output: image.mock.calls[0]?.[0]
		}
	]);
});

test('Skips the read when the request, bridge or commit is missing', () => {
	const image = vi.fn(async (_input: object) => PNG_BYTES);
	const cases: Parameters<typeof recordCases>[2] = [];
	const variants: Array<[string, Workspace, typeof request | null]> = [
		['null request', workspaceOf(image), null],
		[
			'no bridge',
			{ bridge: undefined, snapshot: { revision: { commit } }, context } as unknown as Workspace,
			request
		],
		[
			'no snapshot',
			{ bridge: { image }, snapshot: undefined, context } as unknown as Workspace,
			request
		],
		[
			'empty commit',
			{
				bridge: { image },
				snapshot: { revision: { commit: '' } },
				context
			} as unknown as Workspace,
			request
		]
	];
	for (const [name, workspace, input] of variants) {
		const seen: Applied[] = [];
		imageUrl(workspace, input, (url, error) => seen.push([url, error]));
		cases.push({ name, input: { request: input }, output: seen });
	}
	expect(image).not.toHaveBeenCalled();
	recordCases('imageUrl', 'skips-read-without-request-bridge-or-commit', cases);
});

test('Reports a failed read as String of its cause and creates no URL', async () => {
	const failing = vi.fn(async (_input: object): Promise<Uint8Array> => {
		throw new Error('Missing image');
	});
	const rejectedText = vi.fn(async (_input: object): Promise<Uint8Array> => {
		throw 'denied';
	});
	const errors: Applied[] = [];
	imageUrl(workspaceOf(failing), request, (url, error) => errors.push([url, error]));
	await settle();
	expect(errors).toHaveLength(2);
	const textual: Applied[] = [];
	imageUrl(workspaceOf(rejectedText), request, (url, error) => textual.push([url, error]));
	await settle();
	expect(textual).toHaveLength(2);
	expect(createObjectURL).not.toHaveBeenCalled();
	recordCases('imageUrl', 'reports-bridge-failure-reason', [
		{ name: 'Error cause', input: { cause: 'Error: Missing image' }, output: errors[1] },
		{ name: 'string cause', input: { cause: 'denied' }, output: textual[1] }
	]);
});

test('Drops a read that settles after release and creates no URL', async () => {
	let deliver: (bytes: Uint8Array) => void = () => {};
	const image = vi.fn((_input: object) => new Promise<Uint8Array>((done) => (deliver = done)));
	const seen: Applied[] = [];
	const release = imageUrl(workspaceOf(image), request, (url, error) => seen.push([url, error]));
	release();
	deliver(PNG_BYTES);
	await new Promise((done) => setTimeout(done, 5));
	expect(seen).toEqual([['', '']]);
	expect(createObjectURL).not.toHaveBeenCalled();
	expect(revokeObjectURL).not.toHaveBeenCalled();
	recordCases('imageUrl', 'drops-read-settled-after-release', [
		{ name: 'callbacks after release', input: { release: true }, output: seen },
		{ name: 'bridge image requests sent', input: { request }, output: image.mock.calls.length },
		{
			name: 'object URLs created',
			input: { settled: true },
			output: createObjectURL.mock.calls.length
		}
	]);
});
