import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import NavBar from '../src/components/NavBar.svelte';
import { createWorkspaceStore } from '../src/lib/stores/workspace.svelte';
import type { ProjectSnapshot } from '../src/models/Desktop.types';

/**
 * The top bar of every project page holds one search over the shown project and revision. It
 * says which commit it searches when a commit is pinned, so the tip is never searched in its place.
 */
const [tip, earlier] = ['a'.repeat(40), 'c'.repeat(40)];
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
const field = (html: string) => /<input\b[^>]*role="combobox"[^>]*>/s.exec(html)?.[0] ?? '';

test('the top bar holds one search field labelled for entities, as a combobox of a listbox', () => {
	const html = bar(tip);
	expect(html.match(/role="combobox"/g)).toHaveLength(1);
	expect(field(html)).toMatch(/aria-label="Search entities"/);
	expect(field(html)).toMatch(/aria-expanded="false"/);
	expect(field(html)).toMatch(/aria-controls="[^"]+"/);
	expect(field(html)).toMatch(/placeholder="Search entities"/);
});

test('at a pinned commit the field says the commit it searches', () => {
	expect(field(bar(earlier))).toMatch(/placeholder="Search at ccccccc"/);
});
