import { expect, test } from 'vitest';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';
import { evidenceQuery } from '../../src/utils/evidenceQuery';

const tip = 'a'.repeat(40);
const older = 'b'.repeat(40);
const snapshot = (commit = tip) =>
	({ revision: { branch: 'feat/x', commit, tip, atTip: commit === tip } }) as ProjectSnapshot;

test('a branch tip is asked for alone; a named commit is compared, also when it is the tip', () => {
	const shown = { snapshot: snapshot(), pinned: false, context: { projectId: 'p' } };
	expect(evidenceQuery(shown, 'page:a')).toEqual({
		entityId: 'page:a',
		commit: tip,
		branch: 'feat/x',
		mode: 'current',
		projectId: 'p'
	});
	const named = evidenceQuery({ ...shown, pinned: true, context: {} }, 'page:a');
	expect(named).toEqual({ entityId: 'page:a', commit: tip, branch: 'feat/x', mode: 'commit' });
	const earlier = { snapshot: snapshot(older), pinned: true, context: {} };
	expect(evidenceQuery(earlier, 'page:a')).toMatchObject({ commit: older, mode: 'commit' });
});

test('nothing is asked while no project is shown', () => {
	expect(evidenceQuery({ snapshot: null, pinned: false, context: {} }, 'page:a')).toBeNull();
});
