import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import type { CatalogEntity, ProjectSnapshot } from '../../src/models/Desktop.types';
import { workspaceSearch } from '../../src/components/nav-bar/workspaceSearch';
import { explorerName } from '../../../reports/src/utils/explorerName';
import { measureWorkload } from '../../../../test/support/measureWorkload';

/**
 * The search of the top bar holds the entities of exactly the shown project and revision, each at
 * the commit it was read at, and nothing while another project or revision is being read. A result
 * opens only from the entries that listed it, in their own project, branch and commit.
 */
const [tip, earlier] = ['a'.repeat(40), 'c'.repeat(40)];
const frame = {
	...{ id: 'app.shell.order-frame', category: 'shells', kind: 'shell', title: 'Order frame' },
	...{ summary: 'Frames the order pages.', changed: false, planned: false, hasPlan: false },
	...{ lifecycle: null, verification: 'unverified', verificationNote: '', latestVersion: null },
	...{ approvedVersion: null, threadCount: 0, thumbnail: null }
} as CatalogEntity;
const snapshot = (commit: string, id = 'local-alpha') =>
	({
		project: { name: 'Alpha', root: '/alpha', id },
		revision: { branch: 'feat/alpha', commit, tip, atTip: commit === tip },
		...{ branches: [], commits: [], entities: [frame], writable: commit === tip }
	}) as ProjectSnapshot;
const read = (commit: string, pinned = false, id?: string) =>
	workspaceSearch({ snapshot: snapshot(commit, id), pinned, busy: false });
const alpha = '/projects/local-alpha/harness/branch/feat%2Falpha';

test('at the tip every entity is an entry of that commit, with its display name and purpose', () => {
	const search = read(tip);
	expect(search.entries).toEqual([
		{
			...{ id: 'app.shell.order-frame', category: 'shells', name: explorerName(frame) },
			...{ purpose: 'Frames the order pages.', terms: [], commit: tip }
		}
	]);
	expect(search.scope).toEqual({ label: 'Alpha at the tip of feat/alpha', pinned: null });
});

test('at a pinned commit the scope names the commit, and each entry carries the full commit', () => {
	const search = read(earlier, true);
	expect(search.scope).toEqual({ label: 'Alpha at commit ccccccc', pinned: 'ccccccc' });
	expect(search.entries?.map((item) => item.commit)).toEqual([earlier]);
});

test('while a project or revision is read, nothing of the one shown before is offered', () => {
	for (const shown of [
		{ snapshot: snapshot(tip), pinned: false, busy: true },
		{ snapshot: null, pinned: false, busy: false }
	]) {
		const search = workspaceSearch(shown);
		expect([search.entries, search.scope]).toEqual([
			null,
			{ label: 'Reading the project', pinned: null }
		]);
	}
});

test('a listed result opens in the project, branch and commit it was read at', () =>
	measureWorkload('desktop.function.workspace-search', 'workspace-result-routing', () => {
		const atTip = read(tip);
		expect(atTip.at(atTip.entries![0])).toBe(`${alpha}/shells/app.shell.order-frame`);
		const pinned = read(earlier, true);
		expect(pinned.at(pinned.entries![0])).toBe(
			`${alpha}/commit/${earlier}/shells/app.shell.order-frame`
		);
	}));

test('a result the shown entries did not list is refused, also one equal to a listed result', () => {
	const before = read(tip);
	const now = read(earlier, true);
	expect(now.at(before.entries![0])).toBeNull();
	expect(now.at({ ...now.entries![0] })).toBeNull();
	expect(read(tip, false, 'local-beta').at(before.entries![0])).toBeNull();
	const loading = workspaceSearch({ snapshot: snapshot(tip), pinned: false, busy: true });
	expect(loading.at(before.entries![0])).toBeNull();
	const listed = now.entries![0];
	listed.category = 'platforms';
	expect(now.at(listed)).toBeNull();
});
