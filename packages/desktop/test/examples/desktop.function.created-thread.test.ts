import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createdThread } from '../../src/components/explorer-ui/entity-view/createdThread';
import { pending } from '../../src/utils/explorer-ui/createdThread';
import { rememberCreatedThread } from '../../src/utils/explorer-ui/project-agent-events/rememberCreatedThread';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte';
import type { EntityDetail } from '../../src/models/development-tooling/Desktop.types';

const made = { entityId: 'function.format-time', threadId: 'thread-1' };

function workspace(projectId = 'project-a') {
	return { context: { projectId } } as Workspace;
}

function entity(id = 'function.format-time', threadIds = ['thread-1', 'thread-2']) {
	return { id, threads: threadIds.map((threadId) => ({ id: threadId })) } as EntityDetail;
}

function recordCases(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'desktop.function.created-thread',
			symbol: 'createdThread',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('A saved thread is stored for its workspace project and entity and is consumed by one read', () => {
	const shown = workspace();
	rememberCreatedThread(shown, made);
	const stored = pending.get(shown);
	const first = createdThread(shown, entity());
	const second = createdThread(shown, entity());
	expect(stored).toEqual({ ...made, projectId: 'project-a' });
	expect(first?.id).toBe('thread-1');
	expect(second).toBeNull();
	recordCases('remembers-the-thread-for-one-selection', [
		{ name: 'stored selection after remember', input: made, output: stored },
		{ name: 'first read returns the listed thread', input: entity(), output: first },
		{ name: 'second read finds the consumed selection gone', input: entity(), output: second }
	]);
});

test('A null or empty thread ID leaves the current remembered entry unchanged', () => {
	const shown = workspace();
	rememberCreatedThread(shown, made);
	const beforeNull = pending.get(shown);
	rememberCreatedThread(shown, { entityId: 'function.other', threadId: null });
	const afterNull = pending.get(shown);
	rememberCreatedThread(shown, { entityId: 'function.other', threadId: '' });
	const afterEmpty = pending.get(shown);
	const read = createdThread(shown, entity());
	expect(afterNull).toEqual(beforeNull);
	expect(afterEmpty).toEqual(beforeNull);
	expect(read?.id).toBe('thread-1');
	recordCases('null-or-empty-thread-ids-keep-the-current-entry', [
		{ name: 'stored selection before null remember', input: null, output: beforeNull },
		{ name: 'stored selection after null remember', input: null, output: afterNull },
		{ name: 'stored selection after empty remember', input: '', output: afterEmpty },
		{ name: 'read keeps the earlier thread', input: entity(), output: read }
	]);
});

test('A changed project or entity returns null and still consumes the pending selection', () => {
	const shown = workspace();
	rememberCreatedThread(shown, made);
	(shown.context as { projectId: string }).projectId = 'project-b';
	const otherProject = createdThread(shown, entity());
	const afterProject = createdThread(shown, entity());
	(shown.context as { projectId: string }).projectId = 'project-a';
	rememberCreatedThread(shown, made);
	const otherEntity = createdThread(shown, entity('function.other'));
	const afterEntity = createdThread(shown, entity());
	expect(otherProject).toBeNull();
	expect(afterProject).toBeNull();
	expect(otherEntity).toBeNull();
	expect(afterEntity).toBeNull();
	recordCases('other-project-or-entity-consumes-the-selection', [
		{ name: 'read after project changed', input: 'project-b', output: otherProject },
		{ name: 'second read after project change', input: 'project-b', output: afterProject },
		{ name: 'read for a different entity', input: 'function.other', output: otherEntity },
		{ name: 'read for the original entity afterwards', input: entity().id, output: afterEntity }
	]);
});

test('A remembered thread missing from the entity returns null and still consumes the selection', () => {
	const shown = workspace();
	rememberCreatedThread(shown, made);
	const absent = createdThread(shown, entity('function.format-time', ['thread-2']));
	const afterAbsent = createdThread(shown, entity());
	expect(absent).toBeNull();
	expect(afterAbsent).toBeNull();
	recordCases('absent-thread-consumes-the-selection', [
		{
			name: 'read with only thread-2 listed',
			input: ['thread-2'],
			output: absent
		},
		{
			name: 'read with thread-1 listed afterwards',
			input: ['thread-1', 'thread-2'],
			output: afterAbsent
		}
	]);
});

test('Each Workspace instance keeps its own pending selection', () => {
	const first = workspace();
	const second = workspace();
	rememberCreatedThread(first, made);
	rememberCreatedThread(second, { entityId: 'function.format-time', threadId: 'thread-2' });
	const secondRead = createdThread(second, entity());
	const firstRead = createdThread(first, entity());
	expect(secondRead?.id).toBe('thread-2');
	expect(firstRead?.id).toBe('thread-1');
	recordCases('workspaces-keep-separate-selections', [
		{ name: 'second workspace read', input: 'thread-2 remembered', output: secondRead },
		{ name: 'first workspace read', input: 'thread-1 remembered', output: firstRead }
	]);
});

test('A workspace with no remembered selection reads null', () => {
	const shown = workspace();
	const read = createdThread(shown, entity());
	expect(read).toBeNull();
	recordCases('no-selection-returns-null', [
		{ name: 'read with nothing remembered', input: entity().id, output: read }
	]);
});
