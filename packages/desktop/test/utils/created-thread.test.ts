import { expect, test } from 'vitest';
import { createdThread, rememberCreatedThread } from '../../src/utils/createdThread';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import type { EntityDetail } from '../../src/models/Desktop.types';

const workspace = (projectId = 'project-a') => ({ context: { projectId } }) as Workspace;
const entity = (id = 'function.format-time') =>
	({ id, threads: [{ id: 'thread-1' }] }) as EntityDetail;
const made = { entityId: 'function.format-time', threadId: 'thread-1' };

test('the saved request thread is selected once without changing a route', () => {
	const shown = workspace();
	rememberCreatedThread(shown, made);
	expect(createdThread(shown, entity())?.id).toBe('thread-1');
	expect(createdThread(shown, entity())).toBeNull();
});

test('the same thread ID in another project or entity is not selected', () => {
	const shown = workspace();
	rememberCreatedThread(shown, made);
	(shown.context as { projectId: string }).projectId = 'project-b';
	expect(createdThread(shown, entity())).toBeNull();
	rememberCreatedThread(shown, made);
	expect(createdThread(shown, entity('function.other'))).toBeNull();
});

test('a partial plan without a saved thread makes no thread selection', () => {
	const shown = workspace();
	rememberCreatedThread(shown, { ...made, threadId: null });
	expect(createdThread(shown, entity())).toBeNull();
});
