import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import NavBar from '../src/components/NavBar.svelte';
import { createWorkspaceStore } from '../src/lib/stores/workspace.svelte';
import type { ProjectSnapshot } from '../src/models/Desktop.types';

/**
 * The top bar of every project page holds one search over the shown project and revision. It
 * says which commit it searches when a commit is pinned, so the tip is never searched in its place.
 */
const tip = 'a'.repeat(40);
function bar(commit: string) {
	const workspace = createWorkspaceStore();
	workspace.snapshot = {
		project: { name: 'Alpha', root: '/alpha', id: 'local-alpha' },
		revision: { branch: 'feat/alpha', commit, tip, atTip: commit === tip },
		...{ branches: [], commits: [], entities: [], writable: commit === tip }
	} as ProjectSnapshot;
	workspace.pinned = commit !== tip;
	return render(NavBar, { props: { workspace } }).body.replace(/<!--.*?-->/gs, '');
}
test('the shared workspace exposes search as one icon with a modal, never an inline field', () => {
	const html = bar(tip);
	expect(html).toMatch(/aria-label="Search entities"/);
	expect(html).toMatch(/aria-haspopup="dialog"/);
	expect(html).not.toMatch(/role="combobox"|<input\b/);
});
