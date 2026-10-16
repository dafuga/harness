import { afterEach, expect, test, vi } from 'vitest';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import { forgetRemote } from '../../src/utils/forgetRemote';
import { closedCapabilities } from '../../src/utils/projectCapabilities';

function shown() {
	return {
		invalidate: vi.fn(),
		projects: [{ id: 'local-1', name: 'One', kind: 'local' }],
		snapshot: { project: { id: 'local-1' } },
		entity: { id: 'page:activity' },
		offline: { cachedAt: null },
		capabilities: { ...closedCapabilities, agents: true },
		selection: { id: 'local-1' as string | null },
		target: 'local-1',
		error: ''
	};
}
afterEach(() => vi.unstubAllGlobals());

test('nothing of the computer stays on the page or in its address', () => {
	const replaceState = vi.fn();
	vi.stubGlobal('location', { pathname: '/projects/local-1/harness/pages' });
	vi.stubGlobal('history', { replaceState });
	const workspace = shown();
	forgetRemote(workspace as unknown as Workspace, 'gone');
	expect(workspace.invalidate).toHaveBeenCalledOnce();
	expect(workspace).toMatchObject({
		projects: [],
		snapshot: null,
		entity: null,
		offline: null,
		capabilities: closedCapabilities,
		selection: { id: null },
		target: null,
		error: 'gone'
	});
	expect(replaceState).toHaveBeenCalledWith({}, '', '/');
});

test('the start address is left alone, and a page without a location is not an error', () => {
	const replaceState = vi.fn();
	vi.stubGlobal('location', { pathname: '/' });
	vi.stubGlobal('history', { replaceState });
	forgetRemote(shown() as unknown as Workspace);
	expect(replaceState).not.toHaveBeenCalled();
	vi.unstubAllGlobals();
	expect(() => forgetRemote(shown() as unknown as Workspace)).not.toThrow();
});
