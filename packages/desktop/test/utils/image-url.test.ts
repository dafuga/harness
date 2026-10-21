import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import { imageUrl } from '../../src/utils/imageUrl';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';

const request = { entityId: 'page:a', version: 'v002', sha256: 'b'.repeat(64) };
const commit = 'a'.repeat(40);
function workspaceOf(image: (input: object) => Promise<Uint8Array>, projectId?: string) {
	return {
		bridge: { image },
		snapshot: { revision: { commit } },
		context: projectId ? { projectId } : {}
	} as unknown as Workspace;
}
let revoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
	revoke = vi.fn();
	vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:one'), revokeObjectURL: revoke });
});
afterEach(() => vi.unstubAllGlobals());

test('an image is read for the shown project and commit and released afterwards', () =>
	measureWorkload('desktop.function.image-url', 'bound-image-lifetime', async () => {
		const image = vi.fn(async () => new Uint8Array([1, 2, 3]));
		const seen: string[] = [];
		const release = imageUrl(workspaceOf(image, 'p'), request, (url) => seen.push(url));
		await vi.waitFor(() => expect(seen).toEqual(['', 'blob:one']));
		expect(image).toHaveBeenCalledWith({ ...request, commit, projectId: 'p' });
		release();
		expect(seen.at(-1)).toBe('');
		expect(revoke).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:one'));
	}));

test('a bridge without project identities is asked without one', async () => {
	const image = vi.fn(async () => new Uint8Array());
	imageUrl(workspaceOf(image), request, () => {});
	expect(image).toHaveBeenCalledWith({ ...request, commit });
});

test('an image that arrives after its view is gone is never shown', async () => {
	let deliver = (_bytes: Uint8Array) => {};
	const image = vi.fn(() => new Promise<Uint8Array>((done) => (deliver = done)));
	const seen: string[] = [];
	const release = imageUrl(workspaceOf(image, 'p'), request, (url) => seen.push(url));
	release();
	deliver(new Uint8Array([1]));
	await new Promise((done) => setTimeout(done, 5));
	expect(seen).toEqual(['']);
	expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('a failed read reports its reason and nothing is requested without an image', async () => {
	const failing = vi.fn(async () => {
		throw new Error('Missing image');
	});
	const errors: string[] = [];
	imageUrl(workspaceOf(failing, 'p'), request, (_url, error) => errors.push(error));
	await vi.waitFor(() => expect(errors.at(-1)).toMatch(/Missing image/));
	imageUrl(workspaceOf(failing, 'p'), null, () => {});
	expect(failing).toHaveBeenCalledTimes(1);
});
